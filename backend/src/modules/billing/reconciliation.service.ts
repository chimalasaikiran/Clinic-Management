import { randomUUID } from 'node:crypto'
import { Injectable } from '@nestjs/common'
import { AuditService } from '../../common/audit/audit.service'
import { AppError, conflict, notFound, unprocessable } from '../../common/errors/app-error'
import type { AccessContext, ClientInfo } from '../../common/utils/request'
import { PrismaService, Tx } from '../../database/prisma.service'
import type { ImportStatementInput } from './billing.schemas'
import { FinanceSupport } from './finance.support'
import { rupees, toPaise } from './money'
import { matchLine, parseStatement, PaymentForMatching } from './reconciliation.logic'

// Statement import and the exceptions it raises. Reconciliation never changes a payment: it records how each
// statement line relates to one, and how every difference was explained.
@Injectable()
export class ReconciliationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly support: FinanceSupport,
    private readonly audit: AuditService,
  ) {}

  async importStatement(access: AccessContext, actorUserId: string, input: ImportStatementInput, client: ClientInfo) {
    const parsed = parseStatement(input.csv)
    // All or nothing: a file with a bad row is refused whole, so a statement is never half imported.
    if (parsed.errors.length) {
      throw new AppError(422, 'STATEMENT_INVALID', `The statement has ${parsed.errors.length} row${parsed.errors.length === 1 ? '' : 's'} that could not be read.`, parsed.errors.slice(0, 50).map((entry) => ({ field: `row ${entry.row}`, issue: entry.issue })))
    }
    if (!parsed.lines.length) throw unprocessable('STATEMENT_EMPTY', 'The statement has no transaction rows.')

    const existing = new Set(
      (await this.prisma.statementLine.findMany({ where: { orgId: access.orgId, source: input.source, sourceReference: { in: parsed.lines.map((line) => line.reference) } }, select: { sourceReference: true } })).map((row) => row.sourceReference),
    )
    const fresh = parsed.lines.filter((line) => !existing.has(line.reference))
    const payments = await this.matchingPayments(access.orgId)

    // Matching runs in memory, line by line, so a payment claimed by one line is not offered to the next.
    const outcomes = fresh.map((line) => {
      const outcome = matchLine(line, payments)
      if (outcome.paymentId && outcome.state !== 'exception') payments.find((payment) => payment.id === outcome.paymentId)!.matched = true
      return { line, outcome, id: randomUUID() }
    })
    const counts = { matched: 0, candidate: 0, exception: 0 }
    for (const { outcome } of outcomes) counts[outcome.state] += 1

    // A handful of bulk statements, so a long statement stays well inside the transaction time limit.
    return this.prisma.transaction(async (tx) => {
      const reference = await this.support.reference(tx, access.orgId, 'statement_import_reference', 'IMP-')
      const batch = await tx.statementImport.create({ data: { orgId: access.orgId, reference, source: input.source, fileName: input.fileName, lineCount: fresh.length, importedById: actorUserId }, select: { id: true } })
      if (outcomes.length) {
        await tx.statementLine.createMany({
          data: outcomes.map(({ id, line, outcome }) => ({
            id, orgId: access.orgId, importId: batch.id, source: input.source, sourceReference: line.reference, txnDate: new Date(`${line.date}T00:00:00Z`), txnTime: line.time,
            amount: rupees(line.amount), narration: line.narration, paymentId: outcome.paymentId, state: outcome.state,
          })),
        })
      }
      const exceptions = outcomes.flatMap(({ id, outcome }) => (outcome.state === 'exception' ? [{ lineId: id, kind: outcome.kind, reason: outcome.reason }] : []))
      const numbers = await this.support.references(tx, access.orgId, 'recon_exception_reference', 'EXC-', exceptions.length)
      if (exceptions.length) {
        const rows = exceptions.map((entry, index) => ({ ...entry, id: randomUUID(), orgId: access.orgId, reference: numbers[index]! }))
        await tx.reconException.createMany({ data: rows })
        await tx.financeEvent.createMany({ data: rows.map((row) => ({ orgId: access.orgId, entityType: 'exception', entityId: row.id, action: 'Exception created · Open', note: `${row.kind} · ${reference} · ${input.source}`, actorId: null })) })
      }
      await this.audit.record({ action: 'billing.statement.imported', entityType: 'statement_import', entityId: batch.id, orgId: access.orgId, actorUserId, details: { reference, source: input.source, lines: fresh.length, skipped: existing.size, ...counts } }, client, tx)
      return { id: batch.id, reference, imported: fresh.length, skipped: existing.size, ...counts }
    })
  }

  // A candidate (same amount and day, no reference) is only a match once a person confirms it.
  async confirmCandidate(access: AccessContext, lineId: string, actorUserId: string, note: string, client: ClientInfo) {
    await this.prisma.transaction(async (tx) => {
      const updated = await tx.statementLine.updateMany({ where: { id: lineId, orgId: access.orgId, state: 'candidate' }, data: { state: 'matched' } })
      if (updated.count === 0) throw conflict('LINE_STATE_CHANGED', 'This statement line is no longer awaiting review.')
      await this.audit.record({ action: 'billing.statement.candidate_confirmed', entityType: 'statement_line', entityId: lineId, orgId: access.orgId, actorUserId, details: { note } }, client, tx)
    })
  }

  async rejectCandidate(access: AccessContext, lineId: string, actorUserId: string, note: string, client: ClientInfo) {
    await this.prisma.transaction(async (tx) => {
      const updated = await tx.statementLine.updateMany({ where: { id: lineId, orgId: access.orgId, state: 'candidate' }, data: { state: 'exception', paymentId: null } })
      if (updated.count === 0) throw conflict('LINE_STATE_CHANGED', 'This statement line is no longer awaiting review.')
      const batch = await tx.statementLine.findUniqueOrThrow({ where: { id: lineId }, select: { source: true, import: { select: { reference: true } } } })
      const id = await this.raise(tx, access.orgId, lineId, 'Missing ClinicOS record', 'The suggested payment was rejected on review. Identify the payment this line belongs to before resolving.', `${batch.import.reference} · ${batch.source}`)
      await this.support.event(tx, access.orgId, 'exception', id, 'Candidate match rejected', actorUserId, note)
      await this.audit.record({ action: 'billing.statement.candidate_rejected', entityType: 'statement_line', entityId: lineId, orgId: access.orgId, actorUserId, details: { note } }, client, tx)
    })
  }

  async startReview(access: AccessContext, id: string, actorUserId: string, version: number, client: ClientInfo) {
    await this.change(access, id, actorUserId, version, ['open'], { status: 'in_review', ownerId: actorUserId }, 'Review started · In review', '', client)
  }

  async recordEvidence(access: AccessContext, id: string, actorUserId: string, input: { evidence: string; version: number }, client: ClientInfo) {
    await this.change(access, id, actorUserId, input.version, ['open', 'in_review'], { evidence: input.evidence }, 'Evidence recorded', input.evidence, client)
  }

  async resolve(access: AccessContext, id: string, actorUserId: string, input: { resolutionType: string; note: string; evidence: string; version: number }, client: ClientInfo) {
    await this.prisma.transaction(async (tx) => {
      const exception = await this.changeIn(tx, access, id, actorUserId, input.version, ['open', 'in_review'], {
        status: 'resolved', evidence: input.evidence, resolutionType: input.resolutionType, resolutionNote: input.note, resolvedAt: new Date(), ownerId: actorUserId,
      }, 'Exception resolved', `${input.resolutionType} · ${input.note}`, client)
      await tx.statementLine.update({ where: { id: exception.lineId }, data: { state: 'resolved' } })
    })
  }

  private async change(access: AccessContext, id: string, actorUserId: string, version: number, from: Array<'open' | 'in_review'>, data: object, action: string, note: string, client: ClientInfo) {
    await this.prisma.transaction((tx) => this.changeIn(tx, access, id, actorUserId, version, from, data, action, note, client))
  }

  private async changeIn(tx: Tx, access: AccessContext, id: string, actorUserId: string, version: number, from: Array<'open' | 'in_review'>, data: object, action: string, note: string, client: ClientInfo) {
    const exception = await tx.reconException.findFirst({ where: { id, orgId: access.orgId }, select: { id: true, lineId: true, reference: true } })
    if (!exception) throw notFound('Exception not found.')
    const updated = await tx.reconException.updateMany({ where: { id, orgId: access.orgId, version, status: { in: from } }, data: { ...data, version: { increment: 1 } } })
    if (updated.count === 0) throw conflict('STALE_RECORD', 'This exception was changed by someone else or is already resolved. Reload it and try again.')
    await this.support.event(tx, access.orgId, 'exception', id, action, actorUserId, note)
    await this.audit.record({ action: `billing.exception.${action.split(' ')[0]!.toLowerCase()}`, entityType: 'reconciliation_exception', entityId: id, orgId: access.orgId, actorUserId, details: { reference: exception.reference } }, client, tx)
    return exception
  }

  private async raise(tx: Tx, orgId: string, lineId: string, kind: string, reason: string, origin: string) {
    const reference = await this.support.reference(tx, orgId, 'recon_exception_reference', 'EXC-')
    const exception = await tx.reconException.create({ data: { orgId, reference, lineId, kind, reason }, select: { id: true } })
    await this.support.event(tx, orgId, 'exception', exception.id, 'Exception created · Open', null, `${kind} · ${origin}`)
    return exception.id
  }

  // Recorded payments in the shape the matcher needs, marked when a statement line already claims them.
  private async matchingPayments(orgId: string): Promise<PaymentForMatching[]> {
    const rows = await this.prisma.payment.findMany({
      where: { orgId },
      select: { id: true, txnReference: true, amount: true, receivedAt: true, channel: true, statementLines: { where: { state: { in: ['matched', 'candidate', 'resolved'] } }, select: { id: true } } },
    })
    return rows.map((row) => ({
      id: row.id, txnReference: row.txnReference, amount: toPaise(row.amount), date: this.support.stamp(row.receivedAt).date, cash: row.channel === 'Cash Desk', matched: row.statementLines.length > 0,
    }))
  }
}

import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../database/prisma.service'

export interface Clinician {
  name: string
  // "National Medical Commission (NMC) · NMC-TS-2018-49021" when the staff record has a registration.
  registration: string | null
  department: string | null
}

// Who is writing a prescription, order or referral, as it should appear on the record: the therapist profile's
// display name when there is one, the council registration from the staff record, otherwise the account name.
@Injectable()
export class ClinicianRepository {
  constructor(private readonly prisma: PrismaService) {}

  async of(membershipId: string, userId: string): Promise<Clinician> {
    const [user, practitioner, staff] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { fullName: true } }),
      this.prisma.practitioner.findUnique({ where: { membershipId }, select: { displayName: true, department: true } }),
      this.prisma.staffMember.findFirst({ where: { membershipId }, select: { council: true, councilNumber: true, department: true } }),
    ])
    const registration = staff?.councilNumber ? [staff.council, staff.councilNumber].filter(Boolean).join(' · ') : null
    return { name: practitioner?.displayName ?? user.fullName, registration, department: practitioner?.department ?? staff?.department ?? null }
  }
}

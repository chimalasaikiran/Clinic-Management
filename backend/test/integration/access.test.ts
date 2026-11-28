import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { MembersService } from '../../src/modules/members/members.service'
import { Browser, CLINIC, createOwner, createVerifiedUser, PASSWORD, resetState, signIn, startApp, stopApp, TestContext } from './helpers'

let ctx: TestContext

beforeAll(async () => {
  ctx = await startApp()
})
afterAll(async () => {
  await stopApp(ctx)
})
beforeEach(async () => {
  await resetState(ctx)
})

type RoleRow = { id: string; name: string; isSystem: boolean; version: number; branchIds: string[]; permissions: string[]; users: number }

async function rolesOf(browser: Browser, orgId: string) {
  return (await browser.get('/v1/roles').set('X-Org-Id', orgId).expect(200)).body.data as RoleRow[]
}

async function invite(owner: Browser, orgId: string, email: string, roleName: string) {
  const role = (await rolesOf(owner, orgId)).find((entry) => entry.name === roleName)!
  await owner.post('/v1/invitations').set('X-Org-Id', orgId).send({ email, roleIds: [role.id] }).expect(201)
  return ctx.mail.lastInvitationToken(email)
}

async function joinAs(owner: Browser, orgId: string, email: string, roleName: string) {
  const token = await invite(owner, orgId, email, roleName)
  await ctx.browser().post('/v1/invitations/accept-new').send({ token, fullName: 'Team Member', password: PASSWORD }).expect(201)
  const browser = ctx.browser()
  await signIn(browser, email)
  return browser
}

async function memberId(owner: Browser, orgId: string, email: string) {
  const members = (await owner.get('/v1/members').set('X-Org-Id', orgId).expect(200)).body.data as Array<{ id: string; user: { email: string } }>
  return members.find((member) => member.user.email === email)!.id
}

describe('organisation setup', () => {
  it('makes the creator Super Admin with every permission and seeds default roles', async () => {
    const { browser, orgId, membership } = await createOwner(ctx)
    expect(membership.roles.map((role: { name: string }) => role.name)).toEqual(['Super Admin'])
    expect(membership.branchScope).toBe('all')
    expect(membership.permissions).toContain('settings.roles')

    const session = await browser.get('/v1/auth/session').expect(200)
    expect(session.body.data.memberships[0].organisation).toMatchObject({ id: orgId, name: CLINIC.clinicName })

    const roles = await rolesOf(browser, orgId)
    // The system role first; the defaults are created in one transaction, so their relative order is not asserted.
    expect(roles[0]!.name).toBe('Super Admin')
    expect(roles.map((role) => role.name).sort()).toEqual(['Accountant / Billing', 'Branch Manager', 'Clinician', 'Front Desk & Reception', 'Growth & Marketing', 'HR & Compliance Officer', 'Nurse', 'Pharmacist', 'Super Admin'])
    expect(roles.find((role) => role.name === 'Super Admin')!.users).toBe(1)

    const branches = await browser.get('/v1/branches').set('X-Org-Id', orgId).expect(200)
    expect(branches.body.data).toEqual([expect.objectContaining({ code: 'MAIN', name: CLINIC.location })])
  })

  it('validates the clinic profile', async () => {
    const browser = await createVerifiedUser(ctx, 'owner@aura.test')
    const res = await browser.post('/v1/organisations').send({ ...CLINIC, facilityType: 'Spaceport' }).expect(400)
    expect(res.body.error.details[0].field).toBe('facilityType')
  })

  it('lists the permission catalogue for members', async () => {
    const { browser, orgId } = await createOwner(ctx)
    const res = await browser.get('/v1/permissions').set('X-Org-Id', orgId).expect(200)
    expect(res.body.data.map((group: { id: string }) => group.id)).toContain('settings')
  })
})

describe('role management', () => {
  it('creates and edits a custom role with optimistic locking and an audit trail', async () => {
    const { browser, orgId } = await createOwner(ctx)
    const created = await browser
      .post('/v1/roles')
      .set('X-Org-Id', orgId)
      .send({ name: 'Night Supervisor', category: 'Operations', scope: 'org', status: 'active', permissions: ['dashboard.view', 'bookings.view'] })
      .expect(201)
    const role = created.body.data
    expect(role).toMatchObject({ name: 'Night Supervisor', version: 1, users: 0, createdBy: 'Siddharth Verma' })

    const edited = await browser.patch(`/v1/roles/${role.id}`).set('X-Org-Id', orgId).send({ version: 1, permissions: ['dashboard.view'] }).expect(200)
    expect(edited.body.data).toMatchObject({ version: 2, permissions: ['dashboard.view'] })

    // A status-only edit keeps the permissions.
    const statusOnly = await browser.patch(`/v1/roles/${role.id}`).set('X-Org-Id', orgId).send({ version: 2, status: 'inactive' }).expect(200)
    expect(statusOnly.body.data).toMatchObject({ status: 'inactive', permissions: ['dashboard.view'] })

    const stale = await browser.patch(`/v1/roles/${role.id}`).set('X-Org-Id', orgId).send({ version: 1, status: 'active' }).expect(409)
    expect(stale.body.error.code).toBe('VERSION_CONFLICT')

    const audit = await ctx.prisma.auditLog.findMany({ where: { entityId: role.id }, orderBy: { id: 'asc' } })
    expect(audit.map((entry) => entry.action)).toEqual(['role.created', 'role.updated', 'role.updated'])
  })

  it('applies the grant rules on the server', async () => {
    const { browser, orgId } = await createOwner(ctx)
    const base = { category: 'Operations', status: 'active' }
    const branchId = (await browser.get('/v1/branches').set('X-Org-Id', orgId)).body.data[0].id
    const post = (body: object) => browser.post('/v1/roles').set('X-Org-Id', orgId).send({ ...base, ...body })

    expect((await post({ name: 'A', scope: 'org', permissions: ['staff.payroll'] }).expect(422)).body.error.code).toBe('PERMISSION_NOT_GRANTABLE')
    expect((await post({ name: 'B', scope: 'org', permissions: ['settings.roles'] }).expect(422)).body.error.code).toBe('PERMISSION_NOT_GRANTABLE')
    expect((await post({ name: 'C', scope: 'branch', branchIds: [branchId], permissions: ['accounting.invoices'] }).expect(422)).body.error.code).toBe('PERMISSION_NOT_GRANTABLE')
    expect((await post({ name: 'D', scope: 'org', permissions: ['root.everything'] }).expect(422)).body.error.code).toBe('PERMISSION_UNKNOWN')
    expect((await post({ name: 'E', scope: 'branch', permissions: ['bookings.view'] }).expect(422)).body.error.code).toBe('BRANCHES_REQUIRED')
    expect((await post({ name: '  branch MANAGER ', scope: 'org', permissions: ['bookings.view'] }).expect(409)).body.error.code).toBe('ROLE_NAME_TAKEN')
  })

  it('saves drafts without permissions', async () => {
    const { browser, orgId } = await createOwner(ctx)
    const draft = await browser.post('/v1/roles').set('X-Org-Id', orgId).send({ name: 'Work in progress', category: 'Finance', scope: 'org', status: 'draft' }).expect(201)
    expect(draft.body.data).toMatchObject({ status: 'draft', permissions: [] })
  })

  it('keeps system roles read-only', async () => {
    const { browser, orgId } = await createOwner(ctx)
    const owner = (await rolesOf(browser, orgId)).find((role) => role.isSystem)!
    const res = await browser.patch(`/v1/roles/${owner.id}`).set('X-Org-Id', orgId).send({ version: owner.version, status: 'inactive' }).expect(403)
    expect(res.body.error.code).toBe('SYSTEM_ROLE_LOCKED')
  })

  it('rejects branches from another organisation', async () => {
    const first = await createOwner(ctx, 'one@aura.test')
    const second = await createOwner(ctx, 'two@aura.test')
    const foreignBranch = (await second.browser.get('/v1/branches').set('X-Org-Id', second.orgId)).body.data[0].id
    const res = await first.browser
      .post('/v1/roles')
      .set('X-Org-Id', first.orgId)
      .send({ name: 'Sneaky', category: 'Operations', scope: 'branch', status: 'active', branchIds: [foreignBranch], permissions: ['bookings.view'] })
      .expect(422)
    expect(res.body.error.code).toBe('BRANCH_UNKNOWN')
  })
})

describe('permission enforcement', () => {
  it('gives an invited front-desk user only their role permissions', async () => {
    const { browser, orgId } = await createOwner(ctx)
    const desk = await joinAs(browser, orgId, 'desk@aura.test', 'Front Desk & Reception')

    const membership = (await desk.get('/v1/auth/session').expect(200)).body.data.memberships[0]
    expect(membership.permissions).toContain('bookings.create')
    expect(membership.permissions).not.toContain('settings.roles')
    expect(membership.branchScope).toHaveLength(1)

    expect((await desk.get('/v1/roles').set('X-Org-Id', orgId).expect(403)).body.error.code).toBe('PERMISSION_DENIED')
    await desk.post('/v1/roles').set('X-Org-Id', orgId).send({ name: 'Me', category: 'Operations', scope: 'org', status: 'active', permissions: ['dashboard.view'] }).expect(403)
    await desk.get('/v1/branches').set('X-Org-Id', orgId).expect(200)
  })

  it('isolates organisations from each other', async () => {
    const first = await createOwner(ctx, 'one@aura.test')
    const second = await createOwner(ctx, 'two@aura.test')
    expect((await first.browser.get('/v1/roles').set('X-Org-Id', second.orgId).expect(403)).body.error.code).toBe('NOT_A_MEMBER')
    expect((await first.browser.get('/v1/roles').expect(400)).body.error.code).toBe('ORG_REQUIRED')
  })

  it('applies role changes and suspension on the next request', async () => {
    const { browser, orgId } = await createOwner(ctx)
    const hr = await joinAs(browser, orgId, 'hr@aura.test', 'HR & Compliance Officer')
    await hr.get('/v1/members').set('X-Org-Id', orgId).expect(200)

    const hrMember = await memberId(browser, orgId, 'hr@aura.test')
    await browser.patch(`/v1/members/${hrMember}`).set('X-Org-Id', orgId).send({ status: 'suspended' }).expect(200)
    expect((await hr.get('/v1/members').set('X-Org-Id', orgId).expect(403)).body.error.code).toBe('NOT_A_MEMBER')

    await browser.patch(`/v1/members/${hrMember}`).set('X-Org-Id', orgId).send({ status: 'active' }).expect(200)
    const desk = (await rolesOf(browser, orgId)).find((role) => role.name === 'Front Desk & Reception')!
    await browser.put(`/v1/members/${hrMember}/roles`).set('X-Org-Id', orgId).send({ roleIds: [desk.id] }).expect(200)
    await hr.get('/v1/members').set('X-Org-Id', orgId).expect(403)
  })

  it('stops a deactivated role from granting anything', async () => {
    const { browser, orgId } = await createOwner(ctx)
    const hr = await joinAs(browser, orgId, 'hr@aura.test', 'HR & Compliance Officer')
    const role = (await rolesOf(browser, orgId)).find((entry) => entry.name === 'HR & Compliance Officer')!
    await browser.patch(`/v1/roles/${role.id}`).set('X-Org-Id', orgId).send({ version: role.version, status: 'inactive' }).expect(200)
    await hr.get('/v1/members').set('X-Org-Id', orgId).expect(403)
  })

  it('stops people changing their own access, so an owner can only be removed by another owner', async () => {
    const { browser, orgId } = await createOwner(ctx)
    const self = await memberId(browser, orgId, 'owner@aura.test')
    expect((await browser.patch(`/v1/members/${self}`).set('X-Org-Id', orgId).send({ status: 'suspended' }).expect(403)).body.error.code).toBe('SELF_CHANGE_FORBIDDEN')
    expect((await browser.put(`/v1/members/${self}/roles`).set('X-Org-Id', orgId).send({ roleIds: [] }).expect(403)).body.error.code).toBe('SELF_CHANGE_FORBIDDEN')

    const second = await joinAs(browser, orgId, 'second@aura.test', 'Branch Manager')
    const owner = (await rolesOf(browser, orgId)).find((role) => role.isSystem)!
    await browser.put(`/v1/members/${await memberId(browser, orgId, 'second@aura.test')}/roles`).set('X-Org-Id', orgId).send({ roleIds: [owner.id] }).expect(200)
    await second.patch(`/v1/members/${self}`).set('X-Org-Id', orgId).send({ status: 'suspended' }).expect(200)
    expect((await browser.get('/v1/members').set('X-Org-Id', orgId).expect(403)).body.error.code).toBe('NOT_A_MEMBER')
  })

  it('refuses any change that would leave no active Super Admin', async () => {
    const { orgId } = await createOwner(ctx)
    const members = ctx.app.get(MembersService)
    await ctx.prisma.membership.updateMany({ data: { status: 'suspended' } })
    await expect(ctx.prisma.$transaction((tx) => members.assertOwnerRemains(tx, orgId))).rejects.toMatchObject({ code: 'LAST_OWNER' })
  })
})

describe('invitations', () => {
  it('previews and accepts once, creating a verified account', async () => {
    const { browser, orgId } = await createOwner(ctx)
    const link = await invite(browser, orgId, 'new@aura.test', 'Clinician')

    const preview = await ctx.browser().post('/v1/invitations/preview').send({ token: link }).expect(200)
    expect(preview.body.data).toMatchObject({ email: 'new@aura.test', organisation: CLINIC.clinicName, roles: ['Clinician'], accountExists: false })

    await ctx.browser().post('/v1/invitations/accept-new').send({ token: link, fullName: 'Dr. New', password: 'weak' }).expect(400)
    await ctx.browser().post('/v1/invitations/accept-new').send({ token: link, fullName: 'Dr. New', password: PASSWORD }).expect(201)
    await ctx.browser().post('/v1/invitations/accept-new').send({ token: link, fullName: 'Dr. New', password: PASSWORD }).expect(404)

    const member = ctx.browser()
    await signIn(member, 'new@aura.test')
    const session = (await member.get('/v1/auth/session').expect(200)).body.data
    expect(session.user.emailVerified).toBe(true)
    expect(session.memberships[0].roles[0].name).toBe('Clinician')
  })

  it('lets an existing user accept only an invitation addressed to them', async () => {
    const first = await createOwner(ctx, 'one@aura.test')
    const second = await createOwner(ctx, 'two@aura.test')
    const link = await invite(first.browser, first.orgId, 'two@aura.test', 'Branch Manager')

    const outsider = await createVerifiedUser(ctx, 'other@aura.test')
    expect((await outsider.post('/v1/invitations/accept').send({ token: link }).expect(403)).body.error.code).toBe('INVITATION_EMAIL_MISMATCH')

    await second.browser.post('/v1/invitations/accept').send({ token: link }).expect(200)
    expect((await second.browser.get('/v1/auth/session').expect(200)).body.data.memberships).toHaveLength(2)
  })

  it('rejects expired, revoked and malformed links', async () => {
    const { browser, orgId } = await createOwner(ctx)
    const link = await invite(browser, orgId, 'late@aura.test', 'Clinician')
    await ctx.prisma.invitation.updateMany({ data: { expiresAt: new Date(Date.now() - 60_000) } })
    await ctx.browser().post('/v1/invitations/preview').send({ token: link }).expect(404)

    const fresh = await invite(browser, orgId, 'cancel@aura.test', 'Clinician')
    const list = (await browser.get('/v1/invitations').set('X-Org-Id', orgId)).body.data as Array<{ id: string; email: string }>
    await browser.delete(`/v1/invitations/${list.find((entry) => entry.email === 'cancel@aura.test')!.id}`).set('X-Org-Id', orgId).expect(204)
    await ctx.browser().post('/v1/invitations/preview').send({ token: fresh }).expect(404)

    await ctx.browser().post('/v1/invitations/preview').send({ token: 'short' }).expect(400)
  })

  it('stores only a hash of the invitation token', async () => {
    const { browser, orgId } = await createOwner(ctx)
    const link = await invite(browser, orgId, 'hash@aura.test', 'Clinician')
    const [stored] = await ctx.prisma.invitation.findMany()
    expect(stored!.tokenHash).not.toContain(link)
  })

  it('stops staff managers from granting more than they hold', async () => {
    const { browser, orgId } = await createOwner(ctx)
    const hr = await joinAs(browser, orgId, 'hr@aura.test', 'HR & Compliance Officer')
    const roles = await rolesOf(browser, orgId)
    const send = (email: string, roleName: string) =>
      hr.post('/v1/invitations').set('X-Org-Id', orgId).send({ email, roleIds: [roles.find((role) => role.name === roleName)!.id] })

    expect((await send('x@aura.test', 'Super Admin').expect(403)).body.error.code).toBe('ROLE_NOT_ASSIGNABLE')
    await send('y@aura.test', 'Accountant / Billing').expect(403)
    // HR holds staff.view and dashboard.view but not bookings: still refused.
    await send('z@aura.test', 'Front Desk & Reception').expect(403)
  })

  it('refuses to invite an existing member', async () => {
    const { browser, orgId } = await createOwner(ctx)
    const role = (await rolesOf(browser, orgId)).find((entry) => entry.name === 'Clinician')!
    const res = await browser.post('/v1/invitations').set('X-Org-Id', orgId).send({ email: 'owner@aura.test', roleIds: [role.id] }).expect(409)
    expect(res.body.error.code).toBe('ALREADY_MEMBER')
  })
})

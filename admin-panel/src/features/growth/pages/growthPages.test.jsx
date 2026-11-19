import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { pathFor, ROUTES } from '../../../config/routes'
import { authState } from '../../../test/auth'
import { renderBillingRoute, renderRoute } from '../../../test/renderRoute'
import { billingFake } from '../../../test/fixtures/billingFake'
import { apiLead, createLeadsApi, overdueLead } from '../../../test/fixtures/leadsApi'
import { apiPatient, createPatientsApi } from '../../../test/fixtures/patientsApi'
import { localToday } from '../../patients/format'

const fake = vi.hoisted(() => ({ api: null }))
vi.mock('../../patients/api', async (importOriginal) => {
  const actual = await importOriginal()
  const forward = (name) => new Proxy({}, { get: (_, method) => (...args) => fake.api[name][method](...args) })
  return { ...actual, patientsApi: forward('patientsApi'), branchesApi: forward('branchesApi') }
})

const ANANYA = apiPatient({ id: 'p-1', fullName: 'Ananya Sharma', mobile: '9848022110' })

const addIsoDays = (iso, count) => {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day + count)).toISOString().slice(0, 10)
}

const setup = () => userEvent.setup({ delay: null })

async function fill(user, field, text) {
  await user.click(field)
  await user.clear(field)
  await user.paste(text)
}

beforeEach(() => {
  localStorage.clear()
  fake.api = createPatientsApi({ patients: [ANANYA] }).api
})

const SCREENS = [
  ['GO-01 Growth OS', ROUTES.growth, 'Growth OS'],
  ['GO-02 Lead Register', ROUTES.leads, 'Lead Register'],
  ['GO-03 Lead Details', pathFor(ROUTES.lead, { leadId: 'l-1' }), 'Nisha Menon'],
  ['GO-04 Create lead', ROUTES.leadNew, 'Create/Edit Lead'],
  ['GO-04 Edit lead', pathFor(ROUTES.leadEdit, { leadId: 'l-1' }), 'Create/Edit Lead'],
  ['GO-05 Lead Follow-up', pathFor(ROUTES.leadFollowUp, { leadId: 'l-1' }), 'Lead Follow-up'],
  ['GO-06 Conversion', pathFor(ROUTES.leadConvert, { leadId: 'l-1' }), 'Lead Conversion & Re-engagement'],
  ['GO-07 Campaign Register', ROUTES.campaigns, 'Campaign Register'],
  ['GO-08 Campaign Details', pathFor(ROUTES.campaign, { campaignId: 'CMP2041' }), 'Campaign Details & Performance'],
  ['GO-09 Create campaign', ROUTES.campaignNew, 'Create/Edit Campaign'],
  ['GO-09 Edit campaign', pathFor(ROUTES.campaignEdit, { campaignId: 'CMP2041' }), 'Create/Edit Campaign'],
  ['GO-10 Audiences', ROUTES.audiences, 'Audience Management'],
  ['GO-10A Create segment', ROUTES.segmentNew, 'Create/Edit Audience Segment'],
  ['GO-10A Edit segment', pathFor(ROUTES.segmentEdit, { segmentId: 'SEG301' }), 'Create/Edit Audience Segment'],
  ['GO-11 Content Calendar', ROUTES.content, 'Content Calendar'],
  ['GO-12 Create content', ROUTES.contentNew, 'Create/Edit Content'],
  ['GO-12 Edit content', pathFor(ROUTES.contentEdit, { contentId: 'CNT3101' }), 'Create/Edit Content'],
  ['GO-13 Templates', ROUTES.contentTemplates, 'Content Templates'],
  ['GO-14 Schedule/Publish', pathFor(ROUTES.contentSchedule, { contentId: 'CNT3101' }), 'Schedule/Publish'],
  ['GO-15 Business Profile', ROUTES.businessProfile, 'Business Profile & Locations'],
  ['GO-16 Reviews', ROUTES.reviews, 'Reviews & Reputation Register'],
  ['GO-17 Review Details', pathFor(ROUTES.review, { reviewId: 'REV-DEMO104' }), 'Review Details & Response'],
  ['GO-18 Review Requests', ROUTES.reviewRequests, 'Review Request Workflow'],
  ['GO-19 Escalation', ROUTES.escalations, 'Feedback Escalation'],
  ['GO-20 Reputation', ROUTES.reputation, 'Reputation Reporting'],
  ['GO-21 Inbox', ROUTES.conversations, 'Conversations Inbox'],
  ['GO-22 Thread', pathFor(ROUTES.conversation, { threadId: 'CV-DEMO201' }), 'Conversation Thread & Patient Context'],
  ['GO-23 Message Templates', ROUTES.messageTemplates, 'Message Templates'],
  ['GO-24 History', pathFor(ROUTES.communicationHistory, { threadId: 'CV-DEMO201' }), 'Communication History & Preferences'],
  ['GO-25 Channels', ROUTES.channels, 'Channel / Integration Configuration'],
  ['GO-26 Delivery', ROUTES.deliveryFailures, 'Delivery Failures & Retry'],
  ['GO-27 Workflows', ROUTES.workflows, 'Retention & Reminder Workflows'],
  ['GO-28 Create workflow', ROUTES.workflowNew, 'Create Retention Workflow'],
  ['GO-28 Edit workflow', pathFor(ROUTES.workflowEdit, { workflowId: 'WF-REM201' }), 'Edit Retention Workflow'],
  ['GO-29 Executions', ROUTES.workflowExecutions, 'Workflow Execution & Exceptions'],
  ['GO-30 Performance', ROUTES.growthPerformance, 'Growth Performance & Attribution'],
  ['GO-31 Attribution', pathFor(ROUTES.campaignAttribution, { campaignId: 'CMP2041' }), 'Campaign Attribution Details'],
  ['RPT-01 Overview', ROUTES.reports, 'Reports overview'],
  ['RPT-02 Operations', ROUTES.reportsOperations, 'Operations'],
  ['RPT-03 Financial', ROUTES.reportsFinancial, 'Financial'],
  ['RPT-04 Pharmacy & Inventory', ROUTES.reportsPharmacy, 'Pharmacy & Inventory'],
]

describe('every Growth and Reports screen opens from its route', () => {
  // Report screens wait for the billing ledger and lead screens for the lead; the others render at once.
  it.each(SCREENS)('%s', async (_name, path, title) => {
    await renderBillingRoute(path)
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(title))
  })

  it.each([
    [pathFor(ROUTES.lead, { leadId: 'l-9999' }), 'Lead not found'],
    [pathFor(ROUTES.campaign, { campaignId: 'CMP9999' }), 'Campaign not found'],
    [pathFor(ROUTES.review, { reviewId: 'REV-9999' }), 'Review not found'],
    [pathFor(ROUTES.conversation, { threadId: 'CV-9999' }), 'Conversation not found'],
  ])('shows a not-found page for %s', async (path, title) => {
    renderRoute(path)
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(title))
  })
})

describe('navigation', () => {
  it('opens the Growth sections from the sidebar', () => {
    renderRoute(ROUTES.leads)
    const sections = screen.getByRole('list', { name: 'Growth sections' })
    expect(within(sections).getByRole('link', { name: 'Leads' })).toHaveAttribute('aria-current', 'page')
    expect(within(sections).getByRole('link', { name: 'Campaigns' })).toHaveAttribute('href', ROUTES.campaigns)
  })

  it('moves from the register to a lead and on to its follow-up, edit and conversion', async () => {
    const user = setup()
    const router = renderRoute(ROUTES.leads)

    await user.click(await screen.findByRole('link', { name: /Nisha Menon/ }))
    expect(router.state.location.pathname).toBe(pathFor(ROUTES.lead, { leadId: 'l-1' }))
    expect(await screen.findByRole('link', { name: 'Edit Lead' })).toHaveAttribute('href', pathFor(ROUTES.leadEdit, { leadId: 'l-1' }))
    expect(screen.getAllByRole('link', { name: 'Record Follow up' })[0]).toHaveAttribute('href', pathFor(ROUTES.leadFollowUp, { leadId: 'l-1' }))
    expect(screen.getAllByRole('link', { name: 'Convert Lead' })[0]).toHaveAttribute('href', pathFor(ROUTES.leadConvert, { leadId: 'l-1' }))
  })

  it('links the review, escalation and reporting screens to each other', () => {
    renderRoute(ROUTES.escalations)
    expect(screen.getByRole('link', { name: /Reputation report/ })).toHaveAttribute('href', ROUTES.reputation)
    expect(screen.getByRole('link', { name: /Source review/ })).toHaveAttribute('href', pathFor(ROUTES.review, { reviewId: 'REV-DEMO102' }))
  })
})

describe('leads', () => {
  const twoLeads = () => billingFake.useLeads(createLeadsApi({ leads: [overdueLead(), apiLead({ id: 'l-2', number: 'LD-000002', fullName: 'Rohan Mehta', mobile: '9000000002', source: 'walk_in', branch: { id: 'b-kondapur', name: 'Kondapur Clinic' } })], patients: [ANANYA] }))

  it('lists live leads with their counts, and filters through the API keeping the filter in the address', async () => {
    const user = setup()
    const leads = twoLeads()
    const router = renderRoute(ROUTES.leads)

    expect(await screen.findByText('2 matching inquiries')).toBeInTheDocument()
    expect(screen.getByText('Overdue', { selector: 'dt' }).closest('div')).toHaveTextContent('1')
    await user.selectOptions(screen.getByLabelText('Stage'), 'Qualified')

    expect(router.state.location.search).toBe('?stage=Qualified')
    expect(await screen.findByText('1 matching inquiry')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Rohan Mehta/ })).not.toBeInTheDocument()
    expect(leads.state.calls.filter(([name]) => name === 'list').at(-1)[1]).toMatchObject({ stage: 'qualified', sort: 'follow-up', page: 1 })
  })

  it('follows the header location', async () => {
    const leads = twoLeads()
    localStorage.setItem('clinicos.workspace.branch:org-1', 'b-kondapur')
    renderRoute(ROUTES.leads)
    expect(await screen.findByRole('link', { name: /Rohan Mehta/ })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Nisha Menon/ })).not.toBeInTheDocument()
    expect(leads.state.calls.find(([name]) => name === 'list')[1].branchId).toBe('b-kondapur')
  })

  it('creates a lead with an owner who covers the branch, and opens its details', async () => {
    const user = setup()
    const leads = billingFake.useLeads(createLeadsApi({ leads: [] }))
    const router = renderRoute(ROUTES.leadNew)

    await user.click(screen.getByRole('button', { name: 'Create lead' }))
    expect(screen.getByText('Enter the lead’s full name.')).toBeInTheDocument()

    await fill(user, screen.getByLabelText(/^Full name/), 'Sana Iqbal')
    await fill(user, screen.getByLabelText(/^Phone/), '91234 56780')
    await waitFor(() => expect(within(screen.getByLabelText(/^Owner/)).getAllByRole('option').map((option) => option.textContent)).toEqual(['Meera Shah', 'Priya Nair']))
    await user.selectOptions(screen.getByLabelText(/^Branch/), 'b-kondapur')
    expect(within(screen.getByLabelText(/^Owner/)).getAllByRole('option').map((option) => option.textContent)).toEqual(['Meera Shah'])
    await user.click(screen.getByRole('button', { name: 'Create lead' }))

    await waitFor(() => expect(router.state.location.pathname).toBe(pathFor(ROUTES.lead, { leadId: 'l-1' })))
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Sana Iqbal'))
    expect(leads.state.calls.find(([name]) => name === 'create')[1]).toMatchObject({ fullName: 'Sana Iqbal', mobile: '9123456780', branchId: 'b-kondapur', ownerMembershipId: 'm-1', source: 'phone', stage: 'new', confirmedNotDuplicate: false })
  })

  it('blocks saving a lead with a duplicate mobile until the review is confirmed', async () => {
    const user = setup()
    renderRoute(ROUTES.leadNew)

    await fill(user, screen.getByLabelText(/^Full name/), 'Another Nisha')
    await fill(user, screen.getByLabelText(/^Phone/), '98480 22110')

    expect(await screen.findByText('Possible duplicate · Review required')).toBeInTheDocument()
    expect(screen.getByText(/Nisha Menon \(LD-000001\) uses the same mobile number/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create lead' })).toBeDisabled()
    await user.click(screen.getByRole('checkbox', { name: /Duplicate review completed/ }))
    expect(screen.getByRole('button', { name: 'Create lead' })).toBeEnabled()
  })

  it('records a follow-up through the API and keeps the original task open', async () => {
    const user = setup()
    const router = renderRoute(pathFor(ROUTES.leadFollowUp, { leadId: 'l-1' }))

    expect(await screen.findByRole('button', { name: 'Record Follow-up' })).toBeDisabled()
    await user.click(screen.getByRole('radio', { name: 'Connected' }))
    await fill(user, screen.getByLabelText(/^Notes/), 'Discussed the knee assessment.')
    await user.click(screen.getByRole('checkbox', { name: /Verify activity and task permissions/ }))
    await user.click(screen.getByRole('checkbox', { name: /Review the activity and task decision/ }))
    await user.click(screen.getByRole('button', { name: 'Record Follow-up' }))

    await waitFor(() => expect(router.state.location.pathname).toBe(pathFor(ROUTES.lead, { leadId: 'l-1' })))
    expect(await screen.findByText('Phone call · Connected')).toBeInTheDocument()
    expect(screen.getAllByText('Overdue').length).toBeGreaterThan(0)
    expect(billingFake.leads.state.calls.find(([name]) => name === 'recordInteraction')[2]).toMatchObject({ type: 'phone_call', outcome: 'connected', decision: 'keep', ownerMembershipId: 'm-1', version: 1, occurredDate: localToday() })
  })

  it('links an existing patient only after the identity path and every confirmation', async () => {
    const user = setup()
    const leads = billingFake.useLeads(createLeadsApi({ patients: [ANANYA] }))
    const router = renderRoute(pathFor(ROUTES.leadConvert, { leadId: 'l-1' }))

    expect(await screen.findByRole('button', { name: 'Confirm conversion' })).toBeDisabled()
    expect(await screen.findByText(/Ananya Sharma \(PT-000001\) shares this mobile number/)).toBeInTheDocument()
    await user.click(screen.getByRole('checkbox', { name: 'Duplicate review completed' }))
    await user.click(screen.getByRole('radio', { name: /Link existing patient/ }))
    await user.selectOptions(screen.getByLabelText('Select verified match'), 'p-1')
    await user.click(screen.getByRole('checkbox', { name: /Verify identity and document permission/ }))
    await user.click(screen.getByRole('checkbox', { name: 'Confirm the chosen path' }))
    await user.click(screen.getByRole('checkbox', { name: /Verify conversion & branch permissions/ }))
    await user.click(screen.getByRole('checkbox', { name: 'Confirm conversion separately' }))
    await user.click(screen.getByRole('button', { name: 'Confirm conversion' }))

    await waitFor(() => expect(router.state.location.pathname).toBe(pathFor(ROUTES.lead, { leadId: 'l-1' })))
    expect(await screen.findByRole('link', { name: /Ananya Sharma ↗/ })).toHaveAttribute('href', pathFor(ROUTES.patientHub, { patientId: 'p-1' }))
    expect(leads.state.calls.find(([name]) => name === 'convert')[2]).toEqual({ patientId: 'p-1', version: 1 })
  })

  it('registers a new patient from the lead and converts it when saved', async () => {
    const user = setup()
    fake.api = createPatientsApi({ patients: [] }).api
    const router = renderRoute(pathFor(ROUTES.leadConvert, { leadId: 'l-1' }))

    await user.click(await screen.findByRole('radio', { name: /Create new patient/ }))
    await user.click(screen.getByRole('checkbox', { name: /no matching shared patient exists/ }))
    await user.click(screen.getByRole('checkbox', { name: /Verify identity and document permission/ }))
    await user.click(screen.getByRole('checkbox', { name: 'Confirm the chosen path' }))
    await user.click(screen.getByRole('checkbox', { name: /Verify conversion & branch permissions/ }))
    await user.click(screen.getByRole('checkbox', { name: 'Confirm conversion separately' }))
    await user.click(screen.getByRole('button', { name: 'Continue to registration' }))

    await waitFor(() => expect(router.state.location.pathname).toBe(ROUTES.patientNew))
    expect(router.state.location.search).toBe('?fromLead=l-1')
    expect(await screen.findByText(/Registering from lead LD-000001 · Nisha Menon/)).toBeInTheDocument()
    expect(screen.getByLabelText(/^Full legal name/)).toHaveValue('Nisha Menon')
  })

  it('shows leads read-only to roles that cannot change them', async () => {
    renderRoute(pathFor(ROUTES.lead, { leadId: 'l-1' }), undefined, { auth: authState({ permissions: ['growth.view'] }) })
    expect(await screen.findByText('View only · your role cannot change leads')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Edit Lead' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Change stage')).toBeDisabled()
  })
})

describe('campaigns and audiences', () => {
  it('requires a reason and confirmation before a budget change is saved', async () => {
    const user = setup()
    const router = renderRoute(pathFor(ROUTES.campaignEdit, { campaignId: 'CMP2041' }))

    await fill(user, screen.getByLabelText(/^Planned budget/), '48000')
    expect(screen.getAllByText(/₹45,000 → ₹48,000/).length).toBeGreaterThan(0)
    await user.click(screen.getByRole('checkbox', { name: /Verify role & branch access/ }))
    expect(screen.getByRole('button', { name: 'Save draft' })).toBeDisabled()

    await fill(user, screen.getByLabelText(/^Change reason/), 'More creative testing')
    await user.click(screen.getByRole('checkbox', { name: /I confirm the budget change/ }))
    await user.click(screen.getByRole('button', { name: 'Save draft' }))

    expect(router.state.location.pathname).toBe(pathFor(ROUTES.campaign, { campaignId: 'CMP2041' }))
    expect(screen.getAllByText('₹48,000').length).toBeGreaterThan(0)
  })

  it('shows campaign measurement as unavailable while campaigns are not linked to leads', () => {
    renderRoute(pathFor(ROUTES.campaign, { campaignId: 'CMP2041' }))
    expect(screen.queryByText('Historical tag predates proposed schedule · verification required')).not.toBeInTheDocument()
    expect(screen.getAllByText('Unavailable').length).toBeGreaterThan(0)
  })

  it('requires a lifecycle stage before a segment definition is saved', async () => {
    const user = setup()
    renderRoute(ROUTES.segmentNew)

    await fill(user, screen.getByLabelText(/^Segment name/), 'New segment')
    await fill(user, screen.getByLabelText(/^Purpose/), 'Test purpose')
    await user.click(screen.getByRole('button', { name: 'Save definition' }))

    expect(screen.getByText('Choose at least one permitted lifecycle stage before saving.')).toBeInTheDocument()
  })
})

describe('content', () => {
  it('shows the sample plan on the calendar and switches to the list view', async () => {
    const user = setup()
    renderRoute(ROUTES.content)

    expect(screen.getByRole('button', { name: 'Plan your preventive health check Draft' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^list/i }))
    expect(screen.getByText('Content in October')).toBeInTheDocument()
  })

  it('starts a draft from a template with the template copy filled in', async () => {
    const user = setup()
    const router = renderRoute(ROUTES.contentTemplates)

    await user.click(screen.getAllByRole('button', { name: /Use template/ })[1])

    expect(router.state.location.pathname).toBe(ROUTES.contentNew)
    expect(screen.getByLabelText(/^Title/)).toHaveValue('Bring your questions to your visit')
    expect(screen.getByText(/New from template · TPL-EDU01/)).toBeInTheDocument()
  })

  it('submits a ready draft for review without claiming it is published', async () => {
    const user = setup()
    renderRoute(pathFor(ROUTES.contentSchedule, { contentId: 'CNT3101' }))

    expect(screen.getByRole('button', { name: 'Submit for review' })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Publish now/ })).toBeDisabled()
    for (const label of [/Asset rights/, /Clinical approval recorded/, /Verify content-publish permission/]) await user.click(screen.getByRole('checkbox', { name: label }))
    await user.click(screen.getByRole('button', { name: 'Submit for review' }))

    expect(screen.getByText('Submitted for internal review')).toBeInTheDocument()
  })
})

describe('reviews and messaging', () => {
  it('blocks a public reply that contains a phone number', async () => {
    const user = setup()
    renderRoute(pathFor(ROUTES.review, { reviewId: 'REV-DEMO104' }))

    expect(screen.getByRole('button', { name: 'Request approval' })).toBeEnabled()
    await fill(user, screen.getByLabelText(/^Response draft/), 'Please call me on 9876543210.')

    expect(screen.getByText('Possible personal or clinical detail found')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Request approval' })).toBeDisabled()
  })

  it('computes the reputation metrics from the sample reviews', () => {
    renderRoute(ROUTES.reputation)
    expect(screen.getByText('4 examples')).toBeInTheDocument()
    expect(screen.getByText('3.5 / 5')).toBeInTheDocument()
    expect(screen.getByText('0 of 4')).toBeInTheDocument()
  })

  it('rejects a template variable that is not on the allowlist', async () => {
    const user = setup()
    renderRoute(ROUTES.messageTemplates)

    await fill(user, screen.getByLabelText(/^Message body/), 'Hello {{preferred_name}} {{secret}}')

    expect(screen.getByText('Unknown variable: {{secret}}')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save as new version' })).toBeDisabled()
  })

  it('keeps an unsent reply as a draft because no live channel is verified', async () => {
    const user = setup()
    renderRoute(pathFor(ROUTES.conversation, { threadId: 'CV-DEMO201' }))

    expect(screen.getByRole('button', { name: 'Send reply' })).toBeDisabled()
    await fill(user, screen.getByLabelText(/^Draft text/), 'We open at nine.')
    await user.click(screen.getByRole('button', { name: 'Save draft' }))
    expect(screen.getByText(/Reply draft saved/)).toBeInTheDocument()
  })

  it('reassigns an inbox conversation and marks it resolved', async () => {
    const user = setup()
    renderRoute(ROUTES.conversations)

    await user.selectOptions(screen.getByLabelText('Current owner'), 'Priya Nair')
    await user.click(screen.getByRole('button', { name: 'Mark resolved' }))

    expect(screen.getByRole('button', { name: 'Reopen' })).toBeInTheDocument()
  })
})

describe('workflows', () => {
  it('lists the inactive definitions and creates a draft', async () => {
    const user = setup()
    const router = renderRoute(ROUTES.workflowNew)

    await user.click(screen.getByRole('button', { name: 'Save draft' }))
    expect(screen.getByText('Enter a workflow name.')).toBeInTheDocument()

    await fill(user, screen.getByLabelText(/^Workflow name/), 'Recall check')
    await fill(user, screen.getByLabelText(/^Trigger/), 'Six months after the last visit')
    await user.click(screen.getByRole('button', { name: 'Save draft' }))

    expect(router.state.location.pathname).toBe(ROUTES.workflows)
    expect(screen.getByText('Recall check')).toBeInTheDocument()
    expect(screen.getAllByText('Draft · inactive').length).toBeGreaterThan(5)
  })

  it('never offers a retry for a failure scenario', () => {
    renderRoute(ROUTES.deliveryFailures)
    expect(screen.getByRole('button', { name: 'Retry send' })).toBeDisabled()
  })
})

describe('reports', () => {
  it('shows the operations measures with their denominators', async () => {
    const user = setup()
    await renderBillingRoute(ROUTES.reportsOperations)
    expect(await screen.findByText('6.3%')).toBeInTheDocument()
    expect(screen.getByText('10 ÷ 160 (150 completed + 10 no-show). Exact rate 6.25%.')).toBeInTheDocument()
    expect(screen.getByText('15 min')).toBeInTheDocument()
    // The last 28 days to today, across permitted branches; choosing a branch asks for that branch only.
    const today = localToday()
    expect(billingFake.reports.calls[0].query).toEqual({ from: addIsoDays(today, -27), to: today, branchId: undefined })
    await user.selectOptions(screen.getByLabelText('Branch'), 'b-kondapur')
    await waitFor(() => expect(billingFake.reports.calls.at(-1).query.branchId).toBe('b-kondapur'))
    expect(await screen.findByText(/^Appointments starting .* · Kondapur Clinic$/)).toBeInTheDocument()
  })

  it('shows billed, collected and outstanding apart from one another', async () => {
    const user = setup()
    await renderBillingRoute(ROUTES.reportsFinancial)
    await user.selectOptions(screen.getByLabelText('Period'), 'all')
    expect(screen.getByText('Billed ≠ collected ≠ recognized revenue')).toBeInTheDocument()
    expect(screen.getAllByText('₹62,500').length).toBeGreaterThan(0)
    expect(screen.getAllByText('₹66,900').length).toBeGreaterThan(0)
    expect(screen.getAllByText('₹3,500').length).toBeGreaterThan(0)
  })

  it('filters the live inventory table by stock status', async () => {
    const user = setup()
    await renderBillingRoute(ROUTES.reportsPharmacy)

    await user.selectOptions(await screen.findByLabelText(/Stock expiry/), 'Low stock')

    expect(screen.getByText('2 of 6 SKUs · all locations')).toBeInTheDocument()
    const table = screen.getByText('Inventory table').closest('section')
    expect(within(table).getByText('Cetirizine 10mg')).toBeInTheDocument()
    expect(within(table).getByText('Amoxicillin 500mg')).toBeInTheDocument()
    expect(within(table).queryByText('Paracetamol 500mg')).not.toBeInTheDocument()
  })

  it('links the overview to each report', async () => {
    await renderBillingRoute(ROUTES.reports)
    expect(screen.getByRole('link', { name: /View Operations/ })).toHaveAttribute('href', ROUTES.reportsOperations)
    expect(screen.getByRole('link', { name: /View Financial/ })).toHaveAttribute('href', ROUTES.reportsFinancial)
    expect(screen.getByRole('link', { name: /View Pharmacy/ })).toHaveAttribute('href', ROUTES.reportsPharmacy)
  })
})

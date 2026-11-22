import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { pathFor, ROUTES } from '../../../config/routes'
import { authState } from '../../../test/auth'
import { renderBillingRoute, renderRoute } from '../../../test/renderRoute'
import { billingFake } from '../../../test/fixtures/billingFake'
import { apiLead, createLeadsApi, overdueLead } from '../../../test/fixtures/leadsApi'
import { apiConversation, apiTemplate, createMessagingApi } from '../../../test/fixtures/messagingApi'
import { apiRun, apiWorkflow, createCampaignsApi } from '../../../test/fixtures/campaignsApi'
import { apiEscalation, apiPost, apiReview, createContentApi } from '../../../test/fixtures/contentApi'
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
  ['GO-08 Campaign Details', pathFor(ROUTES.campaign, { campaignId: 'cmp-1' }), 'Campaign Details & Performance'],
  ['GO-09 Create campaign', ROUTES.campaignNew, 'Create/Edit Campaign'],
  ['GO-09 Edit campaign', pathFor(ROUTES.campaignEdit, { campaignId: 'cmp-1' }), 'Create/Edit Campaign'],
  ['GO-10 Audiences', ROUTES.audiences, 'Audience Management'],
  ['GO-10A Create segment', ROUTES.segmentNew, 'Create/Edit Audience Segment'],
  ['GO-10A Edit segment', pathFor(ROUTES.segmentEdit, { segmentId: 'a-1' }), 'Create/Edit Audience Segment'],
  ['GO-11 Content Calendar', ROUTES.content, 'Content Calendar'],
  ['GO-12 Create content', ROUTES.contentNew, 'Create/Edit Content'],
  ['GO-12 Edit content', pathFor(ROUTES.contentEdit, { contentId: 'post-1' }), 'Create/Edit Content'],
  ['GO-13 Templates', ROUTES.contentTemplates, 'Content Templates'],
  ['GO-14 Schedule/Publish', pathFor(ROUTES.contentSchedule, { contentId: 'post-1' }), 'Schedule/Publish'],
  ['GO-15 Business Profile', ROUTES.businessProfile, 'Business Profile & Locations'],
  ['GO-16 Reviews', ROUTES.reviews, 'Reviews & Reputation Register'],
  ['GO-17 Review Details', pathFor(ROUTES.review, { reviewId: 'rev-1' }), 'Review Details & Response'],
  ['GO-18 Review Requests', ROUTES.reviewRequests, 'Review Request Workflow'],
  ['GO-19 Escalation', ROUTES.escalations, 'Feedback Escalation'],
  ['GO-20 Reputation', ROUTES.reputation, 'Reputation Reporting'],
  ['GO-21 Inbox', ROUTES.conversations, 'Conversations Inbox'],
  ['GO-22 Thread', pathFor(ROUTES.conversation, { threadId: 'c-1' }), 'Conversation Thread & Patient Context'],
  ['GO-23 Message Templates', ROUTES.messageTemplates, 'Message Templates'],
  ['GO-24 History', pathFor(ROUTES.communicationHistory, { threadId: 'c-1' }), 'Communication History & Preferences'],
  ['GO-25 Channels', ROUTES.channels, 'Channel / Integration Configuration'],
  ['GO-26 Delivery', ROUTES.deliveryFailures, 'Delivery Failures & Retry'],
  ['GO-27 Workflows', ROUTES.workflows, 'Retention & Reminder Workflows'],
  ['GO-28 Create workflow', ROUTES.workflowNew, 'Create Retention Workflow'],
  ['GO-28 Edit workflow', pathFor(ROUTES.workflowEdit, { workflowId: 'wf-1' }), 'Edit Retention Workflow'],
  ['GO-29 Executions', ROUTES.workflowExecutions, 'Workflow Execution & Exceptions'],
  ['GO-30 Performance', ROUTES.growthPerformance, 'Growth Performance & Attribution'],
  ['GO-31 Attribution', pathFor(ROUTES.campaignAttribution, { campaignId: 'cmp-1' }), 'Campaign Attribution Details'],
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
    [pathFor(ROUTES.campaign, { campaignId: 'cmp-9999' }), 'Campaign not found'],
    [pathFor(ROUTES.review, { reviewId: 'rev-9999' }), 'Review not found'],
    [pathFor(ROUTES.conversation, { threadId: 'c-9999' }), 'Conversation not found'],
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

  it('links the review, escalation and reporting screens to each other', async () => {
    billingFake.useContent(createContentApi({ escalations: [apiEscalation()] }))
    renderRoute(ROUTES.escalations)
    expect(screen.getByRole('link', { name: /Reputation report/ })).toHaveAttribute('href', ROUTES.reputation)
    expect(await screen.findByRole('link', { name: /Source review/ })).toHaveAttribute('href', pathFor(ROUTES.review, { reviewId: 'rev-1' }))
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
  it('requires a reason and confirmation before a budget change is saved, and keeps it in the history', async () => {
    const user = setup()
    const campaigns = billingFake.campaigns
    const router = renderRoute(pathFor(ROUTES.campaignEdit, { campaignId: 'cmp-1' }))

    await fill(user, await screen.findByLabelText(/^Planned budget/), '48000')
    expect(screen.getAllByText(/₹45,000 → ₹48,000/).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Save campaign' })).toBeDisabled()

    await fill(user, screen.getByLabelText(/^Change reason/), 'More creative testing')
    await user.click(screen.getByRole('checkbox', { name: /I confirm this change/ }))
    await user.click(screen.getByRole('button', { name: 'Save campaign' }))

    await waitFor(() => expect(router.state.location.pathname).toBe(pathFor(ROUTES.campaign, { campaignId: 'cmp-1' })))
    expect(await screen.findByText('Budget: ₹45,000 → ₹48,000. Reason: More creative testing')).toBeInTheDocument()
    expect(campaigns.state.calls.find(([name]) => name === 'updateCampaign')[2]).toMatchObject({ budget: 48000, changeNote: 'More creative testing', version: 1 })
  })

  it('shows performance from recorded leads and records spend', async () => {
    const user = setup()
    renderRoute(pathFor(ROUTES.campaign, { campaignId: 'cmp-1' }))

    expect(await screen.findByText('₹6,000 per recorded lead')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'LD-000001 · Nisha Menon' })).toBeInTheDocument()
    await fill(user, screen.getByLabelText(/^Amount/), '3000')
    await fill(user, screen.getByLabelText(/^Source of the figure/), 'Google Ads invoice 77')
    await user.click(screen.getByRole('button', { name: 'Add spend' }))

    expect(await screen.findByText(/Google Ads invoice 77/)).toBeInTheDocument()
    expect(billingFake.campaigns.state.calls.find(([name]) => name === 'addSpend')[2]).toMatchObject({ amount: 3000, note: 'Google Ads invoice 77' })
  })

  it('sends a broadcast only after checking who it reaches and confirming that number', async () => {
    const user = setup()
    renderRoute(pathFor(ROUTES.campaign, { campaignId: 'cmp-1' }))

    await waitFor(() => expect(screen.getByLabelText('Approved template')).toHaveTextContent('MT-0001 · Follow-up check-in'))
    await user.selectOptions(screen.getByLabelText('Approved template'), 't-1')
    await fill(user, screen.getByLabelText(/^service name/), 'knee screening')
    await user.click(screen.getByRole('button', { name: 'Check who it reaches' }))

    expect(await screen.findByText('2 of 3 will receive it')).toBeInTheDocument()
    expect(screen.getByText('Opted out on this channel: 1')).toBeInTheDocument()
    expect(screen.getByText('Hello Nisha, are you still looking for help with knee screening?')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Send broadcast' })).toBeDisabled()
    await user.click(screen.getByRole('checkbox', { name: /I confirm sending MT-0001 to 2 people/ }))
    await user.click(screen.getByRole('button', { name: 'Send broadcast' }))

    expect(await screen.findByText(/Broadcast confirmed for 2 people/)).toBeInTheDocument()
    expect(billingFake.campaigns.state.calls.find(([name]) => name === 'launchBroadcast')[2]).toEqual({ templateId: 't-1', variables: { service_name: 'knee screening' }, expectedRecipients: 2, sendAt: null, confirm: true })
  })

  it('records the campaign a new lead came from', async () => {
    const user = setup()
    const leads = billingFake.useLeads(createLeadsApi({ leads: [] }))
    renderRoute(ROUTES.leadNew)

    await fill(user, screen.getByLabelText(/^Full name/), 'Sana Iqbal')
    await fill(user, screen.getByLabelText(/^Phone/), '91234 56780')
    await waitFor(() => expect(within(screen.getByLabelText(/^Campaign/)).getAllByRole('option').map((option) => option.textContent)).toContain('CMP-0001 · Knee care camp'))
    await user.selectOptions(screen.getByLabelText(/^Campaign/), 'cmp-1')
    await user.click(screen.getByRole('button', { name: 'Create lead' }))

    await waitFor(() => expect(leads.state.calls.find(([name]) => name === 'create')?.[1]).toMatchObject({ campaignId: 'cmp-1' }))
    expect(await screen.findByRole('link', { name: 'CMP-0001 · Knee care camp' })).toBeInTheDocument()
  })

  it('counts the selected audience per channel', async () => {
    renderRoute(ROUTES.audiences)
    const row = await screen.findByRole('row', { name: /WhatsApp/ })
    expect(within(row).getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['2', '1', '0', '0'])
    expect(billingFake.campaigns.state.calls.find(([name]) => name === 'countAudience')[1]).toMatchObject({ branchId: 'b-main', rules: { include: 'leads' } })
  })

  it('requires a lead stage before a segment definition is saved, then saves the rules', async () => {
    const user = setup()
    const router = renderRoute(ROUTES.segmentNew)

    await fill(user, screen.getByLabelText(/^Segment name/), 'New segment')
    await fill(user, screen.getByLabelText(/^Purpose/), 'Test purpose')
    await user.click(screen.getByRole('button', { name: 'Save definition' }))
    expect(screen.getByText('Choose at least one lead stage before saving.')).toBeInTheDocument()

    await user.click(screen.getByRole('checkbox', { name: 'Qualified' }))
    await fill(user, screen.getByLabelText(/^Interest contains/), 'dental')
    expect(await screen.findByText('3 leads · 0 patients')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Save definition' }))

    await waitFor(() => expect(router.state.location.pathname).toBe(ROUTES.audiences))
    expect(billingFake.campaigns.state.calls.find(([name]) => name === 'createAudience')[1]).toMatchObject({ name: 'New segment', status: 'draft', rules: { include: 'leads', leadStages: ['qualified'], leadInterest: 'dental' } })
  })
})

describe('content', () => {
  it('shows live posts on the calendar and switches to the list view', async () => {
    const user = setup()
    renderRoute(ROUTES.content)

    expect(await screen.findByRole('button', { name: 'Plan your preventive health check Draft' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^list/i }))
    expect(screen.getByRole('button', { name: 'Plan your preventive health check' })).toBeInTheDocument()
  })

  it('starts a draft from a template with the template copy filled in', async () => {
    const user = setup()
    billingFake.useContent(createContentApi({ templates: [{ id: 'tpl-1', code: 'TPL-0001', title: 'Bring your questions to your visit', category: 'Health education', body: 'Write down your questions.', cta: 'Contact the clinic', targets: ['facebook'], archived: false, version: 3, updatedAt: '2026-11-18T05:00:00.000Z', updatedBy: 'Meera Shah' }] }))
    const router = renderRoute(ROUTES.contentTemplates)

    await user.click(await screen.findByRole('button', { name: /Use template/ }))

    expect(router.state.location.pathname).toBe(ROUTES.contentNew)
    await waitFor(() => expect(screen.getByLabelText(/^Title/)).toHaveValue('Bring your questions to your visit'))
    expect(screen.getByText(/New from template · TPL-0001 v3/)).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Instagram' })).not.toBeChecked()
  })

  it('submits a draft for review only after both checks, and leaves approval to someone else', async () => {
    const user = setup()
    const content = billingFake.content
    renderRoute(pathFor(ROUTES.contentSchedule, { contentId: 'post-1' }))

    const submit = await screen.findByRole('button', { name: 'Submit for review' })
    expect(submit).toBeDisabled()
    await user.click(screen.getByRole('checkbox', { name: /rights to use the image/ }))
    await user.click(screen.getByRole('checkbox', { name: /promises no results/ }))
    await user.click(screen.getByRole('button', { name: 'Submit for review' }))

    expect(await screen.findByText('Waiting for someone else to review')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Approve & schedule' })).not.toBeInTheDocument()
    expect(content.state.calls.find(([name]) => name === 'submitPost')[2]).toMatchObject({ rightsReviewed: true, version: 1 })
  })

  it('lets a second person approve or send back a post with a reason', async () => {
    const user = setup()
    const content = billingFake.useContent(createContentApi({ posts: [apiPost({ status: 'in_review', submittedBy: 'Priya Nair', submittedById: 'user-2', submittedAt: '2026-11-19T05:00:00.000Z', version: 2 })] }))
    renderRoute(pathFor(ROUTES.contentSchedule, { contentId: 'post-1' }))

    expect(await screen.findByRole('button', { name: 'Send back to draft' })).toBeDisabled()
    await fill(user, screen.getByLabelText(/^Note to the author/), 'Remove the word guarantee.')
    await user.click(screen.getByRole('button', { name: 'Send back to draft' }))

    await waitFor(() => expect(screen.getByText('Sent back to draft with your note.')).toBeInTheDocument())
    expect(content.state.calls.find(([name]) => name === 'decidePost')[2]).toEqual({ decision: 'reject', note: 'Remove the word guarantee.', version: 2 })
  })

  it('uploads an image for a new post and saves the draft', async () => {
    const user = setup()
    const content = billingFake.content
    const router = renderRoute(ROUTES.contentNew)

    await fill(user, await screen.findByLabelText(/^Title/), 'Festive hours')
    await fill(user, screen.getByLabelText(/^Caption/), 'Our festive opening hours.')
    await fill(user, screen.getByLabelText(/^Call to action/), 'See hours')
    await fill(user, screen.getByLabelText(/^Destination URL/), 'https://aura.example/hours')
    await fill(user, screen.getByLabelText(/^Alt text/), 'Card listing the festive hours.')
    await fill(user, screen.getByLabelText(/^Intended date/), addIsoDays(localToday(), 2))
    await user.upload(screen.getByLabelText(/^Image/), new File(['png-bytes'], 'hours.png', { type: 'image/png' }))
    expect(await screen.findByText(/hours\.png/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Save Draft' }))

    await waitFor(() => expect(router.state.location.pathname).toBe(ROUTES.content))
    expect(content.state.calls.find(([name]) => name === 'createPost')[1]).toMatchObject({ title: 'Festive hours', mediaId: 'media-9', targets: ['facebook', 'instagram'], time: '10:00' })
  })
})

describe('reviews and messaging', () => {
  it('blocks a public reply that contains a phone number, then submits a clean one', async () => {
    const user = setup()
    const content = billingFake.content
    renderRoute(pathFor(ROUTES.review, { reviewId: 'rev-1' }))

    await fill(user, await screen.findByLabelText(/^Reply/), 'Please call me on 9876543210.')
    expect(screen.getByText('Possible personal or clinical detail')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Submit for approval' })).toBeDisabled()

    await fill(user, screen.getByLabelText(/^Reply/), 'Thank you. We have updated our holiday hours on the listing.')
    await user.click(screen.getByRole('button', { name: 'Save draft' }))
    await waitFor(() => expect(screen.getByText('Draft saved. It is not posted.')).toBeInTheDocument())
    await waitFor(() => expect(screen.getByRole('button', { name: 'Submit for approval' })).toBeEnabled())
    await user.click(screen.getByRole('button', { name: 'Submit for approval' }))

    expect(await screen.findByText(/Waiting for someone else to approve/)).toBeInTheDocument()
    expect(content.state.calls.map(([name]) => name)).toEqual(expect.arrayContaining(['saveResponse', 'submitResponse']))
  })

  it('opens an internal escalation from a review', async () => {
    const user = setup()
    const content = billingFake.content
    renderRoute(pathFor(ROUTES.review, { reviewId: 'rev-1' }))

    await waitFor(() => expect(screen.getByLabelText(/^Owner/)).toHaveValue('m-1'))
    await user.click(screen.getByRole('button', { name: 'Open escalation' }))
    await waitFor(() => expect(screen.getByText('Escalation opened.')).toBeInTheDocument())
    expect(content.state.calls.find(([name]) => name === 'createEscalation')[1]).toMatchObject({ reviewId: 'rev-1', topic: 'Holiday hours were unclear on the listing', severity: 'high', ownerMembershipId: 'm-1' })
  })

  it('says why the register is empty when Google is not connected', async () => {
    billingFake.useContent(createContentApi({ reviews: [], integrations: { meta: 'connected', google: 'not_connected' } }))
    renderRoute(ROUTES.reviews)
    expect(await screen.findByText('Google Business Profile is not connected')).toBeInTheDocument()
    expect(screen.getByText('No reviews have been fetched yet.')).toBeInTheDocument()
  })

  it('reports reputation from the fetched reviews with their denominators', async () => {
    billingFake.useContent(createContentApi({ reviews: [apiReview(), apiReview({ id: 'rev-2', rating: 5, publicReply: 'Thank you!', publicReplyAt: '2026-11-18T12:00:00.000Z' })] }))
    renderRoute(ROUTES.reputation)
    expect(await screen.findByText('3.5 / 5')).toBeInTheDocument()
    expect(screen.getByText('1 of 2')).toBeInTheDocument()
  })

  it('saves the branch profile and syncs it to Google only after confirming', async () => {
    const user = setup()
    const content = billingFake.content
    renderRoute(ROUTES.businessProfile)

    await fill(user, await screen.findByLabelText(/^Street address/), 'Plot 42, Road 36')
    await fill(user, screen.getByLabelText(/^PIN code/), '500033')
    await user.selectOptions(screen.getByLabelText(/^Primary category/), 'Medical clinic')
    await waitFor(() => expect(within(screen.getByLabelText(/^Google location/)).getAllByRole('option')).toHaveLength(2))
    await user.selectOptions(screen.getByLabelText(/^Google location/), 'locations/1234567890')
    await fill(user, screen.getByLabelText(/^Public review link/), 'https://g.page/r/aura/review')
    await user.click(screen.getByRole('button', { name: 'Save profile' }))

    const sync = await screen.findByRole('button', { name: 'Sync to Google' })
    expect(sync).toBeDisabled()
    await user.click(screen.getByRole('checkbox', { name: /details are correct for the public listing/ }))
    await user.click(sync)
    await waitFor(() => expect(content.state.calls.find(([name]) => name === 'syncProfile')).toEqual(['syncProfile', 'b-main', 1]))
    expect(content.state.calls.find(([name]) => name === 'saveProfile')[2]).toMatchObject({ street: 'Plot 42, Road 36', postalCode: '500033', googleLocation: 'locations/1234567890', reviewUrl: 'https://g.page/r/aura/review' })
  })

  it('rejects a template variable that is not on the allowlist', async () => {
    const user = setup()
    renderRoute(ROUTES.messageTemplates)

    await fill(user, await screen.findByLabelText(/^Message body/), 'Hello {{preferred_name}} {{secret}}')

    expect(screen.getByText('Unknown variable: {{secret}}')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save as new version' })).toBeDisabled()
  })

  it('saves a template as a new version only with a change reason, and needs the provider reference to approve', async () => {
    const user = setup()
    const messaging = billingFake.useMessaging(createMessagingApi({ templates: [apiTemplate({ status: 'draft', providerRef: null, version: 1 })] }))
    renderRoute(ROUTES.messageTemplates)

    await user.selectOptions(await screen.findByLabelText('Status'), 'approved')
    expect(screen.getByText('Enter the Meta template name before approving.')).toBeInTheDocument()
    await fill(user, screen.getByLabelText('Meta template name'), 'follow_up_v1')
    await fill(user, screen.getByLabelText(/^Change reason/), 'Approved by Meta')
    await user.click(screen.getByRole('button', { name: 'Save as new version' }))

    await waitFor(() => expect(screen.getByText('Saved MT-0001 as v2.')).toBeInTheDocument())
    expect(messaging.state.calls.find(([name]) => name === 'updateTemplate')[2]).toMatchObject({ status: 'approved', providerRef: 'follow_up_v1', changeNote: 'Approved by Meta', version: 1 })
  })

  it('answers an enquiry inside the WhatsApp reply window and marks the thread read', async () => {
    const user = setup()
    const messaging = billingFake.messaging
    renderRoute(pathFor(ROUTES.conversation, { threadId: 'c-1' }))

    expect(await screen.findByText('Do you treat frozen shoulder?')).toBeInTheDocument()
    await waitFor(() => expect(messaging.state.calls.find(([name]) => name === 'updateConversation')?.[2]).toEqual({ unread: false, version: 1 }))
    await fill(user, screen.getByLabelText('Message'), 'Yes, we do. Shall we call you?')
    await user.click(screen.getByRole('button', { name: 'Send' }))

    expect(await screen.findByText('Message queued. Its status updates here as the provider reports it.')).toBeInTheDocument()
    expect(await screen.findByText('Yes, we do. Shall we call you?')).toBeInTheDocument()
    expect(screen.getByText('Queued')).toBeInTheDocument()
    expect(messaging.state.calls.find(([name]) => name === 'sendMessage')[2]).toEqual({ body: 'Yes, we do. Shall we call you?' })
  })

  it('sends a template once its variables are filled, and explains an opt-out', async () => {
    const user = setup()
    const messaging = billingFake.useMessaging(createMessagingApi({ conversations: [apiConversation({ lastInboundAt: null, replyWindowOpen: false, lead: { id: 'l-1', number: 'LD-000001', fullName: 'Nisha Menon' }, address: '9848022110' })] }))
    renderRoute(pathFor(ROUTES.conversation, { threadId: 'c-1' }))

    expect(await screen.findByRole('radio', { name: 'Write a reply' })).toBeDisabled()
    await screen.findByRole('option', { name: /Follow-up check-in/ })
    await user.selectOptions(screen.getByLabelText('Approved template'), 't-1')
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()
    await fill(user, screen.getByLabelText(/^service name/), 'knee physiotherapy')
    expect(screen.getByText('Hello Nisha, are you still looking for help with knee physiotherapy?')).toBeInTheDocument()

    messaging.state.consents.push({ id: 'k-1', channel: 'whatsapp', address: '9848022110', status: 'withdrawn', source: 'stop_reply', note: null, createdAt: '2026-11-19T05:00:00.000Z', recordedBy: null })
    await user.click(screen.getByRole('button', { name: 'Send' }))
    expect(await screen.findByText('This contact has opted out of messages on this channel.')).toBeInTheDocument()
    expect(screen.getByText('This contact opted out on this channel.')).toBeInTheDocument()
  })

  it('links an unknown contact to a lead after a search', async () => {
    const user = setup()
    billingFake.useLeads(createLeadsApi({ leads: [apiLead({ id: 'l-2', number: 'LD-000002', fullName: 'Rohan Mehta', mobile: '9000000002' })] }))
    renderRoute(pathFor(ROUTES.conversation, { threadId: 'c-1' }))

    await user.click(await screen.findByRole('searchbox', { name: 'Find a lead or patient' }))
    await user.paste('rohan')
    await user.click(await screen.findByRole('button', { name: 'Link' }))
    expect(await screen.findByText('Linked to Rohan Mehta.')).toBeInTheDocument()
    expect(billingFake.messaging.state.calls.find(([name]) => name === 'link')[2]).toEqual({ leadId: 'l-2', version: 2 })
  })

  it('records a contact’s permission with how it was given', async () => {
    const user = setup()
    renderRoute(pathFor(ROUTES.communicationHistory, { threadId: 'c-1' }))

    expect(await screen.findByText('No permission recorded')).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('How'), 'written_form')
    await user.click(screen.getByRole('checkbox', { name: /I confirm this is what the contact told us/ }))
    await user.click(screen.getByRole('button', { name: 'Record' }))

    expect(await screen.findByText('Permission recorded for this channel')).toBeInTheDocument()
    expect(billingFake.messaging.state.calls.find(([name]) => name === 'recordConsent')[1]).toMatchObject({ channel: 'whatsapp', address: '9000000002', status: 'granted', source: 'written_form' })
  })

  it('reassigns an inbox conversation and marks it resolved', async () => {
    const user = setup()
    renderRoute(ROUTES.conversations)

    await user.selectOptions(await screen.findByLabelText('Current owner'), 'm-2')
    await waitFor(() => expect(screen.getByLabelText('Current owner')).toHaveValue('m-2'))
    await user.click(screen.getByRole('button', { name: 'Mark resolved' }))

    expect(await screen.findByRole('button', { name: 'Reopen' })).toBeInTheDocument()
  })

  it('connects a channel and keeps saved credentials hidden', async () => {
    const user = setup()
    const messaging = billingFake.messaging
    renderRoute(ROUTES.channels)

    expect(await screen.findByText('https://api.clinic.test/v1/webhooks/whatsapp/tok')).toBeInTheDocument()
    expect(screen.getByLabelText('Permanent access token')).toHaveValue('')
    expect(screen.getByLabelText('Permanent access token')).toHaveAttribute('placeholder', 'Saved · leave blank to keep')
    await user.click(screen.getByRole('radio', { name: /SMS/ }))
    await fill(user, screen.getByLabelText('DLT sender ID'), 'AURAHC')
    await fill(user, screen.getByLabelText('MSG91 auth key'), 'msg91-key')
    await user.click(screen.getByRole('button', { name: 'Connect & verify' }))

    expect(await screen.findByText('SMS connected')).toBeInTheDocument()
    expect(messaging.state.calls.find(([name]) => name === 'saveChannel')).toEqual(['saveChannel', 'sms', expect.objectContaining({ senderId: 'AURAHC', authKey: 'msg91-key' })])
  })

  it('hides channel setup from people who do not manage the organisation', async () => {
    renderRoute(ROUTES.channels, undefined, { auth: authState({ permissions: ['growth.view'] }) })
    expect(screen.getByText('Only organisation administrators can view or change channels')).toBeInTheDocument()
  })
})

describe('workflows', () => {
  it('creates a workflow switched off, and cannot switch it on without a template', async () => {
    const user = setup()
    const campaigns = billingFake.useCampaigns(createCampaignsApi({ workflows: [] }))
    const router = renderRoute(ROUTES.workflowNew)

    await user.click(screen.getByRole('button', { name: 'Save draft' }))
    expect(screen.getByText('Enter a workflow name.')).toBeInTheDocument()
    await fill(user, screen.getByLabelText(/^Workflow name/), 'Revisit check-in')
    await user.selectOptions(screen.getByLabelText(/^Trigger/), 'revisit_due')
    await fill(user, screen.getByLabelText(/^Send after/), '30')
    await user.click(screen.getByRole('button', { name: 'Save draft' }))

    await waitFor(() => expect(router.state.location.pathname).toBe(pathFor(ROUTES.workflowEdit, { workflowId: 'wf-1' })))
    expect(campaigns.state.calls.find(([name]) => name === 'createWorkflow')[1]).toMatchObject({ name: 'Revisit check-in', trigger: 'revisit_due', delayHours: 720, weeklyCap: 2 })
    expect(await screen.findByText('• Choose a message template.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Activate' })).toBeDisabled()
  })

  it('asks for confirmation before switching a ready workflow on, and locks it while on', async () => {
    const user = setup()
    const campaigns = billingFake.useCampaigns(createCampaignsApi({ workflows: [apiWorkflow()] }))
    renderRoute(pathFor(ROUTES.workflowEdit, { workflowId: 'wf-1' }))

    await user.click(await screen.findByRole('button', { name: 'Activate' }))
    expect(screen.getByRole('button', { name: 'Switch on' })).toBeDisabled()
    await user.click(screen.getByRole('checkbox', { name: /I confirm this workflow may send/ }))
    await user.click(screen.getByRole('button', { name: 'Switch on' }))

    expect(await screen.findByText('This workflow is on')).toBeInTheDocument()
    expect(screen.getByLabelText(/^Workflow name/)).toBeDisabled()
    expect(campaigns.state.calls.find(([name]) => name === 'activateWorkflow')).toEqual(['activateWorkflow', 'wf-1', 1])
    await user.click(screen.getByRole('button', { name: 'Pause' }))
    expect(await screen.findByRole('button', { name: 'Activate' })).toBeInTheDocument()
  })

  it('lists each event a workflow acted on, with the reason and a safe next step', async () => {
    const user = setup()
    const failed = apiRun({ id: 'run-2', outcome: 'queued', skipReason: null, skipLabel: null, createdAt: '2026-11-19T04:00:00.000Z', message: { id: 'msg-1', status: 'failed', errorCode: '131026', errorMessage: 'Message undeliverable', conversationId: 'c-1', sentAt: null, deliveredAt: null } })
    billingFake.useCampaigns(createCampaignsApi({ runs: [apiRun(), failed] }))
    renderRoute(ROUTES.workflowExecutions)

    expect((await screen.findAllByText('No recorded permission')).length).toBe(2)
    expect(screen.getByText(/Record the person’s permission for this channel/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '19 Nov 2026 · 09:30 IST' }))
    expect(screen.getByText(/The provider rejected the message/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open conversation' })).toHaveAttribute('href', pathFor(ROUTES.conversation, { threadId: 'c-1' }))
  })

  it('never retries an unknown outcome until it is resolved, then retries after the checks', async () => {
    const user = setup()
    const failed = { ...apiConversation().messages[0], id: 'm-9', direction: 'outbound', status: 'unknown', body: 'Hello', errorCode: 'TIMEOUT', errorMessage: 'The provider did not answer in time.', attempts: 1 }
    const messaging = billingFake.useMessaging(createMessagingApi({ conversations: [apiConversation({ messages: [failed] })] }))
    renderRoute(ROUTES.deliveryFailures)

    expect(await screen.findByText('1 message with an unknown outcome')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Retry send' })).not.toBeInTheDocument()
    await fill(user, screen.getByLabelText(/What the provider’s console shows/), 'Not in WhatsApp Manager')
    await user.click(screen.getByRole('button', { name: 'It was not sent' }))

    const retry = await screen.findByRole('button', { name: 'Retry send' })
    expect(retry).toBeDisabled()
    for (const gate of screen.getAllByRole('checkbox')) await user.click(gate)
    await user.click(retry)
    await waitFor(() => expect(screen.getByText('Queued again. Its status updates as the provider reports it.')).toBeInTheDocument())
    expect(messaging.state.calls.map(([name]) => name)).toEqual(expect.arrayContaining(['resolve', 'retry']))
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

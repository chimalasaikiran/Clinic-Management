import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { pathFor, ROUTES } from '../../../config/routes'
import { renderRoute } from '../../../test/renderRoute'

const setup = () => userEvent.setup({ delay: null })

async function fill(user, field, text) {
  await user.click(field)
  await user.clear(field)
  await user.paste(text)
}

beforeEach(() => localStorage.clear())

const SCREENS = [
  ['GO-01 Growth OS', ROUTES.growth, 'Growth OS'],
  ['GO-02 Lead Register', ROUTES.leads, 'Lead Register'],
  ['GO-03 Lead Details', pathFor(ROUTES.lead, { leadId: 'LD1048' }), 'Ananya Rao'],
  ['GO-04 Create lead', ROUTES.leadNew, 'Create/Edit Lead'],
  ['GO-04 Edit lead', pathFor(ROUTES.leadEdit, { leadId: 'LD1048' }), 'Create/Edit Lead'],
  ['GO-05 Lead Follow-up', pathFor(ROUTES.leadFollowUp, { leadId: 'LD1048' }), 'Lead Follow-up'],
  ['GO-06 Conversion', pathFor(ROUTES.leadConvert, { leadId: 'LD1048' }), 'Lead Conversion & Re-engagement'],
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
  it.each(SCREENS)('%s', (_name, path, title) => {
    renderRoute(path)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(title)
  })

  it.each([
    [pathFor(ROUTES.lead, { leadId: 'LD9999' }), 'Lead not found'],
    [pathFor(ROUTES.campaign, { campaignId: 'CMP9999' }), 'Campaign not found'],
    [pathFor(ROUTES.review, { reviewId: 'REV-9999' }), 'Review not found'],
    [pathFor(ROUTES.conversation, { threadId: 'CV-9999' }), 'Conversation not found'],
  ])('shows a not-found page for %s', (path, title) => {
    renderRoute(path)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(title)
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

    await user.click(screen.getByRole('link', { name: /Ananya Rao/ }))
    expect(router.state.location.pathname).toBe(pathFor(ROUTES.lead, { leadId: 'LD1048' }))
    expect(screen.getByRole('link', { name: 'Edit Lead' })).toHaveAttribute('href', pathFor(ROUTES.leadEdit, { leadId: 'LD1048' }))
    expect(screen.getAllByRole('link', { name: 'Record Follow up' })[0]).toHaveAttribute('href', pathFor(ROUTES.leadFollowUp, { leadId: 'LD1048' }))
    expect(screen.getAllByRole('link', { name: 'Convert Lead' })[0]).toHaveAttribute('href', pathFor(ROUTES.leadConvert, { leadId: 'LD1048' }))
  })

  it('links the review, escalation and reporting screens to each other', () => {
    renderRoute(ROUTES.escalations)
    expect(screen.getByRole('link', { name: /Reputation report/ })).toHaveAttribute('href', ROUTES.reputation)
    expect(screen.getByRole('link', { name: /Source review/ })).toHaveAttribute('href', pathFor(ROUTES.review, { reviewId: 'REV-DEMO102' }))
  })
})

describe('leads', () => {
  it('filters the register and keeps the filter in the address', async () => {
    const user = setup()
    const router = renderRoute(ROUTES.leads)

    await user.selectOptions(screen.getByLabelText('Stage'), 'Qualified')

    expect(router.state.location.search).toBe('?stage=Qualified')
    expect(screen.getByText('1 of 3 inquiries')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Rohan Mehta/ })).not.toBeInTheDocument()
  })

  it('creates a lead and opens its details', async () => {
    const user = setup()
    const router = renderRoute(ROUTES.leadNew)

    await user.click(screen.getByRole('button', { name: 'Create lead' }))
    expect(screen.getByText('Enter the lead’s full name.')).toBeInTheDocument()

    await fill(user, screen.getByLabelText(/^Full name/), 'Nisha Menon')
    await fill(user, screen.getByLabelText(/^Phone/), '90000 00004')
    await user.click(screen.getByRole('button', { name: 'Create lead' }))

    expect(router.state.location.pathname).toBe(pathFor(ROUTES.lead, { leadId: 'LD1051' }))
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Nisha Menon')
  })

  it('blocks saving a lead with a duplicate phone until the review is confirmed', async () => {
    const user = setup()
    renderRoute(ROUTES.leadNew)

    await fill(user, screen.getByLabelText(/^Full name/), 'Another Ananya')
    await fill(user, screen.getByLabelText(/^Phone/), '90000 00001')

    expect(screen.getByText('Possible duplicate · Review required')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create lead' })).toBeDisabled()
    await user.click(screen.getByRole('checkbox', { name: /Duplicate review completed/ }))
    expect(screen.getByRole('button', { name: 'Create lead' })).toBeEnabled()
  })

  it('records a follow-up and keeps the original task open', async () => {
    const user = setup()
    const router = renderRoute(pathFor(ROUTES.leadFollowUp, { leadId: 'LD1048' }))

    expect(screen.getByRole('button', { name: 'Record Follow-up' })).toBeDisabled()
    await user.click(screen.getByRole('radio', { name: 'Connected' }))
    await fill(user, screen.getByLabelText(/^Notes/), 'Discussed screening information.')
    await user.click(screen.getByRole('checkbox', { name: /Verify activity and task permissions/ }))
    await user.click(screen.getByRole('checkbox', { name: /Review the activity and task decision/ }))
    await user.click(screen.getByRole('button', { name: 'Record Follow-up' }))

    expect(router.state.location.pathname).toBe(pathFor(ROUTES.lead, { leadId: 'LD1048' }))
    expect(screen.getByText('Phone call · Connected')).toBeInTheDocument()
    expect(screen.getAllByText('Overdue').length).toBeGreaterThan(0)
  })

  it('converts a lead only after the identity path and every confirmation', async () => {
    const user = setup()
    const router = renderRoute(pathFor(ROUTES.leadConvert, { leadId: 'LD1048' }))

    expect(screen.getByRole('button', { name: 'Confirm conversion' })).toBeDisabled()
    await user.click(screen.getByRole('radio', { name: /Create new patient/ }))
    await user.click(screen.getByRole('checkbox', { name: /no matching shared patient exists/ }))
    await user.click(screen.getByRole('checkbox', { name: /Verify identity and document permission/ }))
    await user.click(screen.getByRole('checkbox', { name: 'Confirm the chosen path' }))
    await user.click(screen.getByRole('checkbox', { name: /Verify conversion & branch permissions/ }))
    await user.click(screen.getByRole('checkbox', { name: 'Confirm conversion separately' }))
    await user.click(screen.getByRole('button', { name: 'Confirm conversion' }))

    expect(router.state.location.pathname).toBe(pathFor(ROUTES.lead, { leadId: 'LD1048' }))
    expect(screen.getAllByText('Converted').length).toBeGreaterThan(0)
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

  it('flags a historical tag that predates the proposed campaign window', () => {
    renderRoute(pathFor(ROUTES.campaign, { campaignId: 'CMP2041' }))
    expect(screen.getByText('Historical tag predates proposed schedule · verification required')).toBeInTheDocument()
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
  it('shows the operations measures with their denominators', () => {
    renderRoute(ROUTES.reportsOperations)
    expect(screen.getByText('6.3%')).toBeInTheDocument()
    expect(screen.getByText('10 ÷ 160 (150 completed + 10 no-show). Exact rate 6.25%.')).toBeInTheDocument()
    expect(screen.getByText('15 min')).toBeInTheDocument()
  })

  it('shows billed, collected and outstanding apart from one another', () => {
    renderRoute(ROUTES.reportsFinancial)
    expect(screen.getByText('Billed ≠ collected ≠ recognized revenue')).toBeInTheDocument()
    expect(screen.getAllByText('₹8,500').length).toBeGreaterThan(0)
    expect(screen.getAllByText('₹7,000').length).toBeGreaterThan(0)
    expect(screen.getAllByText('₹3,500').length).toBeGreaterThan(0)
  })

  it('filters the inventory table by expiry status', async () => {
    const user = setup()
    renderRoute(ROUTES.reportsPharmacy)

    await user.selectOptions(screen.getByLabelText(/Stock expiry/), 'Near expiry')

    expect(screen.getByText('2 of 8 SKUs · Main Pharmacy at Main Surgical Pavilion · snapshot 25 Oct 2026 18:00 IST')).toBeInTheDocument()
  })

  it('links the overview to each report', () => {
    renderRoute(ROUTES.reports)
    expect(screen.getByRole('link', { name: /View Operations/ })).toHaveAttribute('href', ROUTES.reportsOperations)
    expect(screen.getByRole('link', { name: /View Financial/ })).toHaveAttribute('href', ROUTES.reportsFinancial)
    expect(screen.getByRole('link', { name: /View Pharmacy/ })).toHaveAttribute('href', ROUTES.reportsPharmacy)
  })
})

import { ApiError } from '../../lib/api'

// An in-memory stand-in for the content, media, business profile, review and integration endpoints, enough for the
// Growth screens. `state.calls` records each request. Two-person approval, publishing, Google sync and the privacy
// check are tested in backend/test/integration/content-reviews.test.ts.

const clone = (value) => structuredClone(value)
const NOW = () => new Date().toISOString()
const BRANCH = { id: 'b-main', name: 'Main Clinic' }
const OWNERS = [{ membershipId: 'm-1', name: 'Meera Shah' }, { membershipId: 'm-2', name: 'Priya Nair' }]
const tomorrowAt = (time) => {
  const day = new Date(Date.now() + 86_400_000).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
  return new Date(`${day}T${time}:00+05:30`).toISOString()
}

export const apiPost = (overrides = {}) => ({
  id: 'post-1', code: 'CNT-0001', title: 'Plan your preventive health check', category: 'Prevention', caption: 'A preventive health check helps you discuss your health with a clinician.',
  targets: ['facebook', 'instagram'], cta: 'Enquire with the clinic', url: 'https://aura.example/screening', altText: 'Typographic card reading “Plan your preventive health check”.',
  templateVersion: null, scheduledAt: tomorrowAt('10:00'), status: 'draft', rightsReviewed: false, submittedAt: null, approvedAt: null, reviewNote: null, publishedAt: null, version: 1,
  createdAt: '2026-11-18T05:00:00.000Z', updatedAt: '2026-11-18T05:00:00.000Z', branch: BRANCH, media: { id: 'media-1', fileName: 'card.png', mimeType: 'image/png', size: 20480 }, template: null,
  owner: OWNERS[0], submittedBy: null, submittedById: null, approvedBy: null, publications: [],
  events: [{ id: 'ev-1', kind: 'created', text: 'Draft created.', createdAt: '2026-11-18T05:00:00.000Z', actor: 'Meera Shah' }],
  readiness: { metaConnected: true, publicUrlReady: true },
  ...overrides,
})

export const apiReview = (overrides = {}) => ({
  id: 'rev-1', source: 'google', providerReviewId: 'r1', reviewerName: 'Visitor A', rating: 2, comment: 'Holiday hours were unclear on the listing.', postedAt: '2026-11-18T09:00:00.000Z',
  publicReply: null, publicReplyAt: null, syncedAt: '2026-11-19T05:00:00.000Z', branch: BRANCH, response: null, responseState: 'none', escalations: [], notes: [],
  ...overrides,
})

export const apiEscalation = (overrides = {}) => ({
  id: 'esc-1', code: 'ESC-0001', topic: 'Holiday hours unclear', severity: 'medium', dueAt: '2026-11-19T11:30:00.000Z', status: 'open', note: '', resolvedAt: null, version: 1, createdAt: '2026-11-18T10:00:00.000Z', updatedAt: '2026-11-18T10:00:00.000Z',
  review: { id: 'rev-1', reviewerName: 'Visitor A', rating: 2, comment: 'Holiday hours were unclear on the listing.', branch: BRANCH }, owner: OWNERS[0], createdBy: 'Meera Shah', overdue: true,
  ...overrides,
})

const blankProfile = { businessName: 'Main Clinic', street: '', city: 'Hyderabad', state: 'Telangana', postalCode: '', country: 'India', description: '', primaryCategory: null, secondaryCategory: null, phone: null, websiteUrl: null, reviewUrl: null, googleLocation: null, syncedAt: null, syncError: null, reviewsSyncedAt: null, version: 0, updatedAt: null, updatedBy: null, specialHours: [] }

export function createContentApi({ posts = [apiPost()], templates = [], reviews = [apiReview()], escalations = [], profile = null, integrations = { meta: 'connected', google: 'connected' } } = {}) {
  const state = { posts: clone(posts), templates: clone(templates), reviews: clone(reviews), escalations: clone(escalations), profile: clone(profile), integrations: clone(integrations), calls: [] }
  const record = (name, ...args) => state.calls.push([name, ...args])
  const find = (list, id, label) => {
    const entry = state[list].find((item) => item.id === id)
    if (!entry) throw new ApiError(404, 'NOT_FOUND', `${label} not found.`)
    return entry
  }
  const fresh = (entry, version) => {
    if (version !== entry.version) throw new ApiError(409, 'CHANGED', 'Someone else changed this. Reload it and try again.')
  }
  const event = (post, kind, text) => post.events.unshift({ id: `ev-${post.events.length + 1}`, kind, text, createdAt: NOW(), actor: 'Siddharth Verma' })
  const reviewView = (review) => clone({ ...review, responseState: review.response && review.response.status !== 'posted' ? review.response.status : review.publicReply ? 'replied' : 'none', escalations: state.escalations.filter((entry) => entry.review.id === review.id).map(({ id, code, status, severity, dueAt }) => ({ id, code, status, severity, dueAt })) })

  const api = {
    async posts(query = {}) {
      record('posts', query)
      const rows = state.posts.filter((post) => (!query.status || post.status === query.status) && (!query.target || post.targets.includes(query.target)))
      return { data: clone(rows), meta: { page: 1, pageSize: 500, total: rows.length } }
    },
    async post(id) {
      return clone(find('posts', id, 'Content'))
    },
    async owners() {
      return clone(OWNERS)
    },
    async createPost(body) {
      record('createPost', body)
      const post = apiPost({ ...body, id: `post-${state.posts.length + 1}`, code: `CNT-${String(state.posts.length + 1).padStart(4, '0')}`, media: body.mediaId ? { id: body.mediaId, fileName: 'card.png', mimeType: 'image/png', size: 20480 } : null, branch: BRANCH, owner: OWNERS[0], scheduledAt: new Date(`${body.date}T${body.time}:00+05:30`).toISOString() })
      state.posts.push(post)
      return clone(post)
    },
    async updatePost(id, body) {
      record('updatePost', id, body)
      const post = find('posts', id, 'Content')
      fresh(post, body.version)
      Object.assign(post, { title: body.title, caption: body.caption, targets: body.targets, cta: body.cta, url: body.url, altText: body.altText, version: post.version + 1 })
      return clone(post)
    },
    async submitPost(id, body) {
      record('submitPost', id, body)
      const post = find('posts', id, 'Content')
      fresh(post, body.version)
      if (post.targets.includes('instagram') && !post.media) throw new ApiError(422, 'INSTAGRAM_IMAGE', 'Instagram posts need an image. Add one, or post to Facebook only.')
      Object.assign(post, { status: 'in_review', submittedBy: 'Siddharth Verma', submittedById: 'user-1', submittedAt: NOW(), scheduledAt: new Date(`${body.date}T${body.time}:00+05:30`).toISOString(), version: post.version + 1 })
      event(post, 'submitted', 'Submitted for review.')
      return clone(post)
    },
    async decidePost(id, body) {
      record('decidePost', id, body)
      const post = find('posts', id, 'Content')
      fresh(post, body.version)
      if (post.submittedById === 'user-1') throw new ApiError(403, 'SECOND_PERSON_REQUIRED', 'Someone other than the person who submitted it must review this post.')
      if (body.decision === 'approve') Object.assign(post, { status: 'scheduled', approvedBy: 'Siddharth Verma', approvedAt: NOW(), publications: post.targets.map((target) => ({ target, status: 'pending', providerPostId: null, permalink: null, errorCode: null, errorMessage: null, attempts: 0, publishedAt: null })) })
      else Object.assign(post, { status: 'draft', reviewNote: body.note })
      post.version += 1
      event(post, body.decision === 'approve' ? 'approved' : 'rejected', body.decision === 'approve' ? 'Approved.' : `Sent back to draft: ${body.note}`)
      return clone(post)
    },
    async withdrawPost(id, version) {
      record('withdrawPost', id, version)
      const post = find('posts', id, 'Content')
      Object.assign(post, { status: 'draft', publications: [], version: post.version + 1 })
      return clone(post)
    },
    async retryPost(id, version) {
      record('retryPost', id, version)
      const post = find('posts', id, 'Content')
      post.publications = post.publications.map((entry) => (entry.status === 'failed' ? { ...entry, status: 'pending', errorMessage: null } : entry))
      Object.assign(post, { status: 'scheduled', version: post.version + 1 })
      return clone(post)
    },
    async resolvePublication(id, target, body) {
      record('resolvePublication', id, target, body)
      return clone(find('posts', id, 'Content'))
    },
    async templates() {
      return clone(state.templates)
    },
    async createTemplate(body) {
      record('createTemplate', body)
      const template = { ...body, id: `tpl-${state.templates.length + 1}`, code: `TPL-${String(state.templates.length + 1).padStart(4, '0')}`, archived: false, version: 1, updatedAt: NOW(), updatedBy: 'Siddharth Verma' }
      state.templates.push(template)
      return clone(template)
    },
    async updateTemplate(id, body) {
      record('updateTemplate', id, body)
      const template = find('templates', id, 'Template')
      Object.assign(template, { ...body, version: template.version + 1 })
      return clone(template)
    },
    async uploadImage(file) {
      record('uploadImage', file.name)
      return { id: 'media-9', fileName: file.name, mimeType: file.type, size: file.size, createdAt: NOW() }
    },

    async profile(branchId) {
      const googleConnected = state.integrations.google === 'connected'
      return clone({ branch: { id: branchId, code: 'MAIN', name: 'Main Clinic', city: 'Hyderabad', state: 'Telangana' }, saved: Boolean(state.profile), googleConnected, profile: state.profile ?? blankProfile })
    },
    async saveProfile(branchId, body) {
      record('saveProfile', branchId, body)
      state.profile = { ...blankProfile, ...body, id: 'profile-1', version: (state.profile?.version ?? 0) + 1, updatedBy: 'Siddharth Verma', updatedAt: NOW() }
      return api.profile(branchId)
    },
    async syncProfile(branchId, version) {
      record('syncProfile', branchId, version)
      state.profile.syncedAt = NOW()
      return api.profile(branchId)
    },
    async googleLocations() {
      return [{ name: 'locations/1234567890', title: 'Aura Health Main' }]
    },

    async reviews(query = {}) {
      record('reviews', query)
      const rows = state.reviews.filter((review) => (!query.rating || String(review.rating) === String(query.rating)) && (!query.response || reviewView(review).responseState === query.response))
      return { data: rows.map(reviewView), meta: { page: 1, pageSize: 100, total: rows.length, sync: { googleConnected: state.integrations.google === 'connected', linkedBranches: 1, lastSyncedAt: '2026-11-19T05:00:00.000Z' } } }
    },
    async review(id) {
      return reviewView(find('reviews', id, 'Review'))
    },
    async saveResponse(id, body) {
      record('saveResponse', id, body)
      const review = find('reviews', id, 'Review')
      review.response = { id: 'resp-1', text: body.text, status: 'draft', submittedAt: null, approvedAt: null, postedAt: null, reviewNote: null, errorMessage: null, version: (review.response?.version ?? 0) + 1, submittedBy: null, submittedById: null, approvedBy: null }
      return reviewView(review)
    },
    async submitResponse(id, version) {
      record('submitResponse', id, version)
      const review = find('reviews', id, 'Review')
      Object.assign(review.response, { status: 'in_review', submittedBy: 'Siddharth Verma', submittedById: 'user-1', submittedAt: NOW(), version: review.response.version + 1 })
      return reviewView(review)
    },
    async decideResponse(id, body) {
      record('decideResponse', id, body)
      return reviewView(find('reviews', id, 'Review'))
    },
    async addReviewNote(id, text) {
      record('addReviewNote', id, text)
      const review = find('reviews', id, 'Review')
      review.notes.unshift({ id: `note-${review.notes.length + 1}`, text, createdAt: NOW(), author: 'Siddharth Verma' })
      return reviewView(review)
    },
    async syncReviews(branchId) {
      record('syncReviews', branchId)
      return { fetched: state.reviews.length }
    },
    async report(query) {
      record('report', query)
      const rows = state.reviews.filter((review) => !query.rating || String(review.rating) === String(query.rating))
      const total = rows.length
      return {
        from: query.from, to: query.to, branchId: null, total, average: total ? Math.round((rows.reduce((sum, review) => sum + review.rating, 0) / total) * 10) / 10 : null,
        distribution: [5, 4, 3, 2, 1].map((star) => ({ star, count: rows.filter((review) => review.rating === star).length })), replied: rows.filter((review) => review.publicReply).length, medianReplyHours: null,
        byDay: total ? [{ date: rows[0].postedAt.slice(0, 10), count: total }] : [], escalations: { total: state.escalations.length, open: state.escalations.filter((entry) => entry.status !== 'resolved').length, overdue: 0 },
      }
    },
    async escalations(query = {}) {
      record('escalations', query)
      const rows = state.escalations.filter((entry) => (!query.status || entry.status === query.status) && (!query.severity || entry.severity === query.severity))
      return { data: clone(rows), meta: { page: 1, pageSize: 100, total: rows.length } }
    },
    async escalationOwners() {
      return clone(OWNERS)
    },
    async createEscalation(body) {
      record('createEscalation', body)
      const review = find('reviews', body.reviewId, 'Review')
      const escalation = apiEscalation({ id: `esc-${state.escalations.length + 1}`, code: `ESC-${String(state.escalations.length + 1).padStart(4, '0')}`, topic: body.topic, severity: body.severity, review: { id: review.id, reviewerName: review.reviewerName, rating: review.rating, comment: review.comment, branch: BRANCH }, overdue: false })
      state.escalations.push(escalation)
      return clone(escalation)
    },
    async updateEscalation(id, body) {
      record('updateEscalation', id, body)
      const escalation = find('escalations', id, 'Escalation')
      fresh(escalation, body.version)
      Object.assign(escalation, { topic: body.topic, severity: body.severity, status: body.status, note: body.note, resolvedAt: body.status === 'resolved' ? NOW() : null, overdue: body.status !== 'resolved' && escalation.overdue, version: escalation.version + 1 })
      return clone(escalation)
    },

    async integrations() {
      return ['meta', 'google'].map((provider) => ({ provider, status: state.integrations[provider], config: {}, saved: {}, description: state.integrations[provider] === 'connected' ? (provider === 'meta' ? 'Aura Health · Instagram @aurahealth' : 'Google Business Profile · 1 location') : null, verifiedAt: '2026-11-19T05:00:00.000Z', lastError: null, encryptionReady: true, publicUrlReady: true, version: 1 }))
    },
    async saveIntegration(provider, body) {
      record('saveIntegration', provider, body)
      state.integrations[provider] = 'connected'
      return (await api.integrations()).find((entry) => entry.provider === provider)
    },
    async disconnectIntegration(provider) {
      record('disconnectIntegration', provider)
      state.integrations[provider] = 'not_connected'
      return (await api.integrations()).find((entry) => entry.provider === provider)
    },
    imageUrl: (mediaId) => `/media/${mediaId}`,
  }
  return { api, state }
}

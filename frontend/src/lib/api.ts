import axios from 'axios'

// In production the SPA is served by the API on the same origin, so we build
// with VITE_API_URL="" and make requests relative (e.g. "/api/..."). Only fall
// back to the local dev backend when the variable is not defined at all.
const API_BASE_URL =
  import.meta.env.VITE_API_URL === undefined
    ? 'http://localhost:8000'
    : import.meta.env.VITE_API_URL

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

// Auth
export const authApi = {
  register: (data: { email: string; username: string; password: string }) =>
    api.post('/api/auth/register', data).then(r => r.data),
  login: (email: string, password: string) => {
    const form = new FormData()
    form.append('username', email)
    form.append('password', password)
    return api.post('/api/auth/login', form, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data)
  },
  me: () => api.get('/api/auth/me').then(r => r.data),
  updateMe: (data: object) => api.patch('/api/auth/me', data).then(r => r.data),
  forgotPassword: (identifier: string) => api.post('/api/auth/forgot-password', { identifier }).then(r => r.data),
  resetPassword: (token: string, new_password: string) =>
    api.post('/api/auth/reset-password', { token, new_password }).then(r => r.data),
  unsubscribe: (token: string) => api.post('/api/auth/unsubscribe', { token }).then(r => r.data),
  resubscribe: (token: string) => api.post('/api/auth/resubscribe', { token }).then(r => r.data),
}

// Public user profiles
export const usersApi = {
  profile: (username: string) => api.get(`/api/users/${username}`).then(r => r.data),
}

// Billing (Stripe premium)
export const billingApi = {
  price: () => api.get('/api/billing/price').then(r => r.data),
  beta: () => api.get('/api/billing/beta').then(r => r.data),
  checkout: () => api.post('/api/billing/checkout').then(r => r.data),
  portal: () => api.post('/api/billing/portal').then(r => r.data),
}

// Trades & sales (listings)
export const listingsApi = {
  browse: (params?: object) => api.get('/api/listings', { params }).then(r => r.data),
  mine: () => api.get('/api/listings/mine').then(r => r.data),
  create: (data: object) => api.post('/api/listings', data).then(r => r.data),
  remove: (id: number) => api.delete(`/api/listings/${id}`),
  setStatus: (id: number, status: string) => api.patch(`/api/listings/${id}/status`, null, { params: { status } }).then(r => r.data),
  resolve: (id: number, outcome: string) => api.patch(`/api/listings/${id}/resolve`, null, { params: { outcome } }).then(r => r.data),
  stats: () => api.get('/api/listings/stats').then(r => r.data),
  interest: (id: number, message: string) => api.post(`/api/listings/${id}/interest`, { message }).then(r => r.data),
  interests: (id: number) => api.get(`/api/listings/${id}/interests`).then(r => r.data),
  conversations: () => api.get('/api/listings/conversations').then(r => r.data),
  thread: (interestId: number) => api.get(`/api/listings/interest/${interestId}/messages`).then(r => r.data),
  sendMessage: (interestId: number, message: string) => api.post(`/api/listings/interest/${interestId}/messages`, { message }).then(r => r.data),
  resolveThread: (interestId: number, outcome: string) => api.patch(`/api/listings/interest/${interestId}/resolve`, null, { params: { outcome } }).then(r => r.data),
  deleteConversation: (interestId: number) => api.delete(`/api/listings/interest/${interestId}/conversation`),
}

// Feedback / contact
export const feedbackApi = {
  submit: (data: { type: string; message: string; email?: string; page?: string }) =>
    api.post('/api/feedback', data).then(r => r.data),
}

// Admin
export const adminApi = {
  stats: () => api.get('/api/admin/stats').then(r => r.data),
  users: () => api.get('/api/admin/users').then(r => r.data),
  updateUser: (id: number, data: object) => api.patch(`/api/admin/users/${id}`, data).then(r => r.data),
  deleteUser: (id: number) => api.delete(`/api/admin/users/${id}`).then(r => r.data),
  feedback: () => api.get('/api/admin/feedback').then(r => r.data),
  resolveFeedback: (id: number, status: string) => api.patch(`/api/admin/feedback/${id}`, { status }).then(r => r.data),
  campaigns: () => api.get('/api/admin/campaigns').then(r => r.data),
  createCampaign: (data: object) => api.post('/api/admin/campaigns', data).then(r => r.data),
  updateCampaign: (id: number, data: object) => api.patch(`/api/admin/campaigns/${id}`, data).then(r => r.data),
  deleteCampaign: (id: number) => api.delete(`/api/admin/campaigns/${id}`).then(r => r.data),
  testCampaign: (id: number) => api.post(`/api/admin/campaigns/${id}/test`).then(r => r.data),
  sendCampaign: (id: number) => api.post(`/api/admin/campaigns/${id}/send`).then(r => r.data),
  campaignAudience: (segment: string) => api.get('/api/admin/campaigns/audience', { params: { segment } }).then(r => r.data),
  // Stores + events management
  stores: () => api.get('/api/admin/stores').then(r => r.data),
  createStore: (data: object) => api.post('/api/admin/stores', data).then(r => r.data),
  updateStore: (id: number, data: object) => api.patch(`/api/admin/stores/${id}`, data).then(r => r.data),
  deleteStore: (id: number) => api.delete(`/api/admin/stores/${id}`).then(r => r.data),
  syncStoreCalendar: (id: number) => api.post(`/api/admin/stores/${id}/sync-calendar`).then(r => r.data),
  events: () => api.get('/api/admin/events').then(r => r.data),
  createEvent: (data: object) => api.post('/api/admin/events', data).then(r => r.data),
  updateEvent: (id: number, data: object) => api.patch(`/api/admin/events/${id}`, data).then(r => r.data),
  deleteEvent: (id: number) => api.delete(`/api/admin/events/${id}`).then(r => r.data),
}

// Public events calendar + store directory
export const eventsApi = {
  list: (params?: object) => api.get('/api/events', { params }).then(r => r.data),
  filters: () => api.get('/api/events/filters').then(r => r.data),
  stores: (city?: string) => api.get('/api/stores', { params: city ? { city } : undefined }).then(r => r.data),
}

// User-created events
export const userEventsApi = {
  mine: () => api.get('/api/my-events').then(r => r.data),
  create: (data: object) => api.post('/api/my-events', data).then(r => r.data),
  update: (id: number, data: object) => api.patch(`/api/my-events/${id}`, data).then(r => r.data),
  remove: (id: number) => api.delete(`/api/my-events/${id}`),
  get: (id: number, token?: string) => api.get(`/api/events/u/${id}`, { params: token ? { token } : undefined }).then(r => r.data),
  toggleInterest: (id: number, token?: string) => api.post(`/api/events/u/${id}/interest`, null, { params: token ? { token } : undefined }).then(r => r.data),
  comments: (id: number, token?: string) => api.get(`/api/events/u/${id}/comments`, { params: token ? { token } : undefined }).then(r => r.data),
  addComment: (id: number, body: string, token?: string) => api.post(`/api/events/u/${id}/comments`, { body }, { params: token ? { token } : undefined }).then(r => r.data),
  deleteComment: (id: number, commentId: number) => api.delete(`/api/events/u/${id}/comments/${commentId}`),
  icsUrl: (id: number, token?: string) => `${API_BASE_URL}/api/events/u/${id}/ics${token ? `?token=${token}` : ''}`,
}

// Community decks (proxied from Archidekt)
export const communityApi = {
  formats: () => api.get('/api/community/formats').then(r => r.data),
  decks: (params?: object) => api.get('/api/community/decks', { params }).then(r => r.data),
  deck: (id: number) => api.get(`/api/community/decks/${id}`).then(r => r.data),
  copyDeck: (id: number) => api.post(`/api/community/decks/${id}/copy`).then(r => r.data),
}

// Cards
export const cardsApi = {
  search: (q: string, page = 1) => api.get('/api/cards/search', { params: { q, page } }).then(r => r.data),
  autocomplete: (q: string) => api.get('/api/cards/autocomplete', { params: { q } }).then(r => r.data),
  getById: (id: string) => api.get(`/api/cards/${id}`).then(r => r.data),
  prints: (id: string) => api.get(`/api/cards/${id}/prints`).then(r => r.data),
  langVariant: (id: string, lang: string) => api.get(`/api/cards/${id}/lang/${lang}`).then(r => r.data),
  fx: () => api.get('/api/cards/fx/usd-brl').then(r => r.data),
}

// Collection
export const collectionApi = {
  list: (params?: object) => api.get('/api/collection', { params }).then(r => r.data),  // params: page, per_page, condition, foil, set_code, q, rarity
  publicView: (username: string) => api.get(`/api/collection/public/${username}`).then(r => r.data),
  stats: () => api.get('/api/collection/stats').then(r => r.data),
  sets: () => api.get('/api/collection/sets').then(r => r.data),
  cardContext: (scryfallId: string) => api.get(`/api/collection/card-context/${scryfallId}`).then(r => r.data),
  valueHistory: () => api.get('/api/collection/value-history').then(r => r.data),
  add: (data: object) => api.post('/api/collection', data).then(r => r.data),
  update: (id: number, data: object) => api.patch(`/api/collection/${id}`, data).then(r => r.data),
  remove: (id: number) => api.delete(`/api/collection/${id}`),
  bulk: (data: { ids: number[]; action: string; condition?: string; foil?: boolean }) => api.post('/api/collection/bulk', data).then(r => r.data),
  exportCsv: () => api.get('/api/collection/export', { responseType: 'blob' }).then(r => r.data),
  importCsv: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return api.post('/api/collection/import', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data)
  },
}

// Binders
export const bindersApi = {
  list: () => api.get('/api/binders').then(r => r.data),
  create: (data: object) => api.post('/api/binders', data).then(r => r.data),
  get: (id: number) => api.get(`/api/binders/${id}`).then(r => r.data),
  update: (id: number, data: object) => api.patch(`/api/binders/${id}`, data).then(r => r.data),
  delete: (id: number) => api.delete(`/api/binders/${id}`),
  addCard: (binderId: number, data: object) => api.post(`/api/binders/${binderId}/cards`, data).then(r => r.data),
  removeCard: (binderId: number, cardId: number) => api.delete(`/api/binders/${binderId}/cards/${cardId}`),
  setLocation: (binderId: number, cardId: number, data: { page?: number; slot?: number }) =>
    api.patch(`/api/binders/${binderId}/cards/${cardId}`, data).then(r => r.data),
}

// Decks
export const decksApi = {
  list: () => api.get('/api/decks').then(r => r.data),
  create: (data: object) => api.post('/api/decks', data).then(r => r.data),
  import: (data: { name: string; format: string; list: string }) => api.post('/api/decks/import', data).then(r => r.data),
  get: (id: number) => api.get(`/api/decks/${id}`).then(r => r.data),
  delete: (id: number) => api.delete(`/api/decks/${id}`),
  addCard: (deckId: number, data: object) => api.post(`/api/decks/${deckId}/cards`, data).then(r => r.data),
  coverage: (id: number) => api.get(`/api/decks/${id}/coverage`).then(r => r.data),
  analysis: (id: number) => api.get(`/api/decks/${id}/analysis`).then(r => r.data),
  update: (id: number, data: object) => api.patch(`/api/decks/${id}`, data).then(r => r.data),
  compareOptions: () => api.get('/api/decks/compare-options').then(r => r.data),
  suggestions: (id: number) => api.get(`/api/decks/${id}/suggestions`).then(r => r.data),
  publicView: (id: number) => api.get(`/api/decks/public/${id}`).then(r => r.data),
  doctorStatus: () => api.get('/api/decks/doctor/status').then(r => r.data),
  doctor: (id: number, lang: string, refresh = false) => api.post(`/api/decks/${id}/doctor`, null, { params: { lang, refresh } }).then(r => r.data),
  // Folders
  folders: () => api.get('/api/decks/folders').then(r => r.data),
  createFolder: (data: { name: string; color?: string }) => api.post('/api/decks/folders', data).then(r => r.data),
  updateFolder: (id: number, data: { name: string; color?: string }) => api.patch(`/api/decks/folders/${id}`, data).then(r => r.data),
  deleteFolder: (id: number) => api.delete(`/api/decks/folders/${id}`),
  publicFolder: (token: string) => api.get(`/api/decks/folder/${token}/public`).then(r => r.data),
}

// Wishlist
export const wishlistApi = {
  list: () => api.get('/api/wishlist').then(r => r.data),
  add: (data: object) => api.post('/api/wishlist', data).then(r => r.data),
  update: (id: number, data: object) => api.patch(`/api/wishlist/${id}`, data).then(r => r.data),
  remove: (id: number) => api.delete(`/api/wishlist/${id}`),
}

// Sets
export const setsApi = {
  list: () => api.get('/api/sets').then(r => r.data),
  cards: (code: string) => api.get(`/api/sets/${code}/cards`).then(r => r.data),
  addAll: (code: string) => api.post(`/api/sets/${code}/add-all`).then(r => r.data),
}

// Friends
export const friendsApi = {
  list: () => api.get('/api/friends').then(r => r.data),
  requests: () => api.get('/api/friends/requests').then(r => r.data),
  request: (identifier: string) => api.post('/api/friends/request', { identifier }).then(r => r.data),
  accept: (id: number) => api.post(`/api/friends/${id}/accept`).then(r => r.data),
  remove: (id: number) => api.delete(`/api/friends/${id}`),
}

// Shares
export const sharesApi = {
  shareWithFriend: (data: { resource_type: string; resource_id?: number | null; friend_id: number }) =>
    api.post('/api/shares', data).then(r => r.data),
  createPublic: (data: { resource_type: string; resource_id?: number | null }) =>
    api.post('/api/shares/public', data).then(r => r.data),
  mine: () => api.get('/api/shares/mine').then(r => r.data),
  withMe: () => api.get('/api/shares/with-me').then(r => r.data),
  viewWithMe: (id: number) => api.get(`/api/shares/with-me/${id}`).then(r => r.data),
  viewPublic: (token: string) => api.get(`/api/shares/public/${token}`).then(r => r.data),
  viewBySlug: (username: string, slug: string) => api.get(`/api/shares/by-slug/${username}/${slug}`).then(r => r.data),
  updateSlug: (id: number, slug: string) => api.patch(`/api/shares/${id}/slug`, { slug }).then(r => r.data),
  remove: (id: number) => api.delete(`/api/shares/${id}`),
}

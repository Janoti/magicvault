import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Users, Crown, Library, Swords, BookOpen, ShieldCheck, MessageSquare, Check, Pencil, Trash2, Mail, Send, Plus, X, Store as StoreIcon, CalendarDays } from 'lucide-react'
import { adminApi } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import Avatar from '@/components/Avatar'

const EMPTY_STORE = {
  id: null as number | null, name: '', city: '', neighborhood: '', address: '',
  phone: '', phone2: '', email: '', website: '', instagram: '', logo: '',
  is_wpn: false, featured: false, notes: '',
}

function StoresSection() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const { data: stores = [] } = useQuery({ queryKey: ['admin-stores'], queryFn: adminApi.stores })
  const [form, setForm] = useState<any>(EMPTY_STORE)
  const [open, setOpen] = useState(false)
  const refresh = () => qc.invalidateQueries({ queryKey: ['admin-stores'] })

  const saveMut = useMutation({
    mutationFn: () => form.id ? adminApi.updateStore(form.id, form) : adminApi.createStore(form),
    onSuccess: () => { refresh(); setOpen(false) },
    onError: (e: any) => alert(e?.response?.data?.detail || t('admin.stores.saveError')),
  })
  const delMut = useMutation({ mutationFn: (id: number) => adminApi.deleteStore(id), onSuccess: refresh })

  const startNew = () => { setForm(EMPTY_STORE); setOpen(true) }
  const startEdit = (s: any) => { setForm({ ...EMPTY_STORE, ...s }); setOpen(true) }
  const field = (k: string, v: any) => setForm({ ...form, [k]: v })

  const FIELDS: [string, string][] = [
    ['name', t('admin.stores.name')], ['city', t('admin.stores.city')], ['neighborhood', t('admin.stores.neighborhood')],
    ['address', t('admin.stores.address')], ['phone', t('admin.stores.phone')], ['phone2', t('admin.stores.phone2')],
    ['email', t('admin.stores.email')], ['website', t('admin.stores.website')], ['instagram', t('admin.stores.instagram')],
    ['logo', t('admin.stores.logo')],
  ]

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-vault-text"><StoreIcon size={15} /> {t('admin.stores.title')} ({stores.length})</h2>
        <button onClick={startNew} className="btn-primary text-xs flex items-center gap-1 px-3 py-1.5"><Plus size={13} /> {t('admin.stores.new')}</button>
      </div>
      {stores.length === 0 ? (
        <p className="surface p-6 text-center text-vault-muted text-sm">{t('admin.stores.empty')}</p>
      ) : (
        <div className="space-y-2">
          {stores.map((s: any) => (
            <div key={s.id} className="surface p-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-vault-text">{s.name}</span>
                  {s.featured && <span className="text-[10px] text-vault-gold">★</span>}
                  {s.is_wpn && <span className="text-[10px] text-vault-accent">WPN</span>}
                </div>
                <p className="text-xs text-vault-muted truncate">{[s.city, s.neighborhood].filter(Boolean).join(' · ')}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => startEdit(s)} className="text-vault-muted hover:text-vault-accent"><Pencil size={14} /></button>
                <button onClick={() => { if (confirm(t('admin.stores.confirmDelete'))) delMut.mutate(s.id) }} className="text-vault-muted hover:text-red-400"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative z-10 surface p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-bold text-vault-gold">{form.id ? t('admin.stores.editTitle') : t('admin.stores.newTitle')}</h3>
              <button onClick={() => setOpen(false)} className="text-vault-muted hover:text-vault-text"><X size={18} /></button>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              {FIELDS.map(([k, label]) => (
                <div key={k} className={k === 'name' || k === 'address' || k === 'logo' ? 'sm:col-span-2' : ''}>
                  <label className="text-xs text-vault-muted">{label}</label>
                  <input className="input-field w-full" value={form[k] || ''} onChange={(e) => field(k, e.target.value)} />
                </div>
              ))}
              <div className="sm:col-span-2">
                <label className="text-xs text-vault-muted">{t('admin.stores.notes')}</label>
                <textarea className="input-field w-full h-20 resize-y" value={form.notes || ''} onChange={(e) => field('notes', e.target.value)} />
              </div>
              <label className="flex items-center gap-2 text-sm text-vault-text cursor-pointer"><input type="checkbox" checked={!!form.featured} onChange={(e) => field('featured', e.target.checked)} /> {t('admin.stores.featured')}</label>
              <label className="flex items-center gap-2 text-sm text-vault-text cursor-pointer"><input type="checkbox" checked={!!form.is_wpn} onChange={(e) => field('is_wpn', e.target.checked)} /> {t('admin.stores.wpn')}</label>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setOpen(false)} className="btn-ghost flex-1">{t('common.cancel')}</button>
              <button onClick={() => saveMut.mutate()} disabled={saveMut.isPending || !form.name.trim() || !form.city.trim()} className="btn-primary flex-1 disabled:opacity-50">{t('common.save')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const EMPTY_EVENT = {
  id: null as number | null, title: '', store_id: '' as any, city: '', address: '',
  format: '', kind: 'tournament', description: '', entry_fee: '', link: '',
  recurrence: 'none', weekday: 4 as number, event_date: '', time_label: '',
}
const KINDS = ['fnm', 'tournament', 'casual', 'prerelease', 'other']

function EventsSection() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const { data: events = [] } = useQuery({ queryKey: ['admin-events'], queryFn: adminApi.events })
  const { data: stores = [] } = useQuery({ queryKey: ['admin-stores'], queryFn: adminApi.stores })
  const [form, setForm] = useState<any>(EMPTY_EVENT)
  const [open, setOpen] = useState(false)
  const refresh = () => qc.invalidateQueries({ queryKey: ['admin-events'] })

  const payload = () => ({
    ...form,
    store_id: form.store_id ? Number(form.store_id) : null,
    weekday: form.recurrence === 'weekly' ? Number(form.weekday) : null,
    event_date: form.recurrence === 'weekly' ? null : (form.event_date || null),
  })
  const saveMut = useMutation({
    mutationFn: () => form.id ? adminApi.updateEvent(form.id, payload()) : adminApi.createEvent(payload()),
    onSuccess: () => { refresh(); setOpen(false) },
    onError: (e: any) => alert(e?.response?.data?.detail || t('admin.events.saveError')),
  })
  const delMut = useMutation({ mutationFn: (id: number) => adminApi.deleteEvent(id), onSuccess: refresh })

  const startNew = () => { setForm(EMPTY_EVENT); setOpen(true) }
  const startEdit = (ev: any) => { setForm({ ...EMPTY_EVENT, ...ev, store_id: ev.store_id ?? '', weekday: ev.weekday ?? 4, event_date: ev.event_date ?? '' }); setOpen(true) }
  const field = (k: string, v: any) => setForm({ ...form, [k]: v })
  const WEEKDAYS = [t('events.wd.mon'), t('events.wd.tue'), t('events.wd.wed'), t('events.wd.thu'), t('events.wd.fri'), t('events.wd.sat'), t('events.wd.sun')]

  // When linking a store, default the city from it.
  const onStore = (v: string) => {
    const s = stores.find((x: any) => String(x.id) === v)
    setForm({ ...form, store_id: v, city: form.city || (s?.city || '') })
  }

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-vault-text"><CalendarDays size={15} /> {t('admin.events.title')} ({events.length})</h2>
        <button onClick={startNew} className="btn-primary text-xs flex items-center gap-1 px-3 py-1.5"><Plus size={13} /> {t('admin.events.new')}</button>
      </div>
      {events.length === 0 ? (
        <p className="surface p-6 text-center text-vault-muted text-sm">{t('admin.events.empty')}</p>
      ) : (
        <div className="space-y-2">
          {events.map((ev: any) => (
            <div key={ev.id} className="surface p-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-vault-text">{ev.title}</span>
                  {ev.format && <span className="text-[10px] text-vault-accent">{ev.format}</span>}
                </div>
                <p className="text-xs text-vault-muted truncate">
                  {ev.recurrence === 'weekly' ? `${t('admin.events.weekly')}: ${WEEKDAYS[ev.weekday] ?? ''}` : ev.event_date}
                  {ev.time_label ? ` · ${ev.time_label}` : ''}
                  {ev.store_name ? ` · ${ev.store_name}` : ` · ${ev.city}`}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => startEdit(ev)} className="text-vault-muted hover:text-vault-accent"><Pencil size={14} /></button>
                <button onClick={() => { if (confirm(t('admin.events.confirmDelete'))) delMut.mutate(ev.id) }} className="text-vault-muted hover:text-red-400"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative z-10 surface p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-bold text-vault-gold">{form.id ? t('admin.events.editTitle') : t('admin.events.newTitle')}</h3>
              <button onClick={() => setOpen(false)} className="text-vault-muted hover:text-vault-text"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-vault-muted">{t('admin.events.titleField')}</label>
                <input className="input-field w-full" value={form.title} onChange={(e) => field('title', e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-vault-muted">{t('admin.events.store')}</label>
                  <select className="input-field w-full" value={form.store_id} onChange={(e) => onStore(e.target.value)}>
                    <option value="">— {t('admin.events.noStore')} —</option>
                    {stores.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-vault-muted">{t('admin.events.city')}</label>
                  <input className="input-field w-full" value={form.city} onChange={(e) => field('city', e.target.value)} />
                </div>
              </div>
              <div>
                <label className="text-xs text-vault-muted">{t('admin.events.address')}</label>
                <input className="input-field w-full" value={form.address} onChange={(e) => field('address', e.target.value)} placeholder={t('admin.events.addressPh')} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-vault-muted">{t('admin.events.format')}</label>
                  <input className="input-field w-full" value={form.format} onChange={(e) => field('format', e.target.value)} placeholder="Commander, Modern…" />
                </div>
                <div>
                  <label className="text-xs text-vault-muted">{t('admin.events.kind')}</label>
                  <select className="input-field w-full" value={form.kind} onChange={(e) => field('kind', e.target.value)}>
                    {KINDS.map((k) => <option key={k} value={k}>{t(`events.kind.${k}`)}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-vault-muted">{t('admin.events.recurrence')}</label>
                  <select className="input-field w-full" value={form.recurrence} onChange={(e) => field('recurrence', e.target.value)}>
                    <option value="none">{t('admin.events.oneOff')}</option>
                    <option value="weekly">{t('admin.events.weekly')}</option>
                  </select>
                </div>
                {form.recurrence === 'weekly' ? (
                  <div>
                    <label className="text-xs text-vault-muted">{t('admin.events.weekday')}</label>
                    <select className="input-field w-full" value={form.weekday} onChange={(e) => field('weekday', Number(e.target.value))}>
                      {WEEKDAYS.map((w, i) => <option key={i} value={i}>{w}</option>)}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="text-xs text-vault-muted">{t('admin.events.date')}</label>
                    <input type="date" className="input-field w-full" value={form.event_date} onChange={(e) => field('event_date', e.target.value)} />
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-vault-muted">{t('admin.events.time')}</label>
                  <input className="input-field w-full" value={form.time_label} onChange={(e) => field('time_label', e.target.value)} placeholder="19:00" />
                </div>
                <div>
                  <label className="text-xs text-vault-muted">{t('admin.events.fee')}</label>
                  <input className="input-field w-full" value={form.entry_fee} onChange={(e) => field('entry_fee', e.target.value)} placeholder={t('admin.events.feePh')} />
                </div>
              </div>
              <div>
                <label className="text-xs text-vault-muted">{t('admin.events.link')}</label>
                <input className="input-field w-full" value={form.link} onChange={(e) => field('link', e.target.value)} placeholder="https://…" />
              </div>
              <div>
                <label className="text-xs text-vault-muted">{t('admin.events.description')}</label>
                <textarea className="input-field w-full h-20 resize-y" value={form.description} onChange={(e) => field('description', e.target.value)} />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setOpen(false)} className="btn-ghost flex-1">{t('common.cancel')}</button>
              <button onClick={() => saveMut.mutate()} disabled={saveMut.isPending || !form.title.trim() || !form.city.trim()} className="btn-primary flex-1 disabled:opacity-50">{t('common.save')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const EMPTY_CAMPAIGN = { id: null as number | null, subject: '', title: '', body: '', image_url: '', cta_text: '', cta_url: '' }

function CampaignsSection() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const { data } = useQuery({ queryKey: ['admin-campaigns'], queryFn: adminApi.campaigns })
  const campaigns = data?.campaigns ?? []
  const audience = data?.audience ?? 0

  const [form, setForm] = useState(EMPTY_CAMPAIGN)
  const [open, setOpen] = useState(false)
  const refresh = () => qc.invalidateQueries({ queryKey: ['admin-campaigns'] })

  const saveMut = useMutation({
    mutationFn: () => form.id
      ? adminApi.updateCampaign(form.id, form)
      : adminApi.createCampaign(form),
    onSuccess: () => { refresh(); setOpen(false); setForm(EMPTY_CAMPAIGN) },
    onError: (e: any) => alert(e?.response?.data?.detail || t('admin.campaigns.saveError')),
  })
  const delMut = useMutation({
    mutationFn: (id: number) => adminApi.deleteCampaign(id),
    onSuccess: refresh,
  })
  const testMut = useMutation({
    mutationFn: (id: number) => adminApi.testCampaign(id),
    onSuccess: (r: any) => alert(t('admin.campaigns.testSent', { email: r?.to || '' })),
    onError: (e: any) => alert(e?.response?.data?.detail || t('admin.campaigns.saveError')),
  })
  const sendMut = useMutation({
    mutationFn: (id: number) => adminApi.sendCampaign(id),
    onSuccess: (r: any) => { refresh(); alert(t('admin.campaigns.sentResult', { sent: r?.sent_count ?? 0, total: r?.total_recipients ?? 0 })) },
    onError: (e: any) => alert(e?.response?.data?.detail || t('admin.campaigns.saveError')),
  })

  const startNew = () => { setForm(EMPTY_CAMPAIGN); setOpen(true) }
  const startEdit = (c: any) => { setForm({ id: c.id, subject: c.subject, title: c.title || '', body: c.body || '', image_url: c.image_url || '', cta_text: c.cta_text || '', cta_url: c.cta_url || '' }); setOpen(true) }

  const badge = (status: string) => {
    const map: Record<string, string> = {
      draft: 'border-vault-border text-vault-muted',
      sending: 'border-amber-500/40 text-amber-400',
      sent: 'border-green-500/40 text-green-400',
    }
    return <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border ${map[status] || ''}`}>{t(`admin.campaigns.status.${status}`)}</span>
  }

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-vault-text">
          <Mail size={15} /> {t('admin.campaigns.title')}
          <span className="text-vault-muted font-normal">· {t('admin.campaigns.audience', { count: audience })}</span>
        </h2>
        <button onClick={startNew} className="btn-primary text-xs flex items-center gap-1 px-3 py-1.5">
          <Plus size={13} /> {t('admin.campaigns.new')}
        </button>
      </div>

      {campaigns.length === 0 ? (
        <p className="surface p-6 text-center text-vault-muted text-sm">{t('admin.campaigns.empty')}</p>
      ) : (
        <div className="space-y-2">
          {campaigns.map((c: any) => (
            <div key={c.id} className="surface p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    {badge(c.status)}
                    <span className="font-medium text-vault-text truncate">{c.subject}</span>
                  </div>
                  <p className="text-xs text-vault-muted">
                    {c.status === 'sent'
                      ? t('admin.campaigns.sentInfo', { sent: c.sent_count, total: c.total_recipients, date: c.sent_at ? new Date(c.sent_at).toLocaleString() : '' })
                      : (c.title || '—')}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {c.status === 'draft' && (
                    <>
                      <button onClick={() => startEdit(c)} title={t('common.edit')} className="text-vault-muted hover:text-vault-accent"><Pencil size={14} /></button>
                      <button onClick={() => testMut.mutate(c.id)} disabled={testMut.isPending} className="text-xs px-2 py-1 rounded border border-vault-border text-vault-muted hover:text-vault-text">{t('admin.campaigns.test')}</button>
                      <button
                        onClick={() => { if (confirm(t('admin.campaigns.confirmSend', { count: audience }))) sendMut.mutate(c.id) }}
                        disabled={sendMut.isPending}
                        className="btn-primary text-xs flex items-center gap-1 px-3 py-1"
                      ><Send size={12} /> {t('admin.campaigns.send')}</button>
                      <button onClick={() => { if (confirm(t('admin.campaigns.confirmDelete'))) delMut.mutate(c.id) }} title={t('common.delete')} className="text-vault-muted hover:text-red-400"><Trash2 size={14} /></button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative z-10 surface p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-bold text-vault-gold">{form.id ? t('admin.campaigns.editTitle') : t('admin.campaigns.newTitle')}</h3>
              <button onClick={() => setOpen(false)} className="text-vault-muted hover:text-vault-text"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-vault-muted">{t('admin.campaigns.subject')}</label>
                <input className="input-field w-full" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} maxLength={255} />
              </div>
              <div>
                <label className="text-xs text-vault-muted">{t('admin.campaigns.heading')}</label>
                <input className="input-field w-full" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={255} />
              </div>
              <div>
                <label className="text-xs text-vault-muted">{t('admin.campaigns.body')}</label>
                <textarea className="input-field w-full h-32 resize-y" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-vault-muted">{t('admin.campaigns.imageUrl')}</label>
                <input className="input-field w-full" value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} placeholder="https://…" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-vault-muted">{t('admin.campaigns.ctaText')}</label>
                  <input className="input-field w-full" value={form.cta_text} onChange={(e) => setForm({ ...form, cta_text: e.target.value })} maxLength={80} />
                </div>
                <div>
                  <label className="text-xs text-vault-muted">{t('admin.campaigns.ctaUrl')}</label>
                  <input className="input-field w-full" value={form.cta_url} onChange={(e) => setForm({ ...form, cta_url: e.target.value })} placeholder="https://…" />
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setOpen(false)} className="btn-ghost flex-1">{t('common.cancel')}</button>
              <button onClick={() => saveMut.mutate()} disabled={saveMut.isPending || !form.subject.trim()} className="btn-primary flex-1 disabled:opacity-50">{t('common.save')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Toggle({ on, onClick, disabled }: { on: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className={`w-10 h-5 rounded-full border transition-all relative disabled:opacity-40 ${
        on ? 'bg-vault-accent border-vault-accent' : 'bg-vault-card border-vault-border'
      }`}>
      <span className={`absolute top-0.5 left-0.5 w-3.5 h-3.5 rounded-full bg-white transition-all ${on ? 'translate-x-5' : ''}`} />
    </button>
  )
}

export default function AdminPage() {
  const { t } = useTranslation()
  const me = useAuthStore((s) => s.user)
  const qc = useQueryClient()

  const { data: stats } = useQuery({ queryKey: ['admin-stats'], queryFn: adminApi.stats })
  const { data: users = [], isLoading } = useQuery({ queryKey: ['admin-users'], queryFn: adminApi.users })
  const { data: feedback = [] } = useQuery({ queryKey: ['admin-feedback'], queryFn: adminApi.feedback })

  const [editEmailFor, setEditEmailFor] = useState<any>(null)
  const [emailValue, setEmailValue] = useState('')

  const mutation = useMutation({
    mutationFn: (v: { id: number; data: object }) => adminApi.updateUser(v.id, v.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  })
  const emailMutation = useMutation({
    mutationFn: (v: { id: number; email: string }) => adminApi.updateUser(v.id, { email: v.email }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-users'] }); setEditEmailFor(null) },
    onError: (e: any) => alert(e?.response?.data?.detail || 'Erro ao atualizar email'),
  })
  const deleteMutation = useMutation({
    mutationFn: (id: number) => adminApi.deleteUser(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-users'] }); qc.invalidateQueries({ queryKey: ['admin-stats'] }) },
    onError: (e: any) => alert(e?.response?.data?.detail || 'Erro ao deletar'),
  })

  const fbMutation = useMutation({
    mutationFn: (v: { id: number; status: string }) => adminApi.resolveFeedback(v.id, v.status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-feedback'] }),
  })

  if (me && !me.is_admin) return <Navigate to="/collection" replace />

  const statCards = [
    { icon: Users, label: t('admin.users'), value: stats?.users },
    { icon: Crown, label: t('admin.premium'), value: stats?.premium },
    { icon: Library, label: t('admin.cards'), value: stats?.cards },
    { icon: Swords, label: t('admin.decks'), value: stats?.decks },
    { icon: BookOpen, label: t('admin.binders'), value: stats?.binders },
  ]

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <ShieldCheck size={26} className="text-vault-accent" />
        <div>
          <h1 className="font-display text-3xl font-bold text-vault-gold">{t('admin.title')}</h1>
          <p className="text-vault-muted text-sm mt-0.5">{t('admin.subtitle')}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        {statCards.map((s, i) => (
          <div key={i} className="surface p-4 text-center">
            <s.icon size={18} className="mx-auto text-vault-accent mb-1" />
            <p className="text-2xl font-display font-bold text-vault-gold">{s.value ?? '—'}</p>
            <p className="text-xs text-vault-muted">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="surface overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-vault-border bg-vault-surface">
              <th className="text-left px-4 py-3 text-xs text-vault-muted font-medium">{t('admin.user')}</th>
              <th className="text-center px-4 py-3 text-xs text-vault-muted font-medium">{t('admin.active')}</th>
              <th className="text-center px-4 py-3 text-xs text-vault-muted font-medium">{t('admin.isAdmin')}</th>
              <th className="text-center px-4 py-3 text-xs text-vault-muted font-medium">{t('admin.premium')}</th>
              <th className="text-left px-4 py-3 text-xs text-vault-muted font-medium">{t('admin.joined')}</th>
              <th className="text-right px-4 py-3 text-xs text-vault-muted font-medium">{t('admin.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} className="text-center py-10"><div className="w-6 h-6 border-2 border-vault-accent border-t-transparent rounded-full animate-spin mx-auto" /></td></tr>
            ) : users.map((u: any) => {
              const self = u.id === me?.id
              return (
                <tr key={u.id} className="border-b border-vault-border/50 hover:bg-vault-card/30">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar value={u.avatar} size={32} />
                      <div>
                        <p className="font-medium text-vault-text">{u.display_name || u.username} {self && <span className="text-[10px] text-vault-accent">(você)</span>}</p>
                        <p className="text-xs text-vault-muted">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center"><div className="flex justify-center"><Toggle on={u.is_active} disabled={self} onClick={() => mutation.mutate({ id: u.id, data: { is_active: !u.is_active } })} /></div></td>
                  <td className="px-4 py-3 text-center"><div className="flex justify-center"><Toggle on={u.is_admin} disabled={self} onClick={() => mutation.mutate({ id: u.id, data: { is_admin: !u.is_admin } })} /></div></td>
                  <td className="px-4 py-3 text-center"><div className="flex justify-center"><Toggle on={u.is_premium} onClick={() => mutation.mutate({ id: u.id, data: { is_premium: !u.is_premium } })} /></div></td>
                  <td className="px-4 py-3 text-xs text-vault-muted">{u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => { setEditEmailFor(u); setEmailValue(u.email) }} title={t('admin.editEmail')} className="text-vault-muted hover:text-vault-accent"><Pencil size={14} /></button>
                      {!self && (
                        <button
                          onClick={() => { if (confirm(t('admin.confirmDelete', { name: u.username }))) deleteMutation.mutate(u.id) }}
                          title={t('admin.deleteUser')} className="text-vault-muted hover:text-red-400"
                        ><Trash2 size={14} /></button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Feedback / bugs */}
      <div className="mt-8">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-vault-text mb-3">
          <MessageSquare size={15} /> {t('admin.feedbackTitle')} ({feedback.length})
        </h2>
        {feedback.length === 0 ? (
          <p className="surface p-6 text-center text-vault-muted text-sm">{t('admin.noFeedback')}</p>
        ) : (
          <div className="space-y-2">
            {feedback.map((f: any) => (
              <div key={f.id} className={`surface p-4 ${f.status === 'resolved' ? 'opacity-60' : ''}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-[10px] uppercase tracking-wider bg-vault-card border border-vault-border px-2 py-0.5 rounded-full text-vault-accent">{f.type}</span>
                      <span className="text-xs text-vault-muted">{f.username ? `@${f.username}` : f.email || 'anônimo'}</span>
                      {f.page && <span className="text-[10px] text-vault-muted font-mono">{f.page}</span>}
                      <span className="text-[10px] text-vault-muted">{f.created_at ? new Date(f.created_at).toLocaleString() : ''}</span>
                    </div>
                    <p className="text-sm text-vault-text whitespace-pre-wrap break-words">{f.message}</p>
                  </div>
                  <button
                    onClick={() => fbMutation.mutate({ id: f.id, status: f.status === 'resolved' ? 'open' : 'resolved' })}
                    className={`shrink-0 text-xs px-3 py-1.5 rounded-lg border flex items-center gap-1 transition-colors ${
                      f.status === 'resolved' ? 'border-vault-border text-vault-muted hover:text-vault-text' : 'border-green-500/40 text-green-400 hover:bg-green-500/10'
                    }`}>
                    <Check size={13} /> {f.status === 'resolved' ? t('admin.reopen') : t('admin.resolve')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <CampaignsSection />
      <StoresSection />
      <EventsSection />

      {/* Edit email modal */}
      {editEmailFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setEditEmailFor(null)} />
          <div className="relative z-10 surface p-6 w-full max-w-sm">
            <h3 className="font-display font-bold text-vault-gold mb-1">{t('admin.editEmail')}</h3>
            <p className="text-xs text-vault-muted mb-4">@{editEmailFor.username}</p>
            <input
              type="email" className="input-field w-full mb-4" value={emailValue}
              onChange={(e) => setEmailValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && emailValue.includes('@')) emailMutation.mutate({ id: editEmailFor.id, email: emailValue }) }}
            />
            <div className="flex gap-2">
              <button onClick={() => setEditEmailFor(null)} className="btn-ghost flex-1">{t('common.cancel')}</button>
              <button
                onClick={() => emailMutation.mutate({ id: editEmailFor.id, email: emailValue })}
                disabled={emailMutation.isPending || !emailValue.includes('@')}
                className="btn-primary flex-1 disabled:opacity-50"
              >{t('common.save')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

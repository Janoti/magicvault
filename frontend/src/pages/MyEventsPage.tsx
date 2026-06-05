import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CalendarDays, Plus, Pencil, Trash2, X, Heart, ExternalLink, Lock, Globe, Copy } from 'lucide-react'
import { userEventsApi } from '@/lib/api'

const TYPES = ['mesao', 'trade', 'happening', 'other']
const EMPTY = { id: null as number | null, title: '', type: 'happening', visibility: 'public', description: '', location: '', starts_at: '', duration_minutes: '' as any }

export default function MyEventsPage() {
  const { t, i18n } = useTranslation()
  const qc = useQueryClient()
  const { data: events = [], isLoading } = useQuery({ queryKey: ['my-events'], queryFn: userEventsApi.mine })
  const [form, setForm] = useState<any>(EMPTY)
  const [open, setOpen] = useState(false)
  const refresh = () => qc.invalidateQueries({ queryKey: ['my-events'] })

  const payload = () => ({
    title: form.title, type: form.type, visibility: form.visibility,
    description: form.description || null, location: form.location || null,
    starts_at: form.starts_at, duration_minutes: form.duration_minutes ? Number(form.duration_minutes) : null,
  })
  const saveMut = useMutation({
    mutationFn: () => form.id ? userEventsApi.update(form.id, payload()) : userEventsApi.create(payload()),
    onSuccess: () => { refresh(); setOpen(false) },
    onError: (e: any) => alert(e?.response?.data?.detail || t('userEvents.saveError')),
  })
  const delMut = useMutation({ mutationFn: (id: number) => userEventsApi.remove(id), onSuccess: refresh })

  const startNew = () => { setForm(EMPTY); setOpen(true) }
  const startEdit = (e: any) => {
    setForm({
      id: e.id, title: e.title, type: e.type, visibility: e.visibility,
      description: e.description || '', location: e.location || '',
      starts_at: e.starts_at ? e.starts_at.slice(0, 16) : '', duration_minutes: e.duration_minutes || '',
    })
    setOpen(true)
  }
  const field = (k: string, v: any) => setForm({ ...form, [k]: v })

  const copyLink = (e: any) => {
    const url = `${window.location.origin}/e/${e.id}${e.visibility === 'private' && e.public_token ? `?token=${e.public_token}` : ''}`
    navigator.clipboard?.writeText(url)
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <CalendarDays size={26} className="text-vault-accent" />
          <div>
            <h1 className="font-display text-3xl font-bold text-vault-gold">{t('userEvents.title')}</h1>
            <p className="text-vault-muted text-sm mt-0.5">{t('userEvents.subtitle')}</p>
          </div>
        </div>
        <button onClick={startNew} className="btn-primary flex items-center gap-2"><Plus size={16} /> {t('userEvents.new')}</button>
      </div>

      {isLoading ? (
        <div className="py-16 text-center"><div className="w-7 h-7 border-2 border-vault-accent border-t-transparent rounded-full animate-spin mx-auto" /></div>
      ) : events.length === 0 ? (
        <p className="surface p-10 text-center text-vault-muted">{t('userEvents.empty')}</p>
      ) : (
        <div className="space-y-2 max-w-3xl">
          {events.map((e: any) => (
            <div key={e.id} className="surface p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Link to={`/e/${e.id}`} className="font-medium text-vault-text hover:text-vault-accent truncate">{e.title}</Link>
                  <span className="text-[10px] uppercase tracking-wide bg-vault-accent/15 text-vault-accent border border-vault-accent/30 rounded-full px-2 py-0.5">{t(`userEvents.types.${e.type}`)}</span>
                  {e.visibility === 'private'
                    ? <span className="text-[10px] text-vault-muted flex items-center gap-1"><Lock size={10} /> {t('userEvents.private')}</span>
                    : <span className="text-[10px] text-green-400 flex items-center gap-1"><Globe size={10} /> {t('userEvents.public')}</span>}
                </div>
                <p className="text-xs text-vault-muted mt-0.5">
                  {e.starts_at ? new Date(e.starts_at).toLocaleString(i18n.language, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}
                  {e.location ? ` · ${e.location}` : ''} · <Heart size={10} className="inline" /> {e.interested}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => copyLink(e)} title={t('userEvents.copyLink')} className="text-vault-muted hover:text-vault-accent"><Copy size={14} /></button>
                <Link to={`/e/${e.id}`} title={t('userEvents.openPage')} className="text-vault-muted hover:text-vault-accent"><ExternalLink size={14} /></Link>
                <button onClick={() => startEdit(e)} className="text-vault-muted hover:text-vault-accent"><Pencil size={14} /></button>
                <button onClick={() => { if (confirm(t('userEvents.confirmDelete'))) delMut.mutate(e.id) }} className="text-vault-muted hover:text-red-400"><Trash2 size={14} /></button>
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
              <h3 className="font-display font-bold text-vault-gold">{form.id ? t('userEvents.editTitle') : t('userEvents.newTitle')}</h3>
              <button onClick={() => setOpen(false)} className="text-vault-muted hover:text-vault-text"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-vault-muted">{t('userEvents.fTitle')}</label>
                <input className="input-field w-full" value={form.title} onChange={(e) => field('title', e.target.value)} maxLength={255} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-vault-muted">{t('userEvents.fType')}</label>
                  <select className="input-field w-full" value={form.type} onChange={(e) => field('type', e.target.value)}>
                    {TYPES.map((ty) => <option key={ty} value={ty}>{t(`userEvents.types.${ty}`)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-vault-muted">{t('userEvents.fVisibility')}</label>
                  <select className="input-field w-full" value={form.visibility} onChange={(e) => field('visibility', e.target.value)}>
                    <option value="public">{t('userEvents.public')}</option>
                    <option value="private">{t('userEvents.private')}</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-vault-muted">{t('userEvents.fWhen')}</label>
                  <input type="datetime-local" className="input-field w-full" value={form.starts_at} onChange={(e) => field('starts_at', e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-vault-muted">{t('userEvents.fDuration')}</label>
                  <input type="number" min="0" step="30" className="input-field w-full" value={form.duration_minutes} onChange={(e) => field('duration_minutes', e.target.value)} placeholder="120" />
                </div>
              </div>
              <div>
                <label className="text-xs text-vault-muted">{t('userEvents.fLocation')}</label>
                <input className="input-field w-full" value={form.location} onChange={(e) => field('location', e.target.value)} placeholder={t('userEvents.locationPh')} />
              </div>
              <div>
                <label className="text-xs text-vault-muted">{t('userEvents.fDescription')}</label>
                <textarea className="input-field w-full h-24 resize-y" value={form.description} onChange={(e) => field('description', e.target.value)} />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setOpen(false)} className="btn-ghost flex-1">{t('common.cancel')}</button>
              <button onClick={() => saveMut.mutate()} disabled={saveMut.isPending || !form.title.trim() || !form.starts_at} className="btn-primary flex-1 disabled:opacity-50">{t('common.save')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

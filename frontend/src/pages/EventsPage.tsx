import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  CalendarDays, CalendarPlus, List, MapPin, Clock, Store as StoreIcon, ExternalLink,
  ChevronLeft, ChevronRight, Ticket, Sparkles,
} from 'lucide-react'
import { useSeo, JsonLd } from '@/components/Seo'
import PublicPage from '@/components/PublicPage'
import { eventsApi } from '@/lib/api'

const KIND_EMOJI: Record<string, string> = { fnm: '🍕', tournament: '🏆', casual: '🎲', prerelease: '✨', other: '📅' }

function iso(d: Date) { return d.toISOString().slice(0, 10) }
function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1) }
function endOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth() + 1, 0) }

function EventCard({ e }: { e: any }) {
  const { t } = useTranslation()
  return (
    <div className="surface p-4 flex flex-col sm:flex-row sm:items-start gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="text-base">{KIND_EMOJI[e.kind] || '📅'}</span>
          <span className="font-medium text-vault-text">{e.title}</span>
          {e.format && <span className="text-[10px] uppercase tracking-wide bg-vault-accent/15 text-vault-accent border border-vault-accent/30 rounded-full px-2 py-0.5">{e.format}</span>}
          {e.store?.featured && <span className="text-[10px] uppercase tracking-wide bg-vault-gold/15 text-vault-gold border border-vault-gold/30 rounded-full px-2 py-0.5">★ {t('events.partner')}</span>}
        </div>
        <div className="text-xs text-vault-muted space-y-0.5">
          {e.store && (
            <p className="flex items-center gap-1.5"><StoreIcon size={12} /> {e.store.name}{e.store.neighborhood ? ` · ${e.store.neighborhood}` : ''}</p>
          )}
          {e.address && <p className="flex items-center gap-1.5"><MapPin size={12} /> {e.address}</p>}
          <p className="flex items-center gap-3">
            {e.time_label && <span className="flex items-center gap-1.5"><Clock size={12} /> {e.time_label}</span>}
            {e.entry_fee && <span className="flex items-center gap-1.5"><Ticket size={12} /> {e.entry_fee}</span>}
            <span className="text-vault-muted/70">{e.city}</span>
          </p>
          {e.description && <p className="text-vault-muted/90 pt-1">{e.description}</p>}
        </div>
      </div>
      {e.link && (
        <a href={e.link} target="_blank" rel="noreferrer noopener"
          className="btn-ghost !py-1.5 text-xs flex items-center gap-1.5 self-start shrink-0">
          {t('events.details')} <ExternalLink size={12} />
        </a>
      )}
    </div>
  )
}

export default function EventsPage() {
  const { t, i18n } = useTranslation()
  useSeo({ title: `${t('events.title')} — VaultSpell`, description: t('events.subtitle'), path: '/eventos' })
  const [view, setView] = useState<'list' | 'calendar'>('list')
  const [city, setCity] = useState('')
  const [format, setFormat] = useState('')
  const [month, setMonth] = useState(() => startOfMonth(new Date()))
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const range = useMemo(() => {
    if (view === 'calendar') return { from: iso(startOfMonth(month)), to: iso(endOfMonth(month)) }
    const today = new Date()
    return { from: iso(today), to: iso(new Date(today.getTime() + 45 * 864e5)) }
  }, [view, month])

  const { data: filters } = useQuery({ queryKey: ['event-filters'], queryFn: eventsApi.filters })
  const { data, isLoading } = useQuery({
    queryKey: ['events', range.from, range.to, city, format],
    queryFn: () => eventsApi.list({ from: range.from, to: range.to, city: city || undefined, format: format || undefined }),
  })
  const events: any[] = data?.events || []

  // schema.org Event structured data (rich results in Google), capped for size.
  const eventLd = events.slice(0, 30).map((e) => ({
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: e.title,
    startDate: `${e.date}T${e.time_label || '00:00'}:00-03:00`,
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: { '@type': 'Place', name: e.store?.name || e.city, address: e.address || e.city },
    ...(e.link ? { url: e.link } : {}),
    ...(e.store?.name ? { organizer: { '@type': 'Organization', name: e.store.name } } : {}),
  }))

  // Group occurrences by date for the agenda list.
  const grouped = useMemo(() => {
    const m = new Map<string, any[]>()
    for (const e of events) { if (!m.has(e.date)) m.set(e.date, []); m.get(e.date)!.push(e) }
    return [...m.entries()]
  }, [events])

  const byDate = useMemo(() => {
    const m = new Map<string, number>()
    for (const e of events) m.set(e.date, (m.get(e.date) || 0) + 1)
    return m
  }, [events])

  const fmtDay = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString(i18n.language, { weekday: 'short', day: 'numeric', month: 'short' })

  // Calendar grid cells (Mon-first), padded to full weeks.
  const cells = useMemo(() => {
    const first = startOfMonth(month)
    const last = endOfMonth(month)
    const lead = (first.getDay() + 6) % 7 // Mon=0
    const out: (Date | null)[] = []
    for (let i = 0; i < lead; i++) out.push(null)
    for (let d = 1; d <= last.getDate(); d++) out.push(new Date(month.getFullYear(), month.getMonth(), d))
    while (out.length % 7 !== 0) out.push(null)
    return out
  }, [month])

  const weekdayLabels = [t('events.wd.mon'), t('events.wd.tue'), t('events.wd.wed'), t('events.wd.thu'), t('events.wd.fri'), t('events.wd.sat'), t('events.wd.sun')]
  const selectedEvents = selectedDate ? events.filter((e) => e.date === selectedDate) : []
  const todayIso = iso(new Date())

  return (
    <PublicPage nav={[{ to: '/lojas', label: t('events.storesNav') }]}>
      {eventLd.length > 0 && <JsonLd data={eventLd} />}

      <section className="max-w-5xl mx-auto px-6 pt-12 pb-4 text-center">
        <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-vault-gold bg-vault-gold/10 border border-vault-gold/30 rounded-full px-3 py-1 mb-4">
          <Sparkles size={13} /> {t('events.badge')}
        </div>
        <h1 className="font-display text-4xl sm:text-5xl font-bold text-vault-gold leading-tight">{t('events.title')}</h1>
        <p className="text-vault-muted text-lg mt-3 max-w-2xl mx-auto">{t('events.subtitle')}</p>

        {/* Create / manage your own events */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link to="/meus-eventos" className="btn-primary inline-flex items-center gap-2 px-6 py-3 text-base shadow-lg">
            <CalendarPlus size={18} /> {t('events.createMine', 'Criar meu evento')}
          </Link>
          <Link to="/meus-eventos" className="btn-ghost inline-flex items-center gap-2 px-5 py-3 text-base border border-vault-border">
            <CalendarDays size={18} /> {t('events.myEvents', 'Meus eventos')}
          </Link>
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-6 pb-20">
        {/* Filters + view toggle */}
        <div className="flex flex-wrap items-center gap-2 mb-5">
          <select className="input-field !w-auto text-sm" value={city} onChange={(e) => setCity(e.target.value)}>
            <option value="">{t('events.allCities')}</option>
            {(filters?.cities || []).map((c: string) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select className="input-field !w-auto text-sm" value={format} onChange={(e) => setFormat(e.target.value)}>
            <option value="">{t('events.allFormats')}</option>
            {(filters?.formats || []).map((f: string) => <option key={f} value={f}>{f}</option>)}
          </select>
          <div className="ml-auto flex rounded-lg border border-vault-border overflow-hidden">
            <button onClick={() => setView('list')} className={`px-3 py-2 text-sm flex items-center gap-1.5 ${view === 'list' ? 'bg-vault-accent/20 text-vault-accent' : 'text-vault-muted'}`}><List size={15} /> {t('events.listView')}</button>
            <button onClick={() => setView('calendar')} className={`px-3 py-2 text-sm flex items-center gap-1.5 ${view === 'calendar' ? 'bg-vault-accent/20 text-vault-accent' : 'text-vault-muted'}`}><CalendarDays size={15} /> {t('events.calendarView')}</button>
          </div>
        </div>

        {isLoading ? (
          <div className="py-16 text-center"><div className="w-7 h-7 border-2 border-vault-accent border-t-transparent rounded-full animate-spin mx-auto" /></div>
        ) : view === 'list' ? (
          grouped.length === 0 ? (
            <p className="surface p-10 text-center text-vault-muted">{t('events.empty')}</p>
          ) : (
            <div className="space-y-6">
              {grouped.map(([d, evs]) => (
                <div key={d}>
                  <h3 className="text-sm font-semibold text-vault-gold mb-2 capitalize">{fmtDay(d)}</h3>
                  <div className="space-y-2">{evs.map((e: any, i: number) => <EventCard key={`${e.id}-${i}`} e={e} />)}</div>
                </div>
              ))}
            </div>
          )
        ) : (
          <div>
            {/* Month nav */}
            <div className="flex items-center justify-between mb-3">
              <button onClick={() => { setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1)); setSelectedDate(null) }} className="p-2 rounded-lg hover:bg-vault-card text-vault-muted"><ChevronLeft size={18} /></button>
              <span className="font-display font-bold text-vault-text capitalize">{month.toLocaleDateString(i18n.language, { month: 'long', year: 'numeric' })}</span>
              <button onClick={() => { setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1)); setSelectedDate(null) }} className="p-2 rounded-lg hover:bg-vault-card text-vault-muted"><ChevronRight size={18} /></button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center mb-1">
              {weekdayLabels.map((w) => <div key={w} className="text-[10px] uppercase tracking-wide text-vault-muted py-1">{w}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {cells.map((d, i) => {
                if (!d) return <div key={i} />
                const ds = iso(d)
                const count = byDate.get(ds) || 0
                const isSel = ds === selectedDate
                return (
                  <button key={i} onClick={() => setSelectedDate(isSel ? null : ds)} disabled={count === 0}
                    className={`aspect-square rounded-lg border text-sm flex flex-col items-center justify-center transition-all ${
                      isSel ? 'border-vault-accent bg-vault-accent/20 text-vault-accent'
                      : count > 0 ? 'border-vault-border bg-vault-card/40 hover:border-vault-accent/40 text-vault-text'
                      : 'border-transparent text-vault-muted/40'
                    } ${ds === todayIso ? 'ring-1 ring-vault-gold/50' : ''}`}>
                    <span>{d.getDate()}</span>
                    {count > 0 && <span className="mt-0.5 flex gap-0.5">{Array.from({ length: Math.min(count, 3) }).map((_, k) => <span key={k} className="w-1 h-1 rounded-full bg-vault-accent" />)}</span>}
                  </button>
                )
              })}
            </div>

            <div className="mt-5 space-y-2">
              {selectedDate ? (
                selectedEvents.length > 0 ? (
                  <>
                    <h3 className="text-sm font-semibold text-vault-gold capitalize">{fmtDay(selectedDate)}</h3>
                    {selectedEvents.map((e: any, i: number) => <EventCard key={`${e.id}-${i}`} e={e} />)}
                  </>
                ) : null
              ) : (
                <p className="text-center text-xs text-vault-muted py-4">{events.length > 0 ? t('events.pickDay') : t('events.emptyMonth')}</p>
              )}
            </div>
          </div>
        )}

        <div className="mt-10 text-center">
          <Link to="/lojas" className="inline-flex items-center gap-2 text-sm text-vault-accent hover:underline">
            <StoreIcon size={15} /> {t('events.seeStores')}
          </Link>
        </div>
      </section>
    </PublicPage>
  )
}

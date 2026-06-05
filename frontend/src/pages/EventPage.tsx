import { useState } from 'react'
import { Link, useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Calendar, MapPin, Clock, Heart, Download, ExternalLink, Send, Trash2, User as UserIcon } from 'lucide-react'
import PublicPage from '@/components/PublicPage'
import { useSeo } from '@/components/Seo'
import { userEventsApi, cardsApi } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import Avatar from '@/components/Avatar'

const ART = ['Goblin Game', 'Pramikon, Sky Rampart', 'Hall of Triumph', 'Plaza of Heroes', 'Command Tower', "Krark's Thumb"]
const TYPE_EMOJI: Record<string, string> = { mesao: '🎲', trade: '🔄', happening: '🎉', other: '📅' }

function pad(n: number) { return String(n).padStart(2, '0') }
function gcalStamp(d: Date) {
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`
}

export default function EventPage() {
  const { t, i18n } = useTranslation()
  const { id } = useParams()
  const eventId = Number(id)
  const [params] = useSearchParams()
  const token = params.get('token') || undefined
  const navigate = useNavigate()
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const [comment, setComment] = useState('')

  const { data: ev, isLoading, isError } = useQuery({ queryKey: ['user-event', eventId], queryFn: () => userEventsApi.get(eventId, token) })
  const { data: comments = [] } = useQuery({ queryKey: ['user-event-comments', eventId], queryFn: () => userEventsApi.comments(eventId, token), enabled: !!ev })
  const { data: art } = useQuery({
    queryKey: ['event-art', eventId],
    queryFn: () => cardsApi.search(`!"${ART[eventId % ART.length]}"`).then((d: any) => d.cards?.[0]?.art_crop || null).catch(() => null),
    staleTime: Infinity,
  })

  useSeo({ title: ev ? `${ev.title} — VaultSpell` : 'Evento — VaultSpell', description: ev?.description || '', path: `/e/${eventId}` })

  const interestMut = useMutation({
    mutationFn: () => userEventsApi.toggleInterest(eventId, token),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['user-event', eventId] }),
  })
  const addCommentMut = useMutation({
    mutationFn: () => userEventsApi.addComment(eventId, comment.trim(), token),
    onSuccess: () => { setComment(''); qc.invalidateQueries({ queryKey: ['user-event-comments', eventId] }) },
  })
  const delCommentMut = useMutation({
    mutationFn: (cid: number) => userEventsApi.deleteComment(eventId, cid),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['user-event-comments', eventId] }),
  })

  if (isLoading) return <PublicPage><div className="py-24 text-center"><div className="w-7 h-7 border-2 border-vault-accent border-t-transparent rounded-full animate-spin mx-auto" /></div></PublicPage>
  if (isError || !ev) return <PublicPage><div className="py-24 text-center text-vault-muted">{t('userEvents.notFound')}</div></PublicPage>

  const start = new Date(ev.starts_at)
  const end = new Date(start.getTime() + (ev.duration_minutes || 120) * 60000)
  const whenLabel = start.toLocaleString(i18n.language, { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
  const gcal = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(ev.title)}&dates=${gcalStamp(start)}/${gcalStamp(end)}&details=${encodeURIComponent(ev.description || '')}&location=${encodeURIComponent(ev.location || '')}`

  return (
    <PublicPage>
      <div className="relative">
        {/* Random translucent card-art background */}
        {art && <div className="absolute inset-x-0 top-0 h-64 bg-cover bg-center opacity-20 pointer-events-none" style={{ backgroundImage: `url(${art})` }} />}
        <div className="absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-transparent to-vault-bg pointer-events-none" />

        <div className="relative max-w-3xl mx-auto px-6 pt-12 pb-20">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">{TYPE_EMOJI[ev.type] || '📅'}</span>
            <span className="text-[10px] uppercase tracking-wide bg-vault-accent/15 text-vault-accent border border-vault-accent/30 rounded-full px-2 py-0.5">{t(`userEvents.types.${ev.type}`)}</span>
            {ev.visibility === 'private' && <span className="text-[10px] uppercase tracking-wide bg-vault-card border border-vault-border rounded-full px-2 py-0.5 text-vault-muted">{t('userEvents.private')}</span>}
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-vault-gold">{ev.title}</h1>

          {ev.organizer?.username && (
            <Link to={`/u/${ev.organizer.username}`} className="inline-flex items-center gap-2 mt-3 text-sm text-vault-muted hover:text-vault-accent">
              <Avatar value={ev.organizer.avatar} size={22} /> {ev.organizer.display_name || ev.organizer.username}
            </Link>
          )}

          <div className="surface p-5 mt-5 space-y-2 text-sm">
            <p className="flex items-center gap-2 text-vault-text"><Calendar size={15} className="text-vault-accent" /> <span className="capitalize">{whenLabel}</span></p>
            {ev.duration_minutes && <p className="flex items-center gap-2 text-vault-muted"><Clock size={15} /> {t('userEvents.duration', { min: ev.duration_minutes })}</p>}
            {ev.location && <p className="flex items-center gap-2 text-vault-muted"><MapPin size={15} /> {ev.location}</p>}
          </div>

          {ev.description && <p className="mt-5 text-vault-text/90 whitespace-pre-line leading-relaxed">{ev.description}</p>}

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-3 mt-6">
            {user ? (
              <button onClick={() => interestMut.mutate()} disabled={interestMut.isPending}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  ev.i_am_interested ? 'border-vault-gold/50 bg-vault-gold/15 text-vault-gold' : 'border-vault-accent/40 text-vault-accent hover:bg-vault-accent/10'
                }`}>
                <Heart size={15} className={ev.i_am_interested ? 'fill-vault-gold' : ''} />
                {ev.i_am_interested ? t('userEvents.interested') : t('userEvents.markInterested')}
                <span className="text-xs opacity-70">· {ev.interested}</span>
              </button>
            ) : (
              <Link to="/login" className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-vault-accent/40 text-vault-accent hover:bg-vault-accent/10">
                <Heart size={15} /> {t('userEvents.loginToInterest')} · {ev.interested}
              </Link>
            )}
            <a href={gcal} target="_blank" rel="noreferrer noopener" className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm border border-vault-border text-vault-muted hover:text-vault-text">
              <ExternalLink size={14} /> {t('userEvents.googleCalendar')}
            </a>
            <a href={userEventsApi.icsUrl(eventId, token)} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm border border-vault-border text-vault-muted hover:text-vault-text">
              <Download size={14} /> {t('userEvents.downloadIcs')}
            </a>
          </div>

          {/* Comments */}
          <div className="mt-10">
            <h2 className="font-display text-lg font-bold text-vault-text mb-3">{t('userEvents.comments')} ({comments.length})</h2>
            {user ? (
              <div className="flex gap-2 mb-4">
                <input className="input-field flex-1" placeholder={t('userEvents.commentPh')} value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && comment.trim()) addCommentMut.mutate() }} />
                <button onClick={() => addCommentMut.mutate()} disabled={!comment.trim() || addCommentMut.isPending} className="btn-primary !px-3 disabled:opacity-50"><Send size={16} /></button>
              </div>
            ) : (
              <p className="text-sm text-vault-muted mb-4"><Link to="/login" className="text-vault-accent hover:underline">{t('common.login')}</Link> {t('userEvents.loginToComment')}</p>
            )}
            <div className="space-y-3">
              {comments.length === 0 ? (
                <p className="text-sm text-vault-muted">{t('userEvents.noComments')}</p>
              ) : comments.map((c: any) => (
                <div key={c.id} className="surface p-3">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="flex items-center gap-2 text-sm text-vault-text">
                      {c.user?.username ? <Avatar value={c.user.avatar} size={20} /> : <UserIcon size={16} className="text-vault-muted" />}
                      {c.user?.display_name || c.user?.username || '—'}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="text-[11px] text-vault-muted">{c.created_at ? new Date(c.created_at).toLocaleDateString(i18n.language) : ''}</span>
                      {(user?.username === c.user?.username || user?.username === ev.organizer?.username) && (
                        <button onClick={() => delCommentMut.mutate(c.id)} className="text-vault-muted hover:text-red-400"><Trash2 size={12} /></button>
                      )}
                    </span>
                  </div>
                  <p className="text-sm text-vault-text/90 whitespace-pre-line">{c.body}</p>
                </div>
              ))}
            </div>
          </div>

          {user?.username === ev.organizer?.username && (
            <div className="mt-8 text-center">
              <button onClick={() => navigate('/meus-eventos')} className="text-sm text-vault-accent hover:underline">{t('userEvents.manageMine')}</button>
            </div>
          )}
        </div>
      </div>
    </PublicPage>
  )
}

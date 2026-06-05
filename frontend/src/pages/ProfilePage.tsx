import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Library, Swords, BookOpen, ExternalLink, MessageCircle, CalendarDays, Eye } from 'lucide-react'
import { usersApi } from '@/lib/api'
import PublicPage from '@/components/PublicPage'
import Avatar from '@/components/Avatar'

// Only allow http(s) links (blocks javascript:/data: XSS in user-supplied URLs).
const safeUrl = (u: string) => {
  const v = (u || '').trim()
  if (/^https?:\/\//i.test(v)) return v
  if (/^(javascript|data|vbscript|file):/i.test(v)) return '#'
  return v ? `https://${v}` : '#'
}

// Phone-like contact → WhatsApp link; otherwise treat as a URL/handle.
const contactHref = (c: string) => {
  const digits = (c || '').replace(/\D/g, '')
  if (digits.length >= 8) return `https://wa.me/${digits}`
  return safeUrl(c)
}

export default function ProfilePage() {
  const { username = '' } = useParams()
  const { t } = useTranslation()
  const [contact, setContact] = useState<string | null>(null)
  const [revealing, setRevealing] = useState(false)
  const revealContact = async () => {
    setRevealing(true)
    try { const r = await usersApi.contact(username); setContact(r.contact) } catch { /* gone */ }
    setRevealing(false)
  }

  const { data, isLoading, isError } = useQuery({
    queryKey: ['profile', username],
    queryFn: () => usersApi.profile(username),
    enabled: !!username,
    retry: false,
  })

  const body = (
    <div className="max-w-2xl mx-auto p-6">
      {isLoading ? (
        <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-vault-accent border-t-transparent rounded-full animate-spin" /></div>
      ) : isError || !data ? (
        <div className="text-center py-20">
          <p className="text-4xl mb-3">👤</p>
          <p className="text-vault-muted">404</p>
        </div>
      ) : (
        <>
          <div className="surface p-6 mb-4 flex items-center gap-4">
            <Avatar value={data.avatar} size={80} />
            <div className="min-w-0">
              <h1 className="font-display text-2xl font-bold text-vault-gold truncate">{data.display_name || data.username}</h1>
              <p className="text-sm text-vault-muted">@{data.username}</p>
              {data.member_since && (
                <p className="text-xs text-vault-muted mt-1">{t('account.memberSince')} {new Date(data.member_since).toLocaleDateString()}</p>
              )}
            </div>
          </div>

          {data.bio && <div className="surface p-5 mb-4"><p className="text-sm text-vault-text whitespace-pre-wrap">{data.bio}</p></div>}

          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="surface p-4 text-center">
              <Library size={18} className="mx-auto text-vault-accent mb-1" />
              <p className="text-xl font-display font-bold text-vault-gold">{data.stats?.cards ?? 0}</p>
              <p className="text-xs text-vault-muted">{t('nav.collection')}</p>
            </div>
            <div className="surface p-4 text-center">
              <Swords size={18} className="mx-auto text-vault-accent mb-1" />
              <p className="text-xl font-display font-bold text-vault-gold">{data.stats?.decks ?? 0}</p>
              <p className="text-xs text-vault-muted">{t('nav.decks')}</p>
            </div>
            <div className="surface p-4 text-center">
              <BookOpen size={18} className="mx-auto text-vault-accent mb-1" />
              <p className="text-xl font-display font-bold text-vault-gold">{data.stats?.binders ?? 0}</p>
              <p className="text-xs text-vault-muted">{t('nav.binders')}</p>
            </div>
          </div>

          {data.has_contact && (
            contact ? (
              <a
                href={contactHref(contact)} target="_blank" rel="noreferrer"
                className="surface p-4 flex items-center gap-3 hover:border-vault-accent/40 transition-all"
              >
                <span className="w-9 h-9 rounded-xl bg-green-500/15 border border-green-500/30 flex items-center justify-center">
                  <MessageCircle size={16} className="text-green-400" />
                </span>
                <div>
                  <p className="text-xs text-vault-muted">{t('account.contact')}</p>
                  <p className="text-sm text-vault-text">{contact}</p>
                </div>
              </a>
            ) : (
              <button
                onClick={revealContact} disabled={revealing}
                className="surface p-4 w-full flex items-center gap-3 hover:border-vault-accent/40 transition-all text-left disabled:opacity-60"
              >
                <span className="w-9 h-9 rounded-xl bg-green-500/15 border border-green-500/30 flex items-center justify-center">
                  {revealing ? <div className="w-4 h-4 border-2 border-green-400 border-t-transparent rounded-full animate-spin" /> : <Eye size={16} className="text-green-400" />}
                </span>
                <div>
                  <p className="text-xs text-vault-muted">{t('account.contact')}</p>
                  <p className="text-sm text-vault-accent">{t('pubprofile.revealContact')}</p>
                </div>
              </button>
            )
          )}

          {data.links?.length > 0 && (
            <div className="surface p-5 space-y-2">
              {data.links.map((l: any, i: number) => (
                <a key={i} href={safeUrl(l.url)} target="_blank" rel="noreferrer"
                  className="flex items-center justify-between p-2.5 rounded-lg border border-vault-border hover:border-vault-accent/40 text-sm text-vault-text transition-all">
                  {l.label}
                  <ExternalLink size={14} className="text-vault-muted" />
                </a>
              ))}
            </div>
          )}

          {/* Public collection & decks the owner chose to show off */}
          {(data.collection_public || data.public_decks?.length > 0) && (
            <div className="surface p-5">
              <h2 className="font-display text-lg font-bold text-vault-gold mb-1">{t('pubprofile.title', { name: data.display_name || data.username })}</h2>
              <p className="text-xs text-vault-muted mb-4">{t('pubprofile.subtitle')}</p>
              <div className="space-y-2">
                {data.collection_public && (
                  <Link to={`/c/${data.username}`}
                    className="flex items-center gap-3 p-3 rounded-lg border border-vault-border hover:border-vault-accent/40 transition-all">
                    <span className="w-9 h-9 rounded-xl bg-vault-accent/15 border border-vault-accent/30 flex items-center justify-center">
                      <Library size={16} className="text-vault-accent" />
                    </span>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-vault-text">{t('pubprofile.collection')}</p>
                      <p className="text-xs text-vault-muted">{t('common.cardsCount', { count: data.stats?.cards ?? 0 })}</p>
                    </div>
                    <ExternalLink size={14} className="text-vault-muted" />
                  </Link>
                )}
                {data.public_decks?.map((d: any) => (
                  <Link key={d.id} to={`/d/${d.id}`}
                    className="flex items-center gap-3 p-3 rounded-lg border border-vault-border hover:border-vault-accent/40 transition-all">
                    <span className="w-9 h-9 rounded-xl bg-vault-gold/15 border border-vault-gold/30 flex items-center justify-center">
                      <Swords size={16} className="text-vault-gold" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-vault-text truncate">{d.name}</p>
                      <p className="text-xs text-vault-muted">{d.format} · {t('common.cardsCount', { count: d.card_count })}</p>
                    </div>
                    <ExternalLink size={14} className="text-vault-muted" />
                  </Link>
                ))}
              </div>
            </div>
          )}

          {data.public_events?.length > 0 && (
            <div className="surface p-5 mt-4">
              <h2 className="font-display text-lg font-bold text-vault-gold mb-3 flex items-center gap-2">
                <CalendarDays size={18} /> {t('pubprofile.events')}
              </h2>
              <div className="space-y-2">
                {data.public_events.map((e: any) => (
                  <Link key={e.id} to={`/e/${e.id}`}
                    className="flex items-center gap-3 p-3 rounded-lg border border-vault-border hover:border-vault-accent/40 transition-all">
                    <span className="w-9 h-9 rounded-xl bg-vault-accent/15 border border-vault-accent/30 flex items-center justify-center">
                      <CalendarDays size={16} className="text-vault-accent" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-vault-text truncate">{e.title}</p>
                      <p className="text-xs text-vault-muted">
                        {e.starts_at ? new Date(e.starts_at).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}
                        {e.location ? ` · ${e.location}` : ''}
                      </p>
                    </div>
                    <ExternalLink size={14} className="text-vault-muted" />
                  </Link>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )

  // Logged-in users get the app Layout (sidebar); visitors get the public header.
  return <PublicPage>{body}</PublicPage>
}

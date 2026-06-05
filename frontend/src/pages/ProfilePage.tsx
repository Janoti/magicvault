import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Library, Swords, BookOpen, ExternalLink, MessageCircle, CalendarDays, Eye, ShoppingBag, Lock, Crown, ArrowLeftRight, MapPin, Instagram, Facebook, Twitter, Youtube, Twitch, Music2, Globe, Link2 } from 'lucide-react'
import { usersApi } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import PublicPage from '@/components/PublicPage'
import Avatar from '@/components/Avatar'

// Pick a brand icon + accent colour from a link's URL/label.
function socialStyle(url: string, label: string): { Icon: any; color: string } {
  const s = `${url} ${label}`.toLowerCase()
  if (s.includes('instagram')) return { Icon: Instagram, color: '#e1306c' }
  if (s.includes('tiktok')) return { Icon: Music2, color: '#69C9D0' }
  if (s.includes('facebook') || s.includes('fb.com')) return { Icon: Facebook, color: '#1877f2' }
  if (s.includes('twitter') || s.includes('x.com')) return { Icon: Twitter, color: '#1da1f2' }
  if (s.includes('youtube') || s.includes('youtu.be')) return { Icon: Youtube, color: '#ff0000' }
  if (s.includes('twitch')) return { Icon: Twitch, color: '#9146ff' }
  if (s.includes('loja') || s.includes('store') || s.includes('shop')) return { Icon: ShoppingBag, color: '#f5a623' }
  if (s.includes('http')) return { Icon: Globe, color: '#8aa0c0' }
  return { Icon: Link2, color: '#8aa0c0' }
}

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
              {data.location && (
                <p className="text-xs text-vault-muted mt-0.5 flex items-center gap-1"><MapPin size={12} /> {data.location}</p>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {data.links.map((l: any, i: number) => {
                const { Icon, color } = socialStyle(l.url, l.label)
                return (
                  <a key={i} href={safeUrl(l.url)} target="_blank" rel="noreferrer"
                    className="group flex items-center gap-3 p-3 rounded-xl border border-vault-border bg-vault-card/40 hover:border-vault-accent/50 hover:bg-vault-card/70 transition-all">
                    <span className="w-9 h-9 rounded-lg flex items-center justify-center border shrink-0"
                      style={{ backgroundColor: `${color}1f`, borderColor: `${color}55` }}>
                      <Icon size={17} style={{ color }} />
                    </span>
                    <span className="text-sm font-medium text-vault-text truncate flex-1">{l.label}</span>
                    <ExternalLink size={14} className="text-vault-muted group-hover:text-vault-accent transition-colors" />
                  </a>
                )
              })}
            </div>
          )}

          {/* Public collection, decks & binders the owner chose to show off */}
          {(data.collection_public || data.public_decks?.length > 0 || data.public_binders?.length > 0) && (
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
                {data.public_binders?.map((b: any) => (
                  <Link key={b.id} to={`/b/${b.id}`}
                    className="flex items-center gap-3 p-3 rounded-lg border border-vault-border hover:border-vault-accent/40 transition-all">
                    <span className="w-9 h-9 rounded-xl flex items-center justify-center border"
                      style={{ backgroundColor: `${b.color}22`, borderColor: `${b.color}55` }}>
                      <BookOpen size={16} style={{ color: b.color || '#6366f1' }} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-vault-text truncate">{b.name}</p>
                      <p className="text-xs text-vault-muted">{t('common.cardsCount', { count: b.card_count })}</p>
                    </div>
                    <ExternalLink size={14} className="text-vault-muted" />
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Marketplace — cards this user is currently selling/trading.
              Visitors must log in; logged-in users need the marketplace (premium). */}
          {data.listings_count > 0 && (
            <MarketSection username={username} count={data.listings_count} />
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

// Marketplace listings on a public profile. Anonymous visitors get a "log in"
// call to action; logged-in users without the marketplace (premium) get an
// upgrade prompt; premium users see the actual cards on sale/trade.
function MarketSection({ username, count }: { username: string; count: number }) {
  const { t } = useTranslation()
  const { user } = useAuthStore()

  const { data, isLoading, error } = useQuery({
    queryKey: ['profile-listings', username],
    queryFn: () => usersApi.listings(username),
    enabled: !!user,        // don't auto-redirect anonymous visitors to /login
    retry: false,
  })

  const header = (
    <h2 className="font-display text-lg font-bold text-vault-gold mb-1 flex items-center gap-2">
      <ShoppingBag size={18} /> {t('pubprofile.market.title')}
    </h2>
  )
  const subtitle = <p className="text-xs text-vault-muted mb-4">{t('pubprofile.market.subtitle', { count })}</p>

  // Not logged in → must log in.
  if (!user) {
    return (
      <div className="surface p-5 mt-4">
        {header}{subtitle}
        <Link to="/login" className="flex items-center gap-3 p-4 rounded-lg border border-vault-accent/30 bg-vault-accent/5 hover:border-vault-accent/50 transition-all">
          <Lock size={18} className="text-vault-accent" />
          <span className="text-sm text-vault-text flex-1">{t('pubprofile.market.loginPrompt')}</span>
          <span className="text-xs font-medium text-vault-accent">{t('pubprofile.market.loginCta')} →</span>
        </Link>
      </div>
    )
  }

  // Logged in but not premium → upgrade prompt (backend returns 403).
  const premiumRequired = (error as any)?.response?.status === 403
  if (premiumRequired) {
    return (
      <div className="surface p-5 mt-4">
        {header}{subtitle}
        <Link to="/premium" className="flex items-center gap-3 p-4 rounded-lg border border-vault-gold/30 bg-vault-gold/5 hover:border-vault-gold/50 transition-all">
          <Crown size={18} className="text-vault-gold" />
          <span className="text-sm text-vault-text flex-1">{t('pubprofile.market.premiumPrompt')}</span>
          <span className="text-xs font-medium text-vault-gold">{t('pubprofile.market.premiumCta')} →</span>
        </Link>
      </div>
    )
  }

  const items: any[] = data?.items || []

  return (
    <div className="surface p-5 mt-4">
      {header}{subtitle}
      {isLoading ? (
        <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-vault-accent border-t-transparent rounded-full animate-spin" /></div>
      ) : items.length === 0 ? (
        <p className="text-sm text-vault-muted py-4 text-center">{t('pubprofile.market.empty')}</p>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {items.map((l) => {
              const img = l.photo || l.card?.image_normal || l.card?.image_small
              const forTrade = !!l.wanted
              return (
                <Link key={l.id} to="/trades" className="group rounded-xl overflow-hidden border border-vault-border hover:border-vault-accent/50 transition-all bg-vault-card/40">
                  <div className="aspect-[63/88] bg-vault-card relative">
                    {img && <img src={img} alt={l.card?.name} className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform" />}
                    <span className="absolute bottom-1 left-1 text-[10px] bg-black/70 text-white px-1.5 py-0.5 rounded font-mono">{l.condition}{l.foil ? ' ⚡' : ''}</span>
                  </div>
                  <div className="p-2">
                    <p className="text-xs font-medium text-vault-text truncate">{l.card?.name}</p>
                    {l.price != null ? (
                      <p className="text-xs font-mono font-bold text-green-400">${l.price.toFixed(2)}</p>
                    ) : forTrade ? (
                      <p className="text-[11px] text-vault-gold flex items-center gap-1"><ArrowLeftRight size={11} /> {t('pubprofile.market.forTrade')}</p>
                    ) : null}
                  </div>
                </Link>
              )
            })}
          </div>
          <Link to="/trades" className="mt-4 inline-flex items-center gap-1.5 text-sm text-vault-accent hover:underline">
            {t('pubprofile.market.viewAll')} <ExternalLink size={14} />
          </Link>
        </>
      )}
    </div>
  )
}

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery, useInfiniteQuery } from '@tanstack/react-query'
import { Eye, X, ExternalLink, Layers, Flame, Clock } from 'lucide-react'
import LanguageSwitcher from '@/components/layout/LanguageSwitcher'
import { useSeo } from '@/components/Seo'
import { communityApi } from '@/lib/api'
import { useAuthStore } from '@/store/auth'

const COLOR_HEX: Record<string, string> = { W: '#f4e6b8', U: '#3b82c4', B: '#5b5563', R: '#d6584f', G: '#4ca766' }

function ColorPips({ colors }: { colors: string[] }) {
  if (!colors?.length) return <span className="w-3 h-3 rounded-full border border-vault-border bg-vault-card inline-block" title="Colorless" />
  return (
    <span className="inline-flex gap-0.5">
      {colors.map((c) => <span key={c} className="w-3 h-3 rounded-full border border-black/30" style={{ background: COLOR_HEX[c] }} />)}
    </span>
  )
}

function TopBar() {
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.user)
  return (
    <header className="border-b border-vault-border/60 backdrop-blur sticky top-0 z-20 bg-vault-bg/80">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link to="/" className="font-display text-xl font-bold text-vault-gold tracking-wider">📖 VaultSpell</Link>
        <div className="flex items-center gap-3">
          <LanguageSwitcher compact direction="down" />
          {user ? (
            <Link to="/collection" className="btn-primary text-sm">{t('events.openApp')}</Link>
          ) : (
            <>
              <Link to="/login" className="text-sm text-vault-muted hover:text-vault-text">{t('common.login')}</Link>
              <Link to="/register" className="btn-primary text-sm">{t('common.register')}</Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

function DeckDetailModal({ id, onClose }: { id: number; onClose: () => void }) {
  const { t } = useTranslation()
  const { data: deck, isLoading } = useQuery({ queryKey: ['community-deck', id], queryFn: () => communityApi.deck(id) })

  // Group cards by category, preserving a sensible order (Commander first).
  const groups = useMemo(() => {
    if (!deck?.cards) return []
    const m = new Map<string, any[]>()
    for (const c of deck.cards) { if (!m.has(c.category)) m.set(c.category, []); m.get(c.category)!.push(c) }
    const entries = [...m.entries()]
    entries.sort((a, b) => (a[0] === 'Commander' ? -1 : b[0] === 'Commander' ? 1 : a[0].localeCompare(b[0])))
    for (const [, list] of entries) list.sort((a, b) => a.name.localeCompare(b.name))
    return entries
  }, [deck])

  const total = deck?.cards?.reduce((s: number, c: any) => s + (c.qty || 1), 0) || 0

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-2xl max-h-[88vh] overflow-hidden rounded-2xl border border-vault-border bg-vault-surface shadow-2xl flex flex-col">
        {deck?.art && <div className="absolute inset-x-0 top-0 h-28 bg-cover bg-center opacity-25" style={{ backgroundImage: `url(${deck.art})` }} />}
        <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-transparent to-vault-surface pointer-events-none" />
        <div className="relative p-5 border-b border-vault-border">
          <button onClick={onClose} className="absolute top-4 right-4 text-vault-muted hover:text-vault-text"><X size={18} /></button>
          {isLoading ? (
            <div className="h-10" />
          ) : deck ? (
            <>
              <h3 className="font-display text-xl font-bold text-vault-gold pr-8">{deck.name}</h3>
              <p className="text-xs text-vault-muted mt-1 flex items-center gap-3 flex-wrap">
                <span>{deck.format}</span>
                {deck.owner && <span>· {deck.owner}</span>}
                <span className="flex items-center gap-1"><Eye size={12} /> {deck.views.toLocaleString()}</span>
                <span>· {total} {t('community.cards')}</span>
              </p>
            </>
          ) : null}
        </div>
        <div className="relative overflow-y-auto p-5">
          {isLoading ? (
            <div className="py-10 text-center"><div className="w-6 h-6 border-2 border-vault-accent border-t-transparent rounded-full animate-spin mx-auto" /></div>
          ) : groups.length === 0 ? (
            <p className="text-center text-vault-muted text-sm py-8">{t('community.deckEmpty')}</p>
          ) : (
            <div className="grid sm:grid-cols-2 gap-x-6 gap-y-4">
              {groups.map(([cat, list]) => (
                <div key={cat}>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-vault-accent mb-1.5">{cat} ({list.reduce((s: number, c: any) => s + c.qty, 0)})</h4>
                  <ul className="space-y-0.5">
                    {list.map((c: any, i: number) => (
                      <li key={`${c.scryfall_id}-${i}`} className="text-sm text-vault-text flex gap-2">
                        <span className="text-vault-muted tabular-nums">{c.qty}×</span>
                        <a href={`https://scryfall.com/card/${c.scryfall_id || ''}`} target="_blank" rel="noreferrer noopener" className="hover:text-vault-accent truncate">{c.name}</a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
        {deck?.url && (
          <div className="relative p-4 border-t border-vault-border text-center">
            <a href={deck.url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1.5 text-sm text-vault-accent hover:underline">
              {t('community.viewOnArchidekt')} <ExternalLink size={13} />
            </a>
          </div>
        )}
      </div>
    </div>
  )
}

export default function CommunityDecksPage() {
  const { t } = useTranslation()
  useSeo({ title: `${t('community.title')} — VaultSpell`, description: t('community.subtitle'), path: '/decks-comunidade' })
  const [format, setFormat] = useState(3)
  const [order, setOrder] = useState<'popular' | 'recent'>('popular')
  const [selected, setSelected] = useState<number | null>(null)

  const { data: formats = [] } = useQuery({ queryKey: ['community-formats'], queryFn: communityApi.formats })
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery({
    queryKey: ['community-decks', format, order],
    queryFn: ({ pageParam }) => communityApi.decks({ format, order, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (last: any) => (last?.has_more ? (last.page || 1) + 1 : undefined),
  })
  const decks = (data?.pages || []).flatMap((p: any) => p.decks || [])

  return (
    <div className="min-h-screen bg-vault-bg text-vault-text">
      <TopBar />

      <section className="max-w-5xl mx-auto px-6 pt-12 pb-4 text-center">
        <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-vault-gold bg-vault-gold/10 border border-vault-gold/30 rounded-full px-3 py-1 mb-4">
          <Layers size={13} /> {t('community.badge')}
        </div>
        <h1 className="font-display text-4xl sm:text-5xl font-bold text-vault-gold leading-tight">{t('community.title')}</h1>
        <p className="text-vault-muted text-lg mt-3 max-w-2xl mx-auto">{t('community.subtitle')}</p>
      </section>

      <section className="max-w-5xl mx-auto px-6 pb-20">
        <div className="flex flex-wrap items-center gap-2 mb-5">
          <select className="input-field !w-auto text-sm" value={format} onChange={(e) => setFormat(Number(e.target.value))}>
            {formats.map((f: any) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
          <div className="ml-auto flex rounded-lg border border-vault-border overflow-hidden">
            <button onClick={() => setOrder('popular')} className={`px-3 py-2 text-sm flex items-center gap-1.5 ${order === 'popular' ? 'bg-vault-accent/20 text-vault-accent' : 'text-vault-muted'}`}><Flame size={15} /> {t('community.popular')}</button>
            <button onClick={() => setOrder('recent')} className={`px-3 py-2 text-sm flex items-center gap-1.5 ${order === 'recent' ? 'bg-vault-accent/20 text-vault-accent' : 'text-vault-muted'}`}><Clock size={15} /> {t('community.recent')}</button>
          </div>
        </div>

        {isLoading ? (
          <div className="py-16 text-center"><div className="w-7 h-7 border-2 border-vault-accent border-t-transparent rounded-full animate-spin mx-auto" /></div>
        ) : decks.length === 0 ? (
          <p className="surface p-10 text-center text-vault-muted">{t('community.empty')}</p>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {decks.map((d: any) => (
                <button key={d.id} onClick={() => setSelected(d.id)}
                  className="group surface overflow-hidden text-left hover:border-vault-accent/50 transition-all">
                  <div className="aspect-[16/10] bg-vault-card relative">
                    {d.art && <img src={d.art} alt="" loading="lazy" className="w-full h-full object-cover transition-transform group-hover:scale-105" />}
                    <span className="absolute top-1.5 left-1.5"><ColorPips colors={d.colors} /></span>
                    <span className="absolute bottom-1.5 right-1.5 text-[10px] bg-black/70 text-white px-1.5 py-0.5 rounded flex items-center gap-1"><Eye size={10} /> {d.views.toLocaleString()}</span>
                  </div>
                  <div className="p-2.5">
                    <p className="text-sm font-medium text-vault-text line-clamp-2 leading-tight">{d.name}</p>
                    {d.owner && <p className="text-xs text-vault-muted mt-0.5 truncate">{d.owner}</p>}
                  </div>
                </button>
              ))}
            </div>
            {hasNextPage && (
              <div className="text-center mt-6">
                <button onClick={() => fetchNextPage()} disabled={isFetchingNextPage} className="btn-ghost px-6 disabled:opacity-50">
                  {isFetchingNextPage ? <div className="w-4 h-4 border-2 border-vault-accent border-t-transparent rounded-full animate-spin mx-auto" /> : t('community.loadMore')}
                </button>
              </div>
            )}
          </>
        )}

        <p className="text-center text-[11px] text-vault-muted/70 mt-8">{t('community.poweredBy')}</p>
      </section>

      {selected && <DeckDetailModal id={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}

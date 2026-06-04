import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { decksApi, cardsApi, wishlistApi } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { ArrowLeft, Plus, Trash2, Search, Crown, Shield, Share2, Library, BarChart3, GitCompareArrows, Globe, Lock, Download, Copy, Check, Sparkles, X, ShoppingCart, Star, List, LayoutGrid } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import CardTile from '@/components/cards/CardTile'
import CardPrice from '@/components/cards/CardPrice'
import DeckAnalysis from '@/components/decks/DeckAnalysis'
import DeckCompare from '@/components/decks/DeckCompare'
import ShareModal from '@/components/sharing/ShareModal'
import { useTranslation } from 'react-i18next'

const ROLE_STYLE: Record<string, string> = {
  ramp: 'bg-green-500/15 text-green-400',
  draw: 'bg-blue-500/15 text-blue-400',
  removal: 'bg-red-500/15 text-red-400',
  wipe: 'bg-orange-500/15 text-orange-400',
  interaction: 'bg-purple-500/15 text-purple-300',
  finisher: 'bg-vault-gold/15 text-vault-gold',
}

function RoleTag({ role }: { role?: string }) {
  const { t } = useTranslation()
  if (!role || !ROLE_STYLE[role]) return null
  return (
    <span className={`inline-block mr-2 align-middle text-[9px] uppercase tracking-wide font-bold px-1.5 py-0.5 rounded ${ROLE_STYLE[role]}`}>
      {t(`analysis.cat_${role}`)}
    </span>
  )
}

export default function DeckDetailPage() {
  const { id } = useParams<{ id: string }>()
  const deckId = Number(id)
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [searching, setSearching] = useState(false)
  const [view, setView] = useState<'grid' | 'list'>('list')
  const [showShare, setShowShare] = useState(false)
  const [showCoverage, setShowCoverage] = useState(false)
  const [showAnalysis, setShowAnalysis] = useState(false)
  const [showCompare, setShowCompare] = useState(false)
  const [showExport, setShowExport] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showDoctor, setShowDoctor] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const { t, i18n } = useTranslation()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const isPremium = !!(user?.is_premium || user?.is_admin)

  const { data: doctorCfg } = useQuery({ queryKey: ['doctor-status'], queryFn: decksApi.doctorStatus })
  const doctorMutation = useMutation({ mutationFn: (refresh?: boolean) => decksApi.doctor(deckId, i18n.language, !!refresh) })

  const { data: deck, isLoading } = useQuery({
    queryKey: ['deck', deckId],
    queryFn: () => decksApi.get(deckId),
  })

  const { data: coverage, isLoading: coverageLoading } = useQuery({
    queryKey: ['deck-coverage', deckId],
    queryFn: () => decksApi.coverage(deckId),
    enabled: showCoverage,
  })

  const addCardMutation = useMutation({
    mutationFn: (data: any) => decksApi.addCard(deckId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deck', deckId] }),
  })

  const publicMutation = useMutation({
    mutationFn: (is_public: boolean) => decksApi.update(deckId, { is_public }),
    onSuccess: (_d, isPublic) => {
      qc.invalidateQueries({ queryKey: ['deck', deckId] })
      setNotice(isPublic ? 'public' : 'private')
    },
  })

  const [wished, setWished] = useState<Record<string, boolean>>({})
  const wishlistMutation = useMutation({
    mutationFn: (scryfallId: string) => wishlistApi.add({ scryfall_id: scryfallId, quantity: 1 }),
    onSuccess: (_d, scryfallId) => { setWished(w => ({ ...w, [scryfallId]: true })); qc.invalidateQueries({ queryKey: ['wishlist'] }) },
  })

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchQuery.trim()) return
    setSearching(true)
    try {
      const data = await cardsApi.search(searchQuery)
      setSearchResults(data.cards || [])
    } finally {
      setSearching(false)
    }
  }

  // Group cards by type
  const mainboard = deck?.cards?.filter((c: any) => !c.is_sideboard && !c.is_commander) || []
  const sideboard = deck?.cards?.filter((c: any) => c.is_sideboard) || []
  const commanders = deck?.cards?.filter((c: any) => c.is_commander) || []

  const totalCards = mainboard.reduce((s: number, c: any) => s + c.quantity, 0)
  const totalValue = deck?.cards?.reduce((s: number, c: any) => s + (c.card?.price_usd || 0) * c.quantity, 0) || 0

  // Build a plain decklist (Moxfield/Arena compatible).
  const buildDecklist = () => {
    const line = (c: any) => `${c.quantity} ${c.card?.name || c.card?.id}`
    const parts: string[] = []
    if (commanders.length) parts.push('Commander', ...commanders.map(line), '')
    parts.push('Deck', ...mainboard.map(line))
    if (sideboard.length) parts.push('', 'Sideboard', ...sideboard.map(line))
    return parts.join('\n')
  }

  const copyDecklist = async () => {
    try { await navigator.clipboard.writeText(buildDecklist()); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch {}
  }
  const downloadDecklist = () => {
    const blob = new Blob([buildDecklist()], { type: 'text/plain' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${(deck?.name || 'deck').replace(/[^a-z0-9]+/gi, '_')}.txt`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  if (isLoading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-2 border-vault-accent border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="p-6">
      {/* Public/private toggle feedback */}
      <AnimatePresence>
        {notice && (
          <motion.div
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className={`mb-4 surface p-3 flex items-center justify-between gap-3 text-sm ${notice === 'public' ? 'border-green-500/40' : 'border-vault-border'}`}
          >
            <span className="flex items-center gap-2 text-vault-text">
              {notice === 'public' ? <Globe size={15} className="text-green-400" /> : <Lock size={15} className="text-vault-muted" />}
              {notice === 'public' ? t('detail.nowPublic') : t('detail.nowPrivate')}
              {notice === 'public' && user?.username && (
                <Link to={`/u/${user.username}`} className="text-vault-accent hover:underline">{t('detail.seeProfile')}</Link>
              )}
            </span>
            <button onClick={() => setNotice(null)} className="text-vault-muted hover:text-vault-text"><X size={15} /></button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link to="/decks" className="btn-ghost !p-2"><ArrowLeft size={18} /></Link>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="font-display text-2xl font-bold text-vault-gold">{deck?.name}</h1>
            <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-full bg-vault-accent/20 text-vault-accent">
              {deck?.format}
            </span>
          </div>
          {deck?.description && <p className="text-sm text-vault-muted mt-0.5">{deck.description}</p>}
        </div>
        <button
          onClick={() => publicMutation.mutate(!deck?.is_public)}
          title={deck?.is_public ? t('detail.makePrivate') : t('detail.makePublic')}
          className={`btn-ghost flex items-center gap-2 ${deck?.is_public ? 'text-green-400' : ''}`}
        >
          {deck?.is_public ? <Globe size={16} /> : <Lock size={16} />}
          {deck?.is_public ? t('detail.public') : t('detail.private')}
        </button>
        <button onClick={() => setShowExport(true)} className="btn-ghost flex items-center gap-2">
          <Download size={16} /> {t('detail.export')}
        </button>
        <button onClick={() => setShowShare(true)} className="btn-ghost flex items-center gap-2">
          <Share2 size={16} /> {t('common.share')}
        </button>
        <button onClick={() => setShowSearch(true)} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> {t('detail.addCard')}
        </button>
      </div>

      {/* Deck tools toolbar */}
      <div className="flex flex-wrap gap-2 mb-6">
        {[
          { id: 'analysis', icon: BarChart3, label: t('analysis.title'), on: showAnalysis, set: setShowAnalysis },
          { id: 'coverage', icon: Library, label: t('coverage.compare'), on: showCoverage, set: setShowCoverage },
          { id: 'compare', icon: GitCompareArrows, label: t('compare.title'), on: showCompare, set: setShowCompare },
        ].map(b => (
          <button
            key={b.id}
            onClick={() => b.set((v: boolean) => !v)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-all ${
              b.on
                ? 'bg-vault-accent/20 border-vault-accent/50 text-vault-accent'
                : 'bg-vault-card border-vault-border text-vault-muted hover:text-vault-text hover:border-vault-accent/30'
            }`}
          >
            <b.icon size={16} /> {b.label}
          </button>
        ))}
        {doctorCfg?.configured && (
          <button
            onClick={() => {
              if (!isPremium) { navigate('/premium'); return }
              setShowDoctor(v => !v)
              if (!doctorMutation.data && !doctorMutation.isPending) doctorMutation.mutate(false)
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-all ${
              showDoctor ? 'bg-vault-gold/20 border-vault-gold/50 text-vault-gold'
                : 'bg-vault-card border-vault-gold/30 text-vault-gold/90 hover:border-vault-gold/50'
            }`}
          >
            <Sparkles size={16} /> {t('doctor.title')} {!isPremium && <Lock size={12} />}
          </button>
        )}
      </div>

      {/* AI Deck Doctor */}
      <AnimatePresence>
        {showDoctor && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden mb-6">
            <div className="surface p-5 border-vault-gold/30 bg-gradient-to-br from-vault-gold/5 to-transparent">
              <div className="flex items-center justify-between mb-3">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-vault-gold">
                  <Sparkles size={15} /> {t('doctor.title')}
                </h2>
                <div className="flex items-center gap-3">
                  {!doctorMutation.isPending && (
                    <button onClick={() => doctorMutation.mutate(true)} className="text-xs text-vault-muted hover:text-vault-gold">{t('doctor.regenerate')}</button>
                  )}
                  <button onClick={() => setShowDoctor(false)} className="text-vault-muted hover:text-vault-text"><X size={16} /></button>
                </div>
              </div>
              {doctorMutation.isPending ? (
                <div className="flex items-center gap-3 py-6 justify-center text-sm text-vault-muted">
                  <div className="w-5 h-5 border-2 border-vault-gold border-t-transparent rounded-full animate-spin" />
                  {t('doctor.thinking')}
                </div>
              ) : doctorMutation.isError ? (
                <p className="text-sm text-red-400 py-4">
                  {(doctorMutation.error as any)?.response?.data?.detail || t('doctor.error')}
                </p>
              ) : (
                <p className="text-sm text-vault-text whitespace-pre-wrap leading-relaxed">{doctorMutation.data?.text}</p>
              )}
              <p className="text-[10px] text-vault-muted/70 mt-3">{t('doctor.disclaimer')}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {showShare && (
        <ShareModal resourceType="deck" resourceId={deckId} resourcelabel={deck?.name} onClose={() => setShowShare(false)} />
      )}

      {/* Export decklist */}
      <AnimatePresence>
        {showExport && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowExport(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="relative z-10 surface p-6 w-full max-w-md">
              <h3 className="font-display font-bold text-vault-gold mb-1">{t('detail.exportTitle')}</h3>
              <p className="text-xs text-vault-muted mb-3">{t('detail.exportHint')}</p>
              <textarea
                readOnly value={buildDecklist()}
                className="input-field resize-none font-mono text-xs w-full h-56 mb-3"
                onFocus={(e) => e.target.select()}
              />
              <div className="flex gap-2">
                <button onClick={copyDecklist} className="btn-primary flex-1 flex items-center justify-center gap-2">
                  {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? t('detail.copied') : t('detail.copy')}
                </button>
                <button onClick={downloadDecklist} className="btn-ghost flex items-center gap-2">
                  <Download size={15} /> .txt
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Compare with another deck */}
      <AnimatePresence>
        {showCompare && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden mb-6"
          >
            <div className="surface p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-vault-accent">
                  <GitCompareArrows size={15} /> {t('compare.title')}
                </h2>
                <button onClick={() => setShowCompare(false)} className="text-vault-muted hover:text-vault-text"><X size={16} /></button>
              </div>
              <DeckCompare deckId={deckId} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Deck analysis */}
      <AnimatePresence>
        {showAnalysis && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden mb-6"
          >
            <div className="surface p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-vault-accent">
                  <BarChart3 size={15} /> {t('analysis.title')}
                </h2>
                <button onClick={() => setShowAnalysis(false)} className="text-vault-muted hover:text-vault-text"><X size={16} /></button>
              </div>
              <DeckAnalysis deckId={deckId} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Collection coverage */}
      <AnimatePresence>
        {showCoverage && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden mb-6"
          >
            <div className="surface p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-vault-accent">
                  <Library size={15} /> {t('coverage.title')}
                </h2>
                <button onClick={() => setShowCoverage(false)} className="text-vault-muted hover:text-vault-text"><X size={16} /></button>
              </div>
              {coverageLoading || !coverage ? (
                <div className="flex justify-center py-6">
                  <div className="w-6 h-6 border-2 border-vault-accent border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <>
                  <div className="flex items-end justify-between mb-2">
                    <p className="text-3xl font-display font-bold text-vault-gold">{coverage.summary.percent}%</p>
                    <p className="text-xs text-vault-muted">
                      {t('coverage.ownedOf', { owned: coverage.summary.owned, needed: coverage.summary.needed })}
                    </p>
                  </div>
                  <div className="h-2.5 rounded-full bg-vault-card overflow-hidden mb-4">
                    <motion.div
                      className="h-full bg-gradient-to-r from-vault-accent to-green-400"
                      initial={{ width: 0 }} animate={{ width: `${coverage.summary.percent}%` }} transition={{ duration: 0.6 }}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="rounded-xl border border-vault-border bg-vault-card/40 p-3 text-center">
                      <p className="text-xl font-display font-bold text-vault-text">{coverage.summary.missing}</p>
                      <p className="text-[11px] text-vault-muted">{t('coverage.missingCards')}</p>
                    </div>
                    <div className="rounded-xl border border-vault-border bg-vault-card/40 p-3 text-center">
                      <p className="text-xl font-display font-bold text-green-400">${coverage.summary.missing_cost.toFixed(2)}</p>
                      <p className="text-[11px] text-vault-muted">{t('coverage.costToComplete')}</p>
                    </div>
                  </div>
                  {coverage.summary.missing > 0 ? (
                    <>
                      <p className="text-xs font-medium text-vault-muted mb-2">{t('coverage.missingList')}</p>
                      <div className="max-h-64 overflow-y-auto rounded-xl border border-vault-border divide-y divide-vault-border/40">
                        {coverage.cards.filter((c: any) => c.missing > 0).map((c: any, i: number) => (
                          <div key={i} className="flex items-center gap-3 px-3 py-2 hover:bg-vault-card/30">
                            {c.card?.image_small && (
                              <img src={c.card.image_small} alt={c.card.name} className="w-6 rounded shadow flex-shrink-0" />
                            )}
                            <span className="flex-1 text-sm text-vault-text truncate">
                              {c.card?.name}
                              {c.is_sideboard && <span className="ml-1.5 text-[10px] text-vault-muted">SB</span>}
                              {c.is_commander && <span className="ml-1.5 text-[10px] text-vault-gold">CMD</span>}
                            </span>
                            <span className="text-xs font-mono text-vault-muted">{c.owned}/{c.needed}</span>
                            <span className="text-xs font-mono font-bold text-vault-accent w-10 text-right">−{c.missing}</span>
                            <span className="text-xs font-mono text-green-400 w-14 text-right">
                              {c.card?.price_usd > 0 ? `$${(c.card.price_usd * c.missing).toFixed(2)}` : '—'}
                            </span>
                            <div className="flex items-center gap-1 pl-1">
                              <button
                                onClick={() => navigate(`/trades?q=${encodeURIComponent(c.card?.name || '')}`)}
                                title={t('coverage.findInMarket')}
                                className="text-vault-muted hover:text-vault-accent p-1 rounded hover:bg-vault-accent/10"
                              ><ShoppingCart size={13} /></button>
                              <button
                                onClick={() => c.card?.id && wishlistMutation.mutate(c.card.id)}
                                disabled={!!wished[c.card?.id]}
                                title={t('coverage.addWishlist')}
                                className={`p-1 rounded hover:bg-vault-gold/10 ${wished[c.card?.id] ? 'text-vault-gold' : 'text-vault-muted hover:text-vault-gold'}`}
                              ><Star size={13} className={wished[c.card?.id] ? 'fill-vault-gold' : ''} /></button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-green-400 text-center py-2">✓ {t('coverage.complete')}</p>
                  )}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="surface p-4 text-center">
          <p className="text-2xl font-display font-bold text-vault-accent">{totalCards}</p>
          <p className="text-xs text-vault-muted">{t('detail.mainCardsLabel')}</p>
        </div>
        <div className="surface p-4 text-center">
          <p className="text-2xl font-display font-bold text-green-400">${totalValue.toFixed(2)}</p>
          <p className="text-xs text-vault-muted">{t('detail.totalValue')}</p>
        </div>
        <div className="surface p-4 text-center">
          <p className="text-2xl font-display font-bold text-vault-muted">{sideboard.length}</p>
          <p className="text-xs text-vault-muted">{t('detail.sideboard')}</p>
        </div>
      </div>

      {deck?.cards?.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-4xl mb-4">⚔️</p>
          <p className="text-vault-muted mb-4">{t('detail.deckEmpty')}</p>
          <button onClick={() => setShowSearch(true)} className="btn-primary inline-flex items-center gap-2">
            <Plus size={16} /> {t('detail.addCards')}
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Commander section */}
          {commanders.length > 0 && (
            <section>
              <h2 className="flex items-center gap-2 text-sm font-semibold text-vault-gold mb-3">
                <Crown size={14} /> {t('detail.commander')} ({commanders.length})
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                {commanders.map((c: any) => <CardTile key={c.id} card={c.card} showActions={false} />)}
              </div>
            </section>
          )}

          {/* Mainboard */}
          {mainboard.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-vault-text">
                  {t('detail.mainDeck')} ({t('common.cardsCount', { count: totalCards })})
                </h2>
                <div className="flex items-center gap-1 bg-vault-card/50 p-1 rounded-lg">
                  <button onClick={() => setView('list')} className={`p-1.5 rounded ${view === 'list' ? 'bg-vault-accent/20 text-vault-accent' : 'text-vault-muted hover:text-vault-text'}`}><List size={15} /></button>
                  <button onClick={() => setView('grid')} className={`p-1.5 rounded ${view === 'grid' ? 'bg-vault-accent/20 text-vault-accent' : 'text-vault-muted hover:text-vault-text'}`}><LayoutGrid size={15} /></button>
                </div>
              </div>
              {view === 'grid' ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                  {mainboard.map((entry: any) => (
                    <div key={entry.id} className="relative">
                      <CardTile card={entry.card} showActions={false} />
                      <span className="absolute top-1 left-1 text-[10px] bg-black/70 text-white px-1.5 py-0.5 rounded font-mono">×{entry.quantity}</span>
                    </div>
                  ))}
                </div>
              ) : (
              <div className="surface overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-vault-border bg-vault-surface">
                      <th className="text-left px-4 py-2.5 text-xs text-vault-muted">{t('detail.thCard')}</th>
                      <th className="text-center px-4 py-2.5 text-xs text-vault-muted w-16">{t('detail.thQty')}</th>
                      <th className="text-left px-4 py-2.5 text-xs text-vault-muted">{t('detail.thType')}</th>
                      <th className="text-right px-4 py-2.5 text-xs text-vault-muted w-20">{t('detail.thPrice')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mainboard.map((entry: any) => (
                      <tr key={entry.id} className="border-b border-vault-border/40 hover:bg-vault-card/30 transition-colors">
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-3">
                            {entry.card?.image_small && (
                              <img src={entry.card.image_small} alt={entry.card.name} className="w-7 rounded shadow flex-shrink-0" />
                            )}
                            <div>
                              <p className="font-medium text-vault-text text-sm">{entry.card?.name}</p>
                              <p className="text-xs text-vault-muted">{entry.card?.mana_cost}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <span className="font-mono font-bold text-vault-accent">×{entry.quantity}</span>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-vault-muted truncate max-w-[240px]">
                          <RoleTag role={entry.role} />
                          {entry.card?.type_line}
                        </td>
                        <td className="px-4 py-2.5 text-right text-xs">
                          <CardPrice usd={entry.card?.price_usd} quantity={entry.quantity} purchaseUri={entry.card?.purchase_uri} compact />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              )}
            </section>
          )}

          {/* Sideboard */}
          {sideboard.length > 0 && (
            <section>
              <h2 className="flex items-center gap-2 text-sm font-semibold text-vault-muted mb-3">
                <Shield size={14} /> {t('detail.sideboard')} ({t('common.cardsCount', { count: sideboard.reduce((s: number, c: any) => s + c.quantity, 0) })})
              </h2>
              <div className="surface overflow-hidden">
                <table className="w-full text-sm">
                  <tbody>
                    {sideboard.map((entry: any) => (
                      <tr key={entry.id} className="border-b border-vault-border/40 hover:bg-vault-card/30 transition-colors">
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-3">
                            {entry.card?.image_small && (
                              <img src={entry.card.image_small} alt={entry.card.name} className="w-7 rounded shadow" />
                            )}
                            <p className="font-medium text-vault-text text-sm">{entry.card?.name}</p>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <span className="font-mono font-bold text-vault-muted">×{entry.quantity}</span>
                        </td>
                        <td className="px-4 py-2.5 text-right text-xs">
                          <CardPrice usd={entry.card?.price_usd} quantity={entry.quantity} purchaseUri={entry.card?.purchase_uri} compact />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      )}

      {/* Add card modal */}
      <AnimatePresence>
        {showSearch && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowSearch(false)} />
            <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }}
              className="relative z-10 bg-vault-surface border border-vault-border rounded-2xl p-6 w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display text-xl font-bold text-vault-gold">{t('detail.addToDeck')}</h2>
                <button onClick={() => setShowSearch(false)} className="text-vault-muted hover:text-vault-text">✕</button>
              </div>

              <form onSubmit={handleSearch} className="flex gap-2 mb-4">
                <input className="input-field flex-1" placeholder={t('detail.searchCard')} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                <button type="submit" className="btn-primary flex items-center gap-2">
                  <Search size={14} /> {t('search.button')}
                </button>
              </form>

              <div className="flex-1 overflow-y-auto">
                {searching ? (
                  <div className="flex justify-center py-8">
                    <div className="w-6 h-6 border-2 border-vault-accent border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {searchResults.map((card: any) => (
                      <div key={card.id} className="relative">
                        <CardTile card={card} showActions={false} />
                        <div className="flex gap-1 mt-1">
                          <button
                            onClick={() => addCardMutation.mutate({ scryfall_id: card.id, quantity: 1 })}
                            className="flex-1 text-[10px] btn-primary py-1"
                          >+ Main</button>
                          <button
                            onClick={() => addCardMutation.mutate({ scryfall_id: card.id, quantity: 1, is_sideboard: true })}
                            className="flex-1 text-[10px] btn-ghost py-1 border border-vault-border"
                          >Side</button>
                          {deck?.format === 'commander' && (
                            <button
                              onClick={() => addCardMutation.mutate({ scryfall_id: card.id, quantity: 1, is_commander: true })}
                              className="text-[10px] px-2 btn-ghost py-1 border border-vault-gold/30 text-vault-gold"
                            >CMD</button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}

import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { cardsApi, collectionApi, wishlistApi } from '@/lib/api'
import CardTile from '@/components/cards/CardTile'
import AddCardModal from '@/components/collection/AddCardModal'
import CardInfoModal from '@/components/cards/CardInfoModal'
import { Search, Filter, ChevronLeft, ChevronRight, Star, Crown, HelpCircle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { debounce } from '@/lib/utils'
import { useTranslation } from 'react-i18next'

// Common ability keywords for the quick-pick chips (value = Scryfall kw: token).
const ABILITIES = [
  'Flying', 'Deathtouch', 'Lifelink', 'Trample', 'Vigilance', 'Haste', 'First strike',
  'Double strike', 'Menace', 'Reach', 'Hexproof', 'Ward', 'Flash', 'Defender',
  'Indestructible', 'Prowess', 'Scry', 'Cascade', 'Convoke', 'Flashback',
]

type Mode = 'name' | 'effect'

export default function SearchPage() {
  const { t } = useTranslation()
  const [mode, setMode] = useState<Mode>('name')
  const [commanderOnly, setCommanderOnly] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [query, setQuery] = useState('')        // final Scryfall query that gets sent
  const [searchInput, setSearchInput] = useState('')
  const [page, setPage] = useState(1)
  const [selectedCard, setSelectedCard] = useState<any>(null)
  const [infoCard, setInfoCard] = useState<any>(null)
  const [showModal, setShowModal] = useState(false)
  const qc = useQueryClient()

  // Turn the raw input into a Scryfall query depending on the chosen mode.
  // When commanderOnly is on, restrict to cards that can be a commander.
  const buildQuery = (input: string, m: Mode, cmd = commanderOnly) => {
    const base = m === 'effect' ? `oracle:"${input.replace(/"/g, '')}"` : input
    return (cmd ? `${base} is:commander` : base).trim()
  }

  const toggleCommander = () => {
    const next = !commanderOnly
    setCommanderOnly(next)
    const input = searchInput.trim()
    // A commander filter is a valid search on its own (no text needed).
    if (input.length >= 2 || next) { setQuery(buildQuery(input, mode, next)); setPage(1) }
  }

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['card-search', query, page],
    queryFn: () => cardsApi.search(query, page),
    enabled: query.length >= 2,
  })

  const { data: suggestions } = useQuery({
    queryKey: ['autocomplete', searchInput],
    queryFn: () => cardsApi.autocomplete(searchInput),
    enabled: searchInput.length >= 2,
  })

  const [toast, setToast] = useState<string | null>(null)
  const flash = (msg: string) => { setToast(msg); window.clearTimeout((flash as any)._t); (flash as any)._t = window.setTimeout(() => setToast(null), 2500) }

  const addMutation = useMutation({
    mutationFn: (data: any) => collectionApi.add(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['collection'] })
      qc.invalidateQueries({ queryKey: ['collection-stats'] })
      setShowModal(false)
      flash(t('search.addedCollection'))
    },
  })

  const wishlistMutation = useMutation({
    mutationFn: (card: any) => wishlistApi.add({ scryfall_id: card.id, quantity: 1 }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['wishlist'] }); flash(t('search.addedWishlist')) },
  })

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchInput.trim().length < 2) return
    setQuery(buildQuery(searchInput.trim(), mode))
    setPage(1)
  }

  const runAbility = (label: string) => {
    setMode('effect')
    setSearchInput(label)
    // oracle: (mentions it anywhere) is broader than keyword: (only cards that
    // intrinsically have the ability) — e.g. Hexproof 321 vs 93.
    setQuery(buildQuery(label, 'effect'))
    setPage(1)
  }

  const handleAdd = (card: any) => {
    setSelectedCard(card)
    setShowModal(true)
  }

  // Run a raw Scryfall query (from the syntax-help examples).
  const runRaw = (q: string) => { setMode('name'); setSearchInput(q); setQuery(q.trim()); setPage(1); setShowHelp(false) }

  // Common Scryfall operators with a concrete, clickable example.
  const SYNTAX = [
    { ex: 't:creature', d: t('search.help.type') },
    { ex: 'c:blue', d: t('search.help.color') },
    { ex: 'id:wu', d: t('search.help.identity') },
    { ex: 'cmc<=3', d: t('search.help.cmc') },
    { ex: 'pow>=4', d: t('search.help.power') },
    { ex: 'r:mythic', d: t('search.help.rarity') },
    { ex: 'set:lci', d: t('search.help.set') },
    { ex: 'o:"draw a card"', d: t('search.help.oracle') },
    { ex: 'is:commander', d: t('search.help.commander') },
    { ex: 't:creature c:blue cmc<=2', d: t('search.help.combine') },
  ]

  return (
    <div className="p-6">
      <div className="mb-4">
        <h1 className="font-display text-3xl font-bold text-vault-gold mb-1">{t('search.title')}</h1>
        <p className="text-vault-muted text-sm flex items-center gap-2 flex-wrap">
          {mode === 'effect'
            ? t('search.effectHint')
            : <>{t('search.syntaxHint')} <code className="text-vault-accent bg-vault-card px-1 rounded">t:creature c:blue</code></>}
          <button onClick={() => setShowHelp(v => !v)} className="inline-flex items-center gap-1 text-vault-accent hover:underline">
            <HelpCircle size={14} /> {t('search.help.button')}
          </button>
        </p>
        <AnimatePresence>
          {showHelp && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden">
              <div className="surface p-4 mt-3">
                <p className="text-xs text-vault-muted mb-3">{t('search.help.intro')}</p>
                <div className="grid sm:grid-cols-2 gap-1.5">
                  {SYNTAX.map(s => (
                    <button key={s.ex} onClick={() => runRaw(s.ex)}
                      className="flex items-center gap-2 text-left px-2.5 py-1.5 rounded-lg hover:bg-vault-card/60 transition-colors group">
                      <code className="text-[11px] text-vault-accent bg-vault-card px-1.5 py-0.5 rounded shrink-0 group-hover:bg-vault-accent/20">{s.ex}</code>
                      <span className="text-xs text-vault-muted truncate">{s.d}</span>
                    </button>
                  ))}
                </div>
                <a href="https://scryfall.com/docs/syntax" target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-vault-accent hover:underline mt-3">
                  {t('search.help.full')} ↗
                </a>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Mode toggle: search by name, or by ability/effect text */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <div className="flex gap-1 bg-vault-card/50 p-1 rounded-lg w-fit">
          {(['name', 'effect'] as Mode[]).map(m => (
            <button
              key={m}
              onClick={() => { setMode(m); if (searchInput.trim().length >= 2) { setQuery(buildQuery(searchInput.trim(), m)); setPage(1) } }}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${mode === m ? 'bg-vault-accent/20 text-vault-accent' : 'text-vault-muted hover:text-vault-text'}`}
            >
              {m === 'name' ? t('search.modeName') : t('search.modeEffect')}
            </button>
          ))}
        </div>
        <button
          onClick={toggleCommander}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
            commanderOnly ? 'border-vault-gold/50 bg-vault-gold/15 text-vault-gold' : 'border-vault-border text-vault-muted hover:text-vault-text'
          }`}
        >
          <Crown size={13} /> {t('search.commandersOnly')}
        </button>
      </div>

      {/* Search form */}
      <form onSubmit={handleSearch} className="mb-4">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-vault-muted" />
            <input
              className="input-field pl-10"
              placeholder={mode === 'effect' ? t('search.effectPlaceholder') : t('search.placeholder')}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          <button type="submit" className="btn-primary px-6">
            {t('search.button')}
          </button>
        </div>

        {/* Autocomplete suggestions (name mode only) */}
        {mode === 'name' && suggestions?.suggestions?.length > 0 && searchInput && !query && (
          <div className="absolute z-10 bg-vault-surface border border-vault-border rounded-lg mt-1 shadow-xl max-w-md">
            {suggestions.suggestions.slice(0, 8).map((name: string) => (
              <button
                key={name}
                type="button"
                className="w-full text-left px-4 py-2 text-sm text-vault-text hover:bg-vault-card transition-colors"
                onClick={() => { setSearchInput(name); setQuery(name); setPage(1) }}
              >
                {name}
              </button>
            ))}
          </div>
        )}
      </form>

      {/* Quick ability chips */}
      <div className="flex flex-wrap gap-1.5 mb-6">
        <span className="text-xs text-vault-muted self-center mr-1">{t('search.abilities')}:</span>
        {ABILITIES.map(a => (
          <button
            key={a}
            onClick={() => runAbility(a)}
            className="text-[11px] px-2.5 py-1 rounded-full border border-vault-border text-vault-muted hover:border-vault-accent/40 hover:text-vault-accent transition-all"
          >
            {a}
          </button>
        ))}
      </div>

      {/* Results */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-vault-accent border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {isError && !isLoading && (
        <div className="text-center py-16">
          <p className="text-vault-muted mb-3">{t('search.errorRetry')}</p>
          <button onClick={() => refetch()} className="btn-ghost">{t('search.retry')}</button>
        </div>
      )}

      {data && !isLoading && data.cards?.length === 0 && (
        <div className="text-center py-16 text-vault-muted">{t('search.noResults')}</div>
      )}

      {data && data.cards?.length > 0 && (
        <>
          <div className="flex items-center justify-between mb-4">
            <p className="text-vault-muted text-sm">
              {t('search.found', { count: data.total_cards })}
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            <AnimatePresence>
              {data.cards?.map((card: any, i: number) => (
                <motion.div
                  key={card.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <CardTile
                    card={card}
                    onAdd={handleAdd}
                    onWishlist={(c) => wishlistMutation.mutate(c)}
                    onClick={(c) => setInfoCard(c)}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Pagination */}
          {(data.has_more || page > 1) && (
            <div className="flex items-center justify-center gap-4 mt-8">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn-ghost flex items-center gap-2 disabled:opacity-40"
              >
                <ChevronLeft size={16} /> {t('search.prev')}
              </button>
              <span className="text-vault-muted text-sm">{t('search.page', { n: page })}</span>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={!data.has_more}
                className="btn-ghost flex items-center gap-2 disabled:opacity-40"
              >
                {t('search.next')} <ChevronRight size={16} />
              </button>
            </div>
          )}
        </>
      )}

      {/* Card encyclopedia (read-only) */}
      {infoCard && (
        <CardInfoModal
          card={infoCard}
          onClose={() => setInfoCard(null)}
          onAddToCollection={(c) => { setInfoCard(null); handleAdd(c) }}
        />
      )}

      {/* Add card modal */}
      {showModal && selectedCard && (
        <AddCardModal
          card={selectedCard}
          onClose={() => setShowModal(false)}
          onConfirm={(data) => addMutation.mutate(data)}
          isLoading={addMutation.isPending}
        />
      )}

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -30, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -30 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] bg-vault-gold text-black px-6 py-3 rounded-xl shadow-2xl flex items-center gap-2 font-semibold text-sm"
          >
            <Star size={17} className="fill-black" /> {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

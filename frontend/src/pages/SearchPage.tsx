import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { cardsApi, collectionApi, wishlistApi } from '@/lib/api'
import CardTile from '@/components/cards/CardTile'
import AddCardModal from '@/components/collection/AddCardModal'
import { Search, Filter, ChevronLeft, ChevronRight, Star } from 'lucide-react'
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
  const [query, setQuery] = useState('')        // final Scryfall query that gets sent
  const [searchInput, setSearchInput] = useState('')
  const [page, setPage] = useState(1)
  const [selectedCard, setSelectedCard] = useState<any>(null)
  const [showModal, setShowModal] = useState(false)
  const qc = useQueryClient()

  // Turn the raw input into a Scryfall query depending on the chosen mode.
  const buildQuery = (input: string, m: Mode) =>
    m === 'effect' ? `oracle:"${input.replace(/"/g, '')}"` : input

  const { data, isLoading } = useQuery({
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
    setQuery(`oracle:"${label}"`)
    setPage(1)
  }

  const handleAdd = (card: any) => {
    setSelectedCard(card)
    setShowModal(true)
  }

  return (
    <div className="p-6">
      <div className="mb-4">
        <h1 className="font-display text-3xl font-bold text-vault-gold mb-1">{t('search.title')}</h1>
        <p className="text-vault-muted text-sm">
          {mode === 'effect'
            ? t('search.effectHint')
            : <>{t('search.syntaxHint')} <code className="text-vault-accent bg-vault-card px-1 rounded">t:creature c:blue</code></>}
        </p>
      </div>

      {/* Mode toggle: search by name, or by ability/effect text */}
      <div className="flex gap-1 mb-3 bg-vault-card/50 p-1 rounded-lg w-fit">
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

      {data && (
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

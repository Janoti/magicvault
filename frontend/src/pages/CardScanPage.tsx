import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { cardsApi, collectionApi } from '@/lib/api'
import { Camera, Search, Plus, CheckCircle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import AddCardModal from '@/components/collection/AddCardModal'
import CameraScanModal from '@/components/scan/CameraScanModal'
import { useFlags } from '@/lib/flags'
import { useAuthStore } from '@/store/auth'

export default function CardScanPage() {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [selectedCard, setSelectedCard] = useState<any>(null)
  const [showModal, setShowModal] = useState(false)
  const [showCamera, setShowCamera] = useState(false)
  const [pendingScan, setPendingScan] = useState('')   // OCR'd name awaiting a match
  const [scanNote, setScanNote] = useState('')         // diagnostic: which engine read it
  const [recentlyAdded, setRecentlyAdded] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const timerRef = useRef<any>(null)
  const qc = useQueryClient()
  const flags = useFlags()
  const user = useAuthStore((s) => s.user)
  const isPremium = !!(user?.is_premium || user?.is_admin)

  // After a camera scan, search the OCR'd name and auto-open the add modal when
  // a result clearly matches (so the card comes up pre-filled, ready to add).
  const onScanned = (name: string, source: string) => {
    setShowCamera(false)
    const [base, ...rest] = source.split(' · ')
    const label = base === 'ximilar' ? '🃏 Ximilar' : base === 'vision' ? '☁️ Google Vision' : '📷 leitura local'
    const note = rest.join(' · ')
    setScanNote(`${label} → "${name || '—'}"${note ? ` (${note})` : ''}`)
    if (!name) return
    setQuery(name); setDebouncedQuery(name); setPendingScan(name.toLowerCase())
  }

  const handleInput = (val: string) => {
    setQuery(val)
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setDebouncedQuery(val), 400)
  }

  const { data: autocomplete } = useQuery({
    queryKey: ['autocomplete', debouncedQuery],
    queryFn: () => cardsApi.autocomplete(debouncedQuery),
    enabled: debouncedQuery.length >= 2,
  })

  const { data: searchData, isLoading } = useQuery({
    queryKey: ['scan-search', debouncedQuery],
    queryFn: () => cardsApi.search(debouncedQuery, 1),
    enabled: debouncedQuery.length >= 3,
  })

  const addMutation = useMutation({
    mutationFn: collectionApi.add,
    onSuccess: (_, vars: any) => {
      qc.invalidateQueries({ queryKey: ['collection'] })
      qc.invalidateQueries({ queryKey: ['collection-stats'] })
      setRecentlyAdded(prev => [vars.scryfall_id, ...prev.slice(0, 9)])
      setShowModal(false)
      setSelectedCard(null)
      setQuery('')
      setDebouncedQuery('')
      inputRef.current?.focus()
    },
  })

  const cards = searchData?.cards || []

  useEffect(() => {
    if (!pendingScan || !cards.length) return
    // Prefer an exact name match, else the first result, then open it pre-filled.
    const match = cards.find((c: any) => (c.name || '').toLowerCase() === pendingScan)
      || cards.find((c: any) => (c.name || '').toLowerCase().includes(pendingScan))
      || cards[0]
    setPendingScan('')
    if (match) { setSelectedCard(match); setShowModal(true) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchData, pendingScan])

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold text-vault-gold">{t('scan.title')}</h1>
        <p className="text-vault-muted text-sm mt-0.5">{t('scan.subtitle')}</p>
      </div>

      {/* Camera scan */}
      <div className="max-w-2xl mx-auto mb-3">
        <button
          onClick={() => setShowCamera(true)}
          className="w-full flex items-center justify-center gap-2 bg-vault-accent/15 border-2 border-vault-accent/40 hover:border-vault-accent text-vault-accent rounded-2xl py-3.5 font-medium transition-all"
        >
          <Camera size={20} /> {t('scan.scanWithCamera')}
        </button>
        <p className="text-center text-[11px] text-vault-muted mt-1.5">{t('scan.orTypeBelow')}</p>
        {scanNote && <p className="text-center text-[11px] text-vault-accent mt-1">{scanNote}</p>}
      </div>

      {/* Search input — big and centered */}
      <div className="max-w-2xl mx-auto mb-8">
        <div className="relative">
          <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-vault-muted" />
          <input
            ref={inputRef}
            className="w-full bg-vault-card border-2 border-vault-border focus:border-vault-accent rounded-2xl px-5 py-4 pl-12 text-lg text-vault-text placeholder-vault-muted focus:outline-none transition-all"
            placeholder={t('scan.placeholder')}
            value={query}
            onChange={e => handleInput(e.target.value)}
          />
          {isLoading && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 border-2 border-vault-accent border-t-transparent rounded-full animate-spin" />
          )}
        </div>

        {/* Autocomplete dropdown */}
        {autocomplete?.suggestions?.length > 0 && query.length >= 2 && cards.length === 0 && (
          <div className="bg-vault-surface border border-vault-border rounded-xl mt-2 overflow-hidden shadow-xl">
            {autocomplete.suggestions.slice(0, 6).map((name: string) => (
              <button
                key={name}
                className="w-full text-left px-4 py-3 text-sm text-vault-text hover:bg-vault-card transition-colors border-b border-vault-border/40 last:border-0"
                onClick={() => { setQuery(name); setDebouncedQuery(name) }}
              >
                {name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Tip */}
      {query.length === 0 && (
        <div className="max-w-2xl mx-auto text-center py-10">
          <div className="text-5xl mb-4">🔍</div>
          <p className="text-vault-muted">
            {t('scan.tip')}<br />
            <span className="text-xs">{t('search.syntaxHint')} <code className="text-vault-accent bg-vault-card px-1 rounded">t:dragon</code>, <code className="text-vault-accent bg-vault-card px-1 rounded">set:lci</code>, etc.</span>
          </p>
        </div>
      )}

      {/* Results */}
      {cards.length > 0 && (
        <div className="max-w-4xl mx-auto">
          <p className="text-xs text-vault-muted mb-3">{t('scan.results', { count: searchData?.total_cards })}</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            <AnimatePresence>
              {cards.map((card: any, i: number) => (
                <motion.div
                  key={card.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="relative"
                >
                  {recentlyAdded.includes(card.id) && (
                    <div className="absolute top-2 left-2 z-10 bg-green-500 text-white rounded-full p-1">
                      <CheckCircle size={14} />
                    </div>
                  )}
                  <div
                    className="group cursor-pointer"
                    onClick={() => { setSelectedCard(card); setShowModal(true) }}
                  >
                    <div className="aspect-[63/88] relative rounded-xl overflow-hidden border border-vault-border group-hover:border-vault-accent/60 transition-all">
                      {card.image_normal ? (
                        <img src={card.image_normal} alt={card.name} className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <div className="w-full h-full bg-vault-card flex items-center justify-center p-3">
                          <p className="text-xs text-center text-vault-text font-medium">{card.name}</p>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-vault-accent/0 group-hover:bg-vault-accent/10 transition-all flex items-center justify-center">
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-vault-accent text-white rounded-full p-2">
                          <Plus size={20} />
                        </div>
                      </div>
                    </div>
                    <div className="mt-1.5 px-0.5">
                      <p className="text-xs font-medium text-vault-text truncate">{card.name}</p>
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] text-vault-muted font-mono">{card.set?.toUpperCase()}</p>
                        {card.price_usd > 0 && (
                          <p className="text-[10px] font-mono font-bold text-green-400">${card.price_usd.toFixed(2)}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Recently added */}
      {recentlyAdded.length > 0 && (
        <div className="max-w-2xl mx-auto mt-8">
          <p className="text-xs text-vault-muted mb-2 flex items-center gap-2">
            <CheckCircle size={12} className="text-green-400" />
            {t('scan.addedSession', { count: recentlyAdded.length })}
          </p>
        </div>
      )}

      {showModal && selectedCard && (
        <AddCardModal
          card={selectedCard}
          onClose={() => { setShowModal(false); setSelectedCard(null) }}
          onConfirm={(data) => addMutation.mutate(data)}
          isLoading={addMutation.isPending}
        />
      )}

      {showCamera && <CameraScanModal onClose={() => setShowCamera(false)} onText={onScanned} serverOcr={flags.scanOCR && isPremium} />}
    </div>
  )
}

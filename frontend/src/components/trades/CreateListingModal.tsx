import { useState, useRef, useEffect } from 'react'
import { X, Search, Upload, Check, Plus } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { cardsApi, listingsApi, collectionApi, bindersApi, decksApi } from '@/lib/api'
import { useUsdBrl } from '@/components/cards/CardPrice'

const CONDITIONS = ['M', 'NM', 'LP', 'MP', 'HP', 'DMG']
type Source = 'collection' | 'binder' | 'deck' | 'search'

function resizePhoto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const max = 420
      const scale = Math.min(1, max / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = img.width * scale; canvas.height = img.height * scale
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/jpeg', 0.75))
    }
    img.onerror = reject
    img.src = URL.createObjectURL(file)
  })
}

export default function CreateListingModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { t } = useTranslation()
  const rate = useUsdBrl()
  const [source, setSource] = useState<Source>('collection')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [binderId, setBinderId] = useState<number | null>(null)
  const [deckId, setDeckId] = useState<number | null>(null)

  const [card, setCard] = useState<any>(null)
  const [condition, setCondition] = useState('NM')
  const [foil, setFoil] = useState(false)
  // Offer mode
  const [forSale, setForSale] = useState(true)
  const [forTrade, setForTrade] = useState(false)
  const [price, setPrice] = useState('')
  const [acceptsOffers, setAcceptsOffers] = useState(true)
  const [wanted, setWanted] = useState('')
  const [wantedCards, setWantedCards] = useState<any[]>([])
  const [tradeQuery, setTradeQuery] = useState('')
  const [tradeResults, setTradeResults] = useState<any[]>([])
  const [photo, setPhoto] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const { data: collection } = useQuery({ queryKey: ['col-pick'], queryFn: () => collectionApi.list({ with_cards: true, per_page: 300 }), enabled: source === 'collection' && !card })
  const { data: binders = [] } = useQuery({ queryKey: ['binders'], queryFn: bindersApi.list, enabled: source === 'binder' && !card })
  const { data: decks = [] } = useQuery({ queryKey: ['decks'], queryFn: decksApi.list, enabled: source === 'deck' && !card })
  const { data: binder } = useQuery({ queryKey: ['binder', binderId], queryFn: () => bindersApi.get(binderId as number), enabled: !!binderId && source === 'binder' && !card })
  const { data: deck } = useQuery({ queryKey: ['deck', deckId], queryFn: () => decksApi.get(deckId as number), enabled: !!deckId && source === 'deck' && !card })

  const pick = (c: any, entry?: any) => {
    setCard(c)
    if (entry) { if (entry.condition) setCondition(entry.condition); if (entry.foil != null) setFoil(entry.foil) }
  }

  const search = async (e: React.FormEvent) => {
    e.preventDefault()
    if (query.length < 2) return
    const d = await cardsApi.search(query)
    setResults(d.cards || [])
  }

  const onPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; e.target.value = ''
    if (!f || f.size > 5 * 1024 * 1024) return
    try { setPhoto(await resizePhoto(f)) } catch {}
  }

  // Debounced card search for the "accept in trade" list.
  useEffect(() => {
    if (!forTrade || tradeQuery.trim().length < 2) { setTradeResults([]); return }
    const id = setTimeout(async () => {
      try { const d = await cardsApi.search(tradeQuery.trim()); setTradeResults((d.cards || []).slice(0, 8)) }
      catch { setTradeResults([]) }
    }, 300)
    return () => clearTimeout(id)
  }, [tradeQuery, forTrade])

  const addWanted = (c: any) => {
    if (wantedCards.some(w => w.id === c.id) || wantedCards.length >= 30) return
    setWantedCards([...wantedCards, { id: c.id, name: c.name, image_small: c.image_small }])
    setTradeQuery(''); setTradeResults([])
  }
  const removeWanted = (id: string) => setWantedCards(wantedCards.filter(w => w.id !== id))

  const canSubmit = !!card && ((forSale && !!price) || (forTrade && (wantedCards.length > 0 || wanted.trim())))

  // Reference market price for the selected card (foil-aware), in USD and ~BRL.
  const marketUsd = (foil ? card?.price_usd_foil : card?.price_usd) || 0
  const marketBrl = rate ? marketUsd * rate : 0
  const marketBrlLabel = marketBrl > 0 ? `R$${marketBrl.toFixed(2).replace('.', ',')}` : ''

  const submit = async () => {
    if (!canSubmit) return
    setBusy(true)
    try {
      await listingsApi.create({
        scryfall_id: card.id, condition, foil,
        price: forSale && price ? parseFloat(price) : null,
        accepts_offers: forSale && acceptsOffers,
        wanted: forTrade ? (wanted || null) : null,
        wanted_cards: forTrade ? wantedCards : null,
        photo: photo || null, notes: notes || null,
      })
      onCreated()
    } catch {}
    setBusy(false)
  }

  // Build the grid of pickable cards for the current source
  let grid: { key: string; card: any; entry?: any }[] = []
  if (source === 'collection') grid = (collection?.items || []).filter((i: any) => i.card).map((i: any) => ({ key: `c${i.id}`, card: i.card, entry: i }))
  else if (source === 'binder' && binder) grid = (binder.cards || []).map((c: any) => ({ key: `b${c.binder_card_id}`, card: c.card, entry: c }))
  else if (source === 'deck' && deck) grid = (deck.cards || []).map((c: any) => ({ key: `d${c.id}`, card: c.card, entry: c }))
  else if (source === 'search') grid = results.map((c: any) => ({ key: c.id, card: c }))

  const TABS: { v: Source; label: string }[] = [
    { v: 'collection', label: t('nav.collection') },
    { v: 'binder', label: t('nav.binders') },
    { v: 'deck', label: t('nav.decks') },
    { v: 'search', label: t('search.button') },
  ]

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
          className="relative z-10 bg-vault-surface border border-vault-border rounded-2xl p-6 w-full max-w-lg max-h-[88vh] overflow-y-auto shadow-2xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-bold text-vault-gold">{t('trades.newListing')}</h3>
            <button onClick={onClose} className="text-vault-muted hover:text-vault-text"><X size={18} /></button>
          </div>

          {!card ? (
            <>
              {/* Source tabs */}
              <div className="flex gap-1 mb-3 flex-wrap">
                {TABS.map(tb => (
                  <button key={tb.v} onClick={() => setSource(tb.v)}
                    className={`px-3 py-1.5 rounded-lg text-xs transition-all ${source === tb.v ? 'bg-vault-accent/20 text-vault-accent border border-vault-accent/30' : 'text-vault-muted hover:text-vault-text border border-transparent'}`}>
                    {tb.label}
                  </button>
                ))}
              </div>

              {source === 'search' && (
                <form onSubmit={search} className="flex gap-2 mb-3">
                  <input className="input-field flex-1" placeholder={t('trades.pickCard')} value={query} onChange={e => setQuery(e.target.value)} />
                  <button className="btn-primary !px-3"><Search size={16} /></button>
                </form>
              )}
              {source === 'binder' && (
                <select className="input-field mb-3" value={binderId ?? ''} onChange={e => setBinderId(e.target.value ? Number(e.target.value) : null)}>
                  <option value="">— {t('nav.binders')} —</option>
                  {binders.map((b: any) => <option key={b.id} value={b.id}>{b.name} ({b.card_count})</option>)}
                </select>
              )}
              {source === 'deck' && (
                <select className="input-field mb-3" value={deckId ?? ''} onChange={e => setDeckId(e.target.value ? Number(e.target.value) : null)}>
                  <option value="">— {t('nav.decks')} —</option>
                  {decks.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              )}

              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-72 overflow-y-auto">
                {grid.map(g => (
                  <button key={g.key} onClick={() => pick(g.card, g.entry)} className="rounded-lg overflow-hidden border border-vault-border hover:border-vault-accent" title={g.card?.name}>
                    {g.card?.image_small ? <img src={g.card.image_small} alt={g.card.name} className="w-full" loading="lazy" /> : <div className="p-2 text-[11px]">{g.card?.name}</div>}
                  </button>
                ))}
              </div>
              {grid.length === 0 && source !== 'search' && (
                <p className="text-xs text-vault-muted text-center py-6">{t('pages.empty')}</p>
              )}
            </>
          ) : (
            <div className="space-y-4">
              <div className="flex gap-3 items-center">
                {card.image_small && <img src={card.image_small} className="w-14 rounded shadow" />}
                <div className="flex-1">
                  <p className="font-medium text-vault-text">{card.name}</p>
                  <p className="text-xs text-vault-muted">{card.set_name}</p>
                  {marketUsd > 0 && (
                    <p className="text-xs text-vault-muted mt-0.5">
                      {t('trades.marketPrice')}:{' '}
                      <span className="font-mono font-bold text-green-400">${marketUsd.toFixed(2)}</span>
                      {marketBrlLabel && <span className="font-mono text-vault-muted/80"> ≈ {marketBrlLabel}</span>}
                    </p>
                  )}
                </div>
                <button onClick={() => setCard(null)} className="text-xs text-vault-accent">↺</button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-vault-muted mb-1 block">{t('modal.condition')}</label>
                  <select className="input-field" value={condition} onChange={e => setCondition(e.target.value)}>
                    {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <label className="flex items-center gap-2 mt-6 text-sm text-vault-text cursor-pointer">
                  <input type="checkbox" checked={foil} onChange={e => setFoil(e.target.checked)} /> {t('modal.foil')}
                </label>
              </div>

              {/* What kind of offer */}
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setForSale(v => !v)}
                  className={`rounded-xl border p-3 text-left transition-all ${forSale ? 'border-green-500/50 bg-green-500/10' : 'border-vault-border'}`}>
                  <span className="text-sm font-medium text-vault-text">💰 {t('trades.forSale')}</span>
                  <p className="text-[11px] text-vault-muted mt-0.5">{t('trades.saleHint')}</p>
                </button>
                <button type="button" onClick={() => setForTrade(v => !v)}
                  className={`rounded-xl border p-3 text-left transition-all ${forTrade ? 'border-vault-gold/50 bg-vault-gold/10' : 'border-vault-border'}`}>
                  <span className="text-sm font-medium text-vault-text">🔄 {t('trades.forTrade')}</span>
                  <p className="text-[11px] text-vault-muted mt-0.5">{t('trades.tradeHint')}</p>
                </button>
              </div>

              {/* Sale details */}
              {forSale && (
                <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-3 space-y-2">
                  <label className="text-xs text-vault-muted block">{t('trades.priceLabel')} (R$)</label>
                  {marketBrl > 0 && (
                    <div className="flex items-center justify-between text-xs gap-2">
                      <span className="text-vault-muted">
                        {t('trades.marketRef')}:{' '}
                        <span className="font-mono font-bold text-green-400">{marketBrlLabel}</span>
                        <span className="font-mono text-vault-muted/70"> (${marketUsd.toFixed(2)})</span>
                      </span>
                      <button type="button" onClick={() => setPrice(marketBrl.toFixed(2))} className="text-vault-accent hover:underline shrink-0">
                        {t('trades.useMarket')}
                      </button>
                    </div>
                  )}
                  <input type="number" step="0.01" min="0" className="input-field" placeholder="0,00" value={price} onChange={e => setPrice(e.target.value)} />
                  <label className="flex items-center gap-2 text-sm text-vault-text cursor-pointer">
                    <input type="checkbox" checked={acceptsOffers} onChange={e => setAcceptsOffers(e.target.checked)} />
                    {t('trades.acceptsOffers')}
                  </label>
                </div>
              )}

              {/* Trade details */}
              {forTrade && (
                <div className="rounded-xl border border-vault-gold/20 bg-vault-gold/5 p-3 space-y-2">
                  <label className="text-xs text-vault-muted block">{t('trades.wantedCardsLabel')}</label>
                  {wantedCards.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {wantedCards.map(w => (
                        <span key={w.id} className="inline-flex items-center gap-1 bg-vault-card border border-vault-border rounded-full pl-1 pr-2 py-0.5 text-xs">
                          {w.image_small && <img src={w.image_small} className="w-4 h-5 rounded object-cover" />}
                          {w.name}
                          <button onClick={() => removeWanted(w.id)} className="text-vault-muted hover:text-red-400"><X size={11} /></button>
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="relative">
                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-vault-muted" />
                    <input className="input-field pl-8 text-sm" placeholder={t('trades.wantedCardsPh')} value={tradeQuery} onChange={e => setTradeQuery(e.target.value)} />
                    {tradeResults.length > 0 && (
                      <div className="absolute z-20 left-0 right-0 mt-1 bg-vault-surface border border-vault-border rounded-lg shadow-xl max-h-56 overflow-y-auto">
                        {tradeResults.map(c => (
                          <button key={c.id} onClick={() => addWanted(c)} className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-vault-card text-left text-sm">
                            {c.image_small && <img src={c.image_small} className="w-5 h-7 rounded object-cover" />}
                            <span className="flex-1 truncate text-vault-text">{c.name}</span>
                            <span className="text-[10px] text-vault-muted">{c.set?.toUpperCase()}</span>
                            <Plus size={13} className="text-vault-accent" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <input className="input-field text-sm" placeholder={t('trades.wantedPh')} value={wanted} onChange={e => setWanted(e.target.value)} />
                </div>
              )}

              <div>
                <label className="text-xs text-vault-muted mb-1 block">{t('trades.photo')}</label>
                <div className="flex items-center gap-3">
                  {photo && <img src={photo} className="w-16 rounded shadow" />}
                  <button onClick={() => fileRef.current?.click()} className="btn-ghost !py-1.5 flex items-center gap-2 text-xs"><Upload size={14} /> {t('account.upload')}</button>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPhoto} />
                </div>
              </div>

              <div>
                <label className="text-xs text-vault-muted mb-1 block">{t('trades.notes')}</label>
                <textarea className="input-field resize-none" rows={2} placeholder={t('trades.notesPh')} value={notes} onChange={e => setNotes(e.target.value)} />
              </div>

              <div className="flex gap-3">
                <button onClick={onClose} className="btn-ghost flex-1">{t('common.cancel')}</button>
                <button onClick={submit} disabled={busy || !canSubmit} className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-50">
                  {busy ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Check size={16} />}
                  {t('trades.create')}
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  )
}

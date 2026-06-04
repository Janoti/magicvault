import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { wishlistApi, cardsApi, collectionApi, decksApi } from '@/lib/api'
import { Trash2, Star, Search, Plus, X, ShoppingCart, Swords, Check } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import CardPrice from '@/components/cards/CardPrice'
import AddToDeckModal from '@/components/collection/AddToDeckModal'

export default function WishlistPage() {
  const qc = useQueryClient()
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [searching, setSearching] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [deckFor, setDeckFor] = useState<any>(null)
  const owned = new Set<string>()

  const flash = (msg: string) => { setToast(msg); window.clearTimeout((flash as any)._t); (flash as any)._t = window.setTimeout(() => setToast(null), 2500) }

  const { data: items = [], isLoading } = useQuery({ queryKey: ['wishlist'], queryFn: wishlistApi.list })
  items.forEach((i: any) => i.card?.id && owned.add(i.card.id))

  const removeMutation = useMutation({
    mutationFn: wishlistApi.remove,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wishlist'] }),
  })

  const addMutation = useMutation({
    mutationFn: (card: any) => wishlistApi.add({ scryfall_id: card.id, quantity: 1 }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['wishlist'] }); flash(t('search.addedWishlist')) },
  })

  // "I bought it" → add to collection and drop from the wishlist.
  const boughtMutation = useMutation({
    mutationFn: async (item: any) => {
      await collectionApi.add({ scryfall_id: item.card.id, quantity: 1, condition: 'NM', foil: false })
      await wishlistApi.remove(item.id)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wishlist'] })
      qc.invalidateQueries({ queryKey: ['collection'] })
      qc.invalidateQueries({ queryKey: ['collection-stats'] })
      flash(t('wl.movedToCollection'))
    },
  })

  const addToDeckMutation = useMutation({
    mutationFn: (vars: { deckId: number; scryfallId: string }) => decksApi.addCard(vars.deckId, { scryfall_id: vars.scryfallId, quantity: 1 }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['decks'] }); setDeckFor(null); flash(t('col.addedToDeck')) },
  })

  const search = async (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim().length < 2) return
    setSearching(true)
    try { const d = await cardsApi.search(query.trim()); setResults((d.cards || []).slice(0, 12)) }
    catch { setResults([]) }
    finally { setSearching(false) }
  }

  const totalValue = items.reduce((sum: number, item: any) => sum + (item.card?.price_usd || 0) * item.quantity, 0)

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-vault-gold">{t('pages.wishlistTitle')}</h1>
          <p className="text-vault-muted text-sm">{t('pages.wishlistSubtitle')}</p>
        </div>
        {items.length > 0 && (
          <div className="surface px-4 py-2 text-right">
            <p className="text-xs text-vault-muted">{t('pages.wlEstValue')}</p>
            <p className="font-mono font-bold text-green-400 text-lg">${totalValue.toFixed(2)}</p>
          </div>
        )}
      </div>

      {/* Inline search to add cards without leaving the page */}
      <div className="surface p-4 mb-6">
        <form onSubmit={search} className="flex gap-2">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-vault-muted" />
            <input className="input-field pl-9" placeholder={t('pages.wlSearchPh')} value={query}
              onChange={e => setQuery(e.target.value)} />
            {query && (
              <button type="button" onClick={() => { setQuery(''); setResults([]) }} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-vault-muted hover:text-vault-text"><X size={14} /></button>
            )}
          </div>
          <button type="submit" className="btn-primary flex items-center gap-2"><Search size={15} /> {t('search.button')}</button>
        </form>
        {searching ? (
          <div className="flex justify-center py-6"><div className="w-6 h-6 border-2 border-vault-accent border-t-transparent rounded-full animate-spin" /></div>
        ) : results.length > 0 && (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 mt-3">
            {results.map((c: any) => (
              <div key={c.id} className="relative group">
                {c.image_small ? <img src={c.image_small} alt={c.name} className="w-full rounded-lg" loading="lazy" /> : <div className="p-2 text-[11px]">{c.name}</div>}
                <button
                  onClick={() => addMutation.mutate(c)}
                  disabled={owned.has(c.id)}
                  className={`absolute inset-x-1 bottom-1 text-[10px] py-1 rounded flex items-center justify-center gap-1 ${owned.has(c.id) ? 'bg-vault-gold/80 text-black' : 'bg-vault-accent text-white opacity-0 group-hover:opacity-100'} transition-opacity`}
                >
                  {owned.has(c.id) ? <><Star size={11} className="fill-black" /> {t('pages.wlInList')}</> : <><Plus size={11} /> {t('pages.wlAdd')}</>}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-vault-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-20">
          <Star size={48} className="mx-auto text-vault-muted mb-4 opacity-50" />
          <p className="text-vault-muted mb-4">{t('pages.wlEmpty')}</p>
          <Link to="/search" className="btn-primary inline-flex items-center gap-2">
            {t('pages.wlSearchAdd')}
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item: any, i: number) => (
            <motion.div key={item.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.04, 0.3) }}>
              <div className="surface p-4 hover:border-vault-gold/30 transition-all flex flex-col gap-3 h-full">
                <div className="flex gap-3">
                  {item.card?.image_small && (
                    <img src={item.card.image_small} alt={item.card.name} className="w-14 rounded-lg shadow-lg flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-vault-text text-sm truncate">{item.card?.name || '...'}</h3>
                    <p className="text-xs text-vault-muted">{item.card?.set?.toUpperCase()} • {item.card?.rarity}</p>
                    <div className="mt-1.5 text-xs">
                      <span className="text-vault-muted">{t('wl.external')}: </span>
                      <CardPrice usd={item.card?.price_usd} purchaseUri={item.card?.purchase_uri} compact />
                    </div>
                  </div>
                </div>

                {/* Our marketplace */}
                {item.market?.count > 0 ? (
                  <Link to={`/trades?q=${encodeURIComponent(item.card?.name || '')}`}
                    className="flex items-center gap-2 text-xs rounded-lg border border-vault-accent/30 bg-vault-accent/10 px-3 py-2 text-vault-accent hover:bg-vault-accent/20">
                    <ShoppingCart size={13} />
                    {t('wl.inMarket', { count: item.market.count, price: `R$${item.market.min_price.toFixed(2).replace('.', ',')}` })}
                  </Link>
                ) : (
                  <Link to={`/trades?q=${encodeURIComponent(item.card?.name || '')}`}
                    className="flex items-center gap-2 text-xs text-vault-muted hover:text-vault-accent px-3 py-1">
                    <ShoppingCart size={13} /> {t('wl.searchMarket')}
                  </Link>
                )}

                {item.notes && <p className="text-xs text-vault-muted italic">{item.notes}</p>}

                {/* Actions */}
                <div className="mt-auto flex gap-1.5">
                  <button onClick={() => boughtMutation.mutate(item)}
                    className="flex-1 text-[11px] py-1.5 rounded border border-green-500/30 text-green-400 hover:bg-green-500/10 flex items-center justify-center gap-1">
                    <Check size={12} /> {t('wl.bought')}
                  </button>
                  <button onClick={() => setDeckFor(item)}
                    className="flex-1 text-[11px] py-1.5 rounded border border-vault-border text-vault-muted hover:text-vault-accent hover:border-vault-accent/30 flex items-center justify-center gap-1">
                    <Swords size={12} /> {t('wl.toDeck')}
                  </button>
                  <button onClick={() => removeMutation.mutate(item.id)}
                    className="px-2 rounded border border-vault-border text-vault-muted hover:text-red-400">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: -30, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -30 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] bg-vault-gold text-black px-6 py-3 rounded-xl shadow-2xl flex items-center gap-2 font-semibold text-sm">
            <Check size={18} /> {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {deckFor && (
        <AddToDeckModal
          entry={{ id: deckFor.id, scryfall_id: deckFor.card?.id }}
          card={deckFor.card}
          onClose={() => setDeckFor(null)}
          onConfirm={(deckId) => addToDeckMutation.mutate({ deckId, scryfallId: deckFor.card?.id })}
          isLoading={addToDeckMutation.isPending}
        />
      )}
    </div>
  )
}

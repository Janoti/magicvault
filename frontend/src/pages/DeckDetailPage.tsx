import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { decksApi, cardsApi } from '@/lib/api'
import { ArrowLeft, Plus, Trash2, Search, Crown, Shield, Share2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import CardTile from '@/components/cards/CardTile'
import ShareModal from '@/components/sharing/ShareModal'

export default function DeckDetailPage() {
  const { id } = useParams<{ id: string }>()
  const deckId = Number(id)
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [searching, setSearching] = useState(false)
  const [view, setView] = useState<'grid' | 'list'>('list')
  const [showShare, setShowShare] = useState(false)
  const qc = useQueryClient()

  const { data: deck, isLoading } = useQuery({
    queryKey: ['deck', deckId],
    queryFn: () => decksApi.get(deckId),
  })

  const addCardMutation = useMutation({
    mutationFn: (data: any) => decksApi.addCard(deckId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deck', deckId] }),
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

  if (isLoading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-2 border-vault-accent border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="p-6">
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
        <button onClick={() => setShowShare(true)} className="btn-ghost flex items-center gap-2">
          <Share2 size={16} /> Compartilhar
        </button>
        <button onClick={() => setShowSearch(true)} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Adicionar Carta
        </button>
      </div>

      {showShare && (
        <ShareModal resourceType="deck" resourceId={deckId} resourcelabel={deck?.name} onClose={() => setShowShare(false)} />
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="surface p-4 text-center">
          <p className="text-2xl font-display font-bold text-vault-accent">{totalCards}</p>
          <p className="text-xs text-vault-muted">Cartas (main)</p>
        </div>
        <div className="surface p-4 text-center">
          <p className="text-2xl font-display font-bold text-green-400">${totalValue.toFixed(2)}</p>
          <p className="text-xs text-vault-muted">Valor total</p>
        </div>
        <div className="surface p-4 text-center">
          <p className="text-2xl font-display font-bold text-vault-muted">{sideboard.length}</p>
          <p className="text-xs text-vault-muted">Sideboard</p>
        </div>
      </div>

      {deck?.cards?.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-4xl mb-4">⚔️</p>
          <p className="text-vault-muted mb-4">Deck vazio — adicione cartas para começar</p>
          <button onClick={() => setShowSearch(true)} className="btn-primary inline-flex items-center gap-2">
            <Plus size={16} /> Adicionar Cartas
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Commander section */}
          {commanders.length > 0 && (
            <section>
              <h2 className="flex items-center gap-2 text-sm font-semibold text-vault-gold mb-3">
                <Crown size={14} /> Commander ({commanders.length})
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                {commanders.map((c: any) => <CardTile key={c.id} card={c.card} showActions={false} />)}
              </div>
            </section>
          )}

          {/* Mainboard */}
          {mainboard.length > 0 && (
            <section>
              <h2 className="flex items-center gap-2 text-sm font-semibold text-vault-text mb-3">
                Main Deck ({totalCards} cartas)
              </h2>
              <div className="surface overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-vault-border bg-vault-surface">
                      <th className="text-left px-4 py-2.5 text-xs text-vault-muted">Carta</th>
                      <th className="text-center px-4 py-2.5 text-xs text-vault-muted w-16">Qtd</th>
                      <th className="text-left px-4 py-2.5 text-xs text-vault-muted">Tipo</th>
                      <th className="text-right px-4 py-2.5 text-xs text-vault-muted w-20">Preço</th>
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
                        <td className="px-4 py-2.5 text-xs text-vault-muted truncate max-w-[200px]">
                          {entry.card?.type_line}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-xs text-green-400">
                          {entry.card?.price_usd > 0 ? `$${(entry.card.price_usd * entry.quantity).toFixed(2)}` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Sideboard */}
          {sideboard.length > 0 && (
            <section>
              <h2 className="flex items-center gap-2 text-sm font-semibold text-vault-muted mb-3">
                <Shield size={14} /> Sideboard ({sideboard.reduce((s: number, c: any) => s + c.quantity, 0)} cartas)
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
                        <td className="px-4 py-2.5 text-right font-mono text-xs text-green-400">
                          {entry.card?.price_usd > 0 ? `$${entry.card.price_usd.toFixed(2)}` : '—'}
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
                <h2 className="font-display text-xl font-bold text-vault-gold">Adicionar ao Deck</h2>
                <button onClick={() => setShowSearch(false)} className="text-vault-muted hover:text-vault-text">✕</button>
              </div>

              <form onSubmit={handleSearch} className="flex gap-2 mb-4">
                <input className="input-field flex-1" placeholder="Buscar carta..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                <button type="submit" className="btn-primary flex items-center gap-2">
                  <Search size={14} /> Buscar
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

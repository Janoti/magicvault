import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { cardsApi, collectionApi, wishlistApi } from '@/lib/api'
import CardTile from '@/components/cards/CardTile'
import AddCardModal from '@/components/collection/AddCardModal'
import { Search, Filter, ChevronLeft, ChevronRight } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { debounce } from '@/lib/utils'

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [page, setPage] = useState(1)
  const [selectedCard, setSelectedCard] = useState<any>(null)
  const [showModal, setShowModal] = useState(false)
  const qc = useQueryClient()

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

  const addMutation = useMutation({
    mutationFn: (data: any) => collectionApi.add(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['collection'] })
      qc.invalidateQueries({ queryKey: ['collection-stats'] })
      setShowModal(false)
    },
  })

  const wishlistMutation = useMutation({
    mutationFn: (card: any) => wishlistApi.add({ scryfall_id: card.id, quantity: 1 }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wishlist'] }),
  })

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setQuery(searchInput)
    setPage(1)
  }

  const handleAdd = (card: any) => {
    setSelectedCard(card)
    setShowModal(true)
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold text-vault-gold mb-1">Buscar Cartas</h1>
        <p className="text-vault-muted text-sm">Use sintaxe Scryfall: e.g. <code className="text-vault-accent bg-vault-card px-1 rounded">t:creature c:blue</code></p>
      </div>

      {/* Search form */}
      <form onSubmit={handleSearch} className="mb-6">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-vault-muted" />
            <input
              className="input-field pl-10"
              placeholder="Buscar cartas... (ex: Lightning Bolt, t:dragon, set:lci)"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          <button type="submit" className="btn-primary px-6">
            Buscar
          </button>
        </div>

        {/* Autocomplete suggestions */}
        {suggestions?.suggestions?.length > 0 && searchInput && !query && (
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
              {data.total_cards} cartas encontradas
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
                <ChevronLeft size={16} /> Anterior
              </button>
              <span className="text-vault-muted text-sm">Página {page}</span>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={!data.has_more}
                className="btn-ghost flex items-center gap-2 disabled:opacity-40"
              >
                Próxima <ChevronRight size={16} />
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
    </div>
  )
}

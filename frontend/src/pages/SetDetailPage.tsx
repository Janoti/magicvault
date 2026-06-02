import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { setsApi, collectionApi } from '@/lib/api'
import CardTile from '@/components/cards/CardTile'
import AddCardModal from '@/components/collection/AddCardModal'
import { ArrowLeft, Layers, ExternalLink, Search } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export default function SetDetailPage() {
  const { code = '' } = useParams()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [selectedCard, setSelectedCard] = useState<any>(null)
  const [showModal, setShowModal] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)

  const { data: cards = [], isLoading } = useQuery({
    queryKey: ['set-cards', code],
    queryFn: () => setsApi.cards(code),
    enabled: !!code,
  })

  const addMutation = useMutation({
    mutationFn: (data: any) => collectionApi.add(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['collection'] })
      qc.invalidateQueries({ queryKey: ['collection-stats'] })
      setShowModal(false)
    },
  })

  const addAllMutation = useMutation({
    mutationFn: () => setsApi.addAll(code),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['collection'] })
      qc.invalidateQueries({ queryKey: ['collection-stats'] })
      setFeedback(`Set adicionado: ${res.added} novas, ${res.updated} incrementadas (${res.total} cartas).`)
    },
    onError: () => setFeedback('Erro ao adicionar o set inteiro.'),
  })

  const handleAddAll = () => {
    if (window.confirm(`Adicionar todas as ${cards.length} cartas de ${code.toUpperCase()} à coleção (qtd 1, NM, não-foil)?`)) {
      addAllMutation.mutate()
    }
  }

  const filtered = search
    ? cards.filter((c: any) => c.name.toLowerCase().includes(search.toLowerCase()))
    : cards

  return (
    <div className="p-6">
      <Link to="/sets" className="inline-flex items-center gap-2 text-sm text-vault-muted hover:text-vault-text mb-4">
        <ArrowLeft size={16} /> Voltar aos sets
      </Link>

      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-vault-gold flex items-center gap-3">
            <Layers size={26} /> {code.toUpperCase()}
          </h1>
          <p className="text-vault-muted text-sm mt-0.5">{cards.length} cartas no set</p>
        </div>
        <div className="flex items-center gap-3">
          <a
            href={`https://scryfall.com/sets/${code}`}
            target="_blank"
            rel="noreferrer"
            className="btn-ghost flex items-center gap-2"
          >
            <ExternalLink size={16} /> Scryfall
          </a>
          <button
            onClick={handleAddAll}
            disabled={addAllMutation.isPending || cards.length === 0}
            className="btn-primary flex items-center gap-2 disabled:opacity-40"
          >
            {addAllMutation.isPending ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : <Layers size={16} />}
            Adicionar set inteiro
          </button>
        </div>
      </div>

      {feedback && (
        <div className="surface p-3 mb-4 text-sm text-vault-text border-vault-accent/40">{feedback}</div>
      )}

      <div className="relative max-w-sm mb-6">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-vault-muted" />
        <input
          className="input-field pl-9"
          placeholder="Filtrar cartas do set..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-vault-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          <AnimatePresence>
            {filtered.map((card: any, i: number) => (
              <motion.div
                key={card.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.01, 0.3) }}
              >
                <CardTile
                  card={card}
                  onAdd={(c) => { setSelectedCard(c); setShowModal(true) }}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

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

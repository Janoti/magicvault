import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { bindersApi, collectionApi } from '@/lib/api'
import { ArrowLeft, Plus, Trash2, GripVertical, Share2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import CardTile from '@/components/cards/CardTile'
import ShareModal from '@/components/sharing/ShareModal'
import { useTranslation } from 'react-i18next'

export default function BinderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const binderId = Number(id)
  const [showAddCard, setShowAddCard] = useState(false)
  const [showShare, setShowShare] = useState(false)
  const { t } = useTranslation()
  const qc = useQueryClient()

  const { data: binder, isLoading } = useQuery({
    queryKey: ['binder', binderId],
    queryFn: () => bindersApi.get(binderId),
  })

  const { data: collection } = useQuery({
    queryKey: ['collection-all-with-cards'],
    queryFn: () => collectionApi.list({ per_page: 200, with_cards: true }),
    enabled: showAddCard,
  })

  const addCardMutation = useMutation({
    mutationFn: (entryId: number) => bindersApi.addCard(binderId, { collection_entry_id: entryId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['binder', binderId] })
      setShowAddCard(false)
    },
  })

  const removeCardMutation = useMutation({
    mutationFn: (binderCardId: number) => bindersApi.removeCard(binderId, binderCardId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['binder', binderId] }),
  })

  const locationMutation = useMutation({
    mutationFn: (v: { cardId: number; page?: number; slot?: number }) => bindersApi.setLocation(binderId, v.cardId, { page: v.page, slot: v.slot }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['binder', binderId] }),
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-vault-accent border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link to="/binders" className="btn-ghost !p-2">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
              style={{ backgroundColor: binder?.color + '20', border: `1px solid ${binder?.color}40` }}
            >
              📚
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold text-vault-gold">{binder?.name}</h1>
              {binder?.description && (
                <p className="text-sm text-vault-muted">{binder.description}</p>
              )}
            </div>
          </div>
        </div>
        <button onClick={() => setShowShare(true)} className="btn-ghost flex items-center gap-2">
          <Share2 size={16} /> {t('common.share')}
        </button>
        <button onClick={() => setShowAddCard(true)} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> {t('detail.addCard')}
        </button>
      </div>

      {showShare && (
        <ShareModal resourceType="binder" resourceId={binderId} resourcelabel={binder?.name} onClose={() => setShowShare(false)} />
      )}

      {/* Stats bar */}
      <div className="surface p-4 mb-6 flex gap-6">
        <div>
          <p className="text-2xl font-display font-bold text-vault-accent">{binder?.cards?.length || 0}</p>
          <p className="text-xs text-vault-muted">{t('detail.cardsInBinder')}</p>
        </div>
        <div>
          <p className="text-2xl font-display font-bold text-green-400">
            ${binder?.cards?.reduce((sum: number, c: any) => sum + (c.card?.price_usd || 0) * c.quantity, 0).toFixed(2) || '0.00'}
          </p>
          <p className="text-xs text-vault-muted">{t('detail.totalValue')}</p>
        </div>
      </div>

      {/* Cards grid */}
      {binder?.cards?.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-4xl mb-4">📖</p>
          <p className="text-vault-muted mb-4">{t('detail.emptyBinder')}</p>
          <button onClick={() => setShowAddCard(true)} className="btn-primary inline-flex items-center gap-2">
            <Plus size={16} /> {t('detail.addCards')}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {binder?.cards?.map((entry: any) => (
            <div key={entry.binder_card_id} className="group">
              <div className="relative">
                <CardTile card={entry.card} showActions={false} />
                <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => removeCardMutation.mutate(entry.binder_card_id)}
                    className="p-1 rounded-lg bg-red-500/80 text-white hover:bg-red-600 transition-colors"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
                <div className="absolute top-1 left-1">
                  <span className="text-[10px] bg-black/60 text-white px-1.5 py-0.5 rounded font-mono">
                    {entry.condition}{entry.foil ? ' ⚡' : ''}
                  </span>
                </div>
              </div>
              {/* Physical location: page / pocket */}
              <div className="flex items-center justify-center gap-1.5 mt-1.5 text-[10px] text-vault-muted">
                <span>{t('binder.page')}</span>
                <input type="number" min="0" defaultValue={entry.page || ''} placeholder="—"
                  className="w-9 bg-vault-card border border-vault-border rounded px-1 py-0.5 text-center text-vault-text"
                  onBlur={(e) => { const v = parseInt(e.target.value) || 0; if (v !== (entry.page || 0)) locationMutation.mutate({ cardId: entry.binder_card_id, page: v }) }} />
                <span>{t('binder.slot')}</span>
                <input type="number" min="0" max="9" defaultValue={entry.slot || ''} placeholder="—"
                  className="w-9 bg-vault-card border border-vault-border rounded px-1 py-0.5 text-center text-vault-text"
                  onBlur={(e) => { const v = parseInt(e.target.value) || 0; if (v !== (entry.slot || 0)) locationMutation.mutate({ cardId: entry.binder_card_id, slot: v }) }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add from collection modal */}
      <AnimatePresence>
        {showAddCard && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setShowAddCard(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              className="relative z-10 bg-vault-surface border border-vault-border rounded-2xl p-6 w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display text-xl font-bold text-vault-gold">{t('detail.addFromCollection')}</h2>
                <button onClick={() => setShowAddCard(false)} className="text-vault-muted hover:text-vault-text">✕</button>
              </div>

              <div className="flex-1 overflow-y-auto">
                {collection?.items?.length === 0 ? (
                  <p className="text-vault-muted text-center py-8">{t('detail.emptyCollection')}</p>
                ) : (
                  <div className="space-y-2">
                    {collection?.items?.map((entry: any) => (
                      <button
                        key={entry.id}
                        onClick={() => addCardMutation.mutate(entry.id)}
                        disabled={addCardMutation.isPending}
                        className="w-full flex items-center gap-3 p-3 rounded-xl border border-vault-border hover:border-vault-accent/50 hover:bg-vault-card text-left transition-all"
                      >
                        <div className="w-8 h-11 bg-vault-card rounded flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-vault-text truncate">
                            {entry.scryfall_id.slice(0, 8)}...
                          </p>
                          <p className="text-xs text-vault-muted">
                            ×{entry.quantity} • {entry.condition}{entry.foil ? ' ⚡' : ''}
                          </p>
                        </div>
                        <Plus size={16} className="text-vault-accent flex-shrink-0" />
                      </button>
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

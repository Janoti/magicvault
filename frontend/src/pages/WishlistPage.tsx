import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { wishlistApi } from '@/lib/api'
import { Trash2, Star, ExternalLink } from 'lucide-react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'

export default function WishlistPage() {
  const qc = useQueryClient()

  const { data: items = [], isLoading } = useQuery({ queryKey: ['wishlist'], queryFn: wishlistApi.list })

  const removeMutation = useMutation({
    mutationFn: wishlistApi.remove,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wishlist'] }),
  })

  const totalValue = items.reduce((sum: number, item: any) => sum + (item.card?.price_usd || 0) * item.quantity, 0)

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-vault-gold">Wishlist</h1>
          <p className="text-vault-muted text-sm">Cartas que você quer adquirir</p>
        </div>
        {items.length > 0 && (
          <div className="surface px-4 py-2 text-right">
            <p className="text-xs text-vault-muted">Valor estimado</p>
            <p className="font-mono font-bold text-green-400 text-lg">${totalValue.toFixed(2)}</p>
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
          <p className="text-vault-muted mb-4">Sua wishlist está vazia</p>
          <Link to="/search" className="btn-primary inline-flex items-center gap-2">
            Buscar cartas para adicionar
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item: any, i: number) => (
            <motion.div key={item.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <div className="surface p-4 hover:border-vault-gold/30 transition-all group flex gap-4">
                {item.card?.image_small && (
                  <img src={item.card.image_small} alt={item.card.name} className="w-14 rounded-lg shadow-lg flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-medium text-vault-text text-sm truncate">{item.card?.name || 'Loading...'}</h3>
                    <button onClick={() => removeMutation.mutate(item.id)} className="flex-shrink-0 opacity-0 group-hover:opacity-100 text-vault-muted hover:text-red-400 transition-all p-1 rounded hover:bg-red-400/10">
                      <Trash2 size={13} />
                    </button>
                  </div>
                  <p className="text-xs text-vault-muted">{item.card?.set?.toUpperCase()} • {item.card?.rarity}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-vault-muted">×{item.quantity}</span>
                    {item.card?.price_usd > 0 && (
                      <span className="text-sm font-mono font-bold text-green-400">${item.card.price_usd.toFixed(2)}</span>
                    )}
                  </div>
                  {item.max_price && (
                    <p className="text-xs text-vault-gold mt-1">Máx: ${item.max_price}</p>
                  )}
                  {item.notes && <p className="text-xs text-vault-muted mt-1 italic">{item.notes}</p>}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}

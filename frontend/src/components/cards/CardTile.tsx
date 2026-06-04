import { useState } from 'react'
import { Plus, Star, Eye } from 'lucide-react'
import { motion } from 'framer-motion'
import CardPrice from './CardPrice'

interface CardTileProps {
  card: {
    id: string
    name: string
    set: string
    set_name?: string
    rarity: string
    mana_cost?: string
    type_line?: string
    image_normal?: string
    image_small?: string
    price_usd?: number
    price_usd_foil?: number
    purchase_uri?: string
    colors?: string[]
    collector_number?: string
  }
  onAdd?: (card: any) => void
  onWishlist?: (card: any) => void
  onClick?: (card: any) => void
  showActions?: boolean
  compact?: boolean
}

const rarityColors: Record<string, string> = {
  common: 'bg-gray-700 text-gray-300',
  uncommon: 'bg-slate-600 text-slate-200',
  rare: 'bg-yellow-900/80 text-yellow-300',
  mythic: 'bg-orange-900/80 text-orange-300',
  special: 'bg-purple-900/80 text-purple-300',
}

const colorMap: Record<string, string> = {
  W: '☀️', U: '💧', B: '💀', R: '🔥', G: '🌲',
}

export default function CardTile({ card, onAdd, onWishlist, onClick, showActions = true, compact = false }: CardTileProps) {
  const [hovered, setHovered] = useState(false)
  const [imgError, setImgError] = useState(false)

  const rarityClass = rarityColors[card.rarity] || rarityColors.common

  return (
    <motion.div
      className="relative bg-vault-card border border-vault-border rounded-xl overflow-hidden group cursor-pointer"
      whileHover={{ scale: 1.03, y: -4 }}
      transition={{ duration: 0.2 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onClick?.(card)}
    >
      {/* Card image */}
      <div className="aspect-[63/88] bg-vault-surface relative overflow-hidden">
        {card.image_normal && !imgError ? (
          <img
            src={compact ? card.image_small || card.image_normal : card.image_normal}
            alt={card.name}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-4 bg-vault-surface">
            <div className="flex gap-1 text-xl mb-2">
              {card.colors?.map(c => colorMap[c] || '◆').join('') || '◆'}
            </div>
            <p className="text-xs text-vault-text font-medium text-center leading-tight">{card.name}</p>
            <p className="text-xs text-vault-muted text-center mt-1">{card.set?.toUpperCase()}</p>
          </div>
        )}

        {/* Hover overlay */}
        {showActions && hovered && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center gap-2 p-3"
          >
            {onAdd && (
              <button
                onClick={(e) => { e.stopPropagation(); onAdd(card) }}
                className="flex items-center gap-2 bg-vault-accent hover:bg-vault-accent-hover text-white text-xs font-medium px-3 py-2 rounded-lg w-full justify-center transition-all"
              >
                <Plus size={14} />
                Adicionar
              </button>
            )}
            {onWishlist && (
              <button
                onClick={(e) => { e.stopPropagation(); onWishlist(card) }}
                className="flex items-center gap-2 border border-vault-gold/50 text-vault-gold text-xs font-medium px-3 py-2 rounded-lg w-full justify-center hover:bg-vault-gold/10 transition-all"
              >
                <Star size={14} />
                Wishlist
              </button>
            )}
          </motion.div>
        )}
      </div>

      {/* Card info */}
      <div className="p-2">
        <p className="text-xs font-medium text-vault-text truncate leading-tight">{card.name}</p>
        <div className="flex items-center justify-between mt-1">
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${rarityClass}`}>
            {card.set?.toUpperCase()} #{card.collector_number}
          </span>
          {(card.price_usd ?? 0) > 0 && (
            <span className="text-[11px]">
              <CardPrice usd={card.price_usd} purchaseUri={card.purchase_uri} compact />
            </span>
          )}
        </div>
      </div>
    </motion.div>
  )
}

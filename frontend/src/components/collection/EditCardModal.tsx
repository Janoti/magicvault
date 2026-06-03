import { useState } from 'react'
import { X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'

interface EditCardModalProps {
  entry: any
  card?: any
  onClose: () => void
  onConfirm: (data: any) => void
  isLoading?: boolean
}

const conditions = [
  { value: 'M', label: 'Mint (M)' },
  { value: 'NM', label: 'Near Mint (NM)' },
  { value: 'LP', label: 'Lightly Played (LP)' },
  { value: 'MP', label: 'Moderately Played (MP)' },
  { value: 'HP', label: 'Heavily Played (HP)' },
  { value: 'DMG', label: 'Damaged (DMG)' },
]

export default function EditCardModal({ entry, card, onClose, onConfirm, isLoading }: EditCardModalProps) {
  const { t } = useTranslation()
  const [quantity, setQuantity] = useState<number>(entry.quantity ?? 1)
  const [condition, setCondition] = useState<string>(entry.condition ?? 'NM')
  const [foil, setFoil] = useState<boolean>(!!entry.foil)
  const [notes, setNotes] = useState<string>(entry.notes ?? '')

  const handleSubmit = () => {
    onConfirm({ quantity, condition, foil, notes: notes || null })
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          onClick={onClose}
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative z-10 bg-vault-surface border border-vault-border rounded-2xl p-6 w-full max-w-md shadow-2xl"
        >
          <div className="flex items-start justify-between mb-4">
            <div className="flex gap-3">
              {card?.image_small && (
                <img src={card.image_small} alt={card.name} className="w-14 rounded-lg shadow-lg" />
              )}
              <div>
                <h3 className="font-display font-bold text-vault-gold">{card?.name || t('modal.editCard')}</h3>
                {card && (
                  <p className="text-xs text-vault-muted">{card.set?.toUpperCase()} • #{card.collector_number}</p>
                )}
              </div>
            </div>
            <button onClick={onClose} className="text-vault-muted hover:text-vault-text transition-colors">
              <X size={18} />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs text-vault-muted mb-1.5 block font-medium">{t('modal.quantity')}</label>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setQuantity(q => Math.max(1, q - 1))}
                  className="w-8 h-8 rounded-lg bg-vault-card border border-vault-border text-vault-text hover:border-vault-accent transition-colors"
                >
                  -
                </button>
                <span className="text-vault-text font-mono font-bold text-lg w-8 text-center">{quantity}</span>
                <button
                  onClick={() => setQuantity(q => q + 1)}
                  className="w-8 h-8 rounded-lg bg-vault-card border border-vault-border text-vault-text hover:border-vault-accent transition-colors"
                >
                  +
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs text-vault-muted mb-1.5 block font-medium">{t('modal.condition')}</label>
              <select
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
                className="input-field"
              >
                {conditions.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-vault-muted mb-1.5 block font-medium">{t('modal.notes')}</label>
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t('modal.optional')}
                className="input-field"
              />
            </div>

            <div className="flex items-center gap-3">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={foil}
                  onChange={(e) => setFoil(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-10 h-5 bg-vault-card border border-vault-border rounded-full peer peer-checked:bg-vault-accent peer-checked:border-vault-accent transition-all after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-5" />
              </label>
              <span className="text-sm text-vault-text">{t('modal.foil')}</span>
            </div>

            <p className="text-[11px] text-vault-muted">{t('modal.mergeHint')}</p>
          </div>

          <div className="flex gap-3 mt-6">
            <button onClick={onClose} className="btn-ghost flex-1">{t('common.cancel')}</button>
            <button
              onClick={handleSubmit}
              disabled={isLoading}
              className="btn-primary flex-1 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : t('common.save')}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}

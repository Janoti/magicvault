import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { X, BookMarked, Check } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { bindersApi } from '@/lib/api'

interface AddToBinderModalProps {
  entry: any
  card?: any
  onClose: () => void
  onConfirm: (binderId: number) => void
  isLoading?: boolean
}

export default function AddToBinderModal({ entry, card, onClose, onConfirm, isLoading }: AddToBinderModalProps) {
  const { t } = useTranslation()
  const [selected, setSelected] = useState<number | null>(null)

  const { data: binders = [], isLoading: loadingBinders } = useQuery({
    queryKey: ['binders'],
    queryFn: bindersApi.list,
  })

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
            <div>
              <h3 className="font-display font-bold text-vault-gold">{t('modal.addToBinder')}</h3>
              <p className="text-xs text-vault-muted">{card?.name || `Entrada #${entry.id}`}</p>
            </div>
            <button onClick={onClose} className="text-vault-muted hover:text-vault-text transition-colors">
              <X size={18} />
            </button>
          </div>

          {loadingBinders ? (
            <div className="flex items-center justify-center py-10">
              <div className="w-6 h-6 border-2 border-vault-accent border-t-transparent rounded-full animate-spin" />
            </div>
          ) : binders.length === 0 ? (
            <p className="text-center text-vault-muted text-sm py-8">{t('modal.noBinders')}</p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {binders.map((b: any) => (
                <button
                  key={b.id}
                  onClick={() => setSelected(b.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left ${
                    selected === b.id
                      ? 'border-vault-accent bg-vault-accent/10'
                      : 'border-vault-border bg-vault-card hover:border-vault-accent/40'
                  }`}
                >
                  <span
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: b.color || '#6366f1' }}
                  >
                    <BookMarked size={16} className="text-white" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-vault-text truncate">{b.name}</p>
                    <p className="text-xs text-vault-muted">{t('common.cardsCount', { count: b.card_count })}</p>
                  </div>
                  {selected === b.id && <Check size={16} className="text-vault-accent shrink-0" />}
                </button>
              ))}
            </div>
          )}

          <div className="flex gap-3 mt-6">
            <button onClick={onClose} className="btn-ghost flex-1">{t('common.cancel')}</button>
            <button
              onClick={() => selected != null && onConfirm(selected)}
              disabled={isLoading || selected == null || binders.length === 0}
              className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-40"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : t('common.add')}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}

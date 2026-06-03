import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { X, Swords, Check } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { decksApi } from '@/lib/api'

interface Props {
  entry: any
  card?: any
  onClose: () => void
  onConfirm: (deckId: number) => void
  isLoading?: boolean
}

export default function AddToDeckModal({ entry, card, onClose, onConfirm, isLoading }: Props) {
  const { t } = useTranslation()
  const [selected, setSelected] = useState<number | null>(null)

  const { data: decks = [], isLoading: loadingDecks } = useQuery({ queryKey: ['decks'], queryFn: decksApi.list })

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
        <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative z-10 bg-vault-surface border border-vault-border rounded-2xl p-6 w-full max-w-md shadow-2xl">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="font-display font-bold text-vault-gold">{t('modal.addToDeck')}</h3>
              <p className="text-xs text-vault-muted">{card?.name || `#${entry.id}`}</p>
            </div>
            <button onClick={onClose} className="text-vault-muted hover:text-vault-text transition-colors"><X size={18} /></button>
          </div>

          {loadingDecks ? (
            <div className="flex items-center justify-center py-10">
              <div className="w-6 h-6 border-2 border-vault-accent border-t-transparent rounded-full animate-spin" />
            </div>
          ) : decks.length === 0 ? (
            <p className="text-center text-vault-muted text-sm py-8">{t('modal.noDecks')}</p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {decks.map((d: any) => (
                <button key={d.id} onClick={() => setSelected(d.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left ${
                    selected === d.id ? 'border-vault-accent bg-vault-accent/10' : 'border-vault-border bg-vault-card hover:border-vault-accent/40'
                  }`}>
                  <span className="w-8 h-8 rounded-lg bg-vault-accent/20 flex items-center justify-center shrink-0">
                    <Swords size={16} className="text-vault-accent" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-vault-text truncate">{d.name}</p>
                    <p className="text-xs text-vault-muted">{d.format} · {t('common.cardsCount', { count: d.card_count })}</p>
                  </div>
                  {selected === d.id && <Check size={16} className="text-vault-accent shrink-0" />}
                </button>
              ))}
            </div>
          )}

          <div className="flex gap-3 mt-6">
            <button onClick={onClose} className="btn-ghost flex-1">{t('common.cancel')}</button>
            <button onClick={() => selected != null && onConfirm(selected)}
              disabled={isLoading || selected == null || decks.length === 0}
              className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-40">
              {isLoading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : t('common.add')}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}

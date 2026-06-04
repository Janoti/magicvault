import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { cardsApi } from '@/lib/api'

interface Props {
  open: boolean
  title: string
  message: string
  confirmLabel: string
  danger?: boolean
  onConfirm: () => void
  onClose: () => void
}

// Themed confirmation dialog (replaces window.confirm) with a faded "sad card"
// art background — a bit of personality for destructive actions.
export default function ConfirmModal({ open, title, message, confirmLabel, danger, onConfirm, onClose }: Props) {
  const { t } = useTranslation()
  const { data: art } = useQuery({
    queryKey: ['sad-card-art'],
    queryFn: () => cardsApi.search('!"Grief"').then((d: any) => d.cards?.[0]?.art_crop || null).catch(() => null),
    staleTime: Infinity,
  })

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
            className="relative z-10 w-full max-w-md rounded-2xl border border-vault-border bg-vault-surface shadow-2xl overflow-hidden"
          >
            {art && (
              <div className="absolute inset-0 bg-cover bg-center opacity-[0.14] pointer-events-none"
                style={{ backgroundImage: `url(${art})` }} />
            )}
            <div className="absolute inset-0 bg-gradient-to-b from-vault-surface/55 via-vault-surface/80 to-vault-surface pointer-events-none" />
            <div className="relative p-6">
              <h3 className="font-display text-xl font-bold text-vault-gold mb-2">{title}</h3>
              <p className="text-sm text-vault-text/90 leading-relaxed mb-6">{message}</p>
              <div className="flex gap-2 justify-end">
                <button onClick={onClose} className="btn-ghost">{t('common.cancel')}</button>
                <button
                  onClick={onConfirm}
                  className={`px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors ${
                    danger ? 'bg-red-500 hover:bg-red-600' : 'bg-vault-accent hover:bg-vault-accent-hover'
                  }`}
                >
                  {confirmLabel}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

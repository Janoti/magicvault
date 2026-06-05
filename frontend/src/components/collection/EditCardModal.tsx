import { useState } from 'react'
import { createPortal } from 'react-dom'
import { X, ChevronDown, Check } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { cardsApi } from '@/lib/api'
import { useFlags } from '@/lib/flags'

const rarityDot: Record<string, string> = {
  common: 'bg-vault-muted', uncommon: 'bg-slate-300', rare: 'bg-vault-gold',
  mythic: 'bg-orange-500', special: 'bg-purple-400', bonus: 'bg-pink-400',
}

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
  const flags = useFlags()
  const [quantity, setQuantity] = useState<number>(entry.quantity ?? 1)
  const [condition, setCondition] = useState<string>(entry.condition ?? 'NM')
  const [foil, setFoil] = useState<boolean>(!!entry.foil)
  const [notes, setNotes] = useState<string>(entry.notes ?? '')
  const [selected, setSelected] = useState<any>(card || { id: entry.scryfall_id })
  const [editionOpen, setEditionOpen] = useState(false)
  const [acquiredPrice, setAcquiredPrice] = useState<string>(entry.acquired_price != null ? String(entry.acquired_price) : '')
  const [acquiredCurrency, setAcquiredCurrency] = useState<'USD' | 'BRL'>((entry.acquired_currency as 'USD' | 'BRL') || 'BRL')

  const { data: printsData, isLoading: loadingPrints } = useQuery({
    queryKey: ['card-prints', entry.scryfall_id],
    queryFn: () => cardsApi.prints(entry.scryfall_id),
    staleTime: 1000 * 60 * 60,
  })
  const prints: any[] = printsData?.prints || []

  const handleSubmit = () => {
    onConfirm({
      quantity, condition, foil, notes: notes || null, scryfall_id: selected.id,
      acquired_price: acquiredPrice ? parseFloat(acquiredPrice) : 0,
      acquired_currency: acquiredPrice ? acquiredCurrency : null,
    })
  }

  return createPortal(
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
              {(selected.image_small || card?.image_small) && (
                <img src={selected.image_small || card?.image_small} alt={card?.name} className="w-14 rounded-lg shadow-lg" />
              )}
              <div>
                <h3 className="font-display font-bold text-vault-gold">{card?.name || t('modal.editCard')}</h3>
                <p className="text-xs text-vault-muted">{(selected.set || card?.set)?.toUpperCase()} • #{selected.collector_number || card?.collector_number}</p>
              </div>
            </div>
            <button onClick={onClose} className="text-vault-muted hover:text-vault-text transition-colors">
              <X size={18} />
            </button>
          </div>

          <div className="space-y-4">
            {(loadingPrints || prints.length > 1) && (
              <div>
                <label className="text-xs text-vault-muted mb-1.5 block font-medium">{t('modal.edition')}</label>
                {loadingPrints ? (
                  <div className="input-field flex items-center gap-2 text-vault-muted text-sm">
                    <div className="w-4 h-4 border-2 border-vault-muted border-t-transparent rounded-full animate-spin" />
                    {t('modal.loadingPrintings')}
                  </div>
                ) : (
                  <>
                    <button type="button" onClick={() => setEditionOpen(o => !o)}
                      className="input-field w-full flex items-center justify-between gap-2 text-left">
                      <span className="flex items-center gap-2 min-w-0">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${rarityDot[selected.rarity] || 'bg-vault-muted'}`} />
                        <span className="truncate text-sm">{selected.set_name || card?.set_name} <span className="text-vault-muted">#{selected.collector_number || card?.collector_number}</span></span>
                      </span>
                      <ChevronDown size={16} className={`shrink-0 text-vault-muted transition-transform ${editionOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {editionOpen && (
                      <div className="mt-1.5 max-h-60 overflow-y-auto rounded-lg border border-vault-border bg-vault-card divide-y divide-vault-border">
                        {prints.map((p) => (
                          <button key={p.id} type="button" onClick={() => { setSelected(p); setEditionOpen(false) }}
                            className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-vault-surface text-left transition-colors">
                            {p.image_small ? <img src={p.image_small} alt="" loading="lazy" className="w-7 rounded shadow shrink-0" /> : <span className="w-7 h-10 rounded bg-vault-surface shrink-0" />}
                            <div className="flex-1 min-w-0">
                              <div className="text-sm text-vault-text truncate">{p.set_name}</div>
                              <div className="text-[11px] text-vault-muted flex items-center gap-1.5">
                                <span className={`w-1.5 h-1.5 rounded-full ${rarityDot[p.rarity] || 'bg-vault-muted'}`} /> #{p.collector_number}
                              </div>
                            </div>
                            {selected.id === p.id && <Check size={15} className="text-vault-accent shrink-0" />}
                          </button>
                        ))}
                      </div>
                    )}
                    <p className="text-[11px] text-vault-muted mt-1">{prints.length} {t('modal.printingsAvailable')}</p>
                  </>
                )}
              </div>
            )}
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

            {flags.pnl && (
              <div>
                <label className="text-xs text-vault-muted mb-1.5 block font-medium">{t('modal.acquiredPrice')}</label>
                <div className="flex gap-2">
                  <input type="number" step="0.01" min="0" className="input-field flex-1" placeholder={t('modal.optional')}
                    value={acquiredPrice} onChange={(e) => setAcquiredPrice(e.target.value)} />
                  <div className="flex rounded-lg border border-vault-border overflow-hidden">
                    {(['BRL', 'USD'] as const).map((c) => (
                      <button key={c} type="button" onClick={() => setAcquiredCurrency(c)}
                        className={`px-3 text-sm ${acquiredCurrency === c ? 'bg-vault-accent/20 text-vault-accent' : 'text-vault-muted'}`}>
                        {c === 'BRL' ? 'R$' : '$'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

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
    </AnimatePresence>,
    document.body,
  )
}

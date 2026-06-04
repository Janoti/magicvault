import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { X, Shuffle, Plus, RotateCcw } from 'lucide-react'
import { useTranslation } from 'react-i18next'

// A simple goldfish/playtest: shuffle the mainboard, draw 7, mulligan, draw more.
export default function PlaytestModal({ mainboard, onClose }: { mainboard: any[]; onClose: () => void }) {
  const { t } = useTranslation()

  // Expand the deck into a flat library of card objects (respecting quantity).
  const buildLibrary = useCallback(() => {
    const lib: any[] = []
    mainboard.forEach((e) => { for (let i = 0; i < e.quantity; i++) lib.push(e.card) })
    for (let i = lib.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [lib[i], lib[j]] = [lib[j], lib[i]] }
    return lib
  }, [mainboard])

  const [library, setLibrary] = useState<any[]>([])
  const [hand, setHand] = useState<any[]>([])
  const [mulligans, setMulligans] = useState(0)

  const newHand = useCallback((isMull = false) => {
    const lib = buildLibrary()
    setHand(lib.slice(0, 7))
    setLibrary(lib.slice(7))
    setMulligans((m) => (isMull ? m + 1 : 0))
  }, [buildLibrary])

  useEffect(() => { newHand(false) }, [])

  const draw = () => {
    if (library.length === 0) return
    setHand((h) => [...h, library[0]])
    setLibrary((l) => l.slice(1))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="relative z-10 bg-vault-surface border border-vault-border rounded-2xl p-6 w-full max-w-4xl max-h-[88vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-bold text-vault-gold flex items-center gap-2">
            <Shuffle size={18} /> {t('playtest.title')}
          </h3>
          <button onClick={onClose} className="text-vault-muted hover:text-vault-text"><X size={18} /></button>
        </div>

        <div className="flex items-center gap-3 mb-4 flex-wrap text-xs text-vault-muted">
          <span>{t('playtest.inHand', { count: hand.length })}</span>
          <span>•</span>
          <span>{t('playtest.inLibrary', { count: library.length })}</span>
          {mulligans > 0 && <><span>•</span><span className="text-vault-gold">{t('playtest.mulligans', { count: mulligans })}</span></>}
        </div>

        {/* Hand */}
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-2 min-h-[180px]">
          {hand.map((c, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              {c?.image_normal || c?.image_small ? (
                <img src={c.image_small || c.image_normal} alt={c.name} className="w-full rounded-lg shadow-lg" />
              ) : (
                <div className="aspect-[63/88] rounded-lg bg-vault-card border border-vault-border flex items-center justify-center p-1 text-[10px] text-center text-vault-text">{c?.name}</div>
              )}
            </motion.div>
          ))}
        </div>

        <div className="flex gap-2 mt-5">
          <button onClick={() => newHand(false)} className="btn-ghost flex items-center gap-2 text-sm"><RotateCcw size={15} /> {t('playtest.newHand')}</button>
          <button onClick={() => newHand(true)} className="btn-ghost flex items-center gap-2 text-sm"><Shuffle size={15} /> {t('playtest.mulligan')}</button>
          <button onClick={draw} disabled={library.length === 0} className="btn-primary flex items-center gap-2 text-sm disabled:opacity-40 ml-auto"><Plus size={15} /> {t('playtest.draw')}</button>
        </div>
      </motion.div>
    </div>
  )
}

import { useState, useEffect, useCallback, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { X, Shuffle, Plus, RotateCcw, ChevronRight, Skull } from 'lucide-react'
import { useTranslation } from 'react-i18next'

// Each zone holds wrapper objects so duplicate cards keep stable React keys.
type Slot = { uid: number; card: any; tapped?: boolean }

let UID = 0
const wrap = (card: any): Slot => ({ uid: ++UID, card })

// A solo goldfish playtest: shuffle the mainboard, draw 7, London mulligan,
// play cards to the battlefield, tap/untap, and advance turns.
export default function PlaytestModal({ mainboard, onClose }: { mainboard: any[]; onClose: () => void }) {
  const { t } = useTranslation()

  // Expand the deck into a flat, shuffled library (respecting quantity).
  const buildLibrary = useCallback((): Slot[] => {
    const lib: Slot[] = []
    mainboard.forEach((e) => { for (let i = 0; i < e.quantity; i++) lib.push(wrap(e.card)) })
    for (let i = lib.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [lib[i], lib[j]] = [lib[j], lib[i]] }
    return lib
  }, [mainboard])

  const [library, setLibrary] = useState<Slot[]>([])
  const [hand, setHand] = useState<Slot[]>([])
  const [field, setField] = useState<Slot[]>([])
  const [grave, setGrave] = useState<Slot[]>([])
  const [turn, setTurn] = useState(1)
  const [mulligans, setMulligans] = useState(0)
  const [toBottom, setToBottom] = useState(0) // London: cards still to bottom after a mulligan

  // Fresh game: shuffle, draw 7, reset every zone.
  const reset = useCallback(() => {
    const lib = buildLibrary()
    setHand(lib.slice(0, 7)); setLibrary(lib.slice(7))
    setField([]); setGrave([]); setTurn(1); setMulligans(0); setToBottom(0)
  }, [buildLibrary])

  useEffect(() => { reset() }, [])

  // London mulligan: shuffle everything back, draw 7, then bottom N cards (N = mulligans taken).
  const mulligan = () => {
    const lib = buildLibrary()
    setHand(lib.slice(0, 7)); setLibrary(lib.slice(7))
    setField([]); setGrave([]); setTurn(1)
    const n = mulligans + 1
    setMulligans(n); setToBottom(n)
  }

  const draw = (n = 1) => {
    setHand((h) => [...h, ...library.slice(0, n)])
    setLibrary((l) => l.slice(n))
  }

  const nextTurn = () => {
    setField((f) => f.map((s) => ({ ...s, tapped: false }))) // untap step
    setTurn((tn) => tn + 1)
    draw(1) // draw step
  }

  const move = (uid: number, from: Slot[], setFrom: any, setTo: any, mut?: (s: Slot) => Slot, toBottomOfList = false) => {
    const slot = from.find((s) => s.uid === uid)
    if (!slot) return
    setFrom(from.filter((s) => s.uid !== uid))
    const next = mut ? mut(slot) : slot
    setTo((z: Slot[]) => (toBottomOfList ? [...z, next] : [next, ...z]))
  }

  // Hand click: while bottoming, put on bottom of library; otherwise play to field.
  const onHandCard = (uid: number) => {
    if (toBottom > 0) {
      move(uid, hand, setHand, setLibrary, undefined, true)
      setToBottom((n) => n - 1)
    } else {
      move(uid, hand, setHand, setField, (s) => ({ ...s, tapped: false }))
    }
  }

  const Card = ({ slot, onClick, badge }: { slot: Slot; onClick?: () => void; badge?: ReactNode }) => {
    const c = slot.card
    return (
      <div className="relative group">
        <div onClick={onClick} className={`cursor-pointer transition-transform ${slot.tapped ? 'rotate-90' : ''}`}>
          {c?.image_normal || c?.image_small ? (
            <img src={c.image_normal || c.image_small} alt={c.name} className="w-full rounded-lg shadow-lg" loading="lazy" />
          ) : (
            <div className="aspect-[63/88] rounded-lg bg-vault-card border border-vault-border flex items-center justify-center p-1 text-[10px] text-center text-vault-text">{c?.name}</div>
          )}
        </div>
        {badge}
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="relative z-10 bg-vault-surface border border-vault-border rounded-2xl p-6 w-full max-w-5xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-bold text-vault-gold flex items-center gap-2">
            <Shuffle size={18} /> {t('playtest.title')}
          </h3>
          <button onClick={onClose} className="text-vault-muted hover:text-vault-text"><X size={18} /></button>
        </div>

        <div className="flex items-center gap-3 mb-4 flex-wrap text-xs text-vault-muted">
          <span className="text-vault-gold font-semibold">{t('playtest.turn', { count: turn })}</span>
          <span>•</span>
          <span>{t('playtest.inHand', { count: hand.length })}</span>
          <span>•</span>
          <span>{t('playtest.inLibrary', { count: library.length })}</span>
          <span>•</span>
          <span>{t('playtest.inGrave', { count: grave.length })}</span>
          {mulligans > 0 && <><span>•</span><span className="text-vault-gold">{t('playtest.mulligans', { count: mulligans })}</span></>}
        </div>

        {toBottom > 0 ? (
          <p className="text-xs text-amber-400 mb-3">{t('playtest.bottomHint', { count: toBottom })}</p>
        ) : (
          <p className="text-xs text-vault-muted/70 mb-3">{t('playtest.playHint')}</p>
        )}

        {/* Battlefield */}
        <div className="mb-4">
          <p className="text-[11px] uppercase tracking-wide text-vault-muted mb-2">{t('playtest.battlefield')}</p>
          {field.length === 0 ? (
            <div className="rounded-xl border border-dashed border-vault-border/60 py-8 text-center text-xs text-vault-muted">{t('playtest.fieldEmpty')}</div>
          ) : (
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
              {field.map((s) => (
                <Card key={s.uid} slot={s} onClick={() => setField((f) => f.map((x) => x.uid === s.uid ? { ...x, tapped: !x.tapped } : x))}
                  badge={
                    <button onClick={(e) => { e.stopPropagation(); move(s.uid, field, setField, setGrave) }} title={t('playtest.toGrave')}
                      className="absolute top-1 right-1 bg-black/70 text-white p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity"><Skull size={11} /></button>
                  } />
              ))}
            </div>
          )}
        </div>

        {/* Hand */}
        <div className="mb-1">
          <p className="text-[11px] uppercase tracking-wide text-vault-muted mb-2">{t('playtest.hand')}</p>
          {hand.length === 0 ? (
            <div className="rounded-xl border border-dashed border-vault-border/60 py-8 text-center text-xs text-vault-muted">{t('playtest.handEmpty')}</div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-2 min-h-[160px]">
              {hand.map((s, i) => (
                <motion.div key={s.uid} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                  <Card slot={s} onClick={() => onHandCard(s.uid)}
                    badge={toBottom === 0 ? (
                      <button onClick={(e) => { e.stopPropagation(); move(s.uid, hand, setHand, setGrave) }} title={t('playtest.toGrave')}
                        className="absolute top-1 right-1 bg-black/70 text-white p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity"><Skull size={11} /></button>
                    ) : undefined} />
                </motion.div>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-2 mt-5 flex-wrap">
          <button onClick={reset} className="btn-ghost flex items-center gap-2 text-sm"><RotateCcw size={15} /> {t('playtest.newHand')}</button>
          <button onClick={mulligan} className="btn-ghost flex items-center gap-2 text-sm"><Shuffle size={15} /> {t('playtest.mulligan')}</button>
          <button onClick={() => draw(1)} disabled={library.length === 0 || toBottom > 0} className="btn-ghost flex items-center gap-2 text-sm disabled:opacity-40"><Plus size={15} /> {t('playtest.draw')}</button>
          <button onClick={nextTurn} disabled={toBottom > 0} className="btn-primary flex items-center gap-2 text-sm disabled:opacity-40 ml-auto"><ChevronRight size={15} /> {t('playtest.nextTurn')}</button>
        </div>
      </motion.div>
    </div>
  )
}

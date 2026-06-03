import { useState, useRef } from 'react'
import { X, Search, Upload, Check } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { cardsApi, listingsApi } from '@/lib/api'

const CONDITIONS = ['M', 'NM', 'LP', 'MP', 'HP', 'DMG']

function resizePhoto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const max = 420
      const scale = Math.min(1, max / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = img.width * scale; canvas.height = img.height * scale
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/jpeg', 0.75))
    }
    img.onerror = reject
    img.src = URL.createObjectURL(file)
  })
}

export default function CreateListingModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [card, setCard] = useState<any>(null)
  const [condition, setCondition] = useState('NM')
  const [foil, setFoil] = useState(false)
  const [price, setPrice] = useState('')
  const [wanted, setWanted] = useState('')
  const [photo, setPhoto] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const search = async (e: React.FormEvent) => {
    e.preventDefault()
    if (query.length < 2) return
    const d = await cardsApi.search(query)
    setResults(d.cards || [])
  }

  const onPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; e.target.value = ''
    if (!f) return
    if (f.size > 5 * 1024 * 1024) return
    try { setPhoto(await resizePhoto(f)) } catch {}
  }

  const submit = async () => {
    if (!card) return
    setBusy(true)
    try {
      await listingsApi.create({
        scryfall_id: card.id, condition, foil,
        price: price ? parseFloat(price) : null,
        wanted: wanted || null, photo: photo || null, notes: notes || null,
      })
      onCreated()
    } catch {}
    setBusy(false)
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
          className="relative z-10 bg-vault-surface border border-vault-border rounded-2xl p-6 w-full max-w-lg max-h-[88vh] overflow-y-auto shadow-2xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-bold text-vault-gold">{t('trades.newListing')}</h3>
            <button onClick={onClose} className="text-vault-muted hover:text-vault-text"><X size={18} /></button>
          </div>

          {!card ? (
            <>
              <form onSubmit={search} className="flex gap-2 mb-3">
                <input className="input-field flex-1" placeholder={t('trades.pickCard')} value={query} onChange={e => setQuery(e.target.value)} />
                <button className="btn-primary !px-3"><Search size={16} /></button>
              </form>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-72 overflow-y-auto">
                {results.map(c => (
                  <button key={c.id} onClick={() => setCard(c)} className="rounded-lg overflow-hidden border border-vault-border hover:border-vault-accent">
                    {c.image_small ? <img src={c.image_small} alt={c.name} className="w-full" /> : <div className="p-2 text-xs">{c.name}</div>}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <div className="flex gap-3 items-center">
                {card.image_small && <img src={card.image_small} className="w-14 rounded shadow" />}
                <div className="flex-1">
                  <p className="font-medium text-vault-text">{card.name}</p>
                  <p className="text-xs text-vault-muted">{card.set_name}</p>
                </div>
                <button onClick={() => setCard(null)} className="text-xs text-vault-accent">↺</button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-vault-muted mb-1 block">{t('modal.condition')}</label>
                  <select className="input-field" value={condition} onChange={e => setCondition(e.target.value)}>
                    {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <label className="flex items-center gap-2 mt-6 text-sm text-vault-text cursor-pointer">
                  <input type="checkbox" checked={foil} onChange={e => setFoil(e.target.checked)} /> {t('modal.foil')}
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-vault-muted mb-1 block">{t('trades.priceLabel')} <span className="opacity-60">({t('trades.forSale')})</span></label>
                  <input type="number" step="0.01" className="input-field" placeholder="0.00" value={price} onChange={e => setPrice(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-vault-muted mb-1 block">{t('trades.wanted')} <span className="opacity-60">({t('trades.forTrade')})</span></label>
                  <input className="input-field" placeholder={t('trades.wantedPh')} value={wanted} onChange={e => setWanted(e.target.value)} />
                </div>
              </div>

              <div>
                <label className="text-xs text-vault-muted mb-1 block">{t('trades.photo')}</label>
                <div className="flex items-center gap-3">
                  {photo && <img src={photo} className="w-16 rounded shadow" />}
                  <button onClick={() => fileRef.current?.click()} className="btn-ghost !py-1.5 flex items-center gap-2 text-xs"><Upload size={14} /> {t('account.upload')}</button>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPhoto} />
                </div>
              </div>

              <div>
                <label className="text-xs text-vault-muted mb-1 block">{t('trades.notes')}</label>
                <textarea className="input-field resize-none" rows={2} placeholder={t('trades.notesPh')} value={notes} onChange={e => setNotes(e.target.value)} />
              </div>

              <div className="flex gap-3">
                <button onClick={onClose} className="btn-ghost flex-1">{t('common.cancel')}</button>
                <button onClick={submit} disabled={busy || (!price && !wanted.trim())} className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-50">
                  {busy ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Check size={16} />}
                  {t('trades.create')}
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  )
}

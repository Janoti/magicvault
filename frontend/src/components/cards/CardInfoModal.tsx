import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ShoppingCart, ExternalLink, Plus, Library } from 'lucide-react'
import { collectionApi, cardsApi } from '@/lib/api'
import { useUsdBrl } from '@/components/cards/CardPrice'
import { useAuthStore } from '@/store/auth'

const LANGS = [{ code: 'en', label: 'EN' }, { code: 'pt', label: 'PT' }, { code: 'es', label: 'ES' }]
const LANG_LABEL: Record<string, string> = { en: 'Inglês', pt: 'Português', es: 'Espanhol' }

const MANA_HEX: Record<string, string> = { W: '#f4e6b8', U: '#3b82c4', B: '#5b5563', R: '#d6584f', G: '#4ca766', C: '#b8b8b8' }
const RARITY_COLOR: Record<string, string> = {
  common: 'text-vault-muted', uncommon: 'text-slate-300', rare: 'text-vault-gold', mythic: 'text-orange-400',
}
// Formats shown in the legality row, in display order.
const LEGAL_FORMATS = ['standard', 'pioneer', 'modern', 'legacy', 'vintage', 'commander', 'pauper', 'brawl']

function ManaCost({ cost }: { cost?: string }) {
  if (!cost) return null
  const tokens = cost.match(/\{[^}]+\}/g) || []
  return (
    <span className="inline-flex flex-wrap gap-0.5 align-middle">
      {tokens.map((tok, i) => {
        const sym = tok.slice(1, -1)
        const color = MANA_HEX[sym]
        return (
          <span key={i} className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[11px] font-bold text-black/80 border border-black/20"
            style={{ background: color || '#cfcfcf' }}>
            {sym.replace('/', '')}
          </span>
        )
      })}
    </span>
  )
}

export default function CardInfoModal({ card: initialCard, onClose, onAddToCollection, entryId }: {
  card: any
  onClose: () => void
  onAddToCollection?: (card: any) => void
  entryId?: number   // when set (collection), switching language persists the printing
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const rate = useUsdBrl()
  const qc = useQueryClient()

  const [card, setCard] = useState<any>(initialCard)
  const [lang, setLang] = useState<string>(initialCard.lang || 'en')
  const [langNote, setLangNote] = useState('')
  const [langLoading, setLangLoading] = useState(false)

  const chooseLang = async (l: string) => {
    if (l === (card.lang || 'en')) { setLang(l); setLangNote(''); return }
    setLangLoading(true); setLangNote('')
    try {
      const r = await cardsApi.langVariant(initialCard.id, l)
      if (r.found) {
        setCard(r.card); setLang(l)
        if (entryId) { await collectionApi.update(entryId, { scryfall_id: r.card.id }); qc.invalidateQueries({ queryKey: ['collection'] }) }
      } else {
        setLang('en'); setCard(initialCard); setLangNote(t('cardInfo.langUnavailable', { lang: LANG_LABEL[l] }))
      }
    } catch { /* keep current */ }
    setLangLoading(false)
  }

  const { data: ctx } = useQuery({
    queryKey: ['card-context', initialCard?.id],
    queryFn: () => collectionApi.cardContext(initialCard.id),
    enabled: !!initialCard?.id && !!user,
    staleTime: 60_000,
  })
  const owned = ctx?.owned ?? 0
  const market = ctx?.market ?? { count: 0, min_price: null }

  const year = (card.released_at || '').slice(0, 4)
  const image = card.image_large || card.image_normal || card.image_small
  // Prices are language-independent; localized printings often have none on
  // Scryfall, so fall back to the original card's price.
  const usd = card.price_usd || initialCard.price_usd || 0
  const usdFoil = card.price_usd_foil || initialCard.price_usd_foil || 0
  const brl = (v: number) => (rate ? `R$${(v * rate).toFixed(2).replace('.', ',')}` : '')
  const goMarket = () => navigate(`/trades?q=${encodeURIComponent(card.name)}`)

  const legalities = card.legalities || {}
  const ptText = card.power != null && card.toughness != null ? `${card.power}/${card.toughness}`
    : card.loyalty != null ? `${t('cardInfo.loyalty')} ${card.loyalty}` : null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />
        <motion.div initial={{ opacity: 0, scale: 0.96, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }}
          className="relative z-10 w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-vault-surface border border-vault-border rounded-2xl shadow-2xl">
          <div className="flex items-center justify-between px-6 pt-5">
            <h2 className="font-display text-2xl font-bold text-vault-gold flex items-center gap-2">
              {card.name} <ManaCost cost={card.mana_cost} />
            </h2>
            <button onClick={onClose} className="text-vault-muted hover:text-vault-text"><X size={20} /></button>
          </div>

          <div className="p-6 grid sm:grid-cols-[200px_1fr] gap-6">
            {/* Left: image + actions */}
            <div className="space-y-3">
              {image && <img src={image} alt={card.name} className="w-full rounded-xl shadow-lg" />}
              {(usd > 0 || usdFoil > 0) && (
                <div className="text-center text-sm font-mono">
                  {usd > 0 && <span className="text-green-400">${usd.toFixed(2)}</span>}
                  {usdFoil > 0 && <span className="text-yellow-400"> / ✦${usdFoil.toFixed(2)}</span>}
                  {rate > 0 && usd > 0 && <div className="text-[11px] text-vault-muted">≈ {brl(usd)}</div>}
                </div>
              )}

              {/* Language (view / persist for owned cards) */}
              <div className="flex gap-1.5">
                {LANGS.map((l) => (
                  <button key={l.code} onClick={() => chooseLang(l.code)} disabled={langLoading}
                    className={`flex-1 py-1 rounded-lg border text-xs transition-all disabled:opacity-50 ${
                      lang === l.code ? 'border-vault-accent bg-vault-accent/15 text-vault-accent' : 'border-vault-border text-vault-muted hover:text-vault-text'
                    }`}>
                    {l.label}
                  </button>
                ))}
              </div>
              {langNote && <p className="text-[11px] text-amber-400">{langNote}</p>}

              {/* Our marketplace (replaces external buy link) */}
              <button onClick={goMarket}
                className={`w-full text-sm rounded-lg px-3 py-2 flex items-center gap-2 justify-center border ${
                  market.count > 0 ? 'border-vault-accent/40 bg-vault-accent/15 text-vault-accent hover:bg-vault-accent/25'
                  : 'border-vault-border text-vault-muted hover:text-vault-text'
                }`}>
                <ShoppingCart size={14} />
                {market.count > 0
                  ? t('cardInfo.inMarket', { count: market.count, price: market.min_price != null ? `R$${market.min_price.toFixed(2).replace('.', ',')}` : '—' })
                  : t('cardInfo.notInMarket')}
              </button>

              {card.scryfall_uri && (
                <a href={card.scryfall_uri} target="_blank" rel="noreferrer noopener"
                  className="w-full text-sm rounded-lg px-3 py-2 flex items-center gap-2 justify-center border border-vault-border text-vault-muted hover:text-vault-text">
                  {t('cardInfo.viewScryfall')} <ExternalLink size={13} />
                </a>
              )}

              {/* Add to collection only if not owned */}
              {onAddToCollection && owned === 0 && (
                <button onClick={() => onAddToCollection(card)}
                  className="w-full text-sm rounded-lg px-3 py-2 flex items-center gap-2 justify-center bg-green-600/90 hover:bg-green-600 text-white font-medium">
                  <Plus size={15} /> {t('modal.addToCollection')}
                </button>
              )}
            </div>

            {/* Right: encyclopedia info */}
            <div className="space-y-3 min-w-0">
              <p className="text-sm text-vault-text">{card.type_line}</p>

              {user && (
                <div className="flex items-center justify-between rounded-lg bg-vault-card/60 border border-vault-border px-3 py-2 text-sm">
                  <span className="flex items-center gap-2 text-vault-muted"><Library size={14} /> {t('cardInfo.inCollection')}</span>
                  <span className={owned > 0 ? 'text-vault-gold font-medium' : 'text-vault-muted'}>{t('cardInfo.copies', { count: owned })}</span>
                </div>
              )}

              {card.oracle_text && (
                <p className="text-sm text-vault-text/90 whitespace-pre-line leading-relaxed">{card.oracle_text}</p>
              )}
              {card.flavor_text && (
                <p className="text-sm text-vault-muted italic border-l-2 border-vault-border pl-3 whitespace-pre-line">{card.flavor_text}</p>
              )}
              {ptText && <p className="font-display font-bold text-vault-text">{ptText}</p>}

              {/* Meta grid */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs pt-2 border-t border-vault-border/60">
                <Meta label={t('cardInfo.set')} value={`${card.set_name}${card.collector_number ? ` · #${card.collector_number}` : ''}`} />
                {year && <Meta label={t('cardInfo.year')} value={year} />}
                {card.rarity && <Meta label={t('cardInfo.rarity')} value={<span className={`capitalize ${RARITY_COLOR[card.rarity] || ''}`}>{card.rarity}</span>} />}
                {card.artist && <Meta label={t('cardInfo.artist')} value={card.artist} />}
              </div>

              {/* Legality */}
              <div className="pt-2">
                <p className="text-[11px] uppercase tracking-wide text-vault-muted mb-1.5">{t('cardInfo.legality')}</p>
                <div className="flex flex-wrap gap-1.5">
                  {LEGAL_FORMATS.map((f) => {
                    const st = legalities[f]
                    if (!st || st === 'not_legal') return null
                    const styles = st === 'legal' ? 'border-green-500/40 text-green-400'
                      : st === 'banned' ? 'border-red-500/40 text-red-400'
                      : 'border-amber-500/40 text-amber-400'
                    return (
                      <span key={f} className={`text-[10px] capitalize px-2 py-0.5 rounded-full border ${styles}`}>{f}</span>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}

function Meta({ label, value }: { label: string; value: any }) {
  return (
    <div className="min-w-0">
      <span className="text-vault-muted">{label}: </span>
      <span className="text-vault-text">{value}</span>
    </div>
  )
}

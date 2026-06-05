import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import LanguageSwitcher from '@/components/layout/LanguageSwitcher'
import { useSeo } from '@/components/Seo'
import { billingApi } from '@/lib/api'
import {
  Library, Swords, SearchCode, ArrowLeftRight, Share2, Settings, ArrowRight, Check, Sparkles, ZoomIn, X, Crown, BrainCircuit, Store, MessageCircle, Instagram,
} from 'lucide-react'

// key = i18n namespace · icon · img = optional screenshot in /public/screenshots/<img>
// premiumItems = indices of bullets that require Premium (everything else is free).
const CATS = [
  { key: 'collection', icon: Library, img: 'collection.png', premiumItems: [] as number[] },
  { key: 'decks', icon: Swords, img: 'decks.png', premiumItems: [6] },
  { key: 'search', icon: SearchCode, img: 'search.png', premiumItems: [] },
  { key: 'trades', icon: ArrowLeftRight, img: 'trades.png', premiumItems: [0, 1, 3] },
  { key: 'social', icon: Share2, img: 'profile.png', premiumItems: [] },
  { key: 'platform', icon: Settings, img: 'premium.png', premiumItems: [] },
]

function PremiumPill() {
  const { t } = useTranslation()
  return (
    <span className="inline-flex items-center gap-1 align-middle text-[10px] font-bold uppercase tracking-wider text-vault-gold bg-vault-gold/10 border border-vault-gold/30 rounded-full px-1.5 py-0.5 ml-1.5">
      <Crown size={10} /> {t('feat.premium.tag')}
    </span>
  )
}

const fadeUp = { initial: { opacity: 0, y: 24 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true } }

// Screenshot slot — falls back to an icon panel when the image isn't present yet.
// Click to open a full-screen lightbox.
function Shot({ img, Icon }: { img: string; Icon: any }) {
  const [failed, setFailed] = useState(false)
  const [zoom, setZoom] = useState(false)
  const src = `/screenshots/${img}`

  if (failed) {
    return (
      <div className="aspect-video w-full rounded-2xl border border-vault-border bg-gradient-to-br from-vault-accent/10 to-vault-card flex items-center justify-center">
        <Icon size={56} className="text-vault-accent/60" />
      </div>
    )
  }
  return (
    <>
      <button onClick={() => setZoom(true)} className="group relative block w-full" title="Ampliar">
        <img src={src} onError={() => setFailed(true)} alt=""
          className="w-full rounded-2xl border border-vault-border shadow-2xl transition-transform group-hover:scale-[1.02]" />
        <span className="absolute inset-0 rounded-2xl bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
          <span className="opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 text-white rounded-full p-2">
            <ZoomIn size={20} />
          </span>
        </span>
      </button>
      <AnimatePresence>
        {zoom && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 cursor-zoom-out"
            onClick={() => setZoom(false)}
          >
            <button className="absolute top-4 right-4 text-white/80 hover:text-white" onClick={() => setZoom(false)}><X size={26} /></button>
            <motion.img
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              src={src} alt="" className="max-w-full max-h-[92vh] rounded-xl shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

// Honest, friendly explainer: what costs money, the price, and why we charge.
function PremiumBlock() {
  const { t } = useTranslation()
  const { data: price } = useQuery({ queryKey: ['billing-price'], queryFn: billingApi.price, staleTime: 1000 * 60 * 60 })
  const { data: beta } = useQuery({ queryKey: ['billing-beta'], queryFn: billingApi.beta, staleTime: 1000 * 60 * 5 })

  const priceLabel = price?.configured
    ? `${price.amount % 1 === 0 ? price.amount : price.amount.toFixed(2)} ${String(price.currency || '').toUpperCase()}${t('feat.premium.perInterval', { interval: price.interval })}`
    : t('feat.premium.soon')

  return (
    <motion.div {...fadeUp} className="surface p-8 sm:p-10 border-vault-gold/25 bg-gradient-to-br from-vault-gold/[0.07] to-transparent">
      <div className="flex items-center gap-2.5 mb-2">
        <span className="w-9 h-9 rounded-xl bg-vault-gold/15 border border-vault-gold/30 flex items-center justify-center">
          <Crown size={18} className="text-vault-gold" />
        </span>
        <h2 className="font-display text-2xl font-bold text-vault-gold">{t('feat.premium.title')}</h2>
      </div>
      <p className="text-vault-muted leading-relaxed mb-6 max-w-2xl">{t('feat.premium.intro')}</p>

      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        <div className="rounded-xl border border-vault-border bg-vault-card/60 p-4">
          <div className="flex items-center gap-2 text-vault-text font-medium mb-1">
            <BrainCircuit size={17} className="text-vault-accent" /> {t('feat.premium.f1Title')}
          </div>
          <p className="text-sm text-vault-muted leading-relaxed">{t('feat.premium.f1Desc')}</p>
        </div>
        <div className="rounded-xl border border-vault-border bg-vault-card/60 p-4">
          <div className="flex items-center gap-2 text-vault-text font-medium mb-1">
            <Store size={17} className="text-vault-accent" /> {t('feat.premium.f2Title')}
          </div>
          <p className="text-sm text-vault-muted leading-relaxed">{t('feat.premium.f2Desc')}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-4">
        <span className="text-vault-muted text-sm">{t('feat.premium.priceLabel')}:</span>
        {beta?.active ? (
          <>
            <span className="text-lg font-bold text-green-400">{t('feat.premium.free')}</span>
            {price?.configured && <span className="text-sm text-vault-muted line-through">{priceLabel}</span>}
            <span className="text-xs text-vault-gold">{t('feat.premium.betaNote', { count: beta.left })}</span>
          </>
        ) : (
          <span className="text-lg font-bold text-vault-text">{priceLabel}</span>
        )}
      </div>

      <p className="text-sm text-vault-muted leading-relaxed max-w-2xl border-t border-vault-border/60 pt-4">
        {t('feat.premium.why')}
      </p>
    </motion.div>
  )
}

export default function FeaturesPage() {
  const { t } = useTranslation()
  useSeo({ title: `${t('feat.title')} — VaultSpell`, description: t('feat.subtitle'), path: '/features' })
  return (
    <div className="min-h-screen bg-vault-bg text-vault-text">
      <header className="border-b border-vault-border/60 backdrop-blur sticky top-0 z-20 bg-vault-bg/80">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="font-display text-xl font-bold text-vault-gold tracking-wider">📖 VaultSpell</Link>
          <div className="flex items-center gap-3">
            <Link to="/eventos" className="hidden sm:inline text-sm text-vault-muted hover:text-vault-text">{t('nav.events')}</Link>
            <Link to="/lojas" className="hidden sm:inline text-sm text-vault-muted hover:text-vault-text">{t('events.storesNav')}</Link>
            <a href="https://www.instagram.com/vault.spell/" target="_blank" rel="noreferrer" aria-label="Instagram" className="hidden sm:inline text-vault-muted hover:text-vault-text"><Instagram size={18} /></a>
            <LanguageSwitcher compact direction="down" />
            <Link to="/login" className="text-sm text-vault-muted hover:text-vault-text">{t('common.login')}</Link>
            <Link to="/register" className="btn-primary text-sm">{t('common.register')}</Link>
          </div>
        </div>
      </header>

      <section className="max-w-5xl mx-auto px-6 pt-20 pb-6 text-center">
        <motion.div {...fadeUp} className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-vault-gold bg-vault-gold/10 border border-vault-gold/30 rounded-full px-3 py-1 mb-5">
          <Sparkles size={13} /> {t('feat.badge')}
        </motion.div>
        <motion.h1 {...fadeUp} transition={{ delay: 0.05 }} className="font-display text-4xl sm:text-5xl font-bold text-vault-gold leading-tight">{t('feat.title')}</motion.h1>
        <motion.p {...fadeUp} transition={{ delay: 0.1 }} className="text-vault-muted text-lg mt-4 max-w-2xl mx-auto">{t('feat.subtitle')}</motion.p>
        <motion.div {...fadeUp} transition={{ delay: 0.15 }} className="mt-6 flex flex-col items-center gap-2">
          <div className="inline-flex flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-full border border-vault-accent/30 bg-vault-accent/10 px-4 py-2">
            <span className="text-[11px] uppercase tracking-wider font-bold text-vault-accent">{t('feat.soonBadge')}</span>
            <span className="text-sm text-vault-text">{t('feat.soonEvents')}</span>
          </div>
          <p className="text-xs text-vault-muted max-w-2xl text-center">{t('feat.soonCollector')}</p>
        </motion.div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-12 space-y-20">
        {CATS.map((c, i) => {
          const items = t(`feat.cats.${c.key}.items`, { returnObjects: true }) as string[]
          const reversed = i % 2 === 1
          return (
            <motion.div key={c.key} {...fadeUp}
              className={`grid lg:grid-cols-2 gap-8 lg:gap-12 items-center ${reversed ? 'lg:[direction:rtl]' : ''}`}>
              <div className="lg:[direction:ltr]">
                <Shot img={c.img} Icon={c.icon} />
              </div>
              <div className="lg:[direction:ltr]">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-11 h-11 rounded-xl bg-vault-accent/15 border border-vault-accent/30 flex items-center justify-center">
                    <c.icon size={20} className="text-vault-accent" />
                  </div>
                  <h2 className="font-display text-2xl font-bold text-vault-gold">{t(`feat.cats.${c.key}.title`)}</h2>
                </div>
                <p className="text-vault-muted mb-5 leading-relaxed">{t(`feat.cats.${c.key}.intro`)}</p>
                <ul className="space-y-2.5">
                  {(Array.isArray(items) ? items : []).map((it, j) => (
                    <li key={j} className="flex items-start gap-2.5 text-sm text-vault-text">
                      <Check size={16} className="text-vault-accent shrink-0 mt-0.5" />
                      <span>{it}{c.premiumItems.includes(j) && <PremiumPill />}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>
          )
        })}
      </section>

      <section className="max-w-5xl mx-auto px-6 pb-8">
        <PremiumBlock />
      </section>

      <section className="max-w-5xl mx-auto px-6 pb-8">
        <motion.div {...fadeUp} className="surface p-6 sm:p-7 flex items-start gap-4">
          <span className="w-10 h-10 rounded-xl bg-vault-accent/15 border border-vault-accent/30 flex items-center justify-center shrink-0">
            <MessageCircle size={18} className="text-vault-accent" />
          </span>
          <div>
            <h3 className="font-display text-lg font-bold text-vault-gold mb-1">{t('feat.listeningTitle')}</h3>
            <p className="text-sm text-vault-muted leading-relaxed">{t('feat.listeningText')}</p>
          </div>
        </motion.div>
      </section>

      <section className="max-w-5xl mx-auto px-6 pb-24 text-center">
        <motion.div {...fadeUp} className="surface p-10 bg-gradient-to-br from-vault-accent/10 to-transparent">
          <h2 className="font-display text-3xl font-bold text-vault-gold">{t('feat.ctaTitle')}</h2>
          <p className="text-vault-muted mt-2 mb-6">{t('feat.ctaSub')}</p>
          <Link to="/register" className="btn-primary inline-flex items-center gap-2 text-base px-8 py-3">
            {t('feat.cta')} <ArrowRight size={18} />
          </Link>
          <p className="text-xs text-vault-muted mt-3">{t('landing.noCard')}</p>
        </motion.div>
      </section>
    </div>
  )
}

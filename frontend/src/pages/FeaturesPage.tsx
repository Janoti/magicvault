import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import LanguageSwitcher from '@/components/layout/LanguageSwitcher'
import {
  Library, Swords, SearchCode, ArrowLeftRight, Share2, Settings, ArrowRight, Check, Sparkles,
} from 'lucide-react'

// key = i18n namespace · icon · img = optional screenshot in /public/screenshots/<img>
const CATS = [
  { key: 'collection', icon: Library, img: 'collection.png' },
  { key: 'decks', icon: Swords, img: 'decks.png' },
  { key: 'search', icon: SearchCode, img: 'search.png' },
  { key: 'trades', icon: ArrowLeftRight, img: 'trades.png' },
  { key: 'social', icon: Share2, img: 'profile.png' },
  { key: 'platform', icon: Settings, img: 'premium.png' },
]

const fadeUp = { initial: { opacity: 0, y: 24 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true } }

// Screenshot slot — falls back to an icon panel when the image isn't present yet.
function Shot({ img, Icon }: { img: string; Icon: any }) {
  const [failed, setFailed] = useState(false)
  if (failed) {
    return (
      <div className="aspect-video w-full rounded-2xl border border-vault-border bg-gradient-to-br from-vault-accent/10 to-vault-card flex items-center justify-center">
        <Icon size={56} className="text-vault-accent/60" />
      </div>
    )
  }
  return (
    <img
      src={`/screenshots/${img}`}
      onError={() => setFailed(true)}
      alt=""
      className="w-full rounded-2xl border border-vault-border shadow-2xl"
    />
  )
}

export default function FeaturesPage() {
  const { t } = useTranslation()
  return (
    <div className="min-h-screen bg-vault-bg text-vault-text">
      <header className="border-b border-vault-border/60 backdrop-blur sticky top-0 z-20 bg-vault-bg/80">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="font-display text-xl font-bold text-vault-gold tracking-wider">📖 VaultSpell</Link>
          <div className="flex items-center gap-3">
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
                      <Check size={16} className="text-vault-accent shrink-0 mt-0.5" /> {it}
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>
          )
        })}
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

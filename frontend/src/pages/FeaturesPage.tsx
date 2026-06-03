import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import LanguageSwitcher from '@/components/layout/LanguageSwitcher'
import {
  Library, Swords, SearchCode, ArrowLeftRight, Share2, Settings, ArrowRight, Check,
} from 'lucide-react'

const CATS = [
  { key: 'collection', icon: Library },
  { key: 'decks', icon: Swords },
  { key: 'search', icon: SearchCode },
  { key: 'trades', icon: ArrowLeftRight },
  { key: 'social', icon: Share2 },
  { key: 'platform', icon: Settings },
]

const fadeUp = { initial: { opacity: 0, y: 20 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true } }

export default function FeaturesPage() {
  const { t } = useTranslation()
  return (
    <div className="min-h-screen bg-vault-bg text-vault-text">
      <header className="border-b border-vault-border/60 backdrop-blur sticky top-0 z-20 bg-vault-bg/80">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="font-display text-xl font-bold text-vault-gold tracking-wider">📖 VaultSpell</Link>
          <div className="flex items-center gap-3">
            <LanguageSwitcher compact direction="down" />
            <Link to="/register" className="btn-primary text-sm">{t('common.register')}</Link>
          </div>
        </div>
      </header>

      <section className="max-w-5xl mx-auto px-6 pt-16 pb-10 text-center">
        <motion.h1 {...fadeUp} className="font-display text-4xl sm:text-5xl font-bold text-vault-gold">{t('feat.title')}</motion.h1>
        <motion.p {...fadeUp} transition={{ delay: 0.1 }} className="text-vault-muted text-lg mt-4 max-w-2xl mx-auto">{t('feat.subtitle')}</motion.p>
      </section>

      <section className="max-w-5xl mx-auto px-6 pb-16 space-y-5">
        {CATS.map((c, i) => {
          const items = t(`feat.cats.${c.key}.items`, { returnObjects: true }) as string[]
          return (
            <motion.div key={c.key} {...fadeUp} transition={{ delay: Math.min(i * 0.05, 0.3) }}
              className="surface p-6 sm:p-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-vault-accent/15 border border-vault-accent/30 flex items-center justify-center">
                  <c.icon size={18} className="text-vault-accent" />
                </div>
                <h2 className="font-display text-xl font-bold text-vault-text">{t(`feat.cats.${c.key}.title`)}</h2>
              </div>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5">
                {(Array.isArray(items) ? items : []).map((it, j) => (
                  <li key={j} className="flex items-start gap-2 text-sm text-vault-text">
                    <Check size={15} className="text-vault-accent shrink-0 mt-0.5" /> {it}
                  </li>
                ))}
              </ul>
            </motion.div>
          )
        })}
      </section>

      <section className="max-w-5xl mx-auto px-6 pb-24 text-center">
        <motion.div {...fadeUp}>
          <Link to="/register" className="btn-primary inline-flex items-center gap-2 text-base px-8 py-3">
            {t('feat.cta')} <ArrowRight size={18} />
          </Link>
          <p className="text-xs text-vault-muted mt-3">{t('landing.noCard')}</p>
        </motion.div>
      </section>
    </div>
  )
}

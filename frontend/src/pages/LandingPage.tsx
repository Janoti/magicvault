import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import LanguageSwitcher from '@/components/layout/LanguageSwitcher'
import {
  Library, Swords, BookOpen, Share2, TrendingUp, Upload,
  ArrowRight, Check, Github, ArrowLeftRight,
} from 'lucide-react'

const features = [
  { icon: Library, k: 'f1' },
  { icon: Swords, k: 'f2' },
  { icon: BookOpen, k: 'f3' },
  { icon: Share2, k: 'f4' },
  { icon: TrendingUp, k: 'f5' },
  { icon: Upload, k: 'f6' },
]

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
}

export default function LandingPage() {
  const { t } = useTranslation()
  return (
    <div className="min-h-screen bg-vault-bg text-vault-text">
      {/* Nav */}
      <header className="border-b border-vault-border/60 backdrop-blur sticky top-0 z-20 bg-vault-bg/80">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <span className="font-display text-xl font-bold text-vault-gold tracking-wider">📖 VaultSpell</span>
          <div className="flex items-center gap-3">
            <LanguageSwitcher compact />
            <Link to="/login" className="text-sm text-vault-muted hover:text-vault-text transition-colors">{t('common.login')}</Link>
            <Link to="/register" className="btn-primary text-sm">{t('common.register')}</Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-vault-accent/10 via-transparent to-transparent pointer-events-none" />
        <div className="max-w-6xl mx-auto px-6 pt-24 pb-16 text-center relative">
          <motion.h1 {...fadeUp} transition={{ delay: 0.05 }}
            className="font-display text-4xl sm:text-6xl font-bold text-vault-gold leading-tight">
            {t('landing.heroTitle1')}<br />{t('landing.heroTitle2')}
          </motion.h1>
          <motion.p {...fadeUp} transition={{ delay: 0.1 }}
            className="text-vault-muted text-lg mt-5 max-w-2xl mx-auto">
            {t('landing.heroSubtitle')}
          </motion.p>
          <motion.div {...fadeUp} transition={{ delay: 0.15 }}
            className="flex items-center justify-center gap-3 mt-8">
            <Link to="/register" className="btn-primary flex items-center gap-2 text-base px-6 py-3">
              {t('landing.ctaStart')} <ArrowRight size={18} />
            </Link>
            <Link to="/login" className="btn-ghost text-base px-6 py-3">{t('landing.ctaHaveAccount')}</Link>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f, i) => (
            <motion.div key={f.k} {...fadeUp} transition={{ delay: Math.min(i * 0.05, 0.3) }}
              className="surface p-6 hover:border-vault-accent/40 transition-all">
              <div className="w-10 h-10 rounded-xl bg-vault-accent/15 border border-vault-accent/30 flex items-center justify-center mb-4">
                <f.icon size={18} className="text-vault-accent" />
              </div>
              <h3 className="font-medium text-vault-text mb-1.5">{t(`landing.${f.k}Title`)}</h3>
              <p className="text-sm text-vault-muted leading-relaxed">{t(`landing.${f.k}Desc`)}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Sharing highlight */}
      <section className="max-w-6xl mx-auto px-6 py-12">
        <motion.div {...fadeUp} className="surface p-8 sm:p-12 text-center bg-gradient-to-br from-vault-accent/10 to-transparent">
          <Share2 size={28} className="mx-auto text-vault-accent mb-4" />
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-vault-gold">{t('landing.shareTitle')}</h2>
          <p className="text-vault-muted mt-3 max-w-xl mx-auto">{t('landing.shareDesc')}</p>
          <div className="flex flex-wrap items-center justify-center gap-4 mt-6 text-sm text-vault-text">
            <span className="flex items-center gap-2"><Check size={15} className="text-green-400" /> {t('landing.shareBullet1')}</span>
            <span className="flex items-center gap-2"><Check size={15} className="text-green-400" /> {t('landing.shareBullet2')}</span>
            <span className="flex items-center gap-2"><Check size={15} className="text-green-400" /> {t('landing.shareBullet3')}</span>
          </div>
        </motion.div>
      </section>

      {/* Trades & sales (coming soon · premium) */}
      <section className="max-w-6xl mx-auto px-6 py-12">
        <motion.div {...fadeUp} className="surface p-8 sm:p-12 bg-gradient-to-br from-vault-gold/10 to-transparent border-vault-gold/20">
          <div className="flex flex-col sm:flex-row items-start gap-6">
            <ArrowLeftRight size={28} className="text-vault-gold shrink-0" />
            <div>
              <span className="inline-block text-[10px] uppercase tracking-wider font-bold text-vault-gold bg-vault-gold/10 border border-vault-gold/30 rounded-full px-2 py-0.5 mb-3">
                {t('landing.tradeBadge')}
              </span>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-vault-gold">{t('landing.tradeTitle')}</h2>
              <p className="text-vault-muted mt-3 max-w-2xl">{t('landing.tradeDesc')}</p>
              <div className="flex flex-wrap gap-4 mt-5 text-sm text-vault-text">
                <span className="flex items-center gap-2"><Check size={15} className="text-vault-gold" /> {t('landing.tradeB1')}</span>
                <span className="flex items-center gap-2"><Check size={15} className="text-vault-gold" /> {t('landing.tradeB2')}</span>
                <span className="flex items-center gap-2"><Check size={15} className="text-vault-gold" /> {t('landing.tradeB3')}</span>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* CTA */}
      <section className="max-w-6xl mx-auto px-6 py-20 text-center">
        <motion.h2 {...fadeUp} className="font-display text-3xl font-bold text-vault-gold">
          {t('landing.ctaBottom')}
        </motion.h2>
        <motion.div {...fadeUp} transition={{ delay: 0.1 }} className="mt-6">
          <Link to="/register" className="btn-primary inline-flex items-center gap-2 text-base px-8 py-3">
            {t('common.register')} <ArrowRight size={18} />
          </Link>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-vault-border/60">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-vault-muted">
          <span className="font-display text-vault-gold">📖 VaultSpell</span>
          <span>{t('landing.footerDisclaimer')}</span>
          <a href="https://github.com/Janoti/magicvault" target="_blank" rel="noreferrer"
            className="flex items-center gap-2 hover:text-vault-text transition-colors">
            <Github size={15} /> {t('landing.openSource')}
          </a>
        </div>
      </footer>
    </div>
  )
}

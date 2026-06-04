import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import LanguageSwitcher from '@/components/layout/LanguageSwitcher'
import { useSeo } from '@/components/Seo'
import { billingApi, cardsApi } from '@/lib/api'
import {
  Library, Swords, BookOpen, Share2, TrendingUp, Upload,
  ArrowRight, Check, Github, ArrowLeftRight, Crown, Layers, SearchCode, Users,
} from 'lucide-react'

const features = [
  { icon: Library, k: 'f1' },
  { icon: Swords, k: 'f2' },
  { icon: BookOpen, k: 'f3' },
  { icon: Layers, k: 'f4' },
  { icon: TrendingUp, k: 'f5' },
  { icon: SearchCode, k: 'f6' },
  { icon: Upload, k: 'f7' },
  { icon: Users, k: 'f8' },
]

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
}

// Iconic art for the rotating hero background (fetched from Scryfall).
const ART_CARDS = [
  'Nicol Bolas, the Ravager', 'Ugin, the Spirit Dragon', 'Lathliss, Dragon Queen',
  'Niv-Mizzet, Parun', 'Atraxa, Praetors\' Voice', 'Shivan Dragon',
]

export default function LandingPage() {
  const { t } = useTranslation()
  useSeo({ title: `VaultSpell — ${t('nav.subtitle')}`, description: t('landing.heroSubtitle'), path: '/' })
  const { data: beta } = useQuery({ queryKey: ['beta-status'], queryFn: billingApi.beta })

  // Rotating translucent card-art background.
  const [artIdx, setArtIdx] = useState(0)
  const { data: arts } = useQuery({
    queryKey: ['landing-art'],
    queryFn: async () => {
      const res = await Promise.all(
        ART_CARDS.map((n) => cardsApi.search(`!"${n}"`).then((d: any) => d.cards?.[0]?.art_crop).catch(() => null)),
      )
      return res.filter(Boolean) as string[]
    },
    staleTime: Infinity,
  })
  useEffect(() => {
    if (!arts?.length) return
    const id = setInterval(() => setArtIdx((i) => (i + 1) % arts.length), 7000)
    return () => clearInterval(id)
  }, [arts])

  return (
    <div className="min-h-screen bg-vault-bg text-vault-text">
      {/* Nav */}
      <header className="border-b border-vault-border/60 backdrop-blur sticky top-0 z-20 bg-vault-bg/80">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <span className="font-display text-xl font-bold text-vault-gold tracking-wider">📖 VaultSpell</span>
          <div className="flex items-center gap-3">
            <LanguageSwitcher compact direction="down" />
            <Link to="/features" className="hidden sm:inline text-sm text-vault-muted hover:text-vault-text transition-colors">{t('landing.featuresNav')}</Link>
            <Link to="/eventos" className="hidden sm:inline text-sm text-vault-muted hover:text-vault-text transition-colors">{t('nav.events')}</Link>
            <Link to="/lojas" className="hidden sm:inline text-sm text-vault-muted hover:text-vault-text transition-colors">{t('events.storesNav')}</Link>
            <Link to="/login" className="text-sm text-vault-muted hover:text-vault-text transition-colors">{t('common.login')}</Link>
            <Link to="/register" className="btn-primary text-sm">{t('common.register')}</Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        {/* Rotating translucent card art */}
        {arts && arts.length > 0 && (
          <AnimatePresence>
            <motion.div
              key={artIdx}
              className="absolute inset-0 bg-cover bg-center pointer-events-none"
              style={{ backgroundImage: `url(${arts[artIdx]})` }}
              initial={{ opacity: 0, scale: 1.08 }}
              animate={{ opacity: 0.26, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ opacity: { duration: 2.5 }, scale: { duration: 8, ease: 'linear' } }}
            />
          </AnimatePresence>
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-vault-bg/25 via-vault-bg/55 to-vault-bg pointer-events-none" />
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
          {beta?.active && (
            <motion.div {...fadeUp} transition={{ delay: 0.12 }}
              className="mt-7 inline-flex flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-full border border-vault-gold/40 bg-vault-gold/10 px-5 py-2.5">
              <span className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-bold text-vault-gold">
                <Crown size={13} /> {t('landing.betaBadge')}
              </span>
              <span className="text-sm text-vault-text">
                {t('landing.betaPitch')}
                <span className="font-bold text-vault-gold"> {t('landing.betaSlotsLeft', { count: beta.left })}</span>
              </span>
            </motion.div>
          )}
          <motion.div {...fadeUp} transition={{ delay: 0.15 }}
            className="flex items-center justify-center gap-3 mt-8">
            <Link to="/register" className="btn-primary flex items-center gap-2 text-base px-6 py-3">
              {t('landing.ctaStart')} <ArrowRight size={18} />
            </Link>
            <Link to="/features" className="btn-ghost text-base px-6 py-3">{t('landing.seeAll')}</Link>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <motion.div {...fadeUp} className="text-center mb-10">
          <h2 className="font-display text-3xl font-bold text-vault-gold">{t('landing.featuresTitle')}</h2>
          <p className="text-vault-muted mt-2">{t('landing.featuresSubtitle')}</p>
        </motion.div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
        <motion.div {...fadeUp} className="text-center mt-8">
          <Link to="/features" className="btn-primary inline-flex items-center gap-2 text-base px-7 py-3">
            {t('landing.seeAll')} <ArrowRight size={18} />
          </Link>
        </motion.div>
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
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            <Link to="/features" className="hover:text-vault-text transition-colors">{t('landing.featuresNav')}</Link>
            <Link to="/eventos" className="hover:text-vault-text transition-colors">{t('nav.events')}</Link>
            <Link to="/lojas" className="hover:text-vault-text transition-colors">{t('events.storesNav')}</Link>
          </div>
          <a href="https://github.com/Janoti/magicvault" target="_blank" rel="noreferrer"
            className="flex items-center gap-2 hover:text-vault-text transition-colors">
            <Github size={15} /> {t('landing.openSource')}
          </a>
        </div>
      </footer>
    </div>
  )
}

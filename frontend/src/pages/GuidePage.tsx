import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import {
  Library, Swords, BookOpen, SearchCode, ArrowLeftRight, Users, CalendarDays, Settings,
  Check, ArrowRight, Compass,
} from 'lucide-react'
import PublicPage from '@/components/PublicPage'
import { useSeo } from '@/components/Seo'

// Task-oriented help: every section maps to an app area and lists the concrete
// things you can do there. Copy lives in i18n under `guide.sections.<key>`.
const SECTIONS = [
  { key: 'collection', icon: Library, to: '/collection' },
  { key: 'decks', icon: Swords, to: '/decks' },
  { key: 'binders', icon: BookOpen, to: '/binders' },
  { key: 'search', icon: SearchCode, to: '/search' },
  { key: 'market', icon: ArrowLeftRight, to: '/trades' },
  { key: 'social', icon: Users, to: '/friends' },
  { key: 'events', icon: CalendarDays, to: '/eventos' },
  { key: 'account', icon: Settings, to: '/account' },
] as const

const fadeUp = { initial: { opacity: 0, y: 18 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true } }

export default function GuidePage() {
  const { t } = useTranslation()
  useSeo({ title: `${t('guide.title')} — VaultSpell`, description: t('guide.subtitle'), path: '/guia' })

  const body = (
    <div className="max-w-4xl mx-auto p-6">
      <div className="text-center mb-10">
        <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-vault-accent bg-vault-accent/10 border border-vault-accent/30 rounded-full px-3 py-1 mb-4">
          <Compass size={13} /> {t('guide.badge')}
        </span>
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-vault-gold">{t('guide.title')}</h1>
        <p className="text-vault-muted mt-3 max-w-2xl mx-auto">{t('guide.subtitle')}</p>
      </div>

      {/* Quick jump */}
      <div className="flex flex-wrap gap-2 justify-center mb-10">
        {SECTIONS.map((s) => (
          <a key={s.key} href={`#${s.key}`}
            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-vault-border bg-vault-card/40 text-vault-muted hover:text-vault-text hover:border-vault-accent/40 transition-all">
            <s.icon size={13} /> {t(`guide.sections.${s.key}.title`)}
          </a>
        ))}
      </div>

      <div className="space-y-6">
        {SECTIONS.map((s) => {
          const steps = t(`guide.sections.${s.key}.steps`, { returnObjects: true }) as string[]
          return (
            <motion.section key={s.key} id={s.key} {...fadeUp} className="surface p-6 scroll-mt-20">
              <div className="flex items-center gap-3 mb-2">
                <span className="w-11 h-11 rounded-xl bg-vault-accent/15 border border-vault-accent/30 flex items-center justify-center shrink-0">
                  <s.icon size={20} className="text-vault-accent" />
                </span>
                <div>
                  <h2 className="font-display text-xl font-bold text-vault-gold">{t(`guide.sections.${s.key}.title`)}</h2>
                  <p className="text-sm text-vault-muted">{t(`guide.sections.${s.key}.intro`)}</p>
                </div>
              </div>
              <ul className="mt-4 space-y-2.5">
                {(Array.isArray(steps) ? steps : []).map((it, j) => (
                  <li key={j} className="flex items-start gap-2.5 text-sm text-vault-text">
                    <Check size={16} className="text-vault-accent shrink-0 mt-0.5" />
                    <span>{it}</span>
                  </li>
                ))}
              </ul>
              <Link to={s.to} className="mt-4 inline-flex items-center gap-1.5 text-sm text-vault-accent hover:underline">
                {t('guide.goTo')} <ArrowRight size={14} />
              </Link>
            </motion.section>
          )
        })}
      </div>

      <div className="surface p-6 mt-8 text-center bg-gradient-to-br from-vault-accent/10 to-transparent">
        <p className="text-sm text-vault-muted">{t('guide.footer')}</p>
        <Link to="/features" className="mt-3 inline-flex items-center gap-1.5 text-sm text-vault-gold hover:underline">
          {t('guide.seeFeatures')} <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  )

  return <PublicPage>{body}</PublicPage>
}

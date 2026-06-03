import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { Library, Swords, Share2, Dices, Sparkles } from 'lucide-react'
import LanguageSwitcher from '@/components/layout/LanguageSwitcher'

// Floating embers config (deterministic so hydration is stable)
const embers = Array.from({ length: 14 }).map((_, i) => ({
  left: (i * 53) % 100,
  size: 2 + (i % 3),
  delay: (i % 7) * 0.8,
  duration: 7 + (i % 5) * 2,
}))

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation()

  const bullets = [
    { icon: Library, text: t('auth.heroB1') },
    { icon: Swords, text: t('auth.heroB2') },
    { icon: Share2, text: t('auth.heroB3') },
  ]

  return (
    <div className="min-h-screen relative overflow-hidden bg-vault-bg flex items-center justify-center p-4">
      {/* Animated arcane background */}
      <div className="absolute inset-0 pointer-events-none">
        <motion.div
          className="absolute -top-32 -left-32 w-[28rem] h-[28rem] rounded-full bg-vault-accent/15 blur-3xl"
          animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute -bottom-40 -right-24 w-[32rem] h-[32rem] rounded-full bg-vault-gold/10 blur-3xl"
          animate={{ scale: [1.1, 1, 1.1], opacity: [0.4, 0.7, 0.4] }}
          transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut' }}
        />
        <div className="absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
        {embers.map((e, i) => (
          <motion.span
            key={i}
            className="absolute rounded-full bg-vault-gold/60"
            style={{ left: `${e.left}%`, bottom: -10, width: e.size, height: e.size }}
            animate={{ y: [0, -700], opacity: [0, 1, 0] }}
            transition={{ duration: e.duration, delay: e.delay, repeat: Infinity, ease: 'easeOut' }}
          />
        ))}
      </div>

      {/* Hero: floating panel pinned to the left (only where there's room) */}
      <div className="hidden xl:flex flex-col justify-center gap-8 absolute left-16 top-1/2 -translate-y-1/2 max-w-sm z-10">
        <div className="flex items-center gap-2 text-vault-gold">
          <Dices size={20} />
          <span className="font-display text-lg font-bold tracking-wider">📖 VaultSpell</span>
        </div>
        <motion.h2
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
          className="font-display text-4xl font-bold text-vault-gold leading-tight"
        >
          {t('auth.heroTagline')}
        </motion.h2>
        <div className="space-y-4">
          {bullets.map((b, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 + i * 0.12 }}
              className="flex items-center gap-3 text-vault-text"
            >
              <span className="w-9 h-9 rounded-xl bg-vault-accent/15 border border-vault-accent/30 flex items-center justify-center">
                <b.icon size={16} className="text-vault-accent" />
              </span>
              {b.text}
            </motion.div>
          ))}
        </div>
        <div className="flex items-center gap-2 text-xs text-vault-muted">
          <Sparkles size={13} className="text-vault-gold/70" /> Magic: The Gathering • Scryfall
        </div>
      </div>

      {/* Language switcher pinned top-right of the viewport */}
      <div className="absolute top-4 right-4 z-20"><LanguageSwitcher direction="down" /></div>

      {/* Form centered on the page */}
      <div className="relative z-10 w-full max-w-sm">
        {children}
      </div>
    </div>
  )
}

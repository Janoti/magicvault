import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { Crown, Check, Sparkles } from 'lucide-react'
import { useAuthStore } from '@/store/auth'

export default function PremiumPage() {
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.user)
  const isPremium = !!(user?.is_premium || user?.is_admin)
  const [notice, setNotice] = useState(false)

  const benefits = [t('premium.b1'), t('premium.b2'), t('premium.b3'), t('premium.b4'), t('premium.b5')]

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          className="w-16 h-16 rounded-2xl bg-vault-gold/15 border border-vault-gold/30 flex items-center justify-center mx-auto mb-4">
          <Crown size={28} className="text-vault-gold" />
        </motion.div>
        <h1 className="font-display text-3xl font-bold text-vault-gold">{t('premium.title')}</h1>
        <p className="text-vault-muted text-sm mt-1">{t('premium.subtitle')}</p>
      </div>

      {isPremium ? (
        <div className="surface p-8 text-center border-vault-gold/30 bg-gradient-to-br from-vault-gold/10 to-transparent">
          <Sparkles size={32} className="mx-auto text-vault-gold mb-3" />
          <h2 className="font-display text-xl font-bold text-vault-gold">{t('premium.youArePremium')}</h2>
          <p className="text-sm text-vault-muted mt-2">{t('premium.youArePremiumDesc')}</p>
          <ul className="mt-5 space-y-2 text-left max-w-sm mx-auto">
            {benefits.map((b, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-vault-text">
                <Check size={16} className="text-vault-gold shrink-0 mt-0.5" /> {b}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="surface overflow-hidden">
          {/* Price header */}
          <div className="p-8 text-center border-b border-vault-border bg-gradient-to-br from-vault-accent/10 to-transparent">
            <span className="inline-block text-[10px] uppercase tracking-wider font-bold text-vault-gold bg-vault-gold/10 border border-vault-gold/30 rounded-full px-2 py-0.5 mb-3">
              {t('premium.soon')}
            </span>
            <p className="font-display text-4xl font-bold text-vault-gold">{t('premium.priceSoon')}</p>
          </div>
          {/* Benefits */}
          <div className="p-8">
            <h3 className="text-sm font-medium text-vault-text mb-4">{t('premium.benefitsTitle')}</h3>
            <ul className="space-y-3">
              {benefits.map((b, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-vault-text">
                  <Check size={16} className="text-vault-accent shrink-0 mt-0.5" /> {b}
                </li>
              ))}
            </ul>
            <button
              onClick={() => setNotice(true)}
              className="btn-primary w-full mt-6 flex items-center justify-center gap-2"
            >
              <Crown size={16} /> {t('premium.subscribe')}
            </button>
            {notice && <p className="text-xs text-vault-gold/90 text-center mt-3">{t('premium.soonNote')}</p>}
          </div>
        </div>
      )}
    </div>
  )
}

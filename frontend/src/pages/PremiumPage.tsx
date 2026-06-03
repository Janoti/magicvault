import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Crown, Check, Sparkles, ExternalLink, ShieldCheck, Lock } from 'lucide-react'
import { billingApi, authApi } from '@/lib/api'
import { useAuthStore } from '@/store/auth'

export default function PremiumPage() {
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)
  const isPremium = !!(user?.is_premium || user?.is_admin)
  const isBeta = !!user?.is_beta
  const [params, setParams] = useSearchParams()
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState(false)

  const { data: price } = useQuery({ queryKey: ['billing-price'], queryFn: billingApi.price })

  // After returning from Stripe checkout, refresh the user to reflect premium.
  useEffect(() => {
    if (params.get('success')) {
      authApi.me().then(setUser).catch(() => {})
      setParams({}, { replace: true })
    }
  }, [])

  const benefits = [t('premium.b1'), t('premium.b2'), t('premium.b3'), t('premium.b4'), t('premium.b5')]

  const subscribe = async () => {
    if (!price?.configured) { setNotice(true); return }
    setBusy(true)
    try {
      const { url } = await billingApi.checkout()
      window.location.href = url
    } catch { setBusy(false) }
  }

  const manage = async () => {
    setBusy(true)
    try {
      const { url } = await billingApi.portal()
      window.location.href = url
    } catch { setBusy(false) }
  }

  const priceLabel = price?.configured
    ? `${price.currency === 'brl' ? 'R$' : '$'} ${price.amount.toFixed(2).replace('.', ',')}${t('premium.perMonth')}`
    : t('premium.priceSoon')

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
          {isBeta && (
            <p className="mt-3 inline-block text-[11px] font-medium text-vault-gold bg-vault-gold/10 border border-vault-gold/30 rounded-full px-3 py-1">
              {t('premium.betaMember')}
            </p>
          )}
          <ul className="mt-5 space-y-2 text-left max-w-sm mx-auto">
            {benefits.map((b, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-vault-text">
                <Check size={16} className="text-vault-gold shrink-0 mt-0.5" /> {b}
              </li>
            ))}
          </ul>
          {user?.is_premium && !isBeta && price?.configured && (
            <button onClick={manage} disabled={busy} className="btn-ghost mt-6 inline-flex items-center gap-2 disabled:opacity-50">
              <ExternalLink size={15} /> {t('premium.manage')}
            </button>
          )}
        </div>
      ) : (
        <div className="surface overflow-hidden">
          <div className="p-8 text-center border-b border-vault-border bg-gradient-to-br from-vault-accent/10 to-transparent">
            {!price?.configured && (
              <span className="inline-block text-[10px] uppercase tracking-wider font-bold text-vault-gold bg-vault-gold/10 border border-vault-gold/30 rounded-full px-2 py-0.5 mb-3">
                {t('premium.soon')}
              </span>
            )}
            <p className="font-display text-4xl font-bold text-vault-gold">{priceLabel}</p>
          </div>
          <div className="p-8">
            <h3 className="text-sm font-medium text-vault-text mb-4">{t('premium.benefitsTitle')}</h3>
            <ul className="space-y-3">
              {benefits.map((b, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-vault-text">
                  <Check size={16} className="text-vault-accent shrink-0 mt-0.5" /> {b}
                </li>
              ))}
            </ul>
            <button onClick={subscribe} disabled={busy} className="btn-primary w-full mt-6 flex items-center justify-center gap-2 disabled:opacity-50">
              {busy ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Crown size={16} />}
              {t('premium.subscribe')}
            </button>
            {notice && <p className="text-xs text-vault-gold/90 text-center mt-3">{t('premium.soonNote')}</p>}

            {price?.configured && (
              <>
                <p className="text-[11px] text-vault-muted text-center mt-3 flex items-center justify-center gap-1.5">
                  <Lock size={11} /> {t('premium.redirectNote')}
                </p>
                <div className="mt-4 rounded-xl border border-vault-border bg-vault-card/40 p-4">
                  <p className="text-xs font-medium text-vault-text flex items-center gap-2 mb-2">
                    <ShieldCheck size={14} className="text-green-400" /> {t('premium.secureTitle')}
                  </p>
                  <ul className="space-y-1.5">
                    {[t('premium.secure1'), t('premium.secure2'), t('premium.secure3')].map((s, i) => (
                      <li key={i} className="text-[11px] text-vault-muted flex items-start gap-1.5">
                        <Check size={12} className="text-green-400 shrink-0 mt-0.5" /> {s}
                      </li>
                    ))}
                  </ul>
                  <p className="text-[10px] text-vault-muted/70 text-center mt-3">Powered by Stripe</p>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

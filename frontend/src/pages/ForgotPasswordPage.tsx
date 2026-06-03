import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { MailCheck, ArrowLeft } from 'lucide-react'
import AuthLayout from '@/components/auth/AuthLayout'
import { authApi } from '@/lib/api'

export default function ForgotPasswordPage() {
  const { t } = useTranslation()
  const [identifier, setIdentifier] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await authApi.forgotPassword(identifier)
      setSent(true)
    } catch {
      setSent(true) // don't reveal whether the email exists
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout>
      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="font-display text-4xl font-black text-vault-gold tracking-wider">📖 VaultSpell</h1>
          <p className="text-vault-muted mt-2 text-sm">{t('auth.forgotSubtitle')}</p>
        </div>

        <div className="surface p-7 shadow-2xl">
          <h2 className="font-display text-xl font-bold text-vault-text mb-5">{t('auth.forgotTitle')}</h2>

          {sent ? (
            <div className="text-center py-4">
              <MailCheck size={40} className="mx-auto text-green-400 mb-3" />
              <p className="text-sm text-vault-text">{t('auth.forgotSent')}</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs text-vault-muted mb-1.5 block font-medium">{t('auth.forgotIdentifier')}</label>
                <input type="text" className="input-field" placeholder="seu@email.com / username"
                  value={identifier} onChange={e => setIdentifier(e.target.value)} required />
              </div>
              <button type="submit" disabled={loading}
                className="btn-primary w-full py-2.5 flex items-center justify-center gap-2 disabled:opacity-60">
                {loading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : t('auth.forgotButton')}
              </button>
            </form>
          )}

          <p className="text-center text-sm text-vault-muted mt-5">
            <Link to="/login" className="text-vault-accent hover:underline inline-flex items-center gap-1">
              <ArrowLeft size={13} /> {t('auth.backToLogin')}
            </Link>
          </p>
        </div>
      </motion.div>
    </AuthLayout>
  )
}

import { useState } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { CheckCircle2 } from 'lucide-react'
import AuthLayout from '@/components/auth/AuthLayout'
import { authApi } from '@/lib/api'

export default function ResetPasswordPage() {
  const { t } = useTranslation()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const token = params.get('token') || ''
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await authApi.resetPassword(token, password)
      setDone(true)
      setTimeout(() => navigate('/login'), 2000)
    } catch (err: any) {
      setError(err?.response?.data?.detail || t('auth.resetInvalid'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout>
      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="font-display text-4xl font-black text-vault-gold tracking-wider">⚔ MagicVault</h1>
          <p className="text-vault-muted mt-2 text-sm">{t('auth.resetSubtitle')}</p>
        </div>

        <div className="surface p-7 shadow-2xl">
          <h2 className="font-display text-xl font-bold text-vault-text mb-5">{t('auth.resetTitle')}</h2>

          {!token ? (
            <p className="text-sm text-red-400 text-center py-4">{t('auth.resetInvalid')}</p>
          ) : done ? (
            <div className="text-center py-4">
              <CheckCircle2 size={40} className="mx-auto text-green-400 mb-3" />
              <p className="text-sm text-vault-text">{t('auth.resetSuccess')}</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="bg-red-900/30 border border-red-500/30 text-red-400 text-sm px-4 py-3 rounded-lg">{error}</div>
              )}
              <div>
                <label className="text-xs text-vault-muted mb-1.5 block font-medium">{t('auth.newPassword')}</label>
                <input type="password" className="input-field" placeholder="••••••••"
                  value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
              </div>
              <button type="submit" disabled={loading}
                className="btn-primary w-full py-2.5 flex items-center justify-center gap-2 disabled:opacity-60">
                {loading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : t('auth.resetButton')}
              </button>
            </form>
          )}

          <p className="text-center text-sm text-vault-muted mt-5">
            <Link to="/login" className="text-vault-accent hover:underline">{t('auth.backToLogin')}</Link>
          </p>
        </div>
      </motion.div>
    </AuthLayout>
  )
}

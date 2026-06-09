import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { GoogleLogin } from '@react-oauth/google'
import { useAuthStore } from '@/store/auth'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import AuthLayout from '@/components/auth/AuthLayout'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const { login, loginWithGoogle, isLoading } = useAuthStore()
  const { t } = useTranslation()
  const navigate = useNavigate()

  const handleGoogleSuccess = async (credentialResponse: { credential?: string }) => {
    if (!credentialResponse.credential) return
    setError('')
    try {
      await loginWithGoogle(credentialResponse.credential)
      navigate('/collection')
    } catch (err: any) {
      setError(err.response?.data?.detail || t('auth.loginError'))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      await login(email, password)
      navigate('/collection')
    } catch (err: any) {
      setError(err.response?.data?.detail || t('auth.loginError'))
    }
  }

  return (
    <AuthLayout>
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        <div className="text-center mb-8">
          <h1 className="font-display text-4xl font-black text-vault-gold tracking-wider">📖 VaultSpell</h1>
          <p className="text-vault-muted mt-2 text-sm">{t('auth.loginSubtitle')}</p>
        </div>

        <div className="surface p-7 shadow-2xl">
          <h2 className="font-display text-xl font-bold text-vault-text mb-5">{t('auth.loginTitle')}</h2>

          {error && (
            <div className="bg-red-900/30 border border-red-500/30 text-red-400 text-sm px-4 py-3 rounded-lg mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs text-vault-muted mb-1.5 block font-medium">{t('auth.forgotIdentifier')}</label>
              <input
                type="text"
                className="input-field"
                placeholder="seu@email.com / username"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="text-xs text-vault-muted mb-1.5 block font-medium">{t('auth.password')}</label>
              <input
                type="password"
                className="input-field"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full py-2.5 flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : t('auth.loginButton')}
            </button>
          </form>

          <div className="text-center mt-4">
            <Link to="/forgot-password" className="text-xs text-vault-muted hover:text-vault-accent hover:underline">
              {t('auth.forgotPassword')}
            </Link>
          </div>

          {import.meta.env.VITE_GOOGLE_CLIENT_ID && (
            <div className="mt-4">
              <div className="flex items-center gap-2 my-3">
                <div className="flex-1 h-px bg-vault-border/60" />
                <span className="text-xs text-vault-muted">ou</span>
                <div className="flex-1 h-px bg-vault-border/60" />
              </div>
              <div className="flex justify-center">
                <GoogleLogin onSuccess={handleGoogleSuccess} onError={() => {}} useOneTap={false} />
              </div>
            </div>
          )}

          <p className="text-center text-sm text-vault-muted mt-3">
            {t('auth.noAccount')}{' '}
            <Link to="/register" className="text-vault-accent hover:underline">
              {t('auth.signUp')}
            </Link>
          </p>
        </div>
      </motion.div>
    </AuthLayout>
  )
}

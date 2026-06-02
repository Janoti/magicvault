import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuthStore } from '@/store/auth'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import LanguageSwitcher from '@/components/layout/LanguageSwitcher'

export default function RegisterPage() {
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const { register, isLoading } = useAuthStore()
  const { t } = useTranslation()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      await register(email, username, password)
      navigate('/collection')
    } catch (err: any) {
      setError(err.response?.data?.detail || t('auth.registerError'))
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-vault-bg p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-vault-accent/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-vault-gold/5 rounded-full blur-3xl" />
      </div>

      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm relative z-10">
        <div className="flex justify-center mb-2"><LanguageSwitcher /></div>
        <div className="text-center mb-8">
          <h1 className="font-display text-4xl font-black text-vault-gold tracking-wider">⚔ MagicVault</h1>
          <p className="text-vault-muted mt-2 text-sm">{t('auth.registerSubtitle')}</p>
        </div>

        <div className="surface p-7 shadow-2xl">
          <h2 className="font-display text-xl font-bold text-vault-text mb-5">{t('auth.registerTitle')}</h2>

          {error && (
            <div className="bg-red-900/30 border border-red-500/30 text-red-400 text-sm px-4 py-3 rounded-lg mb-4">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs text-vault-muted mb-1.5 block">{t('auth.email')}</label>
              <input type="email" className="input-field" placeholder="seu@email.com" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div>
              <label className="text-xs text-vault-muted mb-1.5 block">{t('auth.username')}</label>
              <input className="input-field" placeholder="jogador123" value={username} onChange={e => setUsername(e.target.value)} required />
            </div>
            <div>
              <label className="text-xs text-vault-muted mb-1.5 block">{t('auth.password')}</label>
              <input type="password" className="input-field" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
            </div>
            <button type="submit" disabled={isLoading} className="btn-primary w-full py-2.5 flex items-center justify-center gap-2 disabled:opacity-60">
              {isLoading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : t('auth.registerButton')}
            </button>
          </form>

          <p className="text-center text-sm text-vault-muted mt-5">
            {t('auth.haveAccount')}{' '}
            <Link to="/login" className="text-vault-accent hover:underline">{t('auth.signIn')}</Link>
          </p>
        </div>
      </motion.div>
    </div>
  )
}

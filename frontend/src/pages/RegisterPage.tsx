import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { GoogleLogin } from '@react-oauth/google'
import { useAuthStore } from '@/store/auth'
import { lookupCep } from '@/lib/api'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import AuthLayout from '@/components/auth/AuthLayout'

export default function RegisterPage() {
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [country, setCountry] = useState('')
  const [stateProv, setStateProv] = useState('')
  const [city, setCity] = useState('')
  const [cep, setCep] = useState('')
  const [cepLoading, setCepLoading] = useState(false)
  const [locationPublic, setLocationPublic] = useState(false)
  const [error, setError] = useState('')
  const { register, loginWithGoogle, isLoading } = useAuthStore()
  const { t } = useTranslation()
  const navigate = useNavigate()

  const handleGoogleSuccess = async (credentialResponse: { credential?: string }) => {
    if (!credentialResponse.credential) return
    setError('')
    try {
      await loginWithGoogle(credentialResponse.credential)
      navigate('/collection')
    } catch (err: any) {
      setError(err.response?.data?.detail || t('auth.registerError'))
    }
  }

  const tryCep = async (value: string) => {
    setCep(value)
    if (value.replace(/\D/g, '').length !== 8) return
    setCepLoading(true)
    const r = await lookupCep(value)
    if (r) { setStateProv(r.state); setCity(r.city); if (!country) setCountry('Brasil') }
    setCepLoading(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password !== confirmPassword) {
      setError(t('auth.passwordMismatch'))
      return
    }
    try {
      await register(email, username, password, { country, state: stateProv, city, location_public: locationPublic })
      navigate('/collection')
    } catch (err: any) {
      setError(err.response?.data?.detail || t('auth.registerError'))
    }
  }

  return (
    <AuthLayout>
      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="font-display text-4xl font-black text-vault-gold tracking-wider">📖 VaultSpell</h1>
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
              <p className="text-[11px] text-vault-gold/80 mt-1.5">⚠ {t('auth.emailHint')}</p>
            </div>
            <div>
              <label className="text-xs text-vault-muted mb-1.5 block">{t('auth.username')}</label>
              <input className="input-field" placeholder="jogador123" value={username} onChange={e => setUsername(e.target.value)} required />
              <p className="text-[11px] text-vault-muted mt-1.5">{t('auth.usernameHint')}</p>
            </div>
            <div>
              <label className="text-xs text-vault-muted mb-1.5 block">{t('auth.password')}</label>
              <input type="password" className="input-field" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
            </div>
            <div>
              <label className="text-xs text-vault-muted mb-1.5 block">{t('auth.confirmPassword')}</label>
              <input type="password" className="input-field" placeholder="••••••••" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required minLength={6} />
              {confirmPassword && password !== confirmPassword && (
                <p className="text-[11px] text-red-400 mt-1.5">{t('auth.passwordMismatch')}</p>
              )}
            </div>

            {/* Optional location */}
            <div className="border-t border-vault-border/60 pt-4">
              <p className="text-xs text-vault-muted mb-2">{t('auth.locationOptional')}</p>
              <div className="grid grid-cols-3 gap-2">
                <div className="relative">
                  <input className="input-field" placeholder={t('account.cep')} value={cep} onChange={e => tryCep(e.target.value)} />
                  {cepLoading && <div className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-vault-accent border-t-transparent rounded-full animate-spin" />}
                </div>
                <input className="input-field" placeholder={t('account.state')} value={stateProv} onChange={e => setStateProv(e.target.value)} />
                <input className="input-field" placeholder={t('account.city')} value={city} onChange={e => setCity(e.target.value)} />
              </div>
              <input className="input-field mt-2" placeholder={t('account.country')} value={country} onChange={e => setCountry(e.target.value)} />
              <label className="flex items-center gap-2 mt-2 text-[11px] text-vault-text cursor-pointer">
                <input type="checkbox" checked={locationPublic} onChange={e => setLocationPublic(e.target.checked)} />
                {t('account.locationPublic')}
              </label>
            </div>

            <button type="submit" disabled={isLoading || (!!confirmPassword && password !== confirmPassword)} className="btn-primary w-full py-2.5 flex items-center justify-center gap-2 disabled:opacity-60">
              {isLoading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : t('auth.registerButton')}
            </button>
          </form>

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

          <p className="text-center text-sm text-vault-muted mt-5">
            {t('auth.haveAccount')}{' '}
            <Link to="/login" className="text-vault-accent hover:underline">{t('auth.signIn')}</Link>
          </p>
        </div>
      </motion.div>
    </AuthLayout>
  )
}

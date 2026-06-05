import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { MailCheck, MailWarning } from 'lucide-react'
import { authApi } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import AuthLayout from '@/components/auth/AuthLayout'

export default function VerifyEmailPage() {
  const { t } = useTranslation()
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const setUser = useAuthStore((s) => s.setUser)
  const isAuthed = useAuthStore((s) => !!s.token)
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading')

  useEffect(() => {
    let alive = true
    ;(async () => {
      if (!token) { setStatus('error'); return }
      try {
        await authApi.verifyEmail(token)
        if (!alive) return
        setStatus('ok')
        // Refresh the cached user so the banner clears immediately.
        if (isAuthed) { try { setUser(await authApi.me()) } catch { /* ignore */ } }
      } catch {
        if (alive) setStatus('error')
      }
    })()
    return () => { alive = false }
  }, [token])

  return (
    <AuthLayout>
      <div className="w-full max-w-sm text-center">
        <h1 className="font-display text-4xl font-black text-vault-gold tracking-wider mb-6">📖 VaultSpell</h1>
        <div className="surface p-8 shadow-2xl">
          {status === 'loading' ? (
            <div className="flex justify-center py-6"><div className="w-7 h-7 border-2 border-vault-accent border-t-transparent rounded-full animate-spin" /></div>
          ) : status === 'ok' ? (
            <>
              <MailCheck size={40} className="text-green-400 mx-auto mb-3" />
              <h2 className="font-display text-xl font-bold text-vault-text mb-1">{t('verifyEmail.okTitle')}</h2>
              <p className="text-sm text-vault-muted">{t('verifyEmail.okText')}</p>
            </>
          ) : (
            <>
              <MailWarning size={40} className="text-amber-400 mx-auto mb-3" />
              <h2 className="font-display text-xl font-bold text-vault-text mb-1">{t('verifyEmail.errorTitle')}</h2>
              <p className="text-sm text-vault-muted">{t('verifyEmail.errorText')}</p>
            </>
          )}
          <Link to={isAuthed ? '/collection' : '/login'} className="btn-primary inline-block mt-5">{t('verifyEmail.cta')}</Link>
        </div>
      </div>
    </AuthLayout>
  )
}

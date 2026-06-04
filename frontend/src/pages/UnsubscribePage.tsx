import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { MailX, CheckCircle2, Undo2 } from 'lucide-react'
import AuthLayout from '@/components/auth/AuthLayout'
import { authApi } from '@/lib/api'

type State = 'loading' | 'done' | 'resubscribed' | 'error'

export default function UnsubscribePage() {
  const { t } = useTranslation()
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const [state, setState] = useState<State>('loading')
  const [email, setEmail] = useState('')

  useEffect(() => {
    if (!token) { setState('error'); return }
    authApi.unsubscribe(token)
      .then((r) => { setEmail(r?.email || ''); setState('done') })
      .catch(() => setState('error'))
  }, [token])

  const resubscribe = async () => {
    try {
      const r = await authApi.resubscribe(token)
      setEmail(r?.email || '')
      setState('resubscribed')
    } catch { setState('error') }
  }

  return (
    <AuthLayout>
      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="font-display text-4xl font-black text-vault-gold tracking-wider">📖 VaultSpell</h1>
        </div>

        <div className="surface p-7 shadow-2xl text-center">
          {state === 'loading' && (
            <div className="py-6"><div className="w-6 h-6 border-2 border-vault-accent border-t-transparent rounded-full animate-spin mx-auto" /></div>
          )}

          {state === 'error' && (
            <>
              <MailX size={40} className="mx-auto text-red-400 mb-3" />
              <p className="text-sm text-vault-text">{t('unsubscribe.invalid')}</p>
            </>
          )}

          {state === 'done' && (
            <>
              <CheckCircle2 size={40} className="mx-auto text-green-400 mb-3" />
              <h2 className="font-display text-xl font-bold text-vault-text mb-2">{t('unsubscribe.doneTitle')}</h2>
              <p className="text-sm text-vault-muted mb-5">{t('unsubscribe.doneBody', { email })}</p>
              <button onClick={resubscribe} className="btn-ghost w-full flex items-center justify-center gap-2">
                <Undo2 size={15} /> {t('unsubscribe.resubscribe')}
              </button>
            </>
          )}

          {state === 'resubscribed' && (
            <>
              <CheckCircle2 size={40} className="mx-auto text-vault-accent mb-3" />
              <h2 className="font-display text-xl font-bold text-vault-text mb-2">{t('unsubscribe.resubTitle')}</h2>
              <p className="text-sm text-vault-muted">{t('unsubscribe.resubBody', { email })}</p>
            </>
          )}

          <p className="text-center text-sm text-vault-muted mt-6">
            <Link to="/" className="text-vault-accent hover:underline">{t('unsubscribe.backHome')}</Link>
          </p>
        </div>
      </motion.div>
    </AuthLayout>
  )
}

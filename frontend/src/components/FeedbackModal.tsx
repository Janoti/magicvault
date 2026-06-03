import { useState } from 'react'
import { X, Bug, Lightbulb, Mail, Send, CheckCircle2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { feedbackApi } from '@/lib/api'
import { useAuthStore } from '@/store/auth'

const TYPES = [
  { value: 'bug', icon: Bug, key: 'feedback.bug' },
  { value: 'suggestion', icon: Lightbulb, key: 'feedback.suggestion' },
  { value: 'contact', icon: Mail, key: 'feedback.contact' },
]

export default function FeedbackModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const isAuth = useAuthStore((s) => s.isAuthenticated())
  const [type, setType] = useState('bug')
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState('')
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    if (!message.trim()) return
    setLoading(true)
    try {
      await feedbackApi.submit({ type, message, email: email || undefined, page: window.location.pathname })
      setDone(true)
    } catch {}
    setLoading(false)
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
        <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }}
          className="relative z-10 bg-vault-surface border border-vault-border rounded-2xl p-6 w-full max-w-md shadow-2xl">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="font-display font-bold text-vault-gold">{t('feedback.title')}</h3>
              <p className="text-xs text-vault-muted">{t('feedback.subtitle')}</p>
            </div>
            <button onClick={onClose} className="text-vault-muted hover:text-vault-text"><X size={18} /></button>
          </div>

          {done ? (
            <div className="text-center py-6">
              <CheckCircle2 size={40} className="mx-auto text-green-400 mb-3" />
              <p className="text-sm text-vault-text">{t('feedback.sent')}</p>
              <button onClick={onClose} className="btn-primary mt-4">OK</button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2">
                {TYPES.map(ty => (
                  <button key={ty.value} onClick={() => setType(ty.value)}
                    className={`flex flex-col items-center gap-1 py-3 rounded-lg border text-xs transition-all ${
                      type === ty.value ? 'border-vault-accent bg-vault-accent/10 text-vault-accent' : 'border-vault-border text-vault-muted hover:border-vault-accent/40'
                    }`}>
                    <ty.icon size={16} />
                    {t(ty.key)}
                  </button>
                ))}
              </div>
              <div>
                <label className="text-xs text-vault-muted mb-1.5 block font-medium">{t('feedback.message')}</label>
                <textarea className="input-field resize-none" rows={4} placeholder={t('feedback.messagePh')} value={message} onChange={e => setMessage(e.target.value)} />
              </div>
              {!isAuth && (
                <div>
                  <label className="text-xs text-vault-muted mb-1.5 block font-medium">{t('feedback.email')}</label>
                  <input type="email" className="input-field" placeholder="seu@email.com" value={email} onChange={e => setEmail(e.target.value)} />
                </div>
              )}
              <button onClick={submit} disabled={loading || !message.trim()} className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50">
                {loading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Send size={15} />}
                {t('feedback.send')}
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  )
}

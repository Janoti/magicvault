import { type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import LanguageSwitcher from '@/components/layout/LanguageSwitcher'
import Layout from '@/components/layout/Layout'
import { useAuthStore } from '@/store/auth'

/** Shell for pages that are both public and in-app. Logged-in users get the
 *  normal app Layout (sidebar); anonymous visitors get a marketing top bar. */
export default function PublicPage({ children, nav = [] }: { children: ReactNode; nav?: { to: string; label: string }[] }) {
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.user)

  if (user) return <Layout>{children}</Layout>

  return (
    <div className="min-h-screen bg-vault-bg text-vault-text">
      <header className="border-b border-vault-border/60 backdrop-blur sticky top-0 z-20 bg-vault-bg/80">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="font-display text-xl font-bold text-vault-gold tracking-wider">📖 VaultSpell</Link>
          <div className="flex items-center gap-3">
            {nav.map((n) => (
              <Link key={n.to} to={n.to} className="hidden sm:inline text-sm text-vault-muted hover:text-vault-text">{n.label}</Link>
            ))}
            <LanguageSwitcher compact direction="down" />
            <Link to="/login" className="text-sm text-vault-muted hover:text-vault-text">{t('common.login')}</Link>
            <Link to="/register" className="btn-primary text-sm">{t('common.register')}</Link>
          </div>
        </div>
      </header>
      {children}
    </div>
  )
}

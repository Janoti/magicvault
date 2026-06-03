import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Library, Swords, BookOpen, ExternalLink } from 'lucide-react'
import { usersApi } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import Avatar from '@/components/Avatar'

// Only allow http(s) links (blocks javascript:/data: XSS in user-supplied URLs).
const safeUrl = (u: string) => {
  const v = (u || '').trim()
  if (/^https?:\/\//i.test(v)) return v
  if (/^(javascript|data|vbscript|file):/i.test(v)) return '#'
  return v ? `https://${v}` : '#'
}

export default function ProfilePage() {
  const { username = '' } = useParams()
  const { t } = useTranslation()
  const isAuth = useAuthStore((s) => s.isAuthenticated())

  const { data, isLoading, isError } = useQuery({
    queryKey: ['profile', username],
    queryFn: () => usersApi.profile(username),
    enabled: !!username,
    retry: false,
  })

  const body = (
    <div className="max-w-2xl mx-auto p-6">
      {isLoading ? (
        <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-vault-accent border-t-transparent rounded-full animate-spin" /></div>
      ) : isError || !data ? (
        <div className="text-center py-20">
          <p className="text-4xl mb-3">👤</p>
          <p className="text-vault-muted">404</p>
        </div>
      ) : (
        <>
          <div className="surface p-6 mb-4 flex items-center gap-4">
            <Avatar value={data.avatar} size={80} />
            <div className="min-w-0">
              <h1 className="font-display text-2xl font-bold text-vault-gold truncate">{data.display_name || data.username}</h1>
              <p className="text-sm text-vault-muted">@{data.username}</p>
              {data.member_since && (
                <p className="text-xs text-vault-muted mt-1">{t('account.memberSince')} {new Date(data.member_since).toLocaleDateString()}</p>
              )}
            </div>
          </div>

          {data.bio && <div className="surface p-5 mb-4"><p className="text-sm text-vault-text whitespace-pre-wrap">{data.bio}</p></div>}

          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="surface p-4 text-center">
              <Library size={18} className="mx-auto text-vault-accent mb-1" />
              <p className="text-xl font-display font-bold text-vault-gold">{data.stats?.cards ?? 0}</p>
              <p className="text-xs text-vault-muted">{t('nav.collection')}</p>
            </div>
            <div className="surface p-4 text-center">
              <Swords size={18} className="mx-auto text-vault-accent mb-1" />
              <p className="text-xl font-display font-bold text-vault-gold">{data.stats?.decks ?? 0}</p>
              <p className="text-xs text-vault-muted">{t('nav.decks')}</p>
            </div>
            <div className="surface p-4 text-center">
              <BookOpen size={18} className="mx-auto text-vault-accent mb-1" />
              <p className="text-xl font-display font-bold text-vault-gold">{data.stats?.binders ?? 0}</p>
              <p className="text-xs text-vault-muted">{t('nav.binders')}</p>
            </div>
          </div>

          {data.links?.length > 0 && (
            <div className="surface p-5 space-y-2">
              {data.links.map((l: any, i: number) => (
                <a key={i} href={safeUrl(l.url)} target="_blank" rel="noreferrer"
                  className="flex items-center justify-between p-2.5 rounded-lg border border-vault-border hover:border-vault-accent/40 text-sm text-vault-text transition-all">
                  {l.label}
                  <ExternalLink size={14} className="text-vault-muted" />
                </a>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )

  // Logged-in users see it inside the app layout; logged-out get a minimal shell.
  if (isAuth) return body
  return (
    <div className="min-h-screen bg-vault-bg">
      <header className="border-b border-vault-border bg-vault-surface px-6 py-3 flex items-center justify-between">
        <Link to="/" className="font-display text-lg font-bold text-vault-gold tracking-wider">📖 VaultSpell</Link>
        <Link to="/register" className="btn-primary text-sm">{t('common.register')}</Link>
      </header>
      {body}
    </div>
  )
}

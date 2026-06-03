import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { sharesApi } from '@/lib/api'
import SharedResourceView from '@/components/sharing/SharedResourceView'

export default function PublicViewPage() {
  const { t } = useTranslation()
  const { token = '' } = useParams()
  const { data, isLoading, isError } = useQuery({
    queryKey: ['public-share', token],
    queryFn: () => sharesApi.viewPublic(token),
    enabled: !!token,
    retry: false,
  })

  return (
    <div className="min-h-screen bg-vault-bg">
      <header className="border-b border-vault-border bg-vault-surface px-6 py-3 flex items-center justify-between">
        <Link to="/" className="font-display text-lg font-bold text-vault-gold tracking-wider">📖 VaultSpell</Link>
        <Link to="/register" className="btn-primary text-sm">{t('common.register')}</Link>
      </header>

      <main className="p-6 max-w-7xl mx-auto">
        {isLoading ? (
          <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-vault-accent border-t-transparent rounded-full animate-spin" /></div>
        ) : isError || !data ? (
          <div className="text-center py-20">
            <p className="text-4xl mb-3">🔗</p>
            <p className="text-vault-muted">{t('shared.invalidLink')}</p>
            <Link to="/" className="btn-primary inline-block mt-4">{t('shared.goToApp')}</Link>
          </div>
        ) : (
          <SharedResourceView data={data} />
        )}
      </main>
    </div>
  )
}

import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { decksApi, collectionApi } from '@/lib/api'
import SharedResourceView from '@/components/sharing/SharedResourceView'
import PublicPage from '@/components/PublicPage'

// Renders a public deck (/d/:id) or a public collection (/c/:username).
export default function PublicEntityPage({ kind }: { kind: 'deck' | 'collection' }) {
  const { t } = useTranslation()
  const { id, username } = useParams()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['public-entity', kind, id, username],
    queryFn: () => (kind === 'deck' ? decksApi.publicView(Number(id)) : collectionApi.publicView(username as string)),
    retry: false,
  })

  return (
    <PublicPage>
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
    </PublicPage>
  )
}

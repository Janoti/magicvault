import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Swords, ExternalLink, Folder } from 'lucide-react'
import PublicPage from '@/components/PublicPage'
import { useSeo } from '@/components/Seo'
import { decksApi } from '@/lib/api'

export default function PublicFolderPage() {
  const { t } = useTranslation()
  const { token } = useParams()
  const { data, isLoading, isError } = useQuery({ queryKey: ['public-folder', token], queryFn: () => decksApi.publicFolder(token as string) })
  useSeo({ title: data ? `${data.name} — VaultSpell` : 'VaultSpell', description: t('pages.folderShareDesc') })

  return (
    <PublicPage>
      <div className="max-w-3xl mx-auto px-6 pt-12 pb-20">
        {isLoading ? (
          <div className="py-16 text-center"><div className="w-7 h-7 border-2 border-vault-accent border-t-transparent rounded-full animate-spin mx-auto" /></div>
        ) : isError || !data ? (
          <p className="surface p-10 text-center text-vault-muted">{t('pages.folderNotFound')}</p>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-1">
              <Folder size={26} style={{ color: data.color }} />
              <h1 className="font-display text-3xl font-bold text-vault-gold">{data.name}</h1>
            </div>
            <p className="text-vault-muted text-sm mb-6">{t('pages.folderShareDesc')}</p>
            {data.decks.length === 0 ? (
              <p className="surface p-10 text-center text-vault-muted">{t('pages.folderNoPublic')}</p>
            ) : (
              <div className="grid sm:grid-cols-2 gap-3">
                {data.decks.map((d: any) => (
                  <Link key={d.id} to={`/d/${d.id}`}
                    className="flex items-center gap-3 surface p-4 hover:border-vault-accent/40 transition-all">
                    <span className="w-10 h-10 rounded-xl bg-vault-gold/15 border border-vault-gold/30 flex items-center justify-center">
                      <Swords size={18} className="text-vault-gold" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-vault-text truncate">{d.name}</p>
                      <p className="text-xs text-vault-muted">{d.format} · {t('common.cardsCount', { count: d.card_count })}</p>
                    </div>
                    <ExternalLink size={15} className="text-vault-muted" />
                  </Link>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </PublicPage>
  )
}

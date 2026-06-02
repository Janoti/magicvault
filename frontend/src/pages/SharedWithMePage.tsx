import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { sharesApi } from '@/lib/api'
import SharedResourceView from '@/components/sharing/SharedResourceView'
import { Share2, ArrowLeft, Library, BookOpen, Swords } from 'lucide-react'

const ICON: Record<string, any> = { collection: Library, binder: BookOpen, deck: Swords }

export default function SharedWithMePage() {
  const [openId, setOpenId] = useState<number | null>(null)

  const { data: shares = [], isLoading } = useQuery({ queryKey: ['shared-with-me'], queryFn: sharesApi.withMe })
  const { data: view, isLoading: loadingView } = useQuery({
    queryKey: ['shared-view', openId],
    queryFn: () => sharesApi.viewWithMe(openId as number),
    enabled: openId != null,
  })

  if (openId != null) {
    return (
      <div className="p-6">
        <button onClick={() => setOpenId(null)} className="inline-flex items-center gap-2 text-sm text-vault-muted hover:text-vault-text mb-4">
          <ArrowLeft size={16} /> Voltar
        </button>
        {loadingView ? (
          <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-vault-accent border-t-transparent rounded-full animate-spin" /></div>
        ) : (
          <SharedResourceView data={view} />
        )}
      </div>
    )
  }

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold text-vault-gold">Compartilhados comigo</h1>
        <p className="text-vault-muted text-sm mt-0.5">Coleções, binders e decks que seus amigos compartilharam</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-vault-accent border-t-transparent rounded-full animate-spin" /></div>
      ) : shares.length === 0 ? (
        <div className="text-center py-20 surface">
          <Share2 size={32} className="mx-auto text-vault-muted mb-3" />
          <p className="text-vault-muted">Nada compartilhado com você ainda.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {shares.map((s: any) => {
            const Icon = ICON[s.resource_type] || Share2
            return (
              <button key={s.id} onClick={() => setOpenId(s.id)}
                className="surface p-4 w-full flex items-center gap-3 text-left hover:border-vault-accent/40 transition-all">
                <Icon size={18} className="text-vault-accent" />
                <div className="flex-1">
                  <p className="text-sm text-vault-text font-medium">{s.label}</p>
                  <p className="text-xs text-vault-muted">de {s.owner?.username}</p>
                </div>
                <span className="text-[10px] uppercase tracking-wider text-vault-muted bg-vault-card px-2 py-0.5 rounded-full">{s.resource_type}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

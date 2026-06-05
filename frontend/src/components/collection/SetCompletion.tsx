import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ChevronDown } from 'lucide-react'
import { collectionApi } from '@/lib/api'

export default function SetCompletion() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const { data = [] } = useQuery({ queryKey: ['set-completion'], queryFn: collectionApi.setCompletion })
  if (data.length === 0) return null
  const shown = open ? data : data.slice(0, 6)

  return (
    <div className="surface p-4 mb-4">
      <h3 className="text-sm font-semibold text-vault-text mb-3">{t('col.setCompletion')}</h3>
      <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2.5">
        {shown.map((s: any) => (
          <div key={s.code}>
            <div className="flex justify-between text-xs mb-0.5 gap-2">
              <span className="text-vault-text truncate">{s.name}</span>
              <span className="text-vault-muted shrink-0">{s.owned}/{s.total || '?'} · {s.pct}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-vault-card overflow-hidden">
              <div className="h-full bg-vault-accent" style={{ width: `${Math.min(s.pct, 100)}%` }} />
            </div>
          </div>
        ))}
      </div>
      {data.length > 6 && (
        <button onClick={() => setOpen(o => !o)} className="mt-3 text-xs text-vault-accent hover:underline flex items-center gap-1">
          {open ? t('col.showLess') : t('col.showAllSets', { count: data.length })}
          <ChevronDown size={13} className={open ? 'rotate-180' : ''} />
        </button>
      )}
    </div>
  )
}

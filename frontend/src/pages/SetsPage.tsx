import { useQuery } from '@tanstack/react-query'
import { setsApi } from '@/lib/api'
import { Package, Search, ExternalLink } from 'lucide-react'
import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

const prettyType = (s: string) => (s || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

export default function SetsPage() {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [yearFilter, setYearFilter] = useState('')
  const navigate = useNavigate()
  const { t } = useTranslation()

  const { data: sets = [], isLoading } = useQuery({ queryKey: ['sets'], queryFn: setsApi.list })

  // Filter options come from the real data (covers tokens, alchemy, promos, etc.).
  const types = useMemo(() => [...new Set(sets.map((s: any) => s.set_type).filter(Boolean))].sort() as string[], [sets])
  const years = useMemo(() => ([...new Set(sets.map((s: any) => s.released_at?.slice(0, 4)).filter(Boolean))] as string[]).sort().reverse(), [sets])

  const filtered = sets.filter((s: any) =>
    (!search || s.name.toLowerCase().includes(search.toLowerCase()) || s.code.includes(search.toLowerCase())) &&
    (!typeFilter || s.set_type === typeFilter) &&
    (!yearFilter || s.released_at?.slice(0, 4) === yearFilter)
  )

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold text-vault-gold">{t('pages.setsTitle')}</h1>
        <p className="text-vault-muted text-sm mt-0.5">{t('pages.setsSubtitle')}</p>
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-vault-muted" />
          <input className="input-field pl-9" placeholder={t('pages.searchSet')} value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="input-field !w-auto" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="">{t('pages.allTypes')}</option>
          {types.map((ty) => <option key={ty} value={ty}>{prettyType(ty)}</option>)}
        </select>
        <select className="input-field !w-auto" value={yearFilter} onChange={e => setYearFilter(e.target.value)}>
          <option value="">{t('pages.allYears')}</option>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {!isLoading && (
        <p className="text-xs text-vault-muted mb-4">{t('pages.setsCount', { count: filtered.length })}</p>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-vault-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filtered.slice(0, 100).map((set: any, i: number) => (
            <motion.div key={set.code} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i * 0.01, 0.3) }}>
              <div className="surface p-4 hover:border-vault-accent/40 transition-all cursor-pointer"
                onClick={() => navigate(`/sets/${set.code}`)}>
                <div className="flex items-center gap-3">
                  {set.icon_svg_uri ? (
                    <img src={set.icon_svg_uri} alt={set.code} className="w-6 h-6 opacity-80" style={{ filter: 'invert(1) sepia(1) saturate(5) hue-rotate(200deg)' }} />
                  ) : (
                    <Package size={20} className="text-vault-muted" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-vault-text truncate">{set.name}</p>
                    <p className="text-xs text-vault-muted font-mono">{set.code?.toUpperCase()} • {set.released_at?.slice(0, 4)}</p>
                  </div>
                  <a
                    href={`https://scryfall.com/sets/${set.code}`}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-vault-muted hover:text-vault-accent transition-colors shrink-0"
                    title="Scryfall"
                  >
                    <ExternalLink size={14} />
                  </a>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[10px] uppercase tracking-wider text-vault-muted bg-vault-card px-2 py-0.5 rounded-full">
                    {prettyType(set.set_type)}
                  </span>
                  <span className="text-xs font-mono text-vault-accent">{t('pages.setCardCount', { count: set.card_count })}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
      {filtered.length > 100 && (
        <p className="text-center text-vault-muted text-sm mt-4">{t('pages.setsShowingLimit', { total: filtered.length })}</p>
      )}
    </div>
  )
}

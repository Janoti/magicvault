import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { decksApi } from '@/lib/api'

const COLOR_HEX: Record<string, string> = {
  W: '#e9e4c8', U: '#3b82f6', B: '#7c7c8a', R: '#ef4444', G: '#22c55e', C: '#9ca3af',
}
const CAT_META: Record<string, { icon: string }> = {
  ramp: { icon: '🌱' }, draw: { icon: '📜' }, removal: { icon: '🎯' },
  wipe: { icon: '💥' }, interaction: { icon: '🛡️' }, finisher: { icon: '🔥' },
}

export default function DeckAnalysis({ deckId }: { deckId: number }) {
  const { t } = useTranslation()
  const { data, isLoading } = useQuery({ queryKey: ['deck-analysis', deckId], queryFn: () => decksApi.analysis(deckId) })

  if (isLoading || !data) {
    return (
      <div className="flex justify-center py-8">
        <div className="w-6 h-6 border-2 border-vault-accent border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const maxCurve = Math.max(1, ...data.curve.map((c: any) => c.count))
  const totalPips = Math.max(1, Object.values(data.colors as Record<string, number>).reduce((a, b) => a + b, 0))
  const types = Object.entries(data.types as Record<string, number>).sort((a, b) => b[1] - a[1])
  const cats = ['ramp', 'draw', 'removal', 'wipe', 'interaction', 'finisher'].filter(k => data.categories[k] > 0)

  return (
    <div className="space-y-5">
      {/* Top stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-vault-border bg-vault-card/40 p-3 text-center">
          <p className="text-xl font-display font-bold text-vault-accent">{data.nonlands}</p>
          <p className="text-[11px] text-vault-muted">{t('analysis.spells')}</p>
        </div>
        <div className="rounded-xl border border-vault-border bg-vault-card/40 p-3 text-center">
          <p className="text-xl font-display font-bold text-green-400">{data.lands}</p>
          <p className="text-[11px] text-vault-muted">{t('analysis.lands')}</p>
        </div>
        <div className="rounded-xl border border-vault-border bg-vault-card/40 p-3 text-center">
          <p className="text-xl font-display font-bold text-vault-gold">{data.avg_cmc}</p>
          <p className="text-[11px] text-vault-muted">{t('analysis.avgCmc')}</p>
        </div>
      </div>

      {/* Mana curve */}
      <div>
        <p className="text-xs font-medium text-vault-muted mb-2">{t('analysis.curve')}</p>
        <div className="flex items-end gap-1.5 h-32">
          {data.curve.map((c: any) => (
            <div key={c.cmc} className="flex-1 flex flex-col items-center justify-end gap-1">
              <span className="text-[10px] text-vault-text font-mono">{c.count || ''}</span>
              <motion.div
                className="w-full rounded-t bg-gradient-to-t from-vault-accent to-vault-accent/50 min-h-[2px]"
                initial={{ height: 0 }} animate={{ height: `${(c.count / maxCurve) * 100}%` }} transition={{ duration: 0.5 }}
              />
              <span className="text-[10px] text-vault-muted font-mono">{c.cmc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Colors */}
      <div>
        <p className="text-xs font-medium text-vault-muted mb-2">{t('analysis.colors')}</p>
        <div className="flex h-3 rounded-full overflow-hidden border border-vault-border">
          {Object.entries(data.colors as Record<string, number>).filter(([, v]) => v > 0).map(([k, v]) => (
            <div key={k} style={{ width: `${(v / totalPips) * 100}%`, background: COLOR_HEX[k] }} title={`${k}: ${v}`} />
          ))}
        </div>
        <div className="flex flex-wrap gap-3 mt-2">
          {Object.entries(data.colors as Record<string, number>).filter(([, v]) => v > 0).map(([k, v]) => (
            <span key={k} className="flex items-center gap-1.5 text-xs text-vault-muted">
              <span className="w-3 h-3 rounded-full inline-block" style={{ background: COLOR_HEX[k] }} /> {k} {v}
            </span>
          ))}
        </div>
      </div>

      {/* Types + Categories */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <p className="text-xs font-medium text-vault-muted mb-2">{t('analysis.types')}</p>
          <div className="space-y-1">
            {types.map(([type, n]) => (
              <div key={type} className="flex items-center justify-between text-sm">
                <span className="text-vault-text">{t(`analysis.type_${type}`, type)}</span>
                <span className="font-mono text-vault-muted">{n}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs font-medium text-vault-muted mb-2">{t('analysis.roles')}</p>
          {cats.length === 0 ? (
            <p className="text-xs text-vault-muted">{t('analysis.noRoles')}</p>
          ) : (
            <div className="space-y-1">
              {cats.map(k => (
                <div key={k} className="flex items-center justify-between text-sm">
                  <span className="text-vault-text">{CAT_META[k].icon} {t(`analysis.cat_${k}`)}</span>
                  <span className="font-mono text-vault-muted">{data.categories[k]}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <p className="text-[10px] text-vault-muted/70">{t('analysis.disclaimer')}</p>
    </div>
  )
}

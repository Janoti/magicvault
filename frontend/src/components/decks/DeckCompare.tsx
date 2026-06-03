import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ArrowRight } from 'lucide-react'
import { decksApi } from '@/lib/api'

function Row({ label, a, b, lowerBetter }: { label: string; a: number; b: number; lowerBetter?: boolean }) {
  const aWins = lowerBetter ? a < b : a > b
  const bWins = lowerBetter ? b < a : b > a
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 py-1.5 text-sm">
      <span className={`text-right font-mono ${aWins ? 'text-vault-accent font-bold' : 'text-vault-text'}`}>{a}</span>
      <span className="text-[11px] text-vault-muted text-center w-28">{label}</span>
      <span className={`text-left font-mono ${bWins ? 'text-vault-gold font-bold' : 'text-vault-text'}`}>{b}</span>
    </div>
  )
}

export default function DeckCompare({ deckId }: { deckId: number }) {
  const { t } = useTranslation()
  const [otherId, setOtherId] = useState<number | null>(null)

  const { data: opts } = useQuery({ queryKey: ['compare-options'], queryFn: decksApi.compareOptions })
  const { data: mine } = useQuery({ queryKey: ['deck-analysis', deckId], queryFn: () => decksApi.analysis(deckId) })
  const { data: other } = useQuery({
    queryKey: ['deck-analysis', otherId],
    queryFn: () => decksApi.analysis(otherId as number),
    enabled: !!otherId,
  })

  const cat = (x: any, k: string) => x?.categories?.[k] || 0

  // Build natural-language verdicts comparing mine (a) vs other (b).
  const verdicts: { txt: string; good: boolean }[] = []
  if (mine && other) {
    const push = (cond: boolean, key: string, a: number, b: number) => {
      if (a === b) return
      verdicts.push({ txt: t(`compare.${key}`, { a, b }), good: cond })
    }
    push(mine.avg_cmc < other.avg_cmc, mine.avg_cmc < other.avg_cmc ? 'fasterYes' : 'fasterNo', mine.avg_cmc, other.avg_cmc)
    push(cat(mine, 'removal') > cat(other, 'removal'), cat(mine, 'removal') > cat(other, 'removal') ? 'moreRemoval' : 'lessRemoval', cat(mine, 'removal'), cat(other, 'removal'))
    push(cat(mine, 'draw') > cat(other, 'draw'), cat(mine, 'draw') > cat(other, 'draw') ? 'moreDraw' : 'lessDraw', cat(mine, 'draw'), cat(other, 'draw'))
    push(cat(mine, 'ramp') > cat(other, 'ramp'), cat(mine, 'ramp') > cat(other, 'ramp') ? 'moreRamp' : 'lessRamp', cat(mine, 'ramp'), cat(other, 'ramp'))
    push((mine.types?.Creature || 0) > (other.types?.Creature || 0), (mine.types?.Creature || 0) > (other.types?.Creature || 0) ? 'moreCreatures' : 'lessCreatures', mine.types?.Creature || 0, other.types?.Creature || 0)
  }

  const groups = [
    { key: 'mine', label: t('compare.groupMine') },
    { key: 'friends', label: t('compare.groupFriends') },
    { key: 'public', label: t('compare.groupPublic') },
  ]

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs text-vault-muted mb-1.5 block">{t('compare.pick')}</label>
        <select
          value={otherId ?? ''}
          onChange={(e) => setOtherId(e.target.value ? Number(e.target.value) : null)}
          className="input-field w-full text-sm"
        >
          <option value="">{t('compare.choose')}</option>
          {groups.map((g) => {
            const list = (opts?.[g.key] || []).filter((d: any) => d.id !== deckId)
            if (list.length === 0) return null
            return (
              <optgroup key={g.key} label={g.label}>
                {list.map((d: any) => (
                  <option key={d.id} value={d.id}>
                    {d.name}{d.owner ? ` · @${d.owner}` : ''} ({d.card_count})
                  </option>
                ))}
              </optgroup>
            )
          })}
        </select>
      </div>

      {!otherId ? (
        <p className="text-sm text-vault-muted text-center py-6">{t('compare.hint')}</p>
      ) : !other || !mine ? (
        <div className="flex justify-center py-6"><div className="w-6 h-6 border-2 border-vault-accent border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <>
          {/* Headers */}
          <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3 pb-2 border-b border-vault-border">
            <p className="text-right text-sm font-bold text-vault-accent truncate">{mine.name}</p>
            <span className="text-[10px] text-vault-muted w-28 text-center">vs</span>
            <p className="text-left text-sm font-bold text-vault-gold truncate">{other.name}</p>
          </div>

          <div className="divide-y divide-vault-border/40">
            <Row label={t('compare.spells')} a={mine.nonlands} b={other.nonlands} />
            <Row label={t('compare.lands')} a={mine.lands} b={other.lands} />
            <Row label={t('compare.avgCmc')} a={mine.avg_cmc} b={other.avg_cmc} lowerBetter />
            <Row label={t('analysis.cat_removal')} a={cat(mine, 'removal')} b={cat(other, 'removal')} />
            <Row label={t('analysis.cat_draw')} a={cat(mine, 'draw')} b={cat(other, 'draw')} />
            <Row label={t('analysis.cat_ramp')} a={cat(mine, 'ramp')} b={cat(other, 'ramp')} />
            <Row label={t('analysis.cat_interaction')} a={cat(mine, 'interaction')} b={cat(other, 'interaction')} />
            <Row label={t('analysis.type_Creature')} a={mine.types?.Creature || 0} b={other.types?.Creature || 0} />
          </div>

          {/* Verdict */}
          {verdicts.length > 0 && (
            <div className="rounded-xl border border-vault-border bg-vault-card/40 p-4">
              <p className="text-xs font-medium text-vault-text mb-2 flex items-center gap-1.5">
                <ArrowRight size={13} className="text-vault-accent" /> {t('compare.verdictTitle')}
              </p>
              <ul className="space-y-1">
                {verdicts.map((v, i) => (
                  <li key={i} className={`text-xs flex items-start gap-1.5 ${v.good ? 'text-green-400' : 'text-vault-muted'}`}>
                    <span>{v.good ? '▲' : '▽'}</span> {v.txt}
                  </li>
                ))}
              </ul>
              <p className="text-[10px] text-vault-muted/70 mt-3">{t('compare.disclaimer')}</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}

import { useQuery } from '@tanstack/react-query'
import { ExternalLink } from 'lucide-react'
import { cardsApi } from '@/lib/api'

/** USD→BRL rate, fetched once and cached for the session. */
export function useUsdBrl(): number {
  const { data } = useQuery({
    queryKey: ['fx-usd-brl'],
    queryFn: cardsApi.fx,
    staleTime: 1000 * 60 * 60, // 1h
  })
  return data?.usd_brl || 0
}

interface Props {
  usd?: number
  /** Multiply USD by quantity for the row total. */
  quantity?: number
  /** Official store page (TCGplayer/Cardmarket) for the live price. */
  purchaseUri?: string
  className?: string
  /** Compact (tile) mode: show only USD, with BRL in the tooltip. */
  compact?: boolean
}

/** Shows a card price in USD with an approximate BRL value, linking to the
 *  official store page when available. */
export default function CardPrice({ usd, quantity = 1, purchaseUri, className = '', compact = false }: Props) {
  const rate = useUsdBrl()
  const value = (usd || 0) * quantity
  if (value <= 0) return <span className={`text-vault-muted ${className}`}>—</span>

  const brl = rate ? value * rate : 0
  const usdLabel = `$${value.toFixed(2)}`
  const brlLabel = brl ? `R$${brl.toFixed(2).replace('.', ',')}` : ''

  const content = compact ? (
    <span className="font-mono font-bold text-green-400" title={brlLabel ? `≈ ${brlLabel}` : undefined}>
      {usdLabel}
    </span>
  ) : (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="font-mono font-bold text-green-400">{usdLabel}</span>
      {brlLabel && <span className="font-mono text-[10px] text-vault-muted">≈ {brlLabel}</span>}
    </span>
  )

  if (!purchaseUri) return <span className={className}>{content}</span>

  return (
    <a
      href={purchaseUri}
      target="_blank"
      rel="noreferrer noopener"
      onClick={(e) => e.stopPropagation()}
      title="Ver preço oficial"
      className={`group inline-flex items-center gap-1 hover:underline ${className}`}
    >
      {content}
      <ExternalLink size={10} className="text-vault-muted opacity-0 group-hover:opacity-100 transition-opacity" />
    </a>
  )
}

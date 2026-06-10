import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
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

/** Formats a USD amount in a single currency chosen by the UI language:
 *  Portuguese → BRL (R$), English/Spanish → USD ($). Falls back to USD if the
 *  exchange rate hasn't loaded yet. */
export function useMoney(): (usd: number) => string {
  const { i18n } = useTranslation()
  const rate = useUsdBrl()
  const brl = (i18n.language || '').toLowerCase().startsWith('pt')
  return (usd: number) => {
    const v = usd || 0
    if (brl && rate) return `R$${(v * rate).toFixed(2).replace('.', ',')}`
    return `$${v.toFixed(2)}`
  }
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
  const money = useMoney()
  const value = (usd || 0) * quantity
  if (value <= 0) return <span className={`text-vault-muted ${className}`}>—</span>

  const content = (
    <span className={compact ? '' : 'inline-flex items-baseline gap-1.5'}>
      <span className="font-mono font-bold text-green-400">{money(value)}</span>
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

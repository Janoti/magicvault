import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, QrCode } from 'lucide-react'
import CardTile from '@/components/cards/CardTile'
import { useTranslation } from 'react-i18next'

const PAGE_SIZE = 24

export default function SharedResourceView({ data }: { data: any }) {
  const { t } = useTranslation()
  const [page, setPage] = useState(1)
  const [showQr, setShowQr] = useState(false)
  const pageUrl = typeof window !== 'undefined' ? window.location.href : ''
  const [preview, setPreview] = useState<{ src: string; x: number; y: number } | null>(null)

  const TYPE_LABEL: Record<string, string> = {
    collection: t('nav.collection'),
    binder: 'Binder',
    deck: 'Deck',
  }

  const cards: any[] = data?.cards || []
  const totalValue = useMemo(
    () => cards.reduce((sum, c) => {
      const unit = (c.foil ? c.card?.price_usd_foil : c.card?.price_usd) || 0
      return sum + unit * (c.quantity || 1)
    }, 0),
    [cards],
  )

  if (!data) return null

  const pages = Math.max(1, Math.ceil(cards.length / PAGE_SIZE))
  const safePage = Math.min(page, pages)
  const start = (safePage - 1) * PAGE_SIZE
  const pageCards = cards.slice(start, start + PAGE_SIZE)

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <span className="text-[10px] uppercase tracking-wider text-vault-muted bg-vault-card px-2 py-0.5 rounded-full">
            {TYPE_LABEL[data.resource_type] || data.resource_type}
            {data.format ? ` • ${data.format}` : ''}
          </span>
          <h1 className="font-display text-3xl font-bold text-vault-gold mt-2">{data.title}</h1>
          <p className="text-vault-muted text-sm mt-0.5">
            {t('shared.by', { name: data.owner })} • {t('common.cardsCount', { count: cards.length })}
            {totalValue > 0 && <> • <span className="text-green-400 font-mono">${totalValue.toFixed(2)}</span></>}
          </p>
          {data.description && <p className="text-sm text-vault-muted mt-2 max-w-2xl">{data.description}</p>}
          {data.primer && (
            <details className="mt-3 max-w-2xl">
              <summary className="text-sm font-medium text-vault-accent cursor-pointer">{t('primer.title')}</summary>
              <p className="text-sm text-vault-text whitespace-pre-wrap leading-relaxed mt-2">{data.primer}</p>
            </details>
          )}
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <button onClick={() => setShowQr(v => !v)} className="btn-ghost !py-1.5 flex items-center gap-2 text-xs">
            <QrCode size={15} /> QR
          </button>
          {showQr && pageUrl && (
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&margin=8&data=${encodeURIComponent(pageUrl)}`}
              alt="QR" width={120} height={120}
              className="rounded-lg bg-white p-1 shadow-lg"
            />
          )}
        </div>
      </div>

      {cards.length === 0 ? (
        <p className="text-vault-muted text-center py-20">{t('pages.empty')}</p>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {pageCards.map((c, i) => {
              const zoom = c.card?.image_large || c.card?.image_normal
              return (
                <div
                  key={start + i}
                  className="relative"
                  onMouseEnter={(e) => zoom && setPreview({ src: zoom, x: e.clientX, y: e.clientY })}
                  onMouseMove={(e) => zoom && setPreview((p) => (p ? { ...p, x: e.clientX, y: e.clientY } : p))}
                  onMouseLeave={() => setPreview(null)}
                >
                  <CardTile card={c.card} showActions={false} />
                  <div className="absolute top-1 left-1 flex gap-1">
                    {c.quantity > 1 && (
                      <span className="text-[10px] bg-black/70 text-white px-1.5 py-0.5 rounded font-mono">×{c.quantity}</span>
                    )}
                    {c.condition && (
                      <span className="text-[10px] bg-black/70 text-white px-1.5 py-0.5 rounded font-mono">
                        {c.condition}{c.foil ? ' ⚡' : ''}
                      </span>
                    )}
                    {c.is_commander && (
                      <span className="text-[10px] bg-vault-gold/80 text-black px-1.5 py-0.5 rounded font-mono">CMD</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {pages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-6">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className="btn-ghost !p-2 disabled:opacity-30"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-sm text-vault-muted font-mono">{safePage} / {pages}</span>
              <button
                onClick={() => setPage((p) => Math.min(pages, p + 1))}
                disabled={safePage >= pages}
                className="btn-ghost !p-2 disabled:opacity-30"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </>
      )}

      {/* Hover zoom preview */}
      {preview && (
        <img
          src={preview.src}
          alt=""
          className="hidden md:block fixed z-50 w-64 rounded-xl shadow-2xl pointer-events-none border border-vault-border"
          style={{
            left: Math.min(preview.x + 20, window.innerWidth - 270),
            top: Math.min(Math.max(preview.y - 180, 10), window.innerHeight - 370),
          }}
        />
      )}
    </div>
  )
}

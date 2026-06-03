import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { collectionApi, cardsApi, bindersApi } from '@/lib/api'
import { motion, AnimatePresence } from 'framer-motion'
import { Trash2, Filter, Plus, ChevronLeft, ChevronRight, Pencil, BookMarked, Download, Upload, Share2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import EditCardModal from '@/components/collection/EditCardModal'
import AddToBinderModal from '@/components/collection/AddToBinderModal'
import ShareModal from '@/components/sharing/ShareModal'
import { useAuthStore } from '@/store/auth'
import { useTranslation } from 'react-i18next'

const CONDITIONS = ['', 'M', 'NM', 'LP', 'MP', 'HP', 'DMG']

export default function CollectionPage() {
  const username = useAuthStore((s) => s.user?.username)
  const { t } = useTranslation()
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(24)
  const [condition, setCondition] = useState('')
  const [setCode, setSetCode] = useState('')
  const [foil, setFoil] = useState<boolean | undefined>(undefined)
  const [cardDetails, setCardDetails] = useState<Record<string, any>>({})
  const [editEntry, setEditEntry] = useState<any>(null)
  const [binderEntry, setBinderEntry] = useState<any>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [preview, setPreview] = useState<{ src: string; x: number; y: number } | null>(null)
  const [showShare, setShowShare] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['collection', { page, perPage, condition, foil, setCode }],
    queryFn: () => collectionApi.list({ page, per_page: perPage, condition: condition || undefined, foil, set_code: setCode || undefined }),
  })

  const { data: binders = [] } = useQuery({ queryKey: ['binders'], queryFn: bindersApi.list })
  const { data: collectionSets = [] } = useQuery({ queryKey: ['collection-sets'], queryFn: collectionApi.sets })

  const removeMutation = useMutation({
    mutationFn: collectionApi.remove,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['collection'] })
      qc.invalidateQueries({ queryKey: ['collection-stats'] })
    },
  })

  const updateMutation = useMutation({
    mutationFn: (vars: { id: number; data: any }) => collectionApi.update(vars.id, vars.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['collection'] })
      qc.invalidateQueries({ queryKey: ['collection-stats'] })
      setEditEntry(null)
    },
  })

  const addToBinderMutation = useMutation({
    mutationFn: (vars: { binderId: number; entryId: number }) =>
      bindersApi.addCard(vars.binderId, { collection_entry_id: vars.entryId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['binders'] })
      setBinderEntry(null)
      setNotice(t('col.addedToBinder'))
    },
    onError: () => setNotice(t('col.binderError')),
  })

  const importMutation = useMutation({
    mutationFn: (file: File) => collectionApi.importCsv(file),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['collection'] })
      qc.invalidateQueries({ queryKey: ['collection-stats'] })
      setNotice(t('col.importResult', { imported: res.imported, updated: res.updated, skipped: res.skipped }))
    },
    onError: () => setNotice(t('col.importError')),
  })

  const handleExport = async () => {
    try {
      const blob = await collectionApi.exportCsv()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'magicvault_collection.csv'
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setNotice(t('col.exportError'))
    }
  }

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) importMutation.mutate(file)
    e.target.value = ''
  }

  const fetchCard = async (id: string) => {
    if (cardDetails[id]) return
    try {
      const card = await cardsApi.getById(id)
      setCardDetails(prev => ({ ...prev, [id]: card }))
    } catch {}
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-vault-gold">
            {username ? t('col.title', { name: username }) : t('col.titlePlain')}
          </h1>
          <p className="text-vault-muted text-sm mt-0.5">{t('col.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowShare(true)} className="btn-ghost flex items-center gap-2">
            <Share2 size={16} /> {t('common.share')}
          </button>
          <button onClick={handleExport} className="btn-ghost flex items-center gap-2">
            <Download size={16} /> {t('col.export')}
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importMutation.isPending}
            className="btn-ghost flex items-center gap-2 disabled:opacity-40"
          >
            {importMutation.isPending ? (
              <div className="w-4 h-4 border-2 border-vault-accent border-t-transparent rounded-full animate-spin" />
            ) : <Upload size={16} />}
            {t('col.import')}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={handleImportFile}
          />
          <Link to="/search" className="btn-primary flex items-center gap-2">
            <Plus size={16} /> {t('col.addCards')}
          </Link>
        </div>
      </div>

      {notice && (
        <div className="surface p-3 mb-4 text-sm text-vault-text border-vault-accent/40 flex items-center justify-between">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} className="text-vault-muted hover:text-vault-text text-xs">fechar</button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6 surface p-4">
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-vault-muted" />
          <span className="text-xs text-vault-muted font-medium">{t('col.filters')}</span>
        </div>
        <select
          value={condition}
          onChange={(e) => { setCondition(e.target.value); setPage(1) }}
          className="input-field !w-auto text-xs"
        >
          <option value="">{t('col.allConditions')}</option>
          {CONDITIONS.slice(1).map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select
          value={setCode}
          onChange={(e) => { setSetCode(e.target.value); setPage(1) }}
          className="input-field !w-auto text-xs max-w-[180px]"
        >
          <option value="">{t('col.allSets')}</option>
          {collectionSets.map((s: any) => (
            <option key={s.code} value={s.code}>{s.name} ({s.count})</option>
          ))}
        </select>
        <select
          value={foil === undefined ? '' : String(foil)}
          onChange={(e) => { setFoil(e.target.value === '' ? undefined : e.target.value === 'true'); setPage(1) }}
          className="input-field !w-auto text-xs"
        >
          <option value="">{t('col.normalFoil')}</option>
          <option value="false">{t('col.normal')}</option>
          <option value="true">{t('col.foil')}</option>
        </select>
        <select
          value={perPage}
          onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1) }}
          className="input-field !w-auto text-xs ml-auto"
        >
          {[12, 24, 48, 100].map(n => <option key={n} value={n}>{t('col.perPage', { n })}</option>)}
        </select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-vault-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : data?.items?.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-4xl mb-4">🃏</p>
          <p className="text-vault-muted mb-4">{t('col.empty')}</p>
          <Link to="/search" className="btn-primary inline-flex items-center gap-2">
            <Plus size={16} /> {t('col.searchCards')}
          </Link>
        </div>
      ) : (
        <>
          {/* Table view */}
          <div className="surface overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-vault-border bg-vault-surface">
                  <th className="text-left px-4 py-3 text-xs text-vault-muted font-medium">{t('col.thCard')}</th>
                  <th className="text-left px-4 py-3 text-xs text-vault-muted font-medium">{t('col.thSet')}</th>
                  <th className="text-left px-4 py-3 text-xs text-vault-muted font-medium">{t('col.thQty')}</th>
                  <th className="text-left px-4 py-3 text-xs text-vault-muted font-medium">{t('col.thCond')}</th>
                  <th className="text-left px-4 py-3 text-xs text-vault-muted font-medium">{t('col.thFoil')}</th>
                  <th className="text-right px-4 py-3 text-xs text-vault-muted font-medium">{t('col.thValue')}</th>
                  <th className="text-left px-4 py-3 text-xs text-vault-muted font-medium">{t('col.thAdded')}</th>
                  <th className="text-right px-4 py-3 text-xs text-vault-muted font-medium">{t('col.thActions')}</th>
                </tr>
              </thead>
              <tbody>
                {data?.items?.map((entry: any) => {
                  const card = cardDetails[entry.scryfall_id]
                  if (!card) fetchCard(entry.scryfall_id)

                  return (
                    <motion.tr
                      key={entry.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="border-b border-vault-border/50 hover:bg-vault-card/30 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div
                          className="flex items-center gap-3"
                          onMouseEnter={(e) => {
                            const src = card?.image_normal || card?.image_large || card?.image_small
                            if (src) setPreview({ src, x: e.clientX, y: e.clientY })
                          }}
                          onMouseMove={(e) => setPreview(p => (p ? { ...p, x: e.clientX, y: e.clientY } : p))}
                          onMouseLeave={() => setPreview(null)}
                        >
                          {card?.image_small ? (
                            <img src={card.image_small} alt={card.name} className="w-8 rounded shadow cursor-zoom-in" />
                          ) : (
                            <div className="w-8 h-11 bg-vault-card rounded" />
                          )}
                          <div>
                            <p className="font-medium text-vault-text">{card?.name || entry.scryfall_id.slice(0, 8) + '...'}</p>
                            {card && (
                              <p className="text-xs text-vault-muted">#{card.collector_number}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {card ? (
                          <div className="flex items-center gap-2">
                            {card.set && (
                              <img
                                src={`https://svgs.scryfall.io/sets/${card.set}.svg`}
                                alt={card.set}
                                className="w-4 h-4 opacity-80"
                                style={{ filter: 'invert(1) sepia(1) saturate(4) hue-rotate(200deg)' }}
                                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                              />
                            )}
                            <div className="min-w-0">
                              <p className="text-xs text-vault-text truncate max-w-[160px]">{card.set_name}</p>
                              <p className="text-[10px] text-vault-muted font-mono">{card.set?.toUpperCase()}</p>
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-vault-muted">…</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono font-bold text-vault-accent">×{entry.quantity}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="bg-vault-card border border-vault-border text-vault-text text-xs px-2 py-0.5 rounded font-mono">
                          {entry.condition}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {entry.foil && <span className="text-yellow-400 text-xs">⚡ Foil</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {(() => {
                          const unit = (entry.foil ? card?.price_usd_foil : card?.price_usd) || 0
                          if (!card) return <span className="text-xs text-vault-muted">…</span>
                          if (unit <= 0) return <span className="text-xs text-vault-muted">—</span>
                          return (
                            <div className="leading-tight">
                              <span className="font-mono font-bold text-green-400">${(unit * entry.quantity).toFixed(2)}</span>
                              {entry.quantity > 1 && (
                                <p className="text-[10px] text-vault-muted font-mono">{t('col.perUnit', { price: `$${unit.toFixed(2)}` })}</p>
                              )}
                            </div>
                          )
                        })()}
                      </td>
                      <td className="px-4 py-3 text-xs text-vault-muted">
                        {new Date(entry.added_at).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setEditEntry(entry)}
                            title={t('col.editTip')}
                            className="text-vault-muted hover:text-vault-accent transition-colors p-1.5 rounded-lg hover:bg-vault-accent/10"
                          >
                            <Pencil size={14} />
                          </button>
                          {binders.length > 0 && (
                            <button
                              onClick={() => setBinderEntry(entry)}
                              title={t('col.binderTip')}
                              className="text-vault-muted hover:text-vault-gold transition-colors p-1.5 rounded-lg hover:bg-vault-gold/10"
                            >
                              <BookMarked size={14} />
                            </button>
                          )}
                          <button
                            onClick={() => removeMutation.mutate(entry.id)}
                            title={t('col.removeTip')}
                            className="text-vault-muted hover:text-red-400 transition-colors p-1.5 rounded-lg hover:bg-red-400/10"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4">
            <p className="text-xs text-vault-muted">
              {t('col.totalCards', { count: data?.total ?? 0 })}
              {(() => {
                const pageValue = (data?.items || []).reduce((sum: number, e: any) => {
                  const c = cardDetails[e.scryfall_id]
                  const unit = (e.foil ? c?.price_usd_foil : c?.price_usd) || 0
                  return sum + unit * e.quantity
                }, 0)
                return pageValue > 0 ? (
                  <> • <span className="text-green-400 font-mono font-semibold">${pageValue.toFixed(2)}</span> {t('col.onThisPage')}</>
                ) : null
              })()}
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn-ghost !p-2 disabled:opacity-40"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-sm text-vault-muted">
                {page} / {data?.pages}
              </span>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={page >= (data?.pages || 1)}
                className="btn-ghost !p-2 disabled:opacity-40"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </>
      )}

      {/* Large card preview following the cursor */}
      {preview && (
        <img
          src={preview.src}
          alt="preview"
          className="hidden md:block fixed z-[60] w-64 rounded-xl shadow-2xl pointer-events-none ring-1 ring-vault-border"
          style={{
            left: Math.min(preview.x + 24, window.innerWidth - 270),
            top: Math.min(Math.max(preview.y - 180, 8), window.innerHeight - 370),
          }}
        />
      )}

      {showShare && (
        <ShareModal
          resourceType="collection"
          resourcelabel={username ? `Coleção de ${username}` : 'Minha coleção'}
          onClose={() => setShowShare(false)}
        />
      )}

      {editEntry && (
        <EditCardModal
          entry={editEntry}
          card={cardDetails[editEntry.scryfall_id]}
          onClose={() => setEditEntry(null)}
          onConfirm={(payload) => updateMutation.mutate({ id: editEntry.id, data: payload })}
          isLoading={updateMutation.isPending}
        />
      )}

      {binderEntry && (
        <AddToBinderModal
          entry={binderEntry}
          card={cardDetails[binderEntry.scryfall_id]}
          onClose={() => setBinderEntry(null)}
          onConfirm={(binderId) => addToBinderMutation.mutate({ binderId, entryId: binderEntry.id })}
          isLoading={addToBinderMutation.isPending}
        />
      )}
    </div>
  )
}

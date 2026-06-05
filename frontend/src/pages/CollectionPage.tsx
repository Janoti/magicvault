import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { collectionApi, bindersApi, decksApi, authApi } from '@/lib/api'
import { motion, AnimatePresence } from 'framer-motion'
import { Trash2, Filter, Plus, ChevronLeft, ChevronRight, Pencil, BookMarked, Swords, Download, Upload, Share2, Search, X, BookOpen, Globe, Lock, List, LayoutGrid } from 'lucide-react'
import { Link } from 'react-router-dom'
import CardPrice from '@/components/cards/CardPrice'
import CardTile from '@/components/cards/CardTile'
import CardInfoModal from '@/components/cards/CardInfoModal'
import ValueChart from '@/components/collection/ValueChart'
import SetCompletion from '@/components/collection/SetCompletion'
import RoleTag from '@/components/cards/RoleTag'
import { FLAGS } from '@/lib/flags'
import { cardRole } from '@/lib/cardRole'
import EditCardModal from '@/components/collection/EditCardModal'
import AddToBinderModal from '@/components/collection/AddToBinderModal'
import AddToDeckModal from '@/components/collection/AddToDeckModal'
import ShareModal from '@/components/sharing/ShareModal'
import { useAuthStore } from '@/store/auth'
import { useTranslation } from 'react-i18next'

const CONDITIONS = ['', 'M', 'NM', 'LP', 'MP', 'HP', 'DMG']

export default function CollectionPage() {
  const username = useAuthStore((s) => s.user?.display_name || s.user?.username)
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)
  const { t } = useTranslation()
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(24)
  const [condition, setCondition] = useState('')
  const [setCode, setSetCode] = useState('')
  const [foil, setFoil] = useState<boolean | undefined>(undefined)
  const [search, setSearch] = useState('')
  const [q, setQ] = useState('')          // debounced search actually sent
  const [rarity, setRarity] = useState('')
  const [cardType, setCardType] = useState('')
  // Sort/view preferences persist across refreshes until the user changes them.
  const [sortBy, setSortBy] = useState(() => localStorage.getItem('col.sortBy') || 'added_at')
  const [order, setOrder] = useState<'asc' | 'desc'>(() => (localStorage.getItem('col.order') as 'asc' | 'desc') || 'desc')
  const [view, setView] = useState<'list' | 'grid'>(() => (localStorage.getItem('col.view') as 'list' | 'grid') || 'list')
  const [editEntry, setEditEntry] = useState<any>(null)
  const [infoCard, setInfoCard] = useState<any>(null)
  const [infoEntryId, setInfoEntryId] = useState<number | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [bulkCond, setBulkCond] = useState('NM')
  const [binderEntry, setBinderEntry] = useState<any>(null)
  const [deckEntry, setDeckEntry] = useState<any>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [preview, setPreview] = useState<{ src: string; x: number; y: number } | null>(null)
  const [showShare, setShowShare] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const qc = useQueryClient()

  // Debounce the name search so we don't refetch on every keystroke.
  useEffect(() => {
    const id = setTimeout(() => { setQ(search.trim()); setPage(1) }, 350)
    return () => clearTimeout(id)
  }, [search])

  useEffect(() => { localStorage.setItem('col.sortBy', sortBy) }, [sortBy])
  useEffect(() => { localStorage.setItem('col.order', order) }, [order])
  useEffect(() => { localStorage.setItem('col.view', view) }, [view])

  const { data, isLoading } = useQuery({
    queryKey: ['collection', { page, perPage, condition, foil, setCode, q, rarity, cardType, sortBy, order }],
    queryFn: () => collectionApi.list({
      page, per_page: perPage, condition: condition || undefined, foil,
      set_code: setCode || undefined, q: q || undefined, rarity: rarity || undefined,
      card_type: cardType || undefined, sort_by: sortBy, order, with_cards: true,
    }),
  })

  const { data: binders = [] } = useQuery({ queryKey: ['binders'], queryFn: bindersApi.list })
  const { data: decks = [] } = useQuery({ queryKey: ['decks'], queryFn: decksApi.list })
  const { data: collectionSets = [] } = useQuery({ queryKey: ['collection-sets'], queryFn: collectionApi.sets })

  const removeMutation = useMutation({
    mutationFn: collectionApi.remove,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['collection'] })
      qc.invalidateQueries({ queryKey: ['collection-stats'] })
    },
  })

  const bulkMutation = useMutation({
    mutationFn: (data: { ids: number[]; action: string; condition?: string; foil?: boolean }) => collectionApi.bulk(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['collection'] })
      qc.invalidateQueries({ queryKey: ['collection-stats'] })
      setSelectedIds(new Set())
    },
  })
  const toggleSel = (id: number) => setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

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

  const publicMutation = useMutation({
    mutationFn: (collection_public: boolean) => authApi.updateMe({ collection_public }),
    onSuccess: (updated, isPublic) => {
      setUser(updated)
      setNotice(isPublic ? t('col.nowPublic') : t('col.nowPrivate'))
    },
  })

  const addToDeckMutation = useMutation({
    mutationFn: (vars: { deckId: number; scryfallId: string }) =>
      decksApi.addCard(vars.deckId, { scryfall_id: vars.scryfallId, quantity: 1 }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['decks'] })
      setDeckEntry(null)
      setNotice(t('col.addedToDeck'))
    },
    onError: () => setNotice(t('col.deckError')),
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
          <button
            onClick={() => publicMutation.mutate(!user?.collection_public)}
            title={user?.collection_public ? t('detail.makePrivate') : t('col.makePublic')}
            className={`btn-ghost flex items-center gap-2 ${user?.collection_public ? 'text-green-400' : ''}`}
          >
            {user?.collection_public ? <Globe size={16} /> : <Lock size={16} />}
            {user?.collection_public ? t('detail.public') : t('detail.private')}
          </button>
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
      <div className="flex flex-wrap items-center gap-3 mb-6 surface p-4">
        <div className="relative w-full sm:w-72">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-vault-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('col.searchByName')}
            className="input-field w-full text-xs pl-8 pr-8"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-vault-muted hover:text-vault-text">
              <X size={13} />
            </button>
          )}
        </div>
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
          value={rarity}
          onChange={(e) => { setRarity(e.target.value); setPage(1) }}
          className="input-field !w-auto text-xs"
        >
          <option value="">{t('col.allRarities')}</option>
          <option value="common">{t('col.rarityCommon')}</option>
          <option value="uncommon">{t('col.rarityUncommon')}</option>
          <option value="rare">{t('col.rarityRare')}</option>
          <option value="mythic">{t('col.rarityMythic')}</option>
        </select>
        <select
          value={cardType}
          onChange={(e) => { setCardType(e.target.value); setPage(1) }}
          className="input-field !w-auto text-xs"
        >
          <option value="">{t('col.allTypes')}</option>
          {['Creature', 'Instant', 'Sorcery', 'Artifact', 'Enchantment', 'Planeswalker', 'Land', 'Equipment', 'Aura', 'Battle'].map(ty => (
            <option key={ty} value={ty}>{t(`analysis.type_${ty}`, ty)}</option>
          ))}
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
        <div className="flex items-center gap-1 ml-auto">
          <select value={sortBy} onChange={(e) => { setSortBy(e.target.value); setPage(1) }} className="input-field !w-auto text-xs">
            <option value="added_at">{t('col.sortAdded')}</option>
            <option value="name">{t('col.sortName')}</option>
            <option value="price">{t('col.sortPrice')}</option>
            <option value="quantity">{t('col.sortQty')}</option>
            <option value="rarity">{t('col.sortRarity')}</option>
            <option value="cmc">{t('col.sortCmc')}</option>
          </select>
          <button onClick={() => { setOrder(o => o === 'asc' ? 'desc' : 'asc'); setPage(1) }}
            title={order === 'asc' ? t('col.asc') : t('col.desc')}
            className="input-field !w-auto !px-2 text-xs">
            {order === 'asc' ? '↑' : '↓'}
          </button>
        </div>
        <div className="flex items-center gap-1 bg-vault-card/50 p-1 rounded-lg">
          <button onClick={() => setView('list')} title={t('col.viewList')}
            className={`p-1.5 rounded ${view === 'list' ? 'bg-vault-accent/20 text-vault-accent' : 'text-vault-muted hover:text-vault-text'}`}>
            <List size={15} />
          </button>
          <button onClick={() => setView('grid')} title={t('col.viewGrid')}
            className={`p-1.5 rounded ${view === 'grid' ? 'bg-vault-accent/20 text-vault-accent' : 'text-vault-muted hover:text-vault-text'}`}>
            <LayoutGrid size={15} />
          </button>
        </div>
        <select
          value={perPage}
          onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1) }}
          className="input-field !w-auto text-xs"
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
          <div className="w-20 h-20 rounded-2xl bg-vault-card border border-vault-border flex items-center justify-center mx-auto mb-4">
            <BookOpen size={40} className="text-vault-muted/50" strokeWidth={1.5} />
          </div>
          <p className="text-vault-muted mb-4">{t('col.empty')}</p>
          <Link to="/search" className="btn-primary inline-flex items-center gap-2">
            <Plus size={16} /> {t('col.searchCards')}
          </Link>
        </div>
      ) : (
        <>
          <ValueChart />
          {FLAGS.setCompletion && <SetCompletion />}
          {selectedIds.size > 0 && (
            <div className="surface p-3 mb-3 flex flex-wrap items-center gap-3 border-vault-accent/30">
              <span className="text-sm text-vault-text font-medium">{t('col.bulkSelected', { count: selectedIds.size })}</span>
              <select className="input-field !w-auto !py-1.5 text-sm" value={bulkCond} onChange={(e) => setBulkCond(e.target.value)}>
                {['M', 'NM', 'LP', 'MP', 'HP', 'DMG'].map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <button onClick={() => bulkMutation.mutate({ ids: [...selectedIds], action: 'condition', condition: bulkCond })} className="btn-ghost !py-1.5 text-xs">{t('col.bulkSetCond')}</button>
              <button onClick={() => bulkMutation.mutate({ ids: [...selectedIds], action: 'foil', foil: true })} className="btn-ghost !py-1.5 text-xs">{t('col.bulkFoil')}</button>
              <button onClick={() => { if (confirm(t('col.bulkDeleteConfirm', { count: selectedIds.size }))) bulkMutation.mutate({ ids: [...selectedIds], action: 'delete' }) }}
                className="!py-1.5 text-xs px-3 rounded border border-red-500/40 text-red-400 hover:bg-red-500/10">{t('col.bulkDelete')}</button>
              <button onClick={() => setSelectedIds(new Set())} className="text-xs text-vault-muted hover:text-vault-text ml-auto">{t('col.bulkClear')}</button>
            </div>
          )}
          {view === 'grid' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {data?.items?.map((entry: any) => {
                const card = entry.card
                return (
                  <div key={entry.id} className="relative group">
                    <CardTile card={card || { id: entry.scryfall_id, name: '…' }} showActions={false} onClick={() => { if (card) { setInfoCard(card); setInfoEntryId(entry.id) } }} />
                    <div className="absolute top-1 left-1 flex gap-1">
                      <span className="text-[10px] bg-black/70 text-white px-1.5 py-0.5 rounded font-mono">×{entry.quantity}</span>
                      <span className="text-[10px] bg-black/70 text-white px-1.5 py-0.5 rounded font-mono">{entry.condition}{entry.foil ? ' ⚡' : ''}</span>
                    </div>
                    <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                      <button onClick={() => setEditEntry(entry)} title={t('col.editTip')} className="bg-black/70 text-white p-1 rounded hover:text-vault-accent"><Pencil size={12} /></button>
                      <button onClick={() => removeMutation.mutate(entry.id)} title={t('col.removeTip')} className="bg-black/70 text-white p-1 rounded hover:text-red-400"><Trash2 size={12} /></button>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
          <div className="surface overflow-x-auto">
            <table className="w-full min-w-[680px] text-sm">
              <thead>
                <tr className="border-b border-vault-border bg-vault-surface">
                  <th className="px-3 py-3 w-8">
                    <input type="checkbox"
                      checked={(data?.items?.length ?? 0) > 0 && data.items.every((i: any) => selectedIds.has(i.id))}
                      onChange={(e) => setSelectedIds(e.target.checked ? new Set(data.items.map((i: any) => i.id)) : new Set())} />
                  </th>
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
                  const card = entry.card

                  return (
                    <motion.tr
                      key={entry.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className={`border-b border-vault-border/50 hover:bg-vault-card/30 transition-colors ${selectedIds.has(entry.id) ? 'bg-vault-accent/10' : ''}`}
                    >
                      <td className="px-3"><input type="checkbox" checked={selectedIds.has(entry.id)} onChange={() => toggleSel(entry.id)} /></td>
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
                            <img src={card.image_small} alt={card.name} onClick={() => { setInfoCard(card); setInfoEntryId(entry.id) }} className="w-8 rounded shadow cursor-pointer" />
                          ) : (
                            <div className="w-8 h-11 bg-vault-card rounded" />
                          )}
                          <div>
                            <p className="font-medium text-vault-text">
                              <RoleTag role={cardRole(card)} />
                              {card?.name || entry.scryfall_id.slice(0, 8) + '...'}
                            </p>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {card && <p className="text-xs text-vault-muted">#{card.collector_number}</p>}
                              {entry.binders?.map((b: any) => (
                                <Link key={b.id} to={`/binders/${b.id}`} onClick={(e) => e.stopPropagation()}
                                  title={b.name}
                                  className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full border border-vault-border text-vault-muted hover:text-vault-text hover:border-vault-accent/40">
                                  <span className="w-2 h-2 rounded-full" style={{ background: b.color || '#6366f1' }} />
                                  {b.name}
                                </Link>
                              ))}
                            </div>
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
                              <CardPrice usd={unit} quantity={entry.quantity} purchaseUri={card?.purchase_uri} />
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
                          {decks.length > 0 && (
                            <button
                              onClick={() => setDeckEntry(entry)}
                              title={t('col.deckTip')}
                              className="text-vault-muted hover:text-vault-accent transition-colors p-1.5 rounded-lg hover:bg-vault-accent/10"
                            >
                              <Swords size={14} />
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
          )}

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4">
            <p className="text-xs text-vault-muted">
              {t('col.totalCards', { count: data?.total ?? 0 })}
              {(() => {
                const pageValue = (data?.items || []).reduce((sum: number, e: any) => {
                  const c = e.card
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

      {infoCard && <CardInfoModal card={infoCard} entryId={infoEntryId ?? undefined} onClose={() => { setInfoCard(null); setInfoEntryId(null) }} />}

      {editEntry && (
        <EditCardModal
          entry={editEntry}
          card={editEntry.card}
          onClose={() => setEditEntry(null)}
          onConfirm={(payload) => updateMutation.mutate({ id: editEntry.id, data: payload })}
          isLoading={updateMutation.isPending}
        />
      )}

      {binderEntry && (
        <AddToBinderModal
          entry={binderEntry}
          card={binderEntry.card}
          onClose={() => setBinderEntry(null)}
          onConfirm={(binderId) => addToBinderMutation.mutate({ binderId, entryId: binderEntry.id })}
          isLoading={addToBinderMutation.isPending}
        />
      )}

      {deckEntry && (
        <AddToDeckModal
          entry={deckEntry}
          card={deckEntry.card}
          onClose={() => setDeckEntry(null)}
          onConfirm={(deckId) => addToDeckMutation.mutate({ deckId, scryfallId: deckEntry.scryfall_id })}
          isLoading={addToDeckMutation.isPending}
        />
      )}
    </div>
  )
}

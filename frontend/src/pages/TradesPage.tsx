import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, Trash2, Heart, Send, X, Lock } from 'lucide-react'
import { motion } from 'framer-motion'
import { listingsApi } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import Avatar from '@/components/Avatar'
import CreateListingModal from '@/components/trades/CreateListingModal'

function ListingCard({ l, mine, onInterest, onClose, onDelete }: any) {
  const { t } = useTranslation()
  const img = l.photo || l.card?.image_normal
  return (
    <div className={`surface overflow-hidden flex flex-col ${l.status === 'closed' ? 'opacity-50' : ''}`}>
      <div className="aspect-[63/88] bg-vault-card relative">
        {img ? <img src={img} alt={l.card?.name} className="w-full h-full object-cover" /> : null}
        {l.photo && <span className="absolute top-1 right-1 text-[9px] bg-black/70 text-white px-1.5 py-0.5 rounded">📷 real</span>}
        <span className="absolute bottom-1 left-1 text-[10px] bg-black/70 text-white px-1.5 py-0.5 rounded font-mono">{l.condition}{l.foil ? ' ⚡' : ''}</span>
      </div>
      <div className="p-3 flex-1 flex flex-col">
        <p className="text-sm font-medium text-vault-text truncate">{l.card?.name}</p>
        <div className="mt-1 mb-2 text-xs">
          {l.price != null && <p className="font-mono font-bold text-green-400">${l.price.toFixed(2)} <span className="text-vault-muted font-normal">· {t('trades.forSale')}</span></p>}
          {l.wanted && <p className="text-vault-gold truncate" title={l.wanted}>🔄 {l.wanted}</p>}
        </div>
        {l.notes && <p className="text-[11px] text-vault-muted line-clamp-2 mb-2">{l.notes}</p>}
        <div className="mt-auto flex items-center gap-2">
          <Avatar value={l.seller?.avatar} size={20} />
          <span className="text-xs text-vault-muted truncate flex-1">{l.seller?.display_name || l.seller?.username}</span>
        </div>
        {mine ? (
          <div className="flex gap-1 mt-2">
            <span className="text-[11px] text-vault-muted flex-1">{t('trades.interestsCount', { count: l.interests || 0 })}</span>
            <button onClick={() => onClose(l)} className="text-xs text-vault-muted hover:text-vault-gold">{l.status === 'closed' ? t('trades.reopen') : t('trades.close')}</button>
            <button onClick={() => onDelete(l)} className="text-vault-muted hover:text-red-400"><Trash2 size={13} /></button>
          </div>
        ) : (
          <button onClick={() => onInterest(l)} className="btn-ghost !py-1.5 mt-2 flex items-center justify-center gap-2 text-xs border border-vault-accent/30">
            <Heart size={13} /> {t('trades.interest')}
          </button>
        )}
      </div>
    </div>
  )
}

export default function TradesPage() {
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.user)
  const canCreate = !!(user?.is_premium || user?.is_admin)
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [tab, setTab] = useState<'browse' | 'mine'>('browse')
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [interestFor, setInterestFor] = useState<any>(null)
  const [interestMsg, setInterestMsg] = useState('')
  const [notice, setNotice] = useState('')

  const { data: browse } = useQuery({ queryKey: ['listings', search], queryFn: () => listingsApi.browse({ q: search || undefined, per_page: 48 }), enabled: tab === 'browse' })
  const { data: mine = [] } = useQuery({ queryKey: ['listings-mine'], queryFn: listingsApi.mine, enabled: tab === 'mine' })

  const closeMut = useMutation({ mutationFn: (l: any) => listingsApi.setStatus(l.id, l.status === 'closed' ? 'active' : 'closed'), onSuccess: () => qc.invalidateQueries({ queryKey: ['listings-mine'] }) })
  const delMut = useMutation({ mutationFn: (l: any) => listingsApi.remove(l.id), onSuccess: () => qc.invalidateQueries({ queryKey: ['listings-mine'] }) })
  const interestMut = useMutation({
    mutationFn: () => listingsApi.interest(interestFor.id, interestMsg),
    onSuccess: () => { setInterestFor(null); setInterestMsg(''); setNotice(t('trades.interestSent')) },
  })

  const items = browse?.items || []

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold text-vault-gold">{t('trades.title')}</h1>
          <p className="text-vault-muted text-sm mt-0.5">{t('trades.subtitle')}</p>
        </div>
        <button onClick={() => canCreate ? setShowCreate(true) : navigate('/premium')} className="btn-primary flex items-center gap-2">
          {canCreate ? <Plus size={16} /> : <Lock size={14} />} {t('trades.newListing')}
        </button>
      </div>

      {notice && <div className="surface p-3 mb-4 text-sm text-green-400 border-green-500/30">{notice}</div>}

      <div className="flex gap-2 mb-5">
        {(['browse', 'mine'] as const).map(tb => (
          <button key={tb} onClick={() => setTab(tb)} className={`px-4 py-2 rounded-lg text-sm transition-all ${tab === tb ? 'bg-vault-accent/20 text-vault-accent border border-vault-accent/30' : 'text-vault-muted hover:text-vault-text'}`}>
            {tb === 'browse' ? t('trades.marketplace') : t('trades.mine')}
          </button>
        ))}
      </div>

      {tab === 'browse' && (
        <div className="relative max-w-sm mb-5">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-vault-muted" />
          <input className="input-field pl-9" placeholder={t('trades.search')} value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      )}

      {tab === 'browse' ? (
        items.length === 0 ? <p className="surface p-10 text-center text-vault-muted">{t('trades.noListings')}</p> : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {items.map((l: any) => <ListingCard key={l.id} l={l} onInterest={setInterestFor} />)}
          </div>
        )
      ) : (
        mine.length === 0 ? <p className="surface p-10 text-center text-vault-muted">{t('trades.noMine')}</p> : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {mine.map((l: any) => <ListingCard key={l.id} l={l} mine onClose={(x: any) => closeMut.mutate(x)} onDelete={(x: any) => delMut.mutate(x)} />)}
          </div>
        )
      )}

      {showCreate && <CreateListingModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); qc.invalidateQueries({ queryKey: ['listings-mine'] }); qc.invalidateQueries({ queryKey: ['listings'] }); setTab('mine') }} />}

      {/* Interest modal */}
      {interestFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setInterestFor(null)} />
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="relative z-10 surface p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display font-bold text-vault-gold">{interestFor.card?.name}</h3>
              <button onClick={() => setInterestFor(null)} className="text-vault-muted hover:text-vault-text"><X size={18} /></button>
            </div>
            <textarea className="input-field resize-none mb-3" rows={3} placeholder={t('trades.interestPh')} value={interestMsg} onChange={e => setInterestMsg(e.target.value)} />
            <button onClick={() => interestMut.mutate()} disabled={interestMut.isPending} className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50">
              {interestMut.isPending ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Send size={15} />}
              {t('trades.sendInterest')}
            </button>
          </motion.div>
        </div>
      )}
    </div>
  )
}

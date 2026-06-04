import { useState } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, Trash2, Heart, Send, X, Lock, Bell, ExternalLink, MessageCircle } from 'lucide-react'
import { motion } from 'framer-motion'
import { listingsApi } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import Avatar from '@/components/Avatar'
import CreateListingModal from '@/components/trades/CreateListingModal'
import ChatModal from '@/components/trades/ChatModal'
import ConfirmModal from '@/components/ConfirmModal'

const RESOLVED_LABEL: Record<string, string> = { sold: '💰', traded: '🔄', cancelled: '✖️' }

function ListingCard({ l, mine, onInterest, onInterests, onResolve, onReopen, onDelete }: any) {
  const { t } = useTranslation()
  const img = l.photo || l.card?.image_normal
  const resolved = l.status === 'resolved'
  return (
    <div className={`surface overflow-hidden flex flex-col ${l.status !== 'active' ? 'opacity-60' : ''}`}>
      <div className="aspect-[63/88] bg-vault-card relative">
        {img ? <img src={img} alt={l.card?.name} className="w-full h-full object-cover" /> : null}
        {l.photo && <span className="absolute top-1 right-1 text-[9px] bg-black/70 text-white px-1.5 py-0.5 rounded">📷 real</span>}
        <span className="absolute bottom-1 left-1 text-[10px] bg-black/70 text-white px-1.5 py-0.5 rounded font-mono">{l.condition}{l.foil ? ' ⚡' : ''}</span>
        {resolved && (
          <span className="absolute inset-x-0 top-0 bg-vault-gold/90 text-black text-[10px] font-bold text-center py-0.5">
            {RESOLVED_LABEL[l.resolved_as] || ''} {t(`trades.resolved_${l.resolved_as}`)}
          </span>
        )}
      </div>
      <div className="p-3 flex-1 flex flex-col">
        <p className="text-sm font-medium text-vault-text truncate">{l.card?.name}</p>
        <div className="mt-1 mb-2 text-xs">
          {l.price != null && (
            <p className="font-mono font-bold text-green-400">
              ${l.price.toFixed(2)}
              {l.accepts_offers && <span className="text-vault-muted font-normal font-sans"> · {t('trades.acceptsOffersShort')}</span>}
            </p>
          )}
          {(l.wanted_cards?.length > 0 || l.wanted) && (
            <div className="text-vault-gold mt-0.5">
              <span className="text-[10px] uppercase tracking-wide text-vault-muted">🔄 {t('trades.acceptsInTrade')}</span>
              {l.wanted_cards?.length > 0 && (
                <p className="truncate" title={l.wanted_cards.map((w: any) => w.name).join(', ')}>
                  {l.wanted_cards.map((w: any) => w.name).join(', ')}
                </p>
              )}
              {l.wanted && <p className="truncate text-vault-muted" title={l.wanted}>{l.wanted}</p>}
            </div>
          )}
        </div>
        {l.notes && <p className="text-[11px] text-vault-muted line-clamp-2 mb-2">{l.notes}</p>}
        <div className="mt-auto flex items-center gap-2">
          <Avatar value={l.seller?.avatar} size={20} />
          <span className="text-xs text-vault-muted truncate flex-1">{l.seller?.display_name || l.seller?.username}</span>
        </div>
        {mine ? (
          <div className="mt-2 space-y-1.5">
            <button
              onClick={() => onInterests(l)}
              className={`w-full text-xs flex items-center justify-center gap-1.5 rounded-lg py-1.5 border ${l.interests ? 'border-vault-accent/40 text-vault-accent bg-vault-accent/10' : 'border-vault-border text-vault-muted'}`}
            >
              <Bell size={12} /> {t('trades.viewInterests', { count: l.interests || 0 })}
            </button>
            {resolved ? (
              <div className="flex gap-1">
                <button onClick={() => onReopen(l)} className="flex-1 text-[11px] text-vault-muted hover:text-vault-gold py-1">{t('trades.reopen')}</button>
                <button onClick={() => onDelete(l)} title={t('common.delete')} className="px-2 rounded border border-vault-border text-vault-muted hover:text-red-400"><Trash2 size={13} /></button>
              </div>
            ) : (
              <div className="flex gap-1">
                <button onClick={() => onResolve(l, 'sold')} className="flex-1 text-[11px] py-1 rounded border border-green-500/30 text-green-400 hover:bg-green-500/10">{t('trades.markSold')}</button>
                <button onClick={() => onResolve(l, 'traded')} className="flex-1 text-[11px] py-1 rounded border border-vault-gold/30 text-vault-gold hover:bg-vault-gold/10">{t('trades.markTraded')}</button>
                <button onClick={() => onDelete(l)} className="px-2 text-vault-muted hover:text-red-400 border border-vault-border rounded"><Trash2 size={13} /></button>
              </div>
            )}
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
  const [params] = useSearchParams()
  const [tab, setTab] = useState<'browse' | 'mine' | 'chats'>('browse')
  const [search, setSearch] = useState(params.get('q') || '')
  const [showCreate, setShowCreate] = useState(false)
  const [interestFor, setInterestFor] = useState<any>(null)
  const [interestMsg, setInterestMsg] = useState('')
  const [interestsFor, setInterestsFor] = useState<any>(null)  // owner viewing who's interested
  const [chat, setChat] = useState<{ id: number; other?: any } | null>(null)
  const [notice, setNotice] = useState('')

  const { data: browse } = useQuery({ queryKey: ['listings', search], queryFn: () => listingsApi.browse({ q: search || undefined, per_page: 48 }), enabled: tab === 'browse' })
  const { data: mine = [] } = useQuery({ queryKey: ['listings-mine'], queryFn: listingsApi.mine, enabled: tab === 'mine' })
  const { data: pstats } = useQuery({ queryKey: ['listings-stats'], queryFn: listingsApi.stats })
  const { data: conversations = [] } = useQuery({ queryKey: ['conversations'], queryFn: listingsApi.conversations })
  const { data: interestList = [] } = useQuery({
    queryKey: ['listing-interests', interestsFor?.id],
    queryFn: () => listingsApi.interests(interestsFor.id),
    enabled: !!interestsFor,
  })

  const invalidateMine = () => {
    qc.invalidateQueries({ queryKey: ['listings-mine'] })
    qc.invalidateQueries({ queryKey: ['listings-stats'] })
  }
  const delMut = useMutation({ mutationFn: (l: any) => listingsApi.remove(l.id), onSuccess: invalidateMine })
  const [deleteTarget, setDeleteTarget] = useState<any>(null)
  const [deleteConvTarget, setDeleteConvTarget] = useState<any>(null)
  const delConvMut = useMutation({
    mutationFn: (c: any) => listingsApi.deleteConversation(c.interest_id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['conversations'] }),
  })
  const resolveMut = useMutation({ mutationFn: (v: { l: any; outcome: string }) => listingsApi.resolve(v.l.id, v.outcome), onSuccess: invalidateMine })
  const reopenMut = useMutation({ mutationFn: (l: any) => listingsApi.setStatus(l.id, 'active'), onSuccess: invalidateMine })
  const interestMut = useMutation({
    mutationFn: () => listingsApi.interest(interestFor.id, interestMsg),
    onSuccess: () => { setInterestFor(null); setInterestMsg(''); setNotice(t('trades.interestSent')) },
  })

  const items = browse?.items || []
  const myInterestTotal = mine.reduce((s: number, l: any) => s + (l.status === 'active' ? (l.interests || 0) : 0), 0)

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold text-vault-gold">{t('trades.title')}</h1>
          <p className="text-vault-muted text-sm mt-0.5">{t('trades.subtitle')}</p>
          {pstats && (pstats.sold + pstats.traded) > 0 && (
            <p className="text-xs text-vault-muted mt-1">
              💰 {t('trades.statSold', { count: pstats.sold })} · 🔄 {t('trades.statTraded', { count: pstats.traded })}
            </p>
          )}
        </div>
        <button onClick={() => canCreate ? setShowCreate(true) : navigate('/premium')} className="btn-primary flex items-center gap-2">
          {canCreate ? <Plus size={16} /> : <Lock size={14} />} {t('trades.newListing')}
        </button>
      </div>

      {notice && <div className="surface p-3 mb-4 text-sm text-green-400 border-green-500/30">{notice}</div>}

      <div className="flex gap-2 mb-5">
        {(['browse', 'mine', 'chats'] as const).map(tb => (
          <button key={tb} onClick={() => setTab(tb)} className={`px-4 py-2 rounded-lg text-sm transition-all flex items-center gap-2 ${tab === tb ? 'bg-vault-accent/20 text-vault-accent border border-vault-accent/30' : 'text-vault-muted hover:text-vault-text'}`}>
            {tb === 'browse' ? t('trades.marketplace') : tb === 'mine' ? t('trades.mine') : t('trades.chats')}
            {tb === 'mine' && myInterestTotal > 0 && (
              <span className="text-[10px] font-bold bg-vault-accent text-white rounded-full px-1.5 py-0.5 leading-none">{myInterestTotal}</span>
            )}
            {tb === 'chats' && conversations.length > 0 && (
              <span className="text-[10px] font-bold bg-vault-card text-vault-text rounded-full px-1.5 py-0.5 leading-none">{conversations.length}</span>
            )}
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
      ) : tab === 'mine' ? (
        mine.length === 0 ? <p className="surface p-10 text-center text-vault-muted">{t('trades.noMine')}</p> : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {mine.map((l: any) => (
              <ListingCard
                key={l.id} l={l} mine
                onInterests={setInterestsFor}
                onResolve={(x: any, outcome: string) => resolveMut.mutate({ l: x, outcome })}
                onReopen={(x: any) => reopenMut.mutate(x)}
                onDelete={(x: any) => setDeleteTarget(x)}
              />
            ))}
          </div>
        )
      ) : (
        conversations.length === 0 ? <p className="surface p-10 text-center text-vault-muted">{t('trades.noChats')}</p> : (
          <div className="space-y-2 max-w-2xl">
            {conversations.map((c: any) => (
              <div key={c.interest_id}
                className="surface p-3 flex items-center gap-3 hover:border-vault-accent/40 group">
                <button onClick={() => setChat({ id: c.interest_id, other: c.other })}
                  className="flex items-center gap-3 flex-1 min-w-0 text-left">
                  {c.card?.image_small && <img src={c.card.image_small} className="w-8 rounded shadow flex-shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-vault-text truncate">{c.card?.name}</p>
                    <p className="text-xs text-vault-muted truncate">
                      <span className="text-vault-accent">{c.role === 'seller' ? t('trades.roleSeller') : t('trades.roleBuyer')}</span>
                      {c.other?.username ? ` · ${c.other.display_name || c.other.username}` : ''}
                      {c.last_message ? ` · ${c.last_message}` : ''}
                    </p>
                  </div>
                </button>
                {c.status !== 'open' && <span className="text-[10px] text-vault-gold flex-shrink-0">{t(`trades.resolved_${c.status}`)}</span>}
                <button onClick={() => setDeleteConvTarget(c)} title={t('trades.deleteConv')}
                  className="flex-shrink-0 p-1.5 rounded-lg text-vault-muted hover:text-red-400 hover:bg-red-400/10 sm:opacity-0 sm:group-hover:opacity-100 transition-all">
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
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

      {/* Owner: who's interested */}
      {interestsFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setInterestsFor(null)} />
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="relative z-10 surface p-6 w-full max-w-md max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-display font-bold text-vault-gold flex items-center gap-2"><Bell size={16} /> {t('trades.interestsTitle')}</h3>
              <button onClick={() => setInterestsFor(null)} className="text-vault-muted hover:text-vault-text"><X size={18} /></button>
            </div>
            <p className="text-xs text-vault-muted mb-4 truncate">{interestsFor.card?.name}</p>
            <div className="flex-1 overflow-y-auto -mx-1 px-1">
              {interestList.length === 0 ? (
                <p className="text-sm text-vault-muted text-center py-8">{t('trades.noInterests')}</p>
              ) : (
                <div className="space-y-2">
                  {interestList.map((it: any) => (
                    <div key={it.id} className="rounded-xl border border-vault-border p-3">
                      <div className="flex items-center gap-2">
                        <Avatar value={it.buyer?.avatar} size={24} />
                        <Link to={`/u/${it.buyer?.username}`} className="text-sm font-medium text-vault-text hover:text-vault-accent flex items-center gap-1">
                          {it.buyer?.display_name || it.buyer?.username}
                          <ExternalLink size={11} className="text-vault-muted" />
                        </Link>
                      </div>
                      {it.message && <p className="text-xs text-vault-muted mt-2 bg-vault-card/50 rounded-lg p-2">{it.message}</p>}
                      <button
                        onClick={() => { setChat({ id: it.id, other: it.buyer }); setInterestsFor(null) }}
                        className="mt-2 w-full text-xs btn-ghost !py-1.5 flex items-center justify-center gap-1.5 border border-vault-accent/30"
                      >
                        <MessageCircle size={13} /> {t('trades.openChat')}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <p className="text-[11px] text-vault-muted mt-4 pt-3 border-t border-vault-border">{t('trades.interestsHint')}</p>
          </motion.div>
        </div>
      )}

      {chat && <ChatModal interestId={chat.id} other={chat.other} onClose={() => setChat(null)} />}

      <ConfirmModal
        open={!!deleteTarget}
        danger
        title={t('trades.deleteTitle')}
        message={deleteTarget?.interests > 0
          ? t('trades.confirmDeleteInterested', { count: deleteTarget.interests })
          : t('trades.confirmDelete')}
        confirmLabel={t('common.delete')}
        onConfirm={() => { delMut.mutate(deleteTarget); setDeleteTarget(null) }}
        onClose={() => setDeleteTarget(null)}
      />

      <ConfirmModal
        open={!!deleteConvTarget}
        danger
        title={t('trades.deleteConvTitle')}
        message={t('trades.confirmDeleteConv')}
        confirmLabel={t('common.delete')}
        onConfirm={() => { delConvMut.mutate(deleteConvTarget); setDeleteConvTarget(null) }}
        onClose={() => setDeleteConvTarget(null)}
      />
    </div>
  )
}

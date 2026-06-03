import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { friendsApi } from '@/lib/api'
import { UserPlus, Check, X, Users, Clock, Send, ExternalLink } from 'lucide-react'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'

export default function FriendsPage() {
  const { t } = useTranslation()
  const [identifier, setIdentifier] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const qc = useQueryClient()

  const { data: friends = [] } = useQuery({ queryKey: ['friends'], queryFn: friendsApi.list })
  const { data: requests } = useQuery({ queryKey: ['friend-requests'], queryFn: friendsApi.requests })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['friends'] })
    qc.invalidateQueries({ queryKey: ['friend-requests'] })
  }

  const requestMut = useMutation({
    mutationFn: (id: string) => friendsApi.request(id),
    onSuccess: () => { setMsg({ ok: true, text: t('friends.sent') }); setIdentifier(''); invalidate() },
    onError: (e: any) => setMsg({ ok: false, text: e?.response?.data?.detail || t('friends.sendError') }),
  })
  const acceptMut = useMutation({ mutationFn: (id: number) => friendsApi.accept(id), onSuccess: invalidate })
  const removeMut = useMutation({ mutationFn: (id: number) => friendsApi.remove(id), onSuccess: invalidate })

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold text-vault-gold">{t('friends.title')}</h1>
        <p className="text-vault-muted text-sm mt-0.5">{t('friends.subtitle')}</p>
      </div>

      {/* Add friend */}
      <form
        onSubmit={(e) => { e.preventDefault(); if (identifier.trim()) requestMut.mutate(identifier.trim()) }}
        className="surface p-4 mb-6"
      >
        <label className="text-xs text-vault-muted font-medium mb-2 block">{t('friends.addLabel')}</label>
        <div className="flex gap-2">
          <input
            className="input-field flex-1"
            placeholder={t('friends.addPlaceholder')}
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
          />
          <button type="submit" disabled={requestMut.isPending} className="btn-primary flex items-center gap-2 disabled:opacity-40">
            <UserPlus size={16} /> {t('friends.add')}
          </button>
        </div>
        {msg && <p className={`text-xs mt-2 ${msg.ok ? 'text-green-400' : 'text-red-400'}`}>{msg.text}</p>}
      </form>

      {/* Incoming requests */}
      {requests?.incoming?.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-medium text-vault-text mb-2 flex items-center gap-2"><Clock size={14} /> {t('friends.incoming')}</h2>
          <div className="space-y-2">
            {requests.incoming.map((r: any) => (
              <motion.div key={r.friendship_id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="surface p-3 flex items-center justify-between">
                <div>
                  <Link to={`/u/${r.username}`} className="text-sm text-vault-text font-medium hover:text-vault-accent inline-flex items-center gap-1">
                    {r.display_name || r.username} <ExternalLink size={11} className="text-vault-muted" />
                  </Link>
                  {r.display_name && <p className="text-xs text-vault-muted">@{r.username}</p>}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => acceptMut.mutate(r.friendship_id)} className="btn-primary !py-1.5 flex items-center gap-1 text-xs"><Check size={14} /> {t('friends.accept')}</button>
                  <button onClick={() => removeMut.mutate(r.friendship_id)} className="btn-ghost !py-1.5 flex items-center gap-1 text-xs"><X size={14} /> {t('friends.decline')}</button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Outgoing requests */}
      {requests?.outgoing?.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-medium text-vault-text mb-2 flex items-center gap-2"><Send size={14} /> {t('friends.outgoing')}</h2>
          <div className="space-y-2">
            {requests.outgoing.map((r: any) => (
              <div key={r.friendship_id} className="surface p-3 flex items-center justify-between opacity-70">
                <p className="text-sm text-vault-text">{r.username}</p>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-vault-muted">{t('friends.pending')}</span>
                  <button onClick={() => removeMut.mutate(r.friendship_id)} className="text-vault-muted hover:text-red-400"><X size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Friends list */}
      <h2 className="text-sm font-medium text-vault-text mb-2 flex items-center gap-2"><Users size={14} /> {t('friends.yourFriends', { count: friends.length })}</h2>
      {friends.length === 0 ? (
        <p className="text-vault-muted text-sm py-8 text-center surface">{t('friends.noFriends')}</p>
      ) : (
        <div className="space-y-2">
          {friends.map((f: any) => (
            <div key={f.friendship_id} className="surface p-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-vault-accent/20 border border-vault-accent/40 flex items-center justify-center text-vault-accent text-xs font-bold">
                  {f.username?.[0]?.toUpperCase()}
                </div>
                <div>
                  <Link to={`/u/${f.username}`} className="text-sm text-vault-text font-medium hover:text-vault-accent inline-flex items-center gap-1">
                    {f.display_name || f.username} <ExternalLink size={11} className="text-vault-muted" />
                  </Link>
                  {f.display_name && <p className="text-xs text-vault-muted">@{f.username}</p>}
                </div>
              </div>
              <button onClick={() => removeMut.mutate(f.friendship_id)} className="text-vault-muted hover:text-red-400 text-xs">{t('friends.remove')}</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

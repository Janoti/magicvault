import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { X, Send, ExternalLink } from 'lucide-react'
import { listingsApi } from '@/lib/api'
import { useAuthStore } from '@/store/auth'

const STATUS_LABEL: Record<string, string> = { sold: '💰', traded: '🔄', cancelled: '✖️' }

export default function ChatModal({ interestId, other, onClose }: { interestId: number; other?: any; onClose: () => void }) {
  const { t } = useTranslation()
  const me = useAuthStore((s) => s.user)
  const qc = useQueryClient()
  const [text, setText] = useState('')
  const endRef = useRef<HTMLDivElement>(null)

  const { data } = useQuery({
    queryKey: ['thread', interestId],
    queryFn: () => listingsApi.thread(interestId),
    refetchInterval: 8000, // light polling so new messages show up
  })

  const sendMut = useMutation({
    mutationFn: (body: string) => listingsApi.sendMessage(interestId, body),
    onSuccess: () => { setText(''); qc.invalidateQueries({ queryKey: ['thread', interestId] }) },
  })
  const resolveMut = useMutation({
    mutationFn: (outcome: string) => listingsApi.resolveThread(interestId, outcome),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['thread', interestId] })
      qc.invalidateQueries({ queryKey: ['listings-mine'] })
      qc.invalidateQueries({ queryKey: ['listings-stats'] })
      qc.invalidateQueries({ queryKey: ['conversations'] })
      onClose()
    },
  })

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [data?.messages?.length])

  const isOwner = data?.is_owner
  const resolved = data?.status && data.status !== 'open'
  const otherUser = other || {}

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="relative z-10 surface w-full max-w-md h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 p-4 border-b border-vault-border">
          {data?.listing?.card?.image_small && <img src={data.listing.card.image_small} className="w-8 rounded shadow" />}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-vault-text truncate">{data?.listing?.card?.name || '...'}</p>
            {otherUser.username && (
              <Link to={`/u/${otherUser.username}`} className="text-xs text-vault-muted hover:text-vault-accent inline-flex items-center gap-1">
                {otherUser.display_name || otherUser.username} <ExternalLink size={10} />
              </Link>
            )}
          </div>
          <button onClick={onClose} className="text-vault-muted hover:text-vault-text"><X size={18} /></button>
        </div>

        {resolved && (
          <div className="px-4 py-2 text-xs text-center bg-vault-gold/10 text-vault-gold border-b border-vault-border">
            {STATUS_LABEL[data.status]} {t(`trades.resolved_${data.status}`)}
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {(data?.messages || []).map((m: any) => {
            const mine = m.sender_id === me?.id
            return (
              <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${mine ? 'bg-vault-accent text-white rounded-br-sm' : 'bg-vault-card text-vault-text rounded-bl-sm'}`}>
                  {m.body}
                </div>
              </div>
            )
          })}
          {data?.messages?.length === 0 && <p className="text-center text-xs text-vault-muted py-8">{t('trades.chatEmpty')}</p>}
          <div ref={endRef} />
        </div>

        {/* Seller resolution */}
        {isOwner && !resolved && (
          <div className="px-4 py-2 border-t border-vault-border flex gap-1.5">
            <button onClick={() => resolveMut.mutate('sold')} className="flex-1 text-[11px] py-1.5 rounded border border-green-500/30 text-green-400 hover:bg-green-500/10">{t('trades.markSold')}</button>
            <button onClick={() => resolveMut.mutate('traded')} className="flex-1 text-[11px] py-1.5 rounded border border-vault-gold/30 text-vault-gold hover:bg-vault-gold/10">{t('trades.markTraded')}</button>
            <button onClick={() => resolveMut.mutate('cancelled')} className="flex-1 text-[11px] py-1.5 rounded border border-vault-border text-vault-muted hover:bg-vault-card">{t('trades.markCancelled')}</button>
          </div>
        )}

        {/* Composer */}
        {!resolved ? (
          <form
            onSubmit={(e) => { e.preventDefault(); if (text.trim()) sendMut.mutate(text.trim()) }}
            className="p-3 border-t border-vault-border flex gap-2"
          >
            <input className="input-field flex-1 text-sm" placeholder={t('trades.chatPh')} value={text} onChange={(e) => setText(e.target.value)} />
            <button type="submit" disabled={sendMut.isPending || !text.trim()} className="btn-primary !px-3 disabled:opacity-40"><Send size={15} /></button>
          </form>
        ) : (
          <p className="p-3 border-t border-vault-border text-[11px] text-vault-muted text-center">{t('trades.chatClosed')}</p>
        )}
      </motion.div>
    </div>
  )
}

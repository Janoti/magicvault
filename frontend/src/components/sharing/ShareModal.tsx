import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { X, Users, Link2, Check, Copy } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { friendsApi, sharesApi } from '@/lib/api'

interface ShareModalProps {
  resourceType: 'collection' | 'binder' | 'deck'
  resourceId?: number | null
  resourcelabel?: string
  onClose: () => void
}

export default function ShareModal({ resourceType, resourceId = null, resourcelabel, onClose }: ShareModalProps) {
  const [sharedFriends, setSharedFriends] = useState<number[]>([])
  const [publicUrl, setPublicUrl] = useState<string | null>(null)
  const [copying, setCopying] = useState(false)
  const [busy, setBusy] = useState(false)

  const { data: friends = [], isLoading } = useQuery({ queryKey: ['friends'], queryFn: friendsApi.list })

  const shareWith = async (friendId: number) => {
    setBusy(true)
    try {
      await sharesApi.shareWithFriend({ resource_type: resourceType, resource_id: resourceId, friend_id: friendId })
      setSharedFriends(prev => [...prev, friendId])
    } catch {}
    setBusy(false)
  }

  const makePublic = async () => {
    setBusy(true)
    try {
      const res = await sharesApi.createPublic({ resource_type: resourceType, resource_id: resourceId })
      setPublicUrl(`${window.location.origin}/p/${res.token}`)
    } catch {}
    setBusy(false)
  }

  const copy = async () => {
    if (!publicUrl) return
    await navigator.clipboard.writeText(publicUrl)
    setCopying(true)
    setTimeout(() => setCopying(false), 1500)
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative z-10 bg-vault-surface border border-vault-border rounded-2xl p-6 w-full max-w-md shadow-2xl"
        >
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="font-display font-bold text-vault-gold">Compartilhar</h3>
              <p className="text-xs text-vault-muted">{resourcelabel || resourceType}</p>
            </div>
            <button onClick={onClose} className="text-vault-muted hover:text-vault-text"><X size={18} /></button>
          </div>

          {/* Public link */}
          <div className="mb-5">
            <p className="text-xs text-vault-muted font-medium mb-2 flex items-center gap-2"><Link2 size={13} /> Link público</p>
            {publicUrl ? (
              <div className="flex gap-2">
                <input readOnly value={publicUrl} className="input-field text-xs flex-1" onFocus={e => e.target.select()} />
                <button onClick={copy} className="btn-ghost !px-3" title="Copiar">
                  {copying ? <Check size={15} className="text-green-400" /> : <Copy size={15} />}
                </button>
              </div>
            ) : (
              <button onClick={makePublic} disabled={busy} className="btn-ghost w-full text-sm disabled:opacity-40">
                Gerar link público (qualquer um com o link vê)
              </button>
            )}
          </div>

          {/* Friends */}
          <p className="text-xs text-vault-muted font-medium mb-2 flex items-center gap-2"><Users size={13} /> Amigos</p>
          {isLoading ? (
            <div className="py-6 flex justify-center"><div className="w-5 h-5 border-2 border-vault-accent border-t-transparent rounded-full animate-spin" /></div>
          ) : friends.length === 0 ? (
            <p className="text-xs text-vault-muted py-4 text-center">Você ainda não tem amigos. Adicione em "Amigos".</p>
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto">
              {friends.map((f: any) => {
                const done = sharedFriends.includes(f.id)
                return (
                  <div key={f.id} className="flex items-center justify-between p-2.5 rounded-lg border border-vault-border bg-vault-card">
                    <span className="text-sm text-vault-text">{f.username}</span>
                    <button
                      onClick={() => shareWith(f.id)}
                      disabled={busy || done}
                      className={`text-xs px-3 py-1 rounded-lg transition-colors ${done ? 'text-green-400' : 'text-vault-accent hover:bg-vault-accent/10'}`}
                    >
                      {done ? <span className="flex items-center gap-1"><Check size={13} /> Compartilhado</span> : 'Compartilhar'}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  )
}

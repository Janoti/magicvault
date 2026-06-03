import { useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useMutation } from '@tanstack/react-query'
import { Plus, Trash2, ExternalLink, Check, Upload } from 'lucide-react'
import { authApi } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { AVATARS } from '@/lib/avatars'
import Avatar from '@/components/Avatar'

// Resize an image file to a small square JPEG data URL (keeps the DB row small).
function fileToAvatar(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const size = 128
      const canvas = document.createElement('canvas')
      canvas.width = size; canvas.height = size
      const ctx = canvas.getContext('2d')!
      const scale = Math.max(size / img.width, size / img.height)
      const w = img.width * scale, h = img.height * scale
      ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h)
      resolve(canvas.toDataURL('image/jpeg', 0.8))
    }
    img.onerror = reject
    img.src = URL.createObjectURL(file)
  })
}

export default function AccountPage() {
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)

  const [displayName, setDisplayName] = useState(user?.display_name || '')
  const [username, setUsername] = useState(user?.username || '')
  const [email, setEmail] = useState(user?.email || '')
  const [avatar, setAvatar] = useState(user?.avatar || '')
  const [bio, setBio] = useState(user?.bio || '')
  const [links, setLinks] = useState<{ label: string; url: string }[]>(user?.links || [])
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { setMsg({ ok: false, text: 'Máx 2MB' }); return }
    try { setAvatar(await fileToAvatar(file)) } catch { setMsg({ ok: false, text: t('account.saveError') }) }
  }

  const mutation = useMutation({
    mutationFn: () => authApi.updateMe({
      display_name: displayName, username, email, avatar, bio,
      links: links.filter(l => l.label && l.url),
    }),
    onSuccess: (updated) => { setUser(updated); setMsg({ ok: true, text: t('account.saved') }) },
    onError: (e: any) => setMsg({ ok: false, text: e?.response?.data?.detail || t('account.saveError') }),
  })

  const updateLink = (i: number, field: 'label' | 'url', val: string) =>
    setLinks(ls => ls.map((l, idx) => idx === i ? { ...l, [field]: val } : l))

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-vault-gold">{t('account.title')}</h1>
          <p className="text-vault-muted text-sm mt-0.5">{t('account.subtitle')}</p>
        </div>
        {user?.username && (
          <Link to={`/u/${user.username}`} className="btn-ghost flex items-center gap-2 text-sm">
            <ExternalLink size={15} /> {t('account.viewProfile')}
          </Link>
        )}
      </div>

      {/* Avatar */}
      <div className="surface p-5 mb-4">
        <label className="text-xs text-vault-muted font-medium mb-3 block">{t('account.avatar')}</label>
        <div className="flex items-center gap-4 mb-3">
          <Avatar value={avatar} size={64} />
          <div>
            <p className="text-sm text-vault-muted mb-2">{user?.display_name || user?.username}</p>
            <button onClick={() => fileRef.current?.click()} className="btn-ghost !py-1.5 flex items-center gap-2 text-xs">
              <Upload size={14} /> {t('account.upload')}
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
          </div>
        </div>
        <div className="grid grid-cols-8 gap-2">
          {AVATARS.map(a => (
            <button
              key={a}
              onClick={() => setAvatar(a)}
              className={`aspect-square rounded-lg text-xl flex items-center justify-center border transition-all ${
                avatar === a ? 'border-vault-accent bg-vault-accent/15' : 'border-vault-border hover:border-vault-accent/40 bg-vault-card'
              }`}
            >
              {a}
            </button>
          ))}
        </div>
      </div>

      {/* Fields */}
      <div className="surface p-5 mb-4 space-y-4">
        <div>
          <label className="text-xs text-vault-muted font-medium mb-1.5 block">{t('account.displayName')}</label>
          <input className="input-field" value={displayName} onChange={e => setDisplayName(e.target.value)} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-vault-muted font-medium mb-1.5 block">{t('account.username')}</label>
            <input className="input-field" value={username} onChange={e => setUsername(e.target.value)} />
            <p className="text-[11px] text-vault-muted mt-1">{t('account.usernameHint')}</p>
          </div>
          <div>
            <label className="text-xs text-vault-muted font-medium mb-1.5 block">{t('account.email')}</label>
            <input type="email" className="input-field" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="text-xs text-vault-muted font-medium mb-1.5 block">{t('account.bio')}</label>
          <textarea className="input-field resize-none" rows={3} placeholder={t('account.bioPh')} value={bio} onChange={e => setBio(e.target.value)} />
        </div>
      </div>

      {/* Links */}
      <div className="surface p-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <label className="text-xs text-vault-muted font-medium">{t('account.links')}</label>
          <button onClick={() => setLinks(ls => [...ls, { label: '', url: '' }])} className="btn-ghost !py-1 flex items-center gap-1 text-xs">
            <Plus size={13} /> {t('account.addLink')}
          </button>
        </div>
        <div className="space-y-2">
          {links.map((l, i) => (
            <div key={i} className="flex gap-2">
              <input className="input-field flex-1" placeholder={t('account.label')} value={l.label} onChange={e => updateLink(i, 'label', e.target.value)} />
              <input className="input-field flex-[2]" placeholder="https://..." value={l.url} onChange={e => updateLink(i, 'url', e.target.value)} />
              <button onClick={() => setLinks(ls => ls.filter((_, idx) => idx !== i))} className="text-vault-muted hover:text-red-400 px-2"><Trash2 size={15} /></button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={() => { setMsg(null); mutation.mutate() }} disabled={mutation.isPending} className="btn-primary flex items-center gap-2 disabled:opacity-50">
          {mutation.isPending ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Check size={16} />}
          {t('account.save')}
        </button>
        {msg && <span className={`text-sm ${msg.ok ? 'text-green-400' : 'text-red-400'}`}>{msg.text}</span>}
      </div>
    </div>
  )
}

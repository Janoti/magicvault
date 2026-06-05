import { useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useMutation } from '@tanstack/react-query'
import { Plus, Trash2, ExternalLink, Check, Upload, MapPin, MailCheck, MailWarning } from 'lucide-react'
import { authApi, lookupCep } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { AVATARS } from '@/lib/avatars'
import Avatar from '@/components/Avatar'

// Quick-add suggestions for the links section.
const LINK_SUGGESTIONS = [
  { label: 'Instagram', url: 'https://instagram.com/' },
  { label: 'TikTok', url: 'https://tiktok.com/@' },
  { label: 'Facebook', url: 'https://facebook.com/' },
  { label: 'Loja', url: 'https://' },
  { label: 'Site', url: 'https://' },
]

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
  const [contact, setContact] = useState(user?.contact || '')
  const [contactPublic, setContactPublic] = useState(!!user?.contact_public)
  const [country, setCountry] = useState(user?.country || '')
  const [stateProv, setStateProv] = useState(user?.state || '')
  const [city, setCity] = useState(user?.city || '')
  const [cep, setCep] = useState('')
  const [cepLoading, setCepLoading] = useState(false)
  const [locationPublic, setLocationPublic] = useState(!!user?.location_public)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [verifyMsg, setVerifyMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const tryCep = async (value: string) => {
    setCep(value)
    if (value.replace(/\D/g, '').length !== 8) return
    setCepLoading(true)
    const r = await lookupCep(value)
    if (r) { setStateProv(r.state); setCity(r.city); if (!country) setCountry('Brasil') }
    setCepLoading(false)
  }

  const verifyMutation = useMutation({
    mutationFn: () => authApi.sendVerification(),
    onSuccess: (r: any) => setVerifyMsg(r?.message || t('account.verifySent')),
    onError: () => setVerifyMsg(t('account.saveError')),
  })

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
      contact, contact_public: contactPublic,
      country, state: stateProv, city, location_public: locationPublic,
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

      {/* Email confirmation (soft) */}
      {user && (
        user.email_verified ? (
          <div className="surface p-4 mb-4 flex items-center gap-3 border-green-500/30 bg-green-500/5">
            <MailCheck size={18} className="text-green-400 shrink-0" />
            <p className="text-sm text-vault-text">{t('account.emailVerified')}</p>
          </div>
        ) : (
          <div className="surface p-4 mb-4 border-amber-500/30 bg-amber-500/5">
            <div className="flex items-start gap-3">
              <MailWarning size={18} className="text-amber-400 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-vault-text">{t('account.verifyTitle')}</p>
                <p className="text-xs text-vault-muted mt-0.5">{t('account.verifyWhy')}</p>
                {verifyMsg && <p className="text-xs text-green-400 mt-2">{verifyMsg}</p>}
              </div>
              <button onClick={() => verifyMutation.mutate()} disabled={verifyMutation.isPending}
                className="btn-primary !py-1.5 text-xs whitespace-nowrap shrink-0 disabled:opacity-60">
                {verifyMutation.isPending ? t('account.verifySending') : t('account.verifySend')}
              </button>
            </div>
          </div>
        )
      )}

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
          <p className="text-[11px] text-vault-muted mt-1">{t('account.displayNameHint')}</p>
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
        <div>
          <label className="text-xs text-vault-muted font-medium mb-1.5 block">{t('account.contact')}</label>
          <input className="input-field" placeholder={t('account.contactPh')} value={contact} onChange={e => setContact(e.target.value)} />
          <label className="flex items-center gap-2 mt-2 text-xs text-vault-text cursor-pointer">
            <input type="checkbox" checked={contactPublic} onChange={e => setContactPublic(e.target.checked)} />
            {t('account.contactPublic')}
          </label>
        </div>
      </div>

      {/* Location */}
      <div className="surface p-5 mb-4 space-y-4">
        <div className="flex items-center gap-2">
          <MapPin size={16} className="text-vault-accent" />
          <label className="text-xs text-vault-muted font-medium">{t('account.location')}</label>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="text-xs text-vault-muted font-medium mb-1.5 block">{t('account.cep')}</label>
            <div className="relative">
              <input className="input-field" placeholder="00000-000" value={cep} onChange={e => tryCep(e.target.value)} />
              {cepLoading && <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-vault-accent border-t-transparent rounded-full animate-spin" />}
            </div>
            <p className="text-[11px] text-vault-muted mt-1">{t('account.cepHint')}</p>
          </div>
          <div>
            <label className="text-xs text-vault-muted font-medium mb-1.5 block">{t('account.state')}</label>
            <input className="input-field" value={stateProv} onChange={e => setStateProv(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-vault-muted font-medium mb-1.5 block">{t('account.city')}</label>
            <input className="input-field" value={city} onChange={e => setCity(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="text-xs text-vault-muted font-medium mb-1.5 block">{t('account.country')}</label>
          <input className="input-field" value={country} onChange={e => setCountry(e.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-xs text-vault-text cursor-pointer">
          <input type="checkbox" checked={locationPublic} onChange={e => setLocationPublic(e.target.checked)} />
          {t('account.locationPublic')}
        </label>
      </div>

      {/* Links */}
      <div className="surface p-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <label className="text-xs text-vault-muted font-medium">{t('account.links')}</label>
          <button onClick={() => setLinks(ls => [...ls, { label: '', url: '' }])} className="btn-ghost !py-1 flex items-center gap-1 text-xs">
            <Plus size={13} /> {t('account.addLink')}
          </button>
        </div>
        {/* Quick-add suggestions */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          <span className="text-[11px] text-vault-muted self-center">{t('account.linkSuggest')}:</span>
          {LINK_SUGGESTIONS.map(s => (
            <button key={s.label} onClick={() => setLinks(ls => [...ls, { ...s }])}
              className="text-[11px] px-2 py-1 rounded-full border border-vault-border bg-vault-card/40 text-vault-muted hover:text-vault-text hover:border-vault-accent/40 transition-all inline-flex items-center gap-1">
              <Plus size={10} /> {s.label}
            </button>
          ))}
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

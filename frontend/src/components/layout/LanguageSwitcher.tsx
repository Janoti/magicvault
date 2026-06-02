import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Globe, Check } from 'lucide-react'
import { LANGUAGES } from '@/i18n'

export default function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { i18n } = useTranslation()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const current = LANGUAGES.find(l => i18n.language?.startsWith(l.code)) || LANGUAGES[0]

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 text-sm text-vault-muted hover:text-vault-text transition-colors px-2 py-1.5 rounded-lg hover:bg-vault-card"
        title="Idioma"
      >
        <Globe size={15} />
        {compact ? <span>{current.flag}</span> : <span>{current.flag} {current.label}</span>}
      </button>
      {open && (
        <div className="absolute right-0 bottom-full mb-1 w-40 bg-vault-surface border border-vault-border rounded-lg shadow-xl py-1 z-50">
          {LANGUAGES.map(l => (
            <button
              key={l.code}
              onClick={() => { i18n.changeLanguage(l.code); setOpen(false) }}
              className="w-full flex items-center justify-between px-3 py-2 text-sm text-vault-text hover:bg-vault-card transition-colors"
            >
              <span>{l.flag} {l.label}</span>
              {current.code === l.code && <Check size={14} className="text-vault-accent" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

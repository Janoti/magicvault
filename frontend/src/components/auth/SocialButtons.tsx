import { useEffect, useState } from 'react'
import { authApi, oauthStartUrl } from '@/lib/api'

const PROVIDERS: Record<string, { label: string; icon: string; className: string }> = {
  google: { label: 'Google', icon: 'G', className: 'bg-white text-[#1a1f35] hover:bg-gray-100' },
  facebook: { label: 'Facebook', icon: 'f', className: 'bg-[#1877F2] text-white hover:brightness-110' },
  steam: { label: 'Steam', icon: '🎮', className: 'bg-[#171a21] text-white hover:bg-[#2a2f3a] border border-white/10' },
}

// Renders one button per backend-enabled social provider. Each is a full-page
// navigation to the backend /start endpoint (OAuth needs a top-level redirect,
// not an XHR). Renders nothing while loading or if no provider is configured.
export default function SocialButtons({ label = 'ou continue com' }: { label?: string }) {
  const [providers, setProviders] = useState<string[]>([])

  useEffect(() => {
    authApi.oauthProviders().then(d => setProviders(d.providers || [])).catch(() => setProviders([]))
  }, [])

  if (providers.length === 0) return null

  return (
    <div className="mt-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="h-px flex-1 bg-white/10" />
        <span className="text-xs text-vault-muted">{label}</span>
        <div className="h-px flex-1 bg-white/10" />
      </div>
      <div className="space-y-2">
        {providers.map(p => {
          const meta = PROVIDERS[p]
          if (!meta) return null
          return (
            <a
              key={p}
              href={oauthStartUrl(p)}
              className={`w-full py-2.5 rounded-lg font-medium text-sm flex items-center justify-center gap-2.5 transition ${meta.className}`}
            >
              <span className="font-bold w-5 text-center">{meta.icon}</span>
              <span>{meta.label}</span>
            </a>
          )
        })}
      </div>
    </div>
  )
}

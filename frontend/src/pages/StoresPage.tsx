import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { MapPin, Phone, Mail, Globe, Instagram, BadgeCheck, CalendarDays, Store as StoreIcon } from 'lucide-react'
import { useSeo, JsonLd } from '@/components/Seo'
import PublicPage from '@/components/PublicPage'
import { eventsApi } from '@/lib/api'

function igUrl(handle: string) {
  const h = handle.replace(/^@/, '').trim()
  return h.startsWith('http') ? h : `https://instagram.com/${h}`
}

function StoreCard({ s }: { s: any }) {
  const { t } = useTranslation()
  return (
    <div className={`surface p-5 ${s.featured ? 'border-vault-gold/40 bg-gradient-to-br from-vault-gold/[0.06] to-transparent' : ''}`}>
      <div className="flex items-start gap-2 mb-2 flex-wrap">
        <h3 className="font-display font-bold text-vault-text text-lg">{s.name}</h3>
        {s.featured && <span className="text-[10px] uppercase tracking-wide bg-vault-gold/15 text-vault-gold border border-vault-gold/30 rounded-full px-2 py-0.5">★ {t('stores.partner')}</span>}
        {s.is_wpn && <span className="text-[10px] uppercase tracking-wide bg-vault-accent/15 text-vault-accent border border-vault-accent/30 rounded-full px-2 py-0.5 inline-flex items-center gap-1"><BadgeCheck size={11} /> WPN</span>}
      </div>
      {s.notes && <p className="text-sm text-vault-muted mb-3 leading-relaxed">{s.notes}</p>}
      <div className="space-y-1.5 text-sm">
        {(s.address || s.neighborhood) && (
          <p className="flex items-start gap-2 text-vault-muted"><MapPin size={14} className="mt-0.5 shrink-0" /> {[s.neighborhood, s.address].filter(Boolean).join(' — ')}</p>
        )}
        {s.phone && <a href={`tel:${s.phone.replace(/[^+\d]/g, '')}`} className="flex items-center gap-2 text-vault-muted hover:text-vault-accent"><Phone size={14} /> {s.phone}{s.phone2 ? ` · ${s.phone2}` : ''}</a>}
        {s.email && <a href={`mailto:${s.email}`} className="flex items-center gap-2 text-vault-muted hover:text-vault-accent"><Mail size={14} /> {s.email}</a>}
        {s.website && <a href={s.website} target="_blank" rel="noreferrer noopener" className="flex items-center gap-2 text-vault-muted hover:text-vault-accent"><Globe size={14} /> {s.website.replace(/^https?:\/\//, '')}</a>}
        {s.instagram && <a href={igUrl(s.instagram)} target="_blank" rel="noreferrer noopener" className="flex items-center gap-2 text-vault-muted hover:text-vault-accent"><Instagram size={14} /> {s.instagram}</a>}
      </div>
    </div>
  )
}

export default function StoresPage() {
  const { t } = useTranslation()
  useSeo({ title: `${t('stores.title')} — VaultSpell`, description: t('stores.subtitle'), path: '/lojas' })
  const { data: stores = [], isLoading } = useQuery({ queryKey: ['stores'], queryFn: () => eventsApi.stores() })

  // schema.org structured data for each store (local SEO / rich results).
  const storeLd = stores.map((s: any) => ({
    '@context': 'https://schema.org',
    '@type': 'Store',
    name: s.name,
    address: {
      '@type': 'PostalAddress',
      addressLocality: s.city,
      ...(s.address ? { streetAddress: s.address } : {}),
      ...(s.neighborhood ? { addressRegion: s.neighborhood } : {}),
      addressCountry: 'BR',
    },
    ...(s.phone ? { telephone: s.phone } : {}),
    ...(s.email ? { email: s.email } : {}),
    ...(s.website ? { url: s.website } : {}),
    sameAs: [s.website, s.instagram ? `https://instagram.com/${s.instagram.replace(/^@/, '')}` : null].filter(Boolean),
  }))

  // Group by city; featured first within each city.
  const byCity = useMemo(() => {
    const m = new Map<string, any[]>()
    for (const s of stores) { if (!m.has(s.city)) m.set(s.city, []); m.get(s.city)!.push(s) }
    for (const arr of m.values()) arr.sort((a, b) => Number(b.featured) - Number(a.featured) || a.name.localeCompare(b.name))
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [stores])

  return (
    <PublicPage nav={[{ to: '/eventos', label: t('stores.eventsNav') }]}>
      {storeLd.length > 0 && <JsonLd data={storeLd} />}

      <section className="max-w-5xl mx-auto px-6 pt-12 pb-4 text-center">
        <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-vault-gold bg-vault-gold/10 border border-vault-gold/30 rounded-full px-3 py-1 mb-4">
          <StoreIcon size={13} /> {t('stores.badge')}
        </div>
        <h1 className="font-display text-4xl sm:text-5xl font-bold text-vault-gold leading-tight">{t('stores.title')}</h1>
        <p className="text-vault-muted text-lg mt-3 max-w-2xl mx-auto">{t('stores.subtitle')}</p>
      </section>

      <section className="max-w-4xl mx-auto px-6 pb-20">
        {isLoading ? (
          <div className="py-16 text-center"><div className="w-7 h-7 border-2 border-vault-accent border-t-transparent rounded-full animate-spin mx-auto" /></div>
        ) : stores.length === 0 ? (
          <p className="surface p-10 text-center text-vault-muted">{t('stores.empty')}</p>
        ) : (
          <div className="space-y-8">
            {byCity.map(([city, list]) => (
              <div key={city}>
                <h2 className="font-display text-xl font-bold text-vault-gold mb-3">📍 {city}</h2>
                <div className="grid sm:grid-cols-2 gap-3">
                  {list.map((s: any) => <StoreCard key={s.id} s={s} />)}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-10 surface p-6 text-center border-vault-accent/20">
          <p className="text-sm text-vault-text mb-1">{t('stores.ctaTitle')}</p>
          <p className="text-xs text-vault-muted mb-4">{t('stores.ctaBody')}</p>
          <Link to="/eventos" className="inline-flex items-center gap-2 text-sm text-vault-accent hover:underline">
            <CalendarDays size={15} /> {t('stores.seeEvents')}
          </Link>
        </div>
      </section>
    </PublicPage>
  )
}

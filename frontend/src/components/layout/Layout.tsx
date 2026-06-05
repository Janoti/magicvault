import { useState, useRef, useEffect, type ReactNode } from 'react'
import { Outlet, NavLink, useNavigate, Link } from 'react-router-dom'
import { useAuthStore } from '@/store/auth'
import {
  Library, Search, BookOpen, Star, Package, LogOut, User, Swords, ScanLine, Users, Share2, ShieldCheck,
  ChevronDown, Settings, ArrowLeftRight, Crown, CalendarDays, Layers, Menu, X
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { collectionApi } from '@/lib/api'
import { useFlags } from '@/lib/flags'
import { useUsdBrl } from '@/components/cards/CardPrice'
import LanguageSwitcher from './LanguageSwitcher'
import EmberBackground from '@/components/EmberBackground'
import FeedbackModal from '@/components/FeedbackModal'
import { MessageSquare } from 'lucide-react'

const navGroups = [
  {
    label: 'nav.groupCollection',
    items: [
      { to: '/collection', icon: Library, key: 'nav.collection' },
      { to: '/search', icon: Search, key: 'nav.search' },
      { to: '/scan', icon: ScanLine, key: 'nav.scan' },
      { to: '/sets', icon: Package, key: 'nav.sets' },
    ],
  },
  {
    label: 'nav.groupBuild',
    items: [
      { to: '/decks', icon: Swords, key: 'nav.decks' },
      { to: '/binders', icon: BookOpen, key: 'nav.binders' },
      { to: '/wishlist', icon: Star, key: 'nav.wishlist' },
      { to: '/decks-comunidade', icon: Layers, key: 'nav.communityDecks' },
    ],
  },
  {
    label: 'nav.groupSocial',
    items: [
      { to: '/friends', icon: Users, key: 'nav.friends' },
      { to: '/shared', icon: Share2, key: 'nav.shared' },
      { to: '/trades', icon: ArrowLeftRight, key: 'trades.nav' },
      { to: '/eventos', icon: CalendarDays, key: 'nav.events', flag: 'events' as const },
    ],
  },
]

export default function Layout({ children }: { children?: ReactNode }) {
  const { user, logout } = useAuthStore()
  const { t } = useTranslation()
  const flags = useFlags()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showFeedback, setShowFeedback] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const { data: stats } = useQuery({
    queryKey: ['collection-stats'],
    queryFn: collectionApi.stats,
  })
  const usdBrl = useUsdBrl()

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  return (
    <div className="flex h-screen overflow-hidden bg-vault-bg">
      <EmberBackground />
      {/* Mobile backdrop */}
      {sidebarOpen && <div className="fixed inset-0 bg-black/60 z-30 md:hidden" onClick={() => setSidebarOpen(false)} />}
      {/* Sidebar (off-canvas drawer on mobile, static on md+) */}
      <aside className={`w-60 flex-shrink-0 border-r border-vault-border bg-vault-surface/95 backdrop-blur-sm flex flex-col z-40 fixed inset-y-0 left-0 transform transition-transform duration-200 md:static md:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <button onClick={() => setSidebarOpen(false)} aria-label="Fechar" className="md:hidden absolute top-4 right-3 z-10 text-vault-muted hover:text-vault-text"><X size={20} /></button>
        {/* Logo */}
        <Link to="/" onClick={() => setSidebarOpen(false)} className="block p-5 border-b border-vault-border hover:bg-vault-card/30 transition-colors">
          <h1 className="font-display text-xl font-bold text-vault-gold tracking-wider">
            📖 VaultSpell
          </h1>
          <p className="text-xs text-vault-muted mt-0.5">{t('nav.subtitle')}</p>
        </Link>

        {/* User info + menu */}
        <div className="p-4 border-b border-vault-border">
          <div className="relative" ref={menuRef}>
            <button onClick={() => setMenuOpen(o => !o)}
              className="w-full flex items-center gap-3 rounded-lg -m-1 p-1 hover:bg-vault-card/40 transition-colors text-left">
              {user?.avatar?.startsWith('data:') ? (
                <img src={user.avatar} alt="" className="w-9 h-9 rounded-full object-cover border border-vault-accent/40" />
              ) : (
                <div className="w-9 h-9 rounded-full bg-vault-accent/20 border border-vault-accent/40 flex items-center justify-center text-lg">
                  {user?.avatar || <User size={14} className="text-vault-accent" />}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-vault-text truncate">{user?.display_name || user?.username}</p>
                <p className="text-xs text-vault-muted truncate">{user?.email}</p>
              </div>
              <ChevronDown size={14} className={`text-vault-muted transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
            </button>
            {menuOpen && (
              <div className="absolute left-0 right-0 top-full mt-2 bg-vault-surface border border-vault-border rounded-lg shadow-xl py-1 z-50">
                <Link to="/account" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 px-3 py-2 text-sm text-vault-text hover:bg-vault-card transition-colors">
                  <Settings size={14} /> {t('account.nav')}
                </Link>
                {user?.username && (
                  <Link to={`/u/${user.username}`} onClick={() => setMenuOpen(false)} className="flex items-center gap-2 px-3 py-2 text-sm text-vault-text hover:bg-vault-card transition-colors">
                    <User size={14} /> {t('account.viewProfile')}
                  </Link>
                )}
              </div>
            )}
          </div>
          {stats && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="bg-vault-card rounded-lg p-2 text-center">
                <p className="text-lg font-display font-bold text-vault-gold">{stats.total_cards}</p>
                <p className="text-xs text-vault-muted">{t('nav.total')}</p>
              </div>
              <div className="bg-vault-card rounded-lg p-2 text-center">
                <p className="text-lg font-display font-bold text-vault-accent">{stats.unique_cards}</p>
                <p className="text-xs text-vault-muted">{t('nav.unique')}</p>
              </div>
              {(stats.total_value ?? 0) > 0 && (
                <div className="col-span-2 bg-vault-card rounded-lg p-2 text-center">
                  <p className="text-lg font-display font-bold text-green-400">
                    ${stats.total_value.toFixed(2)}
                    {usdBrl > 0 && (
                      <span className="text-xs text-vault-muted font-mono font-normal ml-1.5">
                        ≈ R${(stats.total_value * usdBrl).toFixed(2).replace('.', ',')}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-vault-muted">{t('nav.totalValue')}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-3 overflow-y-auto" onClick={() => setSidebarOpen(false)}>
          {navGroups.map((group) => (
            <div key={group.label} className="mb-4">
              <p className="px-3 mb-1.5 text-[10px] uppercase tracking-wider font-bold text-vault-muted/60">{t(group.label)}</p>
              <div className="space-y-0.5">
                {group.items.filter((it: any) => !it.flag || flags[it.flag as keyof typeof flags]).map(({ to, icon: Icon, key }) => (
                  <NavLink
                    key={to}
                    to={to}
                    className={({ isActive }) =>
                      `group relative flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150 ${
                        isActive
                          ? 'bg-gradient-to-r from-vault-accent/25 to-transparent text-vault-accent font-medium'
                          : 'text-vault-muted hover:text-vault-text hover:bg-vault-card/60'
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-vault-accent" />}
                        <Icon size={16} className={isActive ? '' : 'group-hover:scale-110 transition-transform'} />
                        {t(key)}
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}

          {/* Premium — highlighted */}
          <NavLink
            to="/premium"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 border ${
                isActive
                  ? 'bg-vault-gold/20 text-vault-gold border-vault-gold/40'
                  : 'bg-gradient-to-r from-vault-gold/10 to-transparent text-vault-gold/90 border-vault-gold/20 hover:border-vault-gold/40'
              }`
            }
          >
            <Crown size={16} /> {t('premium.nav')}
          </NavLink>

          {user?.is_admin && (
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                `mt-1 flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150 ${
                  isActive ? 'bg-vault-gold/15 text-vault-gold font-medium' : 'text-vault-muted hover:text-vault-gold hover:bg-vault-card/60'
                }`
              }
            >
              <ShieldCheck size={16} />
              {t('admin.nav')}
            </NavLink>
          )}
        </nav>

        {/* Footer: feedback + language + logout */}
        <div className="p-3 border-t border-vault-border space-y-1">
          <button
            onClick={() => setShowFeedback(true)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-vault-muted hover:text-vault-text hover:bg-vault-card transition-all w-full"
          >
            <MessageSquare size={15} />
            {t('feedback.nav')}
          </button>
          <LanguageSwitcher />
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-vault-muted hover:text-red-400 hover:bg-red-400/10 transition-all w-full"
          >
            <LogOut size={15} />
            {t('nav.logout')}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto bg-transparent relative z-10">
        {/* Mobile top bar with hamburger */}
        <div className="md:hidden sticky top-0 z-20 flex items-center gap-3 px-4 h-14 border-b border-vault-border bg-vault-surface/90 backdrop-blur">
          <button onClick={() => setSidebarOpen(true)} aria-label="Menu" className="text-vault-text"><Menu size={22} /></button>
          <Link to="/" className="font-display text-lg font-bold text-vault-gold tracking-wider">📖 VaultSpell</Link>
        </div>
        {children ?? <Outlet />}
      </main>

      {showFeedback && <FeedbackModal onClose={() => setShowFeedback(false)} />}
    </div>
  )
}

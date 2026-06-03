import { Outlet, NavLink, useNavigate, Link } from 'react-router-dom'
import { useAuthStore } from '@/store/auth'
import {
  Library, Search, BookOpen, Star, Package, LogOut, User, Swords, ScanLine, Users, Share2
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { collectionApi } from '@/lib/api'
import LanguageSwitcher from './LanguageSwitcher'

const navItems = [
  { to: '/collection', icon: Library, key: 'nav.collection' },
  { to: '/search', icon: Search, key: 'nav.search' },
  { to: '/scan', icon: ScanLine, key: 'nav.scan' },
  { to: '/binders', icon: BookOpen, key: 'nav.binders' },
  { to: '/decks', icon: Swords, key: 'nav.decks' },
  { to: '/wishlist', icon: Star, key: 'nav.wishlist' },
  { to: '/sets', icon: Package, key: 'nav.sets' },
  { to: '/friends', icon: Users, key: 'nav.friends' },
  { to: '/shared', icon: Share2, key: 'nav.shared' },
]

export default function Layout() {
  const { user, logout } = useAuthStore()
  const { t } = useTranslation()
  const navigate = useNavigate()

  const { data: stats } = useQuery({
    queryKey: ['collection-stats'],
    queryFn: collectionApi.stats,
  })

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-60 flex-shrink-0 border-r border-vault-border bg-vault-surface flex flex-col">
        {/* Logo */}
        <Link to="/" className="block p-5 border-b border-vault-border hover:bg-vault-card/30 transition-colors">
          <h1 className="font-display text-xl font-bold text-vault-gold tracking-wider">
            📖 VaultSpell
          </h1>
          <p className="text-xs text-vault-muted mt-0.5">{t('nav.subtitle')}</p>
        </Link>

        {/* User info */}
        <div className="p-4 border-b border-vault-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-vault-accent/20 border border-vault-accent/40 flex items-center justify-center">
              <User size={14} className="text-vault-accent" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-vault-text truncate">{user?.username}</p>
              <p className="text-xs text-vault-muted truncate">{user?.email}</p>
            </div>
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
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {navItems.map(({ to, icon: Icon, key }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 ${
                  isActive
                    ? 'bg-vault-accent/20 text-vault-accent border border-vault-accent/30 font-medium'
                    : 'text-vault-muted hover:text-vault-text hover:bg-vault-card'
                }`
              }
            >
              <Icon size={15} />
              {t(key)}
            </NavLink>
          ))}
        </nav>

        {/* Footer: language + logout */}
        <div className="p-3 border-t border-vault-border space-y-1">
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
      <main className="flex-1 overflow-y-auto bg-vault-bg">
        <Outlet />
      </main>
    </div>
  )
}

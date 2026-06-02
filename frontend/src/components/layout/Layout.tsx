import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/auth'
import {
  Library, Search, BookOpen, Layers, Star, Package, LogOut, User, Swords, ScanLine
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { collectionApi } from '@/lib/api'

const navItems = [
  { to: '/collection', icon: Library, label: 'Coleção' },
  { to: '/search', icon: Search, label: 'Buscar Cartas' },
  { to: '/scan', icon: ScanLine, label: 'Scan / Add Rápido' },
  { to: '/binders', icon: BookOpen, label: 'Binders' },
  { to: '/decks', icon: Swords, label: 'Decks' },
  { to: '/wishlist', icon: Star, label: 'Wishlist' },
  { to: '/sets', icon: Package, label: 'Sets' },
]

export default function Layout() {
  const { user, logout } = useAuthStore()
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
        <div className="p-5 border-b border-vault-border">
          <h1 className="font-display text-xl font-bold text-vault-gold tracking-wider">
            ⚔ MagicVault
          </h1>
          <p className="text-xs text-vault-muted mt-0.5">MTG Collection Manager</p>
        </div>

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
                <p className="text-xs text-vault-muted">Total</p>
              </div>
              <div className="bg-vault-card rounded-lg p-2 text-center">
                <p className="text-lg font-display font-bold text-vault-accent">{stats.unique_cards}</p>
                <p className="text-xs text-vault-muted">Únicas</p>
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {navItems.map(({ to, icon: Icon, label }) => (
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
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Logout */}
        <div className="p-3 border-t border-vault-border">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-vault-muted hover:text-red-400 hover:bg-red-400/10 transition-all w-full"
          >
            <LogOut size={15} />
            Sair
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

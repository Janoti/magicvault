import { Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Users, Crown, Library, Swords, BookOpen, ShieldCheck } from 'lucide-react'
import { adminApi } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import Avatar from '@/components/Avatar'

function Toggle({ on, onClick, disabled }: { on: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className={`w-10 h-5 rounded-full border transition-all relative disabled:opacity-40 ${
        on ? 'bg-vault-accent border-vault-accent' : 'bg-vault-card border-vault-border'
      }`}>
      <span className={`absolute top-0.5 left-0.5 w-3.5 h-3.5 rounded-full bg-white transition-all ${on ? 'translate-x-5' : ''}`} />
    </button>
  )
}

export default function AdminPage() {
  const { t } = useTranslation()
  const me = useAuthStore((s) => s.user)
  const qc = useQueryClient()

  const { data: stats } = useQuery({ queryKey: ['admin-stats'], queryFn: adminApi.stats })
  const { data: users = [], isLoading } = useQuery({ queryKey: ['admin-users'], queryFn: adminApi.users })

  const mutation = useMutation({
    mutationFn: (v: { id: number; data: object }) => adminApi.updateUser(v.id, v.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  })

  if (me && !me.is_admin) return <Navigate to="/collection" replace />

  const statCards = [
    { icon: Users, label: t('admin.users'), value: stats?.users },
    { icon: Crown, label: t('admin.premium'), value: stats?.premium },
    { icon: Library, label: t('admin.cards'), value: stats?.cards },
    { icon: Swords, label: t('admin.decks'), value: stats?.decks },
    { icon: BookOpen, label: t('admin.binders'), value: stats?.binders },
  ]

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <ShieldCheck size={26} className="text-vault-accent" />
        <div>
          <h1 className="font-display text-3xl font-bold text-vault-gold">{t('admin.title')}</h1>
          <p className="text-vault-muted text-sm mt-0.5">{t('admin.subtitle')}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        {statCards.map((s, i) => (
          <div key={i} className="surface p-4 text-center">
            <s.icon size={18} className="mx-auto text-vault-accent mb-1" />
            <p className="text-2xl font-display font-bold text-vault-gold">{s.value ?? '—'}</p>
            <p className="text-xs text-vault-muted">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="surface overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-vault-border bg-vault-surface">
              <th className="text-left px-4 py-3 text-xs text-vault-muted font-medium">{t('admin.user')}</th>
              <th className="text-center px-4 py-3 text-xs text-vault-muted font-medium">{t('admin.active')}</th>
              <th className="text-center px-4 py-3 text-xs text-vault-muted font-medium">{t('admin.isAdmin')}</th>
              <th className="text-center px-4 py-3 text-xs text-vault-muted font-medium">{t('admin.premium')}</th>
              <th className="text-left px-4 py-3 text-xs text-vault-muted font-medium">{t('admin.joined')}</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={5} className="text-center py-10"><div className="w-6 h-6 border-2 border-vault-accent border-t-transparent rounded-full animate-spin mx-auto" /></td></tr>
            ) : users.map((u: any) => {
              const self = u.id === me?.id
              return (
                <tr key={u.id} className="border-b border-vault-border/50 hover:bg-vault-card/30">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar value={u.avatar} size={32} />
                      <div>
                        <p className="font-medium text-vault-text">{u.display_name || u.username} {self && <span className="text-[10px] text-vault-accent">(você)</span>}</p>
                        <p className="text-xs text-vault-muted">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center"><div className="flex justify-center"><Toggle on={u.is_active} disabled={self} onClick={() => mutation.mutate({ id: u.id, data: { is_active: !u.is_active } })} /></div></td>
                  <td className="px-4 py-3 text-center"><div className="flex justify-center"><Toggle on={u.is_admin} disabled={self} onClick={() => mutation.mutate({ id: u.id, data: { is_admin: !u.is_admin } })} /></div></td>
                  <td className="px-4 py-3 text-center"><div className="flex justify-center"><Toggle on={u.is_premium} onClick={() => mutation.mutate({ id: u.id, data: { is_premium: !u.is_premium } })} /></div></td>
                  <td className="px-4 py-3 text-xs text-vault-muted">{u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

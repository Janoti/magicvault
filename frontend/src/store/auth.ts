import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { authApi } from '@/lib/api'

interface User {
  id: number; email: string; username: string
  display_name?: string | null; avatar?: string | null
  bio?: string | null; links?: { label: string; url: string }[]
}

interface AuthState {
  user: User | null
  token: string | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, username: string, password: string) => Promise<void>
  logout: () => void
  setUser: (user: User) => void
  isAuthenticated: () => boolean
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isLoading: false,

      login: async (email, password) => {
        set({ isLoading: true })
        try {
          const data = await authApi.login(email, password)
          localStorage.setItem('token', data.access_token)
          set({ user: data.user, token: data.access_token, isLoading: false })
        } catch (e) {
          set({ isLoading: false })
          throw e
        }
      },

      register: async (email, username, password) => {
        set({ isLoading: true })
        try {
          const data = await authApi.register({ email, username, password })
          localStorage.setItem('token', data.access_token)
          set({ user: data.user, token: data.access_token, isLoading: false })
        } catch (e) {
          set({ isLoading: false })
          throw e
        }
      },

      logout: () => {
        localStorage.removeItem('token')
        set({ user: null, token: null })
      },

      setUser: (user) => set({ user }),

      isAuthenticated: () => !!get().token,
    }),
    { name: 'magicvault-auth', partialize: (s) => ({ user: s.user, token: s.token }) }
  )
)

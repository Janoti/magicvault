import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { authApi } from '@/lib/api'

interface User {
  id: number; email: string; username: string
  display_name?: string | null; avatar?: string | null
  bio?: string | null; links?: { label: string; url: string }[]
  is_admin?: boolean; is_premium?: boolean; is_beta?: boolean
  contact?: string | null; contact_public?: boolean; collection_public?: boolean
  country?: string | null; state?: string | null; city?: string | null; location_public?: boolean
  email_verified?: boolean
}

export interface RegisterExtra { country?: string; state?: string; city?: string; location_public?: boolean }

interface AuthState {
  user: User | null
  token: string | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  loginWithToken: (token: string) => Promise<void>
  register: (email: string, username: string, password: string, extra?: RegisterExtra) => Promise<void>
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

      // Used by the social-login callback: a backend-issued token is already in
      // hand, so just persist it and fetch the user.
      loginWithToken: async (token) => {
        set({ isLoading: true })
        try {
          localStorage.setItem('token', token)
          set({ token })
          const user = await authApi.me()
          set({ user, isLoading: false })
        } catch (e) {
          set({ isLoading: false })
          throw e
        }
      },

      register: async (email, username, password, extra) => {
        set({ isLoading: true })
        try {
          const data = await authApi.register({ email, username, password, ...(extra || {}) })
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

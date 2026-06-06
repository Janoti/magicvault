import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

// Effective feature flags for the current viewer (resolved by the backend from
// each flag's state: off / admin-only / on). Controlled from the admin panel.
export type Flags = { cardRulings: boolean; setCompletion: boolean; pnl: boolean; events: boolean; aiDoctor: boolean; aiPrimer: boolean; scanOCR: boolean }
const DEFAULT: Flags = { cardRulings: false, setCompletion: false, pnl: false, events: false, aiDoctor: false, aiPrimer: false, scanOCR: false }

export function useFlags(): Flags {
  const { data } = useQuery({
    queryKey: ['flags'],
    queryFn: () => api.get('/api/flags').then(r => r.data),
    staleTime: 1000 * 60 * 5,
  })
  return { ...DEFAULT, ...(data || {}) }
}

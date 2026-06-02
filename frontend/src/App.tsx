import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/auth'
import Layout from '@/components/layout/Layout'
import LoginPage from '@/pages/LoginPage'
import RegisterPage from '@/pages/RegisterPage'
import CollectionPage from '@/pages/CollectionPage'
import SearchPage from '@/pages/SearchPage'
import CardScanPage from '@/pages/CardScanPage'
import BindersPage from '@/pages/BindersPage'
import BinderDetailPage from '@/pages/BinderDetailPage'
import DecksPage from '@/pages/DecksPage'
import DeckDetailPage from '@/pages/DeckDetailPage'
import WishlistPage from '@/pages/WishlistPage'
import SetsPage from '@/pages/SetsPage'
import SetDetailPage from '@/pages/SetDetailPage'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  return isAuthenticated() ? <>{children}</> : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/collection" replace />} />
        <Route path="collection" element={<CollectionPage />} />
        <Route path="search" element={<SearchPage />} />
        <Route path="scan" element={<CardScanPage />} />
        <Route path="binders" element={<BindersPage />} />
        <Route path="binders/:id" element={<BinderDetailPage />} />
        <Route path="decks" element={<DecksPage />} />
        <Route path="decks/:id" element={<DeckDetailPage />} />
        <Route path="wishlist" element={<WishlistPage />} />
        <Route path="sets" element={<SetsPage />} />
        <Route path="sets/:code" element={<SetDetailPage />} />
      </Route>
    </Routes>
  )
}

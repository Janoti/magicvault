import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/auth'
import Layout from '@/components/layout/Layout'
import LandingPage from '@/pages/LandingPage'
import LoginPage from '@/pages/LoginPage'
import RegisterPage from '@/pages/RegisterPage'
import ForgotPasswordPage from '@/pages/ForgotPasswordPage'
import ResetPasswordPage from '@/pages/ResetPasswordPage'
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
import FriendsPage from '@/pages/FriendsPage'
import SharedWithMePage from '@/pages/SharedWithMePage'
import PublicViewPage from '@/pages/PublicViewPage'
import AccountPage from '@/pages/AccountPage'
import ProfilePage from '@/pages/ProfilePage'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  return isAuthenticated() ? <>{children}</> : <Navigate to="/login" replace />
}

function RootRoute() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  return isAuthenticated() ? <Navigate to="/collection" replace /> : <LandingPage />
}

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<RootRoute />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/p/:token" element={<PublicViewPage />} />
      <Route path="/u/:username" element={<ProfilePage />} />

      {/* Authenticated app */}
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/collection" element={<CollectionPage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/scan" element={<CardScanPage />} />
        <Route path="/binders" element={<BindersPage />} />
        <Route path="/binders/:id" element={<BinderDetailPage />} />
        <Route path="/decks" element={<DecksPage />} />
        <Route path="/decks/:id" element={<DeckDetailPage />} />
        <Route path="/wishlist" element={<WishlistPage />} />
        <Route path="/sets" element={<SetsPage />} />
        <Route path="/sets/:code" element={<SetDetailPage />} />
        <Route path="/friends" element={<FriendsPage />} />
        <Route path="/shared" element={<SharedWithMePage />} />
        <Route path="/account" element={<AccountPage />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

import { Suspense, lazy, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/auth'
import { authApi } from '@/lib/api'
import Layout from '@/components/layout/Layout'

// Lazy-loaded pages — each becomes its own chunk, so the initial load only
// fetches what the current route needs.
const LandingPage = lazy(() => import('@/pages/LandingPage'))
const FeaturesPage = lazy(() => import('@/pages/FeaturesPage'))
const GuidePage = lazy(() => import('@/pages/GuidePage'))
const PublicEntityPage = lazy(() => import('@/pages/PublicEntityPage'))
const LoginPage = lazy(() => import('@/pages/LoginPage'))
const RegisterPage = lazy(() => import('@/pages/RegisterPage'))
const ForgotPasswordPage = lazy(() => import('@/pages/ForgotPasswordPage'))
const ResetPasswordPage = lazy(() => import('@/pages/ResetPasswordPage'))
const UnsubscribePage = lazy(() => import('@/pages/UnsubscribePage'))
const VerifyEmailPage = lazy(() => import('@/pages/VerifyEmailPage'))
const EventsPage = lazy(() => import('@/pages/EventsPage'))
const StoresPage = lazy(() => import('@/pages/StoresPage'))
const CommunityDecksPage = lazy(() => import('@/pages/CommunityDecksPage'))
const EventPage = lazy(() => import('@/pages/EventPage'))
const MyEventsPage = lazy(() => import('@/pages/MyEventsPage'))
const PublicFolderPage = lazy(() => import('@/pages/PublicFolderPage'))
const CollectionPage = lazy(() => import('@/pages/CollectionPage'))
const SearchPage = lazy(() => import('@/pages/SearchPage'))
const CardScanPage = lazy(() => import('@/pages/CardScanPage'))
const BindersPage = lazy(() => import('@/pages/BindersPage'))
const BinderDetailPage = lazy(() => import('@/pages/BinderDetailPage'))
const DecksPage = lazy(() => import('@/pages/DecksPage'))
const DeckDetailPage = lazy(() => import('@/pages/DeckDetailPage'))
const WishlistPage = lazy(() => import('@/pages/WishlistPage'))
const SetsPage = lazy(() => import('@/pages/SetsPage'))
const SetDetailPage = lazy(() => import('@/pages/SetDetailPage'))
const FriendsPage = lazy(() => import('@/pages/FriendsPage'))
const SharedWithMePage = lazy(() => import('@/pages/SharedWithMePage'))
const PublicViewPage = lazy(() => import('@/pages/PublicViewPage'))
const AccountPage = lazy(() => import('@/pages/AccountPage'))
const ProfilePage = lazy(() => import('@/pages/ProfilePage'))
const AdminPage = lazy(() => import('@/pages/AdminPage'))
const TradesPage = lazy(() => import('@/pages/TradesPage'))
const PremiumPage = lazy(() => import('@/pages/PremiumPage'))

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-vault-bg">
      <div className="w-8 h-8 border-2 border-vault-accent border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  // Select the token (a value) rather than the isAuthenticated function, so this
  // re-renders on login/logout and redirects immediately instead of freezing.
  const authed = useAuthStore((s) => !!s.token)
  return authed ? <>{children}</> : <Navigate to="/login" replace />
}

function RootRoute() {
  const authed = useAuthStore((s) => !!s.token)
  return authed ? <Navigate to="/collection" replace /> : <LandingPage />
}

export default function App() {
  // On load, refresh the signed-in user from the server. This keeps cached data
  // (premium, email_verified, …) fresh and registers activity so last_login_at
  // updates for users who stay logged in via a stored token.
  const token = useAuthStore((s) => s.token)
  const setUser = useAuthStore((s) => s.setUser)
  useEffect(() => {
    if (token) authApi.me().then(setUser).catch(() => { /* invalid token handled by interceptor */ })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Public */}
        <Route path="/" element={<RootRoute />} />
        <Route path="/features" element={<FeaturesPage />} />
        <Route path="/guia" element={<GuidePage />} />
        <Route path="/guide" element={<GuidePage />} />
        <Route path="/eventos" element={<EventsPage />} />
        <Route path="/events" element={<EventsPage />} />
        <Route path="/lojas" element={<StoresPage />} />
        <Route path="/stores" element={<StoresPage />} />
        <Route path="/decks-comunidade" element={<CommunityDecksPage />} />
        <Route path="/community-decks" element={<CommunityDecksPage />} />
        <Route path="/e/:id" element={<EventPage />} />
        <Route path="/f/:token" element={<PublicFolderPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/unsubscribe" element={<UnsubscribePage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/p/:token" element={<PublicViewPage />} />
        <Route path="/p/:username/:slug" element={<PublicViewPage />} />
        <Route path="/u/:username" element={<ProfilePage />} />
        <Route path="/d/:id" element={<PublicEntityPage kind="deck" />} />
        <Route path="/c/:username" element={<PublicEntityPage kind="collection" />} />
        <Route path="/b/:id" element={<PublicEntityPage kind="binder" />} />

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
          <Route path="/trades" element={<TradesPage />} />
          <Route path="/premium" element={<PremiumPage />} />
          <Route path="/account" element={<AccountPage />} />
          <Route path="/meus-eventos" element={<MyEventsPage />} />
          <Route path="/admin" element={<AdminPage />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { AccountProvider, useAccount } from './contexts/AccountContext'
import { Login } from './pages/Login'
import { Signup } from './pages/Signup'
import { Onboarding } from './pages/Onboarding'
import { AuthCallback } from './pages/AuthCallback'
import { GoogleAdsCallback } from './pages/GoogleAdsCallback'
import { Settings } from './pages/Settings'
import { Library } from './pages/Library'
import { Scheduled } from './pages/Scheduled'
import { Privacy } from './pages/Privacy'
import { Terms } from './pages/Terms'
import { MainWorkspace } from './components/MainWorkspace'
import { LandingPage } from './components/LandingPage'
import { Admin } from './pages/Admin'
import { AdminLogin } from './pages/AdminLogin'
import VideoGeneration from './pages/VideoGeneration'
import App from './App'
import { Loader2 } from 'lucide-react'

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
      </div>
    )
  }

  if (user) {
    return <Navigate to="/app" replace />
  }

  return <>{children}</>
}

function ProtectedRoute({ children, skipOnboardingCheck = false }: { children: React.ReactNode, skipOnboardingCheck?: boolean }) {
  const { user } = useAuth()
  const { accounts, loading: accountsLoading } = useAccount()

  if (!user) {
    return <Navigate to="/login" replace />
  }

  // Optionally check if user needs onboarding
  if (!skipOnboardingCheck) {
    if (accountsLoading) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
          <Loader2 className="w-12 h-12 animate-spin text-purple-600" />
        </div>
      )
    }

    const needsOnboarding = accounts.length === 0 ||
      accounts.some(a => a.metadata?.onboarding_complete === false)

    if (needsOnboarding) {
      return <Navigate to="/onboarding" replace />
    }
  }

  return <>{children}</>
}

function AppRoutes() {
  const { loading } = useAuth()

  // Show global loading state while auth is initializing
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <Routes>
            {/* Public Landing Page */}
            <Route path="/" element={<LandingPage />} />
            
            {/* Protected Routes */}
            <Route 
              path="/app" 
              element={
                <ProtectedRoute>
                  <MainWorkspace />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/settings" 
              element={
                <ProtectedRoute>
                  <Settings />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/library" 
              element={
                <ProtectedRoute>
                  <Library />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/scheduled" 
              element={
                <ProtectedRoute>
                  <Scheduled />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/video-generation" 
              element={
                <ProtectedRoute>
                  <VideoGeneration />
                </ProtectedRoute>
              } 
            />
            
            {/* Admin Routes (public but password protected) */}
            <Route path="/admin" element={<AdminLogin />} />
            <Route path="/admin/dashboard" element={<Admin />} />
            
            {/* Onboarding (protected, but skip onboarding redirect to avoid loop) */}
            <Route 
              path="/onboarding" 
              element={
                <ProtectedRoute skipOnboardingCheck>
                  <Onboarding />
                </ProtectedRoute>
              } 
            />
            
            {/* Public Routes */}
            <Route path="/old" element={<App />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/auth/google-ads/callback" element={<GoogleAdsCallback />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />
            
            <Route
              path="/login"
              element={
                <PublicRoute>
                  <Login />
                </PublicRoute>
              }
            />
            <Route
              path="/signup"
              element={
                <PublicRoute>
                  <Signup />
                </PublicRoute>
              }
            />
          </Routes>
  )
}

export function AppWithAuth() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AccountProvider>
          <AppRoutes />
        </AccountProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

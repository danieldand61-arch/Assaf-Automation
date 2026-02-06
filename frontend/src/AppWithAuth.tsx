import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { AccountProvider } from './contexts/AccountContext'
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
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()

  // Auth check happens in AppRoutes, here we just redirect if needed
  if (!user) {
    return <Navigate to="/login" replace />
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
            {/* Protected Routes */}
            <Route 
              path="/" 
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
            
            {/* Semi-Protected Routes */}
            <Route 
              path="/onboarding" 
              element={
                <ProtectedRoute>
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

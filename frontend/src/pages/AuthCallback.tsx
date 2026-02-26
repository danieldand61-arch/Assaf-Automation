import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { getApiUrl } from '../lib/api'

export function AuthCallback() {
  const navigate = useNavigate()

  useEffect(() => {
    const handleCallback = async () => {
      // Extract hash params (OAuth returns tokens in hash)
      const hashParams = new URLSearchParams(window.location.hash.substring(1))
      const accessToken = hashParams.get('access_token')

      if (accessToken) {
        // Check if user needs onboarding
        try {
          const response = await fetch(`${getApiUrl()}/api/accounts`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
          })
          
          if (response.ok) {
            const data = await response.json()
            const needsOnboarding = !data.accounts?.length ||
              data.accounts.some((a: any) => a.metadata?.onboarding_complete === false)
            
            if (needsOnboarding) {
              navigate('/onboarding', { replace: true })
              return
            }
          }
        } catch (err) {
          console.error('Failed to check accounts:', err)
        }
        
        navigate('/app', { replace: true })
      } else {
        navigate('/login', { replace: true })
      }
    }
    
    handleCallback()
  }, [navigate])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="text-center">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          Signing you in...
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Redirecting to the app...
        </p>
      </div>
    </div>
  )
}

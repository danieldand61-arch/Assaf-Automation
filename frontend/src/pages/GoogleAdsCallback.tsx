import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

export function GoogleAdsCallback() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  useEffect(() => {
    // OAuth callback redirects here with token
    const token = searchParams.get('google_ads_token')
    const error = searchParams.get('error')

    if (error) {
      navigate('/settings?tab=connections&error=' + error)
    } else if (token) {
      // Store token temporarily in sessionStorage
      sessionStorage.setItem('google_ads_temp_token', token)
      // Redirect to settings with success flag
      navigate('/settings?tab=connections&google_ads_oauth=true')
    } else {
      // No token, something went wrong
      navigate('/settings?tab=connections&error=no_token')
    }
  }, [navigate, searchParams])

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600 dark:text-gray-400">
          Completing Google Ads connection...
        </p>
      </div>
    </div>
  )
}

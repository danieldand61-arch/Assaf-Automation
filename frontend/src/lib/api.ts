const DEFAULT_LOCAL_API = 'http://localhost:8000'
const DEFAULT_PROD_API = 'https://assaf-automation-production.up.railway.app'

export const getApiUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL
  const isLocalhost = typeof window !== 'undefined' && window.location.hostname === 'localhost'
  const fallbackUrl = isLocalhost ? DEFAULT_LOCAL_API : DEFAULT_PROD_API
  const rawUrl = envUrl && envUrl.trim().length > 0 ? envUrl : fallbackUrl

  if (typeof window !== 'undefined' && window.location.protocol === 'https:' && rawUrl.startsWith('http://')) {
    return rawUrl.replace(/^http:\/\//, 'https://')
  }

  return rawUrl
}

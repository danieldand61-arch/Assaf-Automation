import { useAuth } from '../contexts/AuthContext'
import { useAccount } from '../contexts/AccountContext'
import { useNavigate } from 'react-router-dom'
import { SavedPostsLibrary } from '../components/SavedPostsLibrary'
import { ArrowLeft } from 'lucide-react'

export function Library() {
  const { user } = useAuth()
  const { activeAccount } = useAccount()
  const navigate = useNavigate()

  if (!user) {
    navigate('/login')
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/')}
            className="mb-4 flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Back to Home</span>
          </button>

          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            💾 Post Library
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Your saved posts ready to schedule (not yet scheduled)
          </p>
          <div className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 rounded-lg text-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Click on any post to schedule it for publishing
          </div>
          {activeAccount && (
            <p className="text-sm text-purple-600 dark:text-purple-400 mt-2">
              Current account: <strong>{activeAccount.name}</strong>
            </p>
          )}
        </div>

        {/* Content */}
        <SavedPostsLibrary />
      </div>
    </div>
  )
}

import { useAuth } from '../contexts/AuthContext'
import { useAccount } from '../contexts/AccountContext'
import { useNavigate } from 'react-router-dom'
import { ScheduledPosts } from '../components/ScheduledPosts'
import { ArrowLeft } from 'lucide-react'

export function Scheduled() {
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
            Scheduled Posts
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage your upcoming and published posts
          </p>
          {activeAccount && (
            <p className="text-sm text-purple-600 dark:text-purple-400 mt-2">
              Current account: <strong>{activeAccount.name}</strong>
            </p>
          )}
        </div>

        {/* Content */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
          <ScheduledPosts />
        </div>
      </div>
    </div>
  )
}

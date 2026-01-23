import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useAccount } from '../contexts/AccountContext'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Connections } from './Connections'
import { ScheduledPosts } from '../components/ScheduledPosts'

type Tab = 'connections' | 'scheduled' | 'profile' | 'accounts'

export function Settings() {
  const { user } = useAuth()
  const { activeAccount } = useAccount()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState<Tab>('connections')

  // Read tab from URL params
  useEffect(() => {
    const tabParam = searchParams.get('tab')
    if (tabParam === 'social' || tabParam === 'connections') {
      setActiveTab('connections')
    } else if (tabParam === 'scheduled') {
      setActiveTab('scheduled')
    } else if (tabParam === 'profile') {
      setActiveTab('profile')
    } else if (tabParam === 'accounts') {
      setActiveTab('accounts')
    }

    // Show error/success notifications
    const error = searchParams.get('error')
    const success = searchParams.get('success')
    
    if (error) {
      // You can use toast notifications here
      console.error('Connection error:', error)
      alert(`Connection failed: ${error}`)
    }
    
    if (success) {
      console.log('Connection successful:', success)
      alert(`Successfully connected ${success}!`)
    }
  }, [searchParams])

  if (!user) {
    navigate('/login')
    return null
  }

  const tabs = [
    {
      id: 'connections' as Tab,
      name: 'Social Media',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
      )
    },
    {
      id: 'scheduled' as Tab,
      name: 'Scheduled Posts',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      )
    },
    {
      id: 'profile' as Tab,
      name: 'Profile',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      )
    },
    {
      id: 'accounts' as Tab,
      name: 'Business Accounts',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      )
    }
  ]

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Settings
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage your account settings and preferences
          </p>
          {activeAccount && (
            <p className="text-sm text-purple-600 dark:text-purple-400 mt-2">
              Current account: <strong>{activeAccount.name}</strong>
            </p>
          )}
        </div>

        <div className="flex flex-col md:flex-row gap-6">
          {/* Sidebar Tabs */}
          <div className="w-full md:w-64 flex-shrink-0">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
              <nav className="flex flex-col">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`
                      flex items-center gap-3 px-6 py-4 text-left transition-all
                      ${activeTab === tab.id
                        ? 'bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 border-l-4 border-purple-600'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 border-l-4 border-transparent'
                      }
                    `}
                  >
                    {tab.icon}
                    <span className="font-medium">{tab.name}</span>
                  </button>
                ))}
              </nav>
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1">
            {activeTab === 'connections' && (
              <ConnectionsTab />
            )}
            {activeTab === 'scheduled' && (
              <ScheduledPostsTab />
            )}
            {activeTab === 'profile' && (
              <ProfileTab />
            )}
            {activeTab === 'accounts' && (
              <AccountsTab />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// Connections Tab (uses existing Connections component)
function ConnectionsTab() {
  return <Connections />
}

// Scheduled Posts Tab
function ScheduledPostsTab() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
      <ScheduledPosts />
    </div>
  )
}

// Profile Tab
function ProfileTab() {
  const { user } = useAuth()

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        Profile Settings
      </h2>

      <div className="space-y-6">
        {/* User Info */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Email
          </label>
          <input
            type="email"
            value={user?.email || ''}
            disabled
            className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Email cannot be changed
          </p>
        </div>

        {/* Full Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Full Name
          </label>
          <input
            type="text"
            value={user?.user_metadata?.full_name || ''}
            disabled
            className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
          />
        </div>

        {/* Coming Soon Notice */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 p-4 rounded-lg">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <div>
              <h3 className="font-semibold text-blue-900 dark:text-blue-200">
                More settings coming soon!
              </h3>
              <p className="text-sm text-blue-800 dark:text-blue-300 mt-1">
                Profile editing, password change, and notification preferences will be available in the next update.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Accounts Tab
function AccountsTab() {
  const { accounts } = useAccount()

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        Business Accounts
      </h2>

      <div className="space-y-4">
        {accounts.map((account) => (
          <div
            key={account.id}
            className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg"
          >
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">
                {account.name}
              </h3>
              {account.description && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {account.description}
                </p>
              )}
            </div>
            <span className="text-sm text-green-600 dark:text-green-400 font-medium">
              Active
            </span>
          </div>
        ))}

        {accounts.length === 0 && (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            No business accounts found
          </div>
        )}

        {/* Coming Soon Notice */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 p-4 rounded-lg mt-6">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <div>
              <h3 className="font-semibold text-blue-900 dark:text-blue-200">
                Account management coming soon!
              </h3>
              <p className="text-sm text-blue-800 dark:text-blue-300 mt-1">
                Create, edit, and delete business accounts. Switch between accounts easily.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

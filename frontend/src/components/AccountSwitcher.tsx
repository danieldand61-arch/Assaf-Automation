import { useState } from 'react'
import { useAccount } from '../contexts/AccountContext'
import { ChevronDown, Plus, Building2, Check } from 'lucide-react'

export function AccountSwitcher() {
  const { accounts, activeAccount, switchAccount } = useAccount()
  const [isOpen, setIsOpen] = useState(false)

  if (!activeAccount) return null

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-500 dark:hover:border-blue-400 transition"
      >
        <Building2 className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        <span className="font-medium text-gray-900 dark:text-white">
          {activeAccount.name}
        </span>
        <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown */}
          <div className="absolute top-full left-0 mt-2 w-64 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-20 overflow-hidden">
            
            {/* Accounts List */}
            <div className="max-h-64 overflow-y-auto">
              {accounts.map((account) => (
                <button
                  key={account.id}
                  onClick={() => {
                    switchAccount(account.id)
                    setIsOpen(false)
                  }}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                >
                  <div className="flex items-center gap-3">
                    <Building2 className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                    <div className="text-left">
                      <div className="font-medium text-gray-900 dark:text-white">
                        {account.name}
                      </div>
                      {account.role && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                          {account.role}
                        </div>
                      )}
                    </div>
                  </div>
                  {activeAccount.id === account.id && (
                    <Check className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  )}
                </button>
              ))}
            </div>

            {/* Create New Account */}
            <div className="border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => {
                  // TODO: Open create account modal
                  alert('Create account modal coming soon!')
                  setIsOpen(false)
                }}
                className="w-full flex items-center gap-3 px-4 py-3 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition font-medium"
              >
                <Plus className="w-5 h-5" />
                Create New Account
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

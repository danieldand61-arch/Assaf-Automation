import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

interface Account {
  id: string
  name: string
  logo_url?: string
  brand_colors?: string[]
  brand_voice?: string
}

interface AccountContextType {
  accounts: Account[]
  currentAccount: Account | null
  setCurrentAccount: (account: Account) => void
  loading: boolean
  refetchAccounts: () => Promise<void>
}

const AccountContext = createContext<AccountContextType | null>(null)

export const AccountProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [currentAccount, setCurrentAccount] = useState<Account | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchAccounts = async () => {
    if (!user) {
      setAccounts([])
      setCurrentAccount(null)
      setLoading(false)
      return
    }

    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/accounts`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setAccounts(data)
        
        // Set first account as current if none selected
        if (data.length > 0 && !currentAccount) {
          setCurrentAccount(data[0])
        }
      }
    } catch (error) {
      console.error('Failed to fetch accounts:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAccounts()
  }, [user])

  return (
    <AccountContext.Provider value={{
      accounts,
      currentAccount,
      setCurrentAccount,
      loading,
      refetchAccounts: fetchAccounts
    }}>
      {children}
    </AccountContext.Provider>
  )
}

export const useAccount = () => {
  const context = useContext(AccountContext)
  if (!context) {
    throw new Error('useAccount must be used within AccountProvider')
  }
  return context
}

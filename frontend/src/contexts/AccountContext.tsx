import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useAuth } from './AuthContext'
import { getApiUrl } from '../lib/api'
import axios from 'axios'

interface Account {
  id: string
  name: string
  description?: string
  industry?: string
  target_audience?: string
  brand_voice: string
  logo_url?: string
  brand_colors: string[]
  metadata?: {
    onboarding_complete?: boolean
    marketing_goal?: string
    website_url?: string
    geographic_focus?: string
    budget_range?: string
    [key: string]: any
  }
  role?: string
}

interface AccountContextType {
  accounts: Account[]
  activeAccount: Account | null
  loading: boolean
  fetchAccounts: () => Promise<void>
  switchAccount: (accountId: string) => Promise<void>
  createAccount: (data: Partial<Account>) => Promise<void>
  updateAccount: (accountId: string, data: Partial<Account>) => Promise<void>
}

const AccountContext = createContext<AccountContextType | undefined>(undefined)

export function AccountProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [activeAccount, setActiveAccount] = useState<Account | null>(null)
  const [loading, setLoading] = useState(true)

  const apiUrl = getApiUrl()

  const getAuthHeaders = () => ({
    Authorization: `Bearer ${session?.access_token}`,
  })

  const fetchAccounts = async () => {
    if (!session) {
      setAccounts([])
      setActiveAccount(null)
      setLoading(false)
      return
    }

    try {
      const response = await axios.get(`${apiUrl}/api/accounts`, {
        headers: getAuthHeaders(),
      })
      
      console.log('📊 Fetched accounts:', response.data.accounts)
      setAccounts(response.data.accounts)
      
      // Set first account as active if none selected
      if (response.data.accounts && response.data.accounts.length > 0 && !activeAccount) {
        setActiveAccount(response.data.accounts[0])
      }
    } catch (error) {
      console.error('Failed to fetch accounts:', error)
    } finally {
      setLoading(false)
    }
  }

  const switchAccount = async (accountId: string) => {
    try {
      await axios.post(
        `${apiUrl}/api/accounts/${accountId}/switch`,
        {},
        { headers: getAuthHeaders() }
      )
      
      const account = accounts.find(a => a.id === accountId)
      if (account) {
        setActiveAccount(account)
      }
    } catch (error) {
      console.error('Failed to switch account:', error)
      throw error
    }
  }

  const createAccount = async (data: Partial<Account>) => {
    try {
      const response = await axios.post(
        `${apiUrl}/api/accounts`,
        data,
        { headers: getAuthHeaders() }
      )
      
      await fetchAccounts()
      return response.data.account
    } catch (error) {
      console.error('Failed to create account:', error)
      throw error
    }
  }

  const updateAccount = async (accountId: string, data: Partial<Account>) => {
    try {
      await axios.patch(
        `${apiUrl}/api/accounts/${accountId}`,
        data,
        { headers: getAuthHeaders() }
      )
      
      await fetchAccounts()
    } catch (error) {
      console.error('Failed to update account:', error)
      throw error
    }
  }

  useEffect(() => {
    if (session) {
      fetchAccounts()
    }
  }, [session])

  return (
    <AccountContext.Provider
      value={{
        accounts,
        activeAccount,
        loading,
        fetchAccounts,
        switchAccount,
        createAccount,
        updateAccount,
      }}
    >
      {children}
    </AccountContext.Provider>
  )
}

export function useAccount() {
  const context = useContext(AccountContext)
  if (context === undefined) {
    throw new Error('useAccount must be used within an AccountProvider')
  }
  return context
}

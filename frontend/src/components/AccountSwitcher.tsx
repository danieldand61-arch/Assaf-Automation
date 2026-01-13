import { useAccount } from '../contexts/AccountContext'

export const AccountSwitcher = () => {
  const { accounts, currentAccount, setCurrentAccount, loading } = useAccount()

  if (loading || accounts.length === 0) {
    return null
  }

  return (
    <div className="relative">
      <select
        value={currentAccount?.id || ''}
        onChange={(e) => {
          const account = accounts.find(a => a.id === e.target.value)
          if (account) setCurrentAccount(account)
        }}
        className="appearance-none bg-white border border-gray-300 rounded-lg px-4 py-2 pr-8 text-sm font-medium text-gray-700 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer"
      >
        {accounts.map((account) => (
          <option key={account.id} value={account.id}>
            {account.name}
          </option>
        ))}
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
        <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
          <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
        </svg>
      </div>
    </div>
  )
}

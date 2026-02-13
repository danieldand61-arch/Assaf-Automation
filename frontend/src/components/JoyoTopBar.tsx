import { useState } from 'react'
import { Building2, ChevronDown, Bell, LogOut, Sun, Moon } from 'lucide-react'
import { useAccount } from '../contexts/AccountContext'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { JoyoTheme } from '../styles/joyo-theme'

interface JoyoTopBarProps {
  title: string
}

export function JoyoTopBar({ title }: JoyoTopBarProps) {
  const { activeAccount, accounts, switchAccount } = useAccount()
  const { user, signOut } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  const handleSignOut = async () => {
    setUserMenuOpen(false)
    try {
      await signOut()
    } catch (error) {
      console.error('Sign out error:', error)
    } finally {
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('sb-')) localStorage.removeItem(key)
      })
      Object.keys(sessionStorage).forEach(key => {
        if (key.startsWith('sb-')) sessionStorage.removeItem(key)
      })
      window.location.replace('/login')
    }
  }

  return (
    <div style={{
      height: 60,
      background: 'rgba(255,255,255,0.82)',
      backdropFilter: 'blur(16px)',
      borderBottom: `1px solid ${JoyoTheme.border}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 28px',
      flexShrink: 0,
      position: 'sticky',
      top: 0,
      zIndex: 30
    }}>
      <span style={{ 
        fontSize: 16, 
        fontWeight: 700, 
        color: JoyoTheme.text 
      }}>
        {title}
      </span>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Account Switcher */}
        {accounts.length > 0 && (
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setAccountMenuOpen(!accountMenuOpen)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '7px 14px',
                borderRadius: 10,
                border: `1px solid ${JoyoTheme.border}`,
                background: 'white',
                cursor: 'pointer',
                fontSize: 13,
                color: JoyoTheme.textSecondary,
                fontWeight: 600
              }}
            >
              <Building2 size={14} />
              {activeAccount?.name || 'Select Account'}
              <ChevronDown size={14} />
            </button>

            {accountMenuOpen && (
              <>
                <div 
                  style={{ position: 'fixed', inset: 0, zIndex: 40 }}
                  onClick={() => setAccountMenuOpen(false)}
                />
                <div style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  right: 0,
                  background: 'white',
                  border: `1px solid ${JoyoTheme.border}`,
                  borderRadius: 12,
                  boxShadow: '0 12px 36px rgba(0,0,0,0.1)',
                  padding: 6,
                  minWidth: 200,
                  zIndex: 50
                }}>
                  {accounts.map((account) => (
                    <button
                      key={account.id}
                      onClick={async () => {
                        await switchAccount(account.id)
                        setAccountMenuOpen(false)
                      }}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '10px 14px',
                        borderRadius: 8,
                        border: 'none',
                        cursor: 'pointer',
                        background: account.id === activeAccount?.id ? JoyoTheme.accentSoft : 'transparent',
                        fontSize: 13,
                        color: account.id === activeAccount?.id ? JoyoTheme.accent : JoyoTheme.textSecondary,
                        fontWeight: account.id === activeAccount?.id ? 650 : 500
                      }}
                    >
                      {account.name}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Notifications */}
        <button style={{
          width: 38,
          height: 38,
          borderRadius: 10,
          border: `1px solid ${JoyoTheme.border}`,
          background: 'white',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: JoyoTheme.textMuted,
          position: 'relative'
        }}>
          <Bell size={18} />
        </button>

        {/* Theme Toggle */}
        <button 
          onClick={toggleTheme}
          style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            border: `1px solid ${JoyoTheme.border}`,
            background: 'white',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: JoyoTheme.textMuted
          }}
        >
          {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
        </button>

        {/* User Avatar */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            style={{
              width: 38,
              height: 38,
              borderRadius: 12,
              background: JoyoTheme.gradient1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: 13,
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer'
            }}
          >
            {user?.email?.[0]?.toUpperCase() || 'U'}
          </button>

          {userMenuOpen && (
            <>
              <div 
                style={{ position: 'fixed', inset: 0, zIndex: 40 }}
                onClick={() => setUserMenuOpen(false)}
              />
              <div style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                right: 0,
                background: 'white',
                border: `1px solid ${JoyoTheme.border}`,
                borderRadius: 12,
                boxShadow: '0 12px 36px rgba(0,0,0,0.1)',
                padding: 6,
                minWidth: 180,
                zIndex: 50
              }}>
                <div style={{
                  padding: '12px 14px',
                  borderBottom: `1px solid ${JoyoTheme.borderLight}`
                }}>
                  <div style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: JoyoTheme.text
                  }}>
                    {user?.email}
                  </div>
                </div>
                <button
                  onClick={handleSignOut}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '10px 14px',
                    borderRadius: 8,
                    border: 'none',
                    cursor: 'pointer',
                    background: 'transparent',
                    fontSize: 13,
                    color: JoyoTheme.danger,
                    fontWeight: 500,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8
                  }}
                >
                  <LogOut size={14} />
                  Sign Out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

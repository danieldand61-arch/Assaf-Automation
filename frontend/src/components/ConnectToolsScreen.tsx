import { useState } from 'react'
import { Check, ArrowRight } from 'lucide-react'
import { getJoyoTheme } from '../styles/joyo-theme'
import { useTheme } from '../contexts/ThemeContext'

const TOOLS = [
  { id: 'facebook',  name: 'Facebook',     desc: 'Publish posts & manage pages',        color: '#1877F2', icon: 'f' },
  { id: 'instagram', name: 'Instagram',     desc: 'Share photos, stories & reels',       color: '#E4405F', icon: 'ig' },
  { id: 'linkedin',  name: 'LinkedIn',      desc: 'Post to your company page',           color: '#0A66C2', icon: 'in' },
  { id: 'tiktok',    name: 'TikTok',        desc: 'Publish short-form videos',           color: '#010101', icon: 'tt' },
  { id: 'google',    name: 'Google Ads',    desc: 'Manage ad campaigns & budgets',       color: '#4285F4', icon: 'g' },
  { id: 'analytics', name: 'Google Analytics', desc: 'Track website traffic & conversions', color: '#E37400', icon: 'ga' },
]

interface ConnectToolsScreenProps {
  onComplete: () => void
}

export function ConnectToolsScreen({ onComplete }: ConnectToolsScreenProps) {
  const { theme } = useTheme()
  const t = getJoyoTheme(theme)
  const [connected, setConnected] = useState<Record<string, boolean>>({})

  const handleConnect = (id: string) => {
    // Mock OAuth — in production this would trigger real OAuth flow
    setConnected(prev => ({ ...prev, [id]: true }))
  }

  const handleSkip = () => {
    localStorage.setItem('joyo_tools_connected', '1')
    onComplete()
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: t.surface,
      padding: 24,
    }}>
      <div style={{ maxWidth: 720, width: '100%', textAlign: 'center' }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: t.text, marginBottom: 8 }}>
          Connect your marketing tools
        </h1>
        <p style={{ fontSize: 14, color: t.textSecondary, marginBottom: 36 }}>
          Link your accounts so JOYO can manage everything in one place
        </p>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: 16,
          marginBottom: 32,
        }}>
          {TOOLS.map(tool => {
            const isConnected = connected[tool.id]
            return (
              <div key={tool.id} style={{
                background: t.card,
                border: `1px solid ${isConnected ? tool.color : t.border}`,
                borderRadius: 16,
                padding: '24px 20px',
                textAlign: 'center',
                transition: 'all 0.2s',
              }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 14,
                  background: `${tool.color}15`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 14px',
                  fontSize: 18, fontWeight: 800, color: tool.color,
                }}>
                  {tool.icon}
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 4 }}>
                  {tool.name}
                </div>
                <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 16, lineHeight: 1.4 }}>
                  {tool.desc}
                </div>
                {isConnected ? (
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    padding: '8px 16px', borderRadius: 10,
                    background: `${tool.color}15`, color: tool.color,
                    fontSize: 12.5, fontWeight: 650,
                  }}>
                    <Check size={14} /> Connected
                  </div>
                ) : (
                  <button
                    onClick={() => handleConnect(tool.id)}
                    style={{
                      padding: '8px 16px', borderRadius: 10,
                      border: `1px solid ${t.border}`,
                      background: t.card, color: t.text,
                      fontSize: 12.5, fontWeight: 600,
                      cursor: 'pointer', transition: 'all 0.2s',
                      width: '100%',
                    }}
                  >
                    Connect
                  </button>
                )}
              </div>
            )
          })}
        </div>

        <button
          onClick={handleSkip}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: 'none', border: 'none',
            color: t.textMuted, fontSize: 13, fontWeight: 500,
            cursor: 'pointer', padding: '8px 16px',
          }}
        >
          I'll do this later <ArrowRight size={14} />
        </button>
      </div>
    </div>
  )
}

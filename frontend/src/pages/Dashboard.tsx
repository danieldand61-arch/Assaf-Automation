import { useState, useEffect } from 'react'
import { Send, Target, Image as ImagePlus, ArrowUp, Eye, Film } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useAccount } from '../contexts/AccountContext'
import { useTheme } from '../contexts/ThemeContext'
import { getJoyoTheme } from '../styles/joyo-theme'

interface DashboardProps {
  onNavigate: (tab: string) => void
}

interface MetricCardProps {
  icon: React.ElementType
  label: string
  value: string
  change?: string
  changeDir?: 'up' | 'down'
  color: string
  delay?: number
}

function MetricCard({ icon: Icon, label, value, change, changeDir, color, delay = 0 }: MetricCardProps) {
  const { theme } = useTheme()
  const JoyoTheme = getJoyoTheme(theme)
  
  return (
    <div 
      style={{
        background: JoyoTheme.card,
        borderRadius: 16,
        border: `1px solid ${JoyoTheme.border}`,
        transition: "all 0.25s cubic-bezier(0.4,0,0.2,1)",
        padding: '20px 22px',
        flex: 1,
        minWidth: 170,
        position: 'relative',
        overflow: 'hidden',
        animation: `fadeUp 0.5s ease ${delay}s both`
      }}
    >
      <div style={{
        position: 'absolute',
        top: -30,
        right: -30,
        width: 90,
        height: 90,
        borderRadius: '50%',
        background: `${color}06`
      }} />
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        marginBottom: 14
      }}>
        <div style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          background: `${color}0D`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <Icon size={17} color={color} />
        </div>
        <span style={{
          fontSize: 12,
          color: JoyoTheme.textSecondary,
          fontWeight: 600
        }}>
          {label}
        </span>
      </div>
      <div style={{
        fontSize: 28,
        fontWeight: 800,
        color: JoyoTheme.text,
        letterSpacing: -1.2
      }}>
        {value}
      </div>
      {change && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          marginTop: 8,
          fontSize: 11.5,
          fontWeight: 600,
          color: changeDir === 'up' ? JoyoTheme.success : JoyoTheme.danger
        }}>
          {changeDir === 'up' && <ArrowUp size={13} />}
          {change}
        </div>
      )}
    </div>
  )
}

export default function Dashboard({ onNavigate }: DashboardProps) {
  const { user, session } = useAuth()
  const { activeAccount } = useAccount()
  const { theme } = useTheme()
  const [stats, setStats] = useState({
    postsCreated: 0,
    imagesGenerated: 0,
    videosTranslated: 0,
    totalRequests: 0
  })

  const JoyoTheme = getJoyoTheme(theme)

  useEffect(() => {
    const fetchStats = async () => {
      console.log('📊 Dashboard: Fetching stats...')
      console.log('📊 Active account:', activeAccount)
      console.log('📊 Session exists:', !!session)
      
      if (!session || !activeAccount) {
        console.log('⚠️ Dashboard: Missing session or activeAccount')
        return
      }

      try {
        const apiUrl = import.meta.env.VITE_API_URL || 'https://assaf-automation-production.up.railway.app'
        const url = `${apiUrl}/api/accounts/${activeAccount.id}/stats`
        console.log('📊 Fetching from:', url)
        
        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        })

        console.log('📊 Response status:', response.status)

        if (response.ok) {
          const data = await response.json()
          console.log('📊 Stats received:', data)
          setStats({
            postsCreated: data.posts_created || 0,
            imagesGenerated: data.images_generated || 0,
            videosTranslated: data.videos_translated || 0,
            totalRequests: data.total_requests || 0
          })
        } else {
          console.error('❌ Stats fetch failed:', response.status, await response.text())
        }
      } catch (error) {
        console.error('❌ Failed to fetch stats:', error)
      }
    }

    fetchStats()
  }, [session, activeAccount])

  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User'

  return (
    <div style={{ maxWidth: 1160, margin: '0 auto' }}>
      {/* Welcome Banner */}
      <div style={{
        borderRadius: 18,
        padding: '26px 30px',
        marginBottom: 22,
        background: 'linear-gradient(135deg, #1B2A4A 0%, #2A3F6E 50%, #3B4F8A 100%)',
        position: 'relative',
        overflow: 'hidden',
        animation: 'fadeUp 0.4s ease both'
      }}>
        <div style={{
          position: 'absolute',
          top: -40,
          right: -20,
          width: 200,
          height: 200,
          borderRadius: '50%',
          background: 'rgba(74,124,255,0.12)'
        }} />
        <h1 style={{
          fontSize: 24,
          fontWeight: 800,
          color: 'white',
          marginBottom: 5
        }}>
          Good morning, {userName} 👋
        </h1>
        <p style={{
          fontSize: 13.5,
          color: 'rgba(255,255,255,0.7)',
          marginBottom: 18
        }}>
          Your AI marketing platform is ready to create amazing content
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => onNavigate('social')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '9px 18px',
              borderRadius: 10,
              border: 'none',
              background: 'rgba(255,255,255,0.15)',
              color: 'white',
              fontSize: 12.5,
              fontWeight: 650,
              cursor: 'pointer'
            }}
          >
            <Send size={14} /> Create Posts
          </button>
          <button
            onClick={() => onNavigate('ads')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '9px 18px',
              borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.15)',
              background: 'transparent',
              color: 'rgba(255,255,255,0.8)',
              fontSize: 12.5,
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <Target size={14} /> Google Ads
          </button>
        </div>
      </div>

      {/* Metrics */}
      <div style={{
        display: 'flex',
        gap: 14,
        marginBottom: 22,
        flexWrap: 'wrap'
      }}>
        <MetricCard
          icon={Send}
          label="Posts Created"
          value={stats.postsCreated.toString()}
          color={JoyoTheme.accent}
          delay={0.05}
        />
        <MetricCard
          icon={ImagePlus}
          label="Images Generated"
          value={stats.imagesGenerated.toString()}
          color={JoyoTheme.purple}
          delay={0.1}
        />
        <MetricCard
          icon={Film}
          label="Videos Processed"
          value={stats.videosTranslated.toString()}
          color={JoyoTheme.success}
          delay={0.15}
        />
        <MetricCard
          icon={Eye}
          label="Total Requests"
          value={stats.totalRequests.toString()}
          color={JoyoTheme.warning}
          delay={0.2}
        />
      </div>

      {/* Quick Actions */}
      <div style={{
        display: 'flex',
        gap: 14,
        flexWrap: 'wrap',
        animation: 'fadeUp 0.5s ease 0.4s both'
      }}>
        {[
          { icon: Send, title: 'Social Posts', desc: 'AI captions + images', gradient: JoyoTheme.gradient1, to: 'social' },
          { icon: Target, title: 'Google Ads', desc: 'Full campaign generation', gradient: JoyoTheme.gradient2, to: 'ads' },
          { icon: Film, title: 'Video Tools', desc: 'Translation & dubbing', gradient: JoyoTheme.gradient3, to: 'video' }
        ].map((feature, i) => {
          const Icon = feature.icon
          return (
            <div
              key={i}
              onClick={() => onNavigate(feature.to)}
              style={{
                background: JoyoTheme.card,
                borderRadius: 16,
                border: `1px solid ${JoyoTheme.border}`,
                transition: "all 0.25s cubic-bezier(0.4,0,0.2,1)",
                flex: 1,
                minWidth: 190,
                padding: '20px',
                cursor: 'pointer'
              }}
            >
              <div style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: feature.gradient,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 14,
                boxShadow: '0 4px 12px rgba(0,0,0,0.12)'
              }}>
                <Icon size={20} color="white" />
              </div>
              <div style={{
                fontSize: 13.5,
                fontWeight: 700,
                color: JoyoTheme.text,
                marginBottom: 4
              }}>
                {feature.title}
              </div>
              <div style={{
                fontSize: 12,
                color: JoyoTheme.textSecondary
              }}>
                {feature.desc}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

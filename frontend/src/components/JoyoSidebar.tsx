import { 
  LayoutDashboard, Send, Megaphone, Video, Film, 
  ImagePlus, FileText, Calendar, Settings, Menu,
  Sparkles
} from 'lucide-react'
import { JoyoTheme } from '../styles/joyo-theme'

interface JoyoSidebarProps {
  activeTab: string
  onTabChange: (tab: string) => void
  collapsed: boolean
  onToggleCollapse: () => void
}

const navSections = [
  { type: 'label', text: 'OVERVIEW' },
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  
  { type: 'label', text: 'CREATE' },
  { id: 'social', label: 'Social Posts', icon: Send },
  { id: 'ads', label: 'Google Ads', icon: Megaphone },
  { id: 'video', label: 'Video Translation', icon: Video },
  { id: 'videogen', label: 'Video Generation', icon: Film, disabled: true, badge: 'Coming Soon' },
  { id: 'images', label: 'Image Studio', icon: ImagePlus },
  
  { type: 'label', text: 'MANAGE' },
  { id: 'library', label: 'Content Library', icon: FileText },
  { id: 'calendar', label: 'Scheduled Posts', icon: Calendar },
]

export function JoyoSidebar({ activeTab, onTabChange, collapsed, onToggleCollapse }: JoyoSidebarProps) {
  return (
    <div 
      style={{ 
        width: collapsed ? 72 : 260, 
        minHeight: '100vh',
        background: JoyoTheme.sidebarGrad,
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.3s',
        overflow: 'hidden',
        flexShrink: 0,
        position: 'relative'
      }}
    >
      {/* Ambient Blobs */}
      <div style={{ 
        position: 'absolute', 
        top: 60, 
        left: -40, 
        width: 140, 
        height: 140, 
        borderRadius: '50%', 
        background: 'radial-gradient(circle, rgba(74,124,255,0.1) 0%, transparent 70%)', 
        pointerEvents: 'none' 
      }} />
      <div style={{ 
        position: 'absolute', 
        bottom: 120, 
        right: -50, 
        width: 160, 
        height: 160, 
        borderRadius: '50%', 
        background: 'radial-gradient(circle, rgba(139,92,246,0.08) 0%, transparent 70%)', 
        pointerEvents: 'none' 
      }} />

      {/* Header */}
      <div style={{ 
        padding: collapsed ? '22px 16px' : '22px', 
        display: 'flex', 
        alignItems: 'center', 
        gap: 12 
      }}>
        <div style={{ 
          width: 40, 
          height: 40, 
          borderRadius: 12, 
          background: JoyoTheme.gradient1, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          flexShrink: 0, 
          boxShadow: '0 4px 16px rgba(74,124,255,0.35)' 
        }}>
          <Sparkles size={20} color="white" />
        </div>
        {!collapsed && (
          <div>
            <div style={{ 
              color: 'white', 
              fontSize: 19, 
              fontWeight: 800, 
              letterSpacing: -0.5 
            }}>
              JOYO
            </div>
            <div style={{ 
              color: 'rgba(255,255,255,0.35)', 
              fontSize: 9.5, 
              fontWeight: 600, 
              letterSpacing: 2, 
              marginTop: 3 
            }}>
              AI MARKETING
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div style={{ 
        flex: 1, 
        padding: collapsed ? '4px 10px' : '4px 14px', 
        overflowY: 'auto' 
      }}>
        {navSections.map((item, i) => {
          if (item.type === 'label') {
            if (collapsed) return <div key={i} style={{ height: 16 }} />
            return (
              <div 
                key={i} 
                style={{ 
                  fontSize: 9.5, 
                  fontWeight: 700, 
                  letterSpacing: 2, 
                  color: 'rgba(255,255,255,0.2)', 
                  padding: '18px 14px 7px' 
                }}
              >
                {item.text}
              </div>
            )
          }

          const Icon = item.icon!
          const isActive = activeTab === item.id
          const isDisabled = item.disabled

          return (
            <button
              key={item.id}
              onClick={() => !isDisabled && onTabChange(item.id!)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: collapsed ? '10px 0' : '10px 14px',
                borderRadius: 10,
                border: 'none',
                cursor: isDisabled ? 'not-allowed' : 'pointer',
                background: isActive ? 'rgba(74,124,255,0.15)' : 'transparent',
                color: isDisabled ? 'rgba(255,255,255,0.25)' : (isActive ? '#B4CDFF' : 'rgba(255,255,255,0.5)'),
                fontSize: 13.5,
                fontWeight: isActive ? 600 : 500,
                transition: 'all 0.2s',
                justifyContent: collapsed ? 'center' : 'flex-start',
                position: 'relative',
                opacity: isDisabled ? 0.6 : 1
              }}
            >
              {isActive && !collapsed && !isDisabled && (
                <div style={{ 
                  position: 'absolute', 
                  left: -14, 
                  top: '50%', 
                  transform: 'translateY(-50%)', 
                  width: 3, 
                  height: 22, 
                  borderRadius: 2, 
                  background: JoyoTheme.accent, 
                  boxShadow: `0 0 10px ${JoyoTheme.accent}` 
                }} />
              )}
              <Icon size={18} style={{ flexShrink: 0 }} />
              {!collapsed && (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ textAlign: 'left' }}>
                    {item.label}
                  </span>
                  {item.badge && (
                    <span style={{
                      fontSize: 9,
                      fontWeight: 700,
                      padding: '2px 6px',
                      borderRadius: 4,
                      background: 'rgba(255,193,7,0.2)',
                      color: '#FFC107'
                    }}>
                      {item.badge}
                    </span>
                  )}
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* Settings */}
      <div style={{ 
        padding: collapsed ? '14px 10px' : '14px', 
        borderTop: '1px solid rgba(255,255,255,0.05)' 
      }}>
        <button
          onClick={() => onTabChange('settings')}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: collapsed ? '10px 0' : '10px 14px',
            borderRadius: 10,
            border: 'none',
            cursor: 'pointer',
            background: 'transparent',
            color: 'rgba(255,255,255,0.45)',
            fontSize: 13.5,
            justifyContent: collapsed ? 'center' : 'flex-start'
          }}
        >
          <Settings size={18} />
          {!collapsed && 'Settings'}
        </button>
      </div>

      {/* Collapse Toggle */}
      <button
        onClick={onToggleCollapse}
        style={{
          position: 'absolute',
          top: 22,
          right: collapsed ? 16 : 22,
          background: 'rgba(255,255,255,0.1)',
          border: 'none',
          borderRadius: 8,
          width: 32,
          height: 32,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'rgba(255,255,255,0.6)'
        }}
      >
        <Menu size={18} />
      </button>
    </div>
  )
}

import { 
  LayoutDashboard, Send, Megaphone, MessageSquare, Image, Film, 
  FileText, Calendar, Link2, Settings, Menu,
  Sparkles
} from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'
import { useApp } from '../contexts/AppContext'
import { getJoyoTheme } from '../styles/joyo-theme'
import { TranslationKey } from '../i18n/translations'

interface JoyoSidebarProps {
  activeTab: string
  onTabChange: (tab: string) => void
  collapsed: boolean
  onToggleCollapse: () => void
}

const navItems: { id: string; labelKey: TranslationKey; icon: any; disabled?: boolean; badgeKey?: TranslationKey }[] = [
  { id: 'dashboard',    labelKey: 'navDashboard',       icon: LayoutDashboard },
  { id: 'ads',          labelKey: 'navGoogleAds',       icon: Megaphone },
  { id: 'social',       labelKey: 'navPostGenerator',   icon: Send },
  { id: 'chat',         labelKey: 'navAIAdvisor',       icon: MessageSquare },
  { id: 'media',        labelKey: 'navMediaStudio',     icon: Image, disabled: true, badgeKey: 'comingSoon' },
  { id: 'videogen',     labelKey: 'navVideoStudio',     icon: Film, disabled: true, badgeKey: 'comingSoon' },
  { id: 'library',      labelKey: 'navContentLibrary',  icon: FileText },
  { id: 'calendar',     labelKey: 'navCalendar',        icon: Calendar },
  { id: 'integrations', labelKey: 'navIntegrations',    icon: Link2 },
  { id: 'settings',     labelKey: 'navSettings',        icon: Settings },
]

export function JoyoSidebar({ activeTab, onTabChange, collapsed, onToggleCollapse }: JoyoSidebarProps) {
  const { theme } = useTheme()
  const { t } = useApp()
  const JoyoTheme = getJoyoTheme(theme)
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
        {navItems.map((item) => {
          const Icon = item.icon
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
                    {t(item.labelKey)}
                  </span>
                  {item.badgeKey && (
                    <span style={{
                      fontSize: 9,
                      fontWeight: 700,
                      padding: '2px 6px',
                      borderRadius: 4,
                      background: 'rgba(255,193,7,0.2)',
                      color: '#FFC107'
                    }}>
                      {t(item.badgeKey)}
                    </span>
                  )}
                </div>
              )}
            </button>
          )
        })}
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

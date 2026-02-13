import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { JoyoSidebar } from './JoyoSidebar'
import { JoyoTopBar } from './JoyoTopBar'
import { FloatingChat } from './FloatingChat'
import { InputSection } from './InputSection'
import { GoogleAdsGeneration } from './GoogleAdsGeneration'
import { VideoTranslation } from './VideoTranslation'
import { PreviewSection } from './PreviewSection'
import VideoGeneration from '../pages/VideoGeneration'
import Dashboard from '../pages/Dashboard'
import { Library } from '../pages/Library'
import { Scheduled } from '../pages/Scheduled'
import { Settings } from '../pages/Settings'
import { useContentStore } from '../store/contentStore'
import { useAccount } from '../contexts/AccountContext'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { getJoyoTheme, animations } from '../styles/joyo-theme'

type TabType = 'dashboard' | 'social' | 'ads' | 'video' | 'videogen' | 'library' | 'calendar' | 'settings'

export function MainWorkspace() {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard')
  const [collapsed, setCollapsed] = useState(false)
  const { generatedContent, setGeneratedContent } = useContentStore()
  const { loading, accounts } = useAccount()
  const { session } = useAuth()
  const { theme } = useTheme()
  const [generating, setGenerating] = useState(false)
  
  const JoyoTheme = getJoyoTheme(theme)
  
  console.log('🏢 MainWorkspace render - loading:', loading, 'accounts:', accounts.length)

  const handleGenerate = async (data: any) => {
    console.log('🎯 handleGenerate called with:', data)
    
    try {
      setGenerating(true)
      setGeneratedContent(null)
      
      console.log('🔐 Session check:', session ? 'exists' : 'missing')
      
      if (!session) {
        alert('Please sign in to generate content')
        setGenerating(false)
        return
      }
      
      const apiUrl = import.meta.env.VITE_API_URL || 'https://assaf-automation-production.up.railway.app'
      const endpoint = `${apiUrl}/api/generate`
      console.log('🌐 Sending request to:', endpoint)
      console.log('📦 Request payload:', data)
      console.log('🔑 Has token:', !!session.access_token)
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify(data)
      })
      
      console.log('📥 Response status:', response.status)
      console.log('📥 Response ok:', response.ok)
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ Error response:', errorText)
        throw new Error(`Generation failed: ${response.status} - ${errorText}`)
      }
      
      const result = await response.json()
      console.log('✅ Generation complete. Variations:', result.variations?.length, 'Images:', result.images?.length)
      
      setGeneratedContent(result)
    } catch (error: any) {
      console.error('❌ Generation error:', error)
      alert(`Failed to generate content: ${error.message}`)
    } finally {
      setGenerating(false)
    }
  }

  const handleReset = () => {
    setGeneratedContent(null)
  }

  // Show loading while fetching accounts
  if (loading) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: JoyoTheme.surface
      }}>
        <Loader2 className="w-12 h-12 animate-spin" style={{ color: JoyoTheme.accent }} />
      </div>
    )
  }

  const pageTitles: Record<TabType, string> = {
    dashboard: 'Dashboard',
    social: 'Social Posts',
    ads: 'Google Ads',
    video: 'Video Dubbing',
    videogen: 'Video Generation',
    library: 'Content Library',
    calendar: 'Scheduled Posts',
    settings: 'Settings'
  }

  return (
    <div style={{ 
      display: 'flex', 
      minHeight: '100vh',
      background: JoyoTheme.surface,
      fontFamily: "'Plus Jakarta Sans','Inter',-apple-system,sans-serif"
    }}>
      {/* Inject animations */}
      <style>{animations}</style>

      {/* Sidebar */}
      <JoyoSidebar
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab as TabType)}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed(!collapsed)}
      />

      {/* Main Content */}
      <div style={{ 
        flex: 1, 
        display: 'flex', 
        flexDirection: 'column', 
        minWidth: 0 
      }}>
        {/* Top Bar */}
        <JoyoTopBar title={pageTitles[activeTab]} />

        {/* Content Area */}
        <div 
          key={activeTab}
          style={{ 
            flex: 1, 
            padding: '28px 28px 40px', 
            overflowY: 'auto' 
          }}
        >
          {activeTab === 'dashboard' && <Dashboard onNavigate={(tab) => setActiveTab(tab as TabType)} />}
          
          {activeTab === 'social' && (
            <div style={{ display: 'flex', height: '100%' }}>
              <div style={{ 
                flex: generatedContent ? 1 : 1, 
                overflowY: 'auto',
                paddingRight: generatedContent ? '12px' : 0
              }}>
                {generating && (
                  <div style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(0,0,0,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 50
                  }}>
                    <div style={{
                      background: JoyoTheme.card,
                      borderRadius: 20,
                      padding: '32px',
                      maxWidth: '400px',
                      textAlign: 'center'
                    }}>
                      <Loader2 
                        size={48} 
                        style={{ 
                          color: JoyoTheme.accent,
                          animation: 'spin 1s linear infinite',
                          margin: '0 auto 16px'
                        }} 
                      />
                      <h3 style={{
                        fontSize: 18,
                        fontWeight: 800,
                        color: JoyoTheme.text,
                        marginBottom: 8
                      }}>
                        Generating Content...
                      </h3>
                      <p style={{
                        fontSize: 14,
                        color: JoyoTheme.textSecondary
                      }}>
                        Creating amazing posts and images for you
                      </p>
                    </div>
                  </div>
                )}
                <InputSection onGenerate={handleGenerate} />
              </div>
              {generatedContent && generatedContent.variations && generatedContent.images && (
                <div style={{ 
                  flex: 1, 
                  borderLeft: `1px solid ${JoyoTheme.border}`,
                  overflowY: 'auto',
                  paddingLeft: '12px',
                  background: JoyoTheme.card
                }}>
                  <PreviewSection onReset={handleReset} />
                </div>
              )}
            </div>
          )}
          
          {activeTab === 'ads' && <GoogleAdsGeneration />}
          
          {activeTab === 'video' && <VideoTranslation />}
          
          {activeTab === 'videogen' && <VideoGeneration />}
          
          {activeTab === 'library' && <Library />}
          
          {activeTab === 'calendar' && <Scheduled />}
          
          {activeTab === 'settings' && <Settings />}
        </div>
      </div>

      {/* Floating Chat Assistant */}
      <FloatingChat />
    </div>
  )
}

import { useState, useRef, useEffect } from 'react'
import { Loader2, Check, Sparkles } from 'lucide-react'
import { JoyoSidebar } from './JoyoSidebar'
import { JoyoTopBar } from './JoyoTopBar'
import { FloatingChat } from './FloatingChat'
import { ConnectToolsScreen } from './ConnectToolsScreen'
import { InputSection, GenerateFormData } from './InputSection'
import { GoogleAdsGeneration } from './GoogleAdsGeneration'
import { VideoTranslation } from './VideoTranslation'
import { PreviewSection } from './PreviewSection'
import VideoGeneration from '../pages/VideoGeneration'
import Dashboard from '../pages/Dashboard'
import { Library } from '../pages/Library'
import { Scheduled } from '../pages/Scheduled'
import { Settings } from '../pages/Settings'
import AdAnalytics from '../pages/AdAnalytics'
import AIAdvisor from '../pages/AIAdvisor'
import { Connections } from '../pages/Connections'
import { useContentStore } from '../store/contentStore'
import { useAccount } from '../contexts/AccountContext'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { getJoyoTheme, animations } from '../styles/joyo-theme'
import { getApiUrl } from '../lib/api'

type TabType = 'dashboard' | 'social' | 'ads' | 'chat' | 'analyst' | 'advisor' | 'media' | 'video' | 'videogen' | 'library' | 'calendar' | 'integrations' | 'settings'
type SocialScreen = 'form' | 'generating' | 'results'

/* ── Platform display info for loading screen ─────────────────── */
const PLATFORM_LABELS: Record<string, string> = {
  facebook: 'Facebook', instagram: 'Instagram', linkedin: 'LinkedIn',
  tiktok: 'TikTok', x: 'X (Twitter)', google_business: 'Google Business',
}

export function MainWorkspace() {
  const [activeTab, setActiveTab] = useState<TabType>(() => {
    const params = new URLSearchParams(window.location.search)
    const tab = params.get('tab')
    if (tab && ['dashboard','social','ads','chat','analyst','advisor','media','video','videogen','library','calendar','integrations','settings'].includes(tab)) {
      return tab as TabType
    }
    return 'dashboard'
  })
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const tab = params.get('tab')
    if (tab && tab !== activeTab && ['dashboard','social','ads','chat','analyst','advisor','media','video','videogen','library','calendar','integrations','settings'].includes(tab)) {
      setActiveTab(tab as TabType)
    }
  }, [])
  const [showConnectTools, setShowConnectTools] = useState(
    () => !localStorage.getItem('joyo_tools_connected')
  )
  const { generatedContent, setGeneratedContent } = useContentStore()
  const { loading } = useAccount()
  const { session } = useAuth()
  const { theme } = useTheme()

  // Social post generator state
  const [socialScreen, setSocialScreen] = useState<SocialScreen>('form')
  const [progress, setProgress] = useState(0)
  const [platformStatus, setPlatformStatus] = useState<Record<string, 'pending' | 'done'>>({})
  const savedFormRef = useRef<GenerateFormData | null>(null)

  const JoyoTheme = getJoyoTheme(theme)

  const handleGenerate = async (data: GenerateFormData) => {
    if (!session) { alert('Please sign in to generate content'); return }

    // Save form for "Back" button
    savedFormRef.current = data

    // Normalize URL — add https:// if missing
    let url = data.url.trim()
    if (url && !/^https?:\/\//i.test(url)) url = `https://${url}`

    // Switch to generating screen
    setSocialScreen('generating')
    setGeneratedContent(null)
    setProgress(0)

    // Init platform statuses
    const statuses: Record<string, 'pending' | 'done'> = {}
    data.platforms.forEach(p => { statuses[p] = 'pending' })
    setPlatformStatus({ ...statuses })

    // Simulate per-platform progress while waiting for API
    const totalPlatforms = data.platforms.length
    let completed = 0
    const interval = setInterval(() => {
      if (completed < totalPlatforms) {
        const next = data.platforms[completed]
        statuses[next] = 'done'
        completed++
        setPlatformStatus({ ...statuses })
        setProgress(Math.min(Math.round((completed / totalPlatforms) * 90), 90))
      }
    }, 1500)

    try {
      const apiUrl = getApiUrl()
      const response = await fetch(`${apiUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          url,
          keywords: data.keywords,
          platforms: data.platforms,
          image_size: data.image_size,
          style: data.style,
          language: data.language,
          target_audience: data.target_audience,
          include_emojis: data.include_emojis,
          include_logo: data.include_logo,
          skip_image_generation: !!data.media_file,
          user_media_url: data.media_file || undefined,
          use_custom_url: !!data.use_custom_url,
          include_people: !!data.include_people,
        })
      })

      clearInterval(interval)

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Generation failed: ${response.status} - ${errorText}`)
      }

      const result = await response.json()

      // Mark all platforms done
      data.platforms.forEach(p => { statuses[p] = 'done' })
      setPlatformStatus({ ...statuses })
      setProgress(100)

      // Store result with form params + user media if provided
      setGeneratedContent({ ...result, request_params: data, user_media: data.media_file || null })

      // Auto-transition to results after short delay
      setTimeout(() => setSocialScreen('results'), 600)
    } catch (error: any) {
      clearInterval(interval)
      console.error('Generation error:', error)
      alert(`Failed to generate content: ${error.message}`)
      setSocialScreen('form')
    }
  }

  const handleBackToForm = () => {
    setSocialScreen('form')
  }

  const handleReset = () => {
    setGeneratedContent(null)
    savedFormRef.current = null
    setSocialScreen('form')
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: JoyoTheme.surface }}>
        <Loader2 className="w-12 h-12 animate-spin" style={{ color: JoyoTheme.accent }} />
      </div>
    )
  }

  const pageTitles: Record<TabType, string> = {
    dashboard: 'Dashboard', social: 'Post Generator', ads: 'Google Ads',
    chat: 'AI Advisor & Analyst', analyst: 'Analyst', advisor: 'AI Advisor', media: 'Media Studio',
    video: 'Video Dubbing', videogen: 'Video Studio',
    library: 'Content Library', calendar: 'Calendar',
    integrations: 'Integrations', settings: 'Settings',
  }

  if (showConnectTools) {
    return <ConnectToolsScreen onComplete={() => setShowConnectTools(false)} />
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: JoyoTheme.surface, fontFamily: "'Plus Jakarta Sans','Inter',-apple-system,sans-serif" }}>
      <style>{animations}</style>

      <JoyoSidebar
        activeTab={activeTab}
        onTabChange={(tab) => { setActiveTab(tab as TabType); if (tab === 'social') setSocialScreen(generatedContent ? 'results' : 'form') }}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed(!collapsed)}
      />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <JoyoTopBar title={pageTitles[activeTab]} />

        <div key={activeTab} style={{ flex: 1, padding: '28px 28px 40px', overflowY: 'auto' }}>
          {activeTab === 'dashboard' && <Dashboard onNavigate={(tab) => setActiveTab(tab as TabType)} />}

          {/* ── Social Post Generator — 3 screens ──────────────── */}
          {activeTab === 'social' && (
            <>
              {/* Screen 1: Form */}
              {socialScreen === 'form' && (
                <InputSection onGenerate={handleGenerate} savedForm={savedFormRef.current} />
              )}

              {/* Screen 2: Generating */}
              {socialScreen === 'generating' && (
                <GeneratingScreen
                  progress={progress}
                  platformStatus={platformStatus}
                  theme={JoyoTheme}
                />
              )}

              {/* Screen 3: Results */}
              {socialScreen === 'results' && generatedContent && (
                <PreviewSection onReset={handleReset} onBack={handleBackToForm} />
              )}
            </>
          )}

          {activeTab === 'ads' && <GoogleAdsGeneration />}
          {activeTab === 'analyst' && <AdAnalytics />}
          {activeTab === 'advisor' && <AIAdvisor />}
          {activeTab === 'media' && <PlaceholderPage title="Media Studio" description="Create, edit, and manage your visual content — templates, batch resize, background removal, and more." />}
          {activeTab === 'video' && <VideoTranslation />}
          {activeTab === 'videogen' && <VideoGeneration />}
          {activeTab === 'library' && <Library />}
          {activeTab === 'calendar' && <Scheduled />}
          {activeTab === 'integrations' && <Connections />}
          {activeTab === 'settings' && <Settings />}
        </div>
      </div>

      <FloatingChat />
    </div>
  )
}


/* ── Placeholder page for upcoming sections ──────────────────── */
function PlaceholderPage({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-center" style={{ minHeight: '50vh' }}>
      <Sparkles size={48} className="text-blue-500 mb-4" />
      <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">{title}</h2>
      <p className="text-gray-500 dark:text-gray-400 max-w-md">{description}</p>
      <span className="mt-4 px-4 py-1.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
        Coming Soon
      </span>
    </div>
  )
}

/* ── Screen 2: Generating ────────────────────────────────────── */
function GeneratingScreen({
  progress, platformStatus, theme
}: {
  progress: number
  platformStatus: Record<string, 'pending' | 'done'>
  theme: any
}) {
  return (
    <div className="flex flex-col items-center justify-center" style={{ minHeight: '60vh' }}>
      {/* Sparkle icon */}
      <div className="mb-6">
        <Sparkles size={56} style={{ color: theme.accent, animation: 'spin 2s linear infinite' }} />
      </div>

      <h2 className="text-2xl font-bold mb-2" style={{ color: theme.text }}>
        Creating your posts...
      </h2>
      <p className="text-sm mb-8" style={{ color: theme.textSecondary }}>
        AI is crafting optimized content for each platform
      </p>

      {/* Progress bar */}
      <div className="w-full max-w-md mb-8">
        <div className="h-3 rounded-full overflow-hidden" style={{ background: theme.border }}>
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${progress}%`,
              background: 'linear-gradient(90deg, #4A7CFF, #7C3AED)',
            }}
          />
        </div>
        <p className="text-xs text-center mt-2" style={{ color: theme.textSecondary }}>
          {progress}%
        </p>
      </div>

      {/* Per-platform status */}
      <div className="space-y-3 w-full max-w-sm">
        {Object.entries(platformStatus).map(([platform, status]) => (
          <div key={platform} className="flex items-center gap-3 px-4 py-2.5 rounded-xl"
            style={{ background: theme.card }}
          >
            {status === 'done' ? (
              <Check size={18} className="text-green-500 shrink-0" />
            ) : (
              <Loader2 size={18} className="animate-spin shrink-0" style={{ color: theme.accent }} />
            )}
            <span className="text-sm font-medium" style={{ color: theme.text }}>
              {PLATFORM_LABELS[platform] || platform}
            </span>
            {status === 'done' && (
              <span className="ml-auto text-xs text-green-500 font-medium">ready!</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

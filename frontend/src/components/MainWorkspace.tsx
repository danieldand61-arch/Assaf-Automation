import { useState, useRef, useEffect } from 'react'
import { Loader2, Check, Sparkles, FileSearch, Palette, FileCheck } from 'lucide-react'
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
import Billing from '../pages/Billing'
import GenerateCreative from '../pages/GenerateCreative'
import { useContentStore } from '../store/contentStore'
import { useAccount } from '../contexts/AccountContext'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { useApp } from '../contexts/AppContext'
import type { TranslationKey } from '../i18n/translations'
import { getJoyoTheme, animations } from '../styles/joyo-theme'
import { getApiUrl } from '../lib/api'

type TabType = 'dashboard' | 'brandkit' | 'social' | 'creative' | 'ads' | 'chat' | 'analyst' | 'advisor' | 'media' | 'video' | 'videogen' | 'library' | 'calendar' | 'billing' | 'integrations' | 'settings'

function _friendlyGenerateError(msg: string, t: (key: TranslationKey) => string): string {
  const m = msg.toLowerCase()
  if (m.includes('429') || m.includes('rate limit') || m.includes('too many')) return t('errRateLimit')
  if (m.includes('timeout') || m.includes('timed out')) return t('errTimeout')
  if (m.includes('quota') || m.includes('billing')) return t('errQuota')
  if (m.includes('credit') || m.includes('balance')) return t('errCredits')
  if (m.includes('could not analyze') || m.includes('scrape')) return t('errAnalyze')
  if (m.includes('blocked') || m.includes('safety')) return t('errBlocked')
  if (m.includes('failed to fetch') || m.includes('networkerror')) return t('errNetwork')
  return msg
}
type SocialScreen = 'form' | 'generating' | 'results'

export function MainWorkspace() {
  const [activeTab, setActiveTab] = useState<TabType>(() => {
    const params = new URLSearchParams(window.location.search)
    const tab = params.get('tab')
    if (tab && ['dashboard','brandkit','social','creative','ads','chat','analyst','advisor','media','video','videogen','library','calendar','billing','integrations','settings'].includes(tab)) {
      return tab as TabType
    }
    return 'dashboard'
  })
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const tab = params.get('tab')
    if (tab && tab !== activeTab && ['dashboard','brandkit','social','creative','ads','chat','analyst','advisor','media','video','videogen','library','calendar','billing','integrations','settings'].includes(tab)) {
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
  const { t } = useApp()

  // Social post generator state
  const [socialScreen, setSocialScreen] = useState<SocialScreen>('form')
  const [progress, setProgress] = useState(0)
  const [platformStatus, setPlatformStatus] = useState<Record<string, 'pending' | 'done'>>({})
  const [generateError, setGenerateError] = useState('')
  const [saveResults, setSaveResults] = useState<Record<number, boolean>>({})
  const [showCreditsPopup, setShowCreditsPopup] = useState(false)
  const savedFormRef = useRef<GenerateFormData | null>(null)

  const JoyoTheme = getJoyoTheme(theme)

  const handleGenerate = async (data: GenerateFormData) => {
    if (!session) { setGenerateError(t('pleaseSignIn')); return }

    // Save form for "Back" button
    savedFormRef.current = data

    // Normalize URL — add https:// if missing
    let url = data.url.trim()
    if (url && !/^https?:\/\//i.test(url)) url = `https://${url}`

    // Switch to generating screen
    setSocialScreen('generating')
    setGeneratedContent(null)
    setProgress(0)
    setSaveResults({})

    // Init platform statuses
    const statuses: Record<string, 'pending' | 'done'> = {}
    data.platforms.forEach(p => { statuses[p] = 'pending' })
    setPlatformStatus({ ...statuses })

    // Simulate per-platform progress while waiting for API
    const totalPlatforms = data.platforms.length
    let completed = 0
    let apiDone = false
    const interval = setInterval(() => {
      if (completed < totalPlatforms) {
        const next = data.platforms[completed]
        statuses[next] = 'done'
        completed++
        setPlatformStatus({ ...statuses })
        setProgress(Math.min(Math.round((completed / totalPlatforms) * 90), 90))
      }
    }, 1500)

    // Slow tick from 90→99% while waiting for image generation
    const slowTick = setInterval(() => {
      if (apiDone) return
      setProgress(prev => prev >= 99 ? 99 : prev < 90 ? prev : prev + 1)
    }, 4000)

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
          reference_image: data.uploaded_image || undefined,
          graphic_mode: !!data.graphic_mode,
        })
      })

      apiDone = true
      clearInterval(interval)
      clearInterval(slowTick)

      if (!response.ok) {
        const errorText = await response.text()
        let detail = errorText
        try { detail = JSON.parse(errorText).detail || errorText } catch {}
        throw new Error(detail)
      }

      const result = await response.json()

      data.platforms.forEach(p => { statuses[p] = 'done' })
      setPlatformStatus({ ...statuses })
      setProgress(100)

      setGeneratedContent({ ...result, request_params: data, user_media: data.media_file || null })

      // Auto-save all variations to library (track real completion)
      if (session && result.variations?.length) {
        const mediaUrl = data.media_file || ''
        const savePromises = result.variations.map((v: any, i: number) => {
          const img = result.images?.[i] || result.images?.[0]
          const imageUrl = img?.url || mediaUrl
          return fetch(`${apiUrl}/api/saved-posts/save`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
            body: JSON.stringify({ text: v.text, hashtags: v.hashtags || [], call_to_action: v.call_to_action || '', image_url: imageUrl, platforms: data.platforms })
          }).then(r => ({ idx: i, ok: r.ok })).catch(() => ({ idx: i, ok: false }))
        })
        Promise.allSettled(savePromises).then(results => {
          const saved: Record<number, boolean> = {}
          results.forEach(r => { if (r.status === 'fulfilled' && r.value.ok) saved[r.value.idx] = true })
          setSaveResults(saved)
        })
      }

      setTimeout(() => setSocialScreen('results'), 600)
    } catch (error: any) {
      apiDone = true
      clearInterval(interval)
      clearInterval(slowTick)
      console.error('Generation error:', error)
      const msg = error.message || 'Unknown error'
      if (msg.toLowerCase().includes('credit') || msg.toLowerCase().includes('balance') || msg.toLowerCase().includes('402')) {
        setShowCreditsPopup(true)
      } else {
        setGenerateError(_friendlyGenerateError(msg, t))
      }
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

  const handleSendVideoToPostGenerator = (videoUrl: string, videoPrompt?: string) => {
    savedFormRef.current = {
      url: '', keywords: videoPrompt ? `Write a social media post for this video: ${videoPrompt}` : '',
      platforms: ['facebook', 'instagram'],
      image_size: '1080x1080', style: 'professional', language: 'en',
      target_audience: 'b2c', include_emojis: true, include_logo: false,
      include_people: false, graphic_mode: false, uploaded_image: null, media_file: videoUrl,
    }
    setSocialScreen('form')
    setActiveTab('social')
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: JoyoTheme.surface }}>
        <Loader2 className="w-12 h-12 animate-spin" style={{ color: JoyoTheme.accent }} />
      </div>
    )
  }

  const pageTitles: Record<TabType, string> = {
    dashboard: t('navHome'), brandkit: t('navBrandKit'), social: t('navPostGenerator'), creative: t('navCreativeStudio'), ads: t('navGoogleAds'),
    chat: t('aiAdvisorAnalyst'), analyst: t('navAnalyst'), advisor: t('navAIAdvisor'), media: t('navMediaStudio'),
    video: t('aiDubbing'), videogen: t('navVideoStudio'),
    library: t('navContentLibrary'), calendar: t('navCalendar'),
    billing: t('navBilling'), integrations: t('navIntegrations'), settings: t('navSettings'),
  }

  if (showConnectTools) {
    return <ConnectToolsScreen onComplete={() => setShowConnectTools(false)} />
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: JoyoTheme.surface, fontFamily: "'Plus Jakarta Sans','Inter',-apple-system,sans-serif" }}>
      <style>{animations}</style>

      <JoyoSidebar
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab as TabType)}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed(!collapsed)}
      />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <JoyoTopBar title={pageTitles[activeTab]} onNavigate={(tab) => setActiveTab(tab as TabType)} />

        {/* Social tab stays mounted so generation doesn't reset on tab switch */}
        <div style={{ flex: 1, padding: '28px 28px 40px', overflowY: 'auto', display: activeTab === 'social' ? undefined : 'none' }}>
          {socialScreen === 'form' && (
            <>
              {generateError && (
                <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-red-500 text-lg">!</span>
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-red-800 dark:text-red-300 text-sm">{t('generationFailed')}</p>
                    <p className="text-red-600 dark:text-red-400 text-sm mt-0.5">{generateError}</p>
                  </div>
                  <button onClick={() => setGenerateError('')} className="text-red-400 hover:text-red-600 text-lg leading-none">&times;</button>
                </div>
              )}
              <InputSection onGenerate={(d) => { setGenerateError(''); handleGenerate(d) }} savedForm={savedFormRef.current} />
            </>
          )}
          {socialScreen === 'generating' && (
            <GeneratingScreen
              progress={progress}
              platformStatus={platformStatus}
              theme={JoyoTheme}
            />
          )}
          {socialScreen === 'results' && generatedContent && (
            <PreviewSection onReset={handleReset} onBack={handleBackToForm} autoSaveResults={saveResults} />
          )}
        </div>

        {/* Video Studio stays mounted so generation state persists on tab switch */}
        <div style={{ flex: 1, padding: '28px 28px 40px', overflowY: 'auto', display: activeTab === 'videogen' ? undefined : 'none' }}>
          <VideoGeneration onSendToPostGenerator={handleSendVideoToPostGenerator} onNeedCredits={() => setShowCreditsPopup(true)} />
        </div>

        {activeTab !== 'social' && activeTab !== 'videogen' && (
          <div style={{ flex: 1, padding: '28px 28px 40px', overflowY: 'auto' }}>
            {activeTab === 'dashboard' && <Dashboard onNavigate={(tab) => setActiveTab(tab as TabType)} />}
            {activeTab === 'creative' && <GenerateCreative />}
            {activeTab === 'ads' && <GoogleAdsGeneration />}
            {activeTab === 'analyst' && <AdAnalytics />}
            {activeTab === 'advisor' && <AIAdvisor />}
            {activeTab === 'media' && <PlaceholderPage title={t('mediaStudio')} description={t('mediaStudioDesc')} />}
            {activeTab === 'video' && <VideoTranslation />}
            {activeTab === 'library' && <Library onSendToPostGenerator={handleSendVideoToPostGenerator} />}
            {activeTab === 'calendar' && <Scheduled />}
            {activeTab === 'billing' && <Billing />}
            {activeTab === 'integrations' && <Connections />}
            {activeTab === 'brandkit' && <Settings />}
            {activeTab === 'settings' && <Settings />}
          </div>
        )}
      </div>

      <FloatingChat />

      {/* Out-of-credits popup */}
      {showCreditsPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowCreditsPopup(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 max-w-sm mx-4" onClick={e => e.stopPropagation()}>
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">⚡</span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{t('outOfCredits')}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                {t('outOfCreditsDesc')}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowCreditsPopup(false)}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
                >
                  {t('later')}
                </button>
                <button
                  onClick={() => { setShowCreditsPopup(false); setActiveTab('billing') }}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 text-white text-sm font-bold hover:from-violet-700 hover:to-blue-700 transition-all shadow-lg shadow-violet-200 dark:shadow-violet-900/30"
                >
                  {t('buyCredits')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


/* ── Placeholder page for upcoming sections ──────────────────── */
function PlaceholderPage({ title, description }: { title: string; description: string }) {
  const { t } = useApp()
  return (
    <div className="flex flex-col items-center justify-center text-center" style={{ minHeight: '50vh' }}>
      <Sparkles size={48} className="text-blue-500 mb-4" />
      <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">{title}</h2>
      <p className="text-gray-500 dark:text-gray-400 max-w-md">{description}</p>
      <span className="mt-4 px-4 py-1.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
        {t('comingSoonPlaceholder')}
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
  const { t } = useApp()
  const activeStep = progress < 35 ? 0 : progress < 75 ? 1 : 2

  const GENERATION_STEPS = [
    { label: t('analyzingBrief'), icon: FileSearch, description: t('scanningWebsite') },
    { label: t('renderingVisuals'), icon: Palette, description: t('generatingAiImages') },
    { label: t('finalizing'), icon: FileCheck, description: t('polishingContent') },
  ]

  const platformLabels: Record<string, string> = {
    facebook: t('platformFacebook'), instagram: t('platformInstagram'), linkedin: t('platformLinkedin'),
    tiktok: t('platformTiktok'), x: t('platformX'), google_business: t('platformGoogleBusiness'),
  }

  return (
    <div className="flex flex-col items-center justify-center" style={{ minHeight: '60vh' }}>
      <div className="mb-8">
        <Sparkles size={48} style={{ color: theme.accent, animation: 'spin 2s linear infinite' }} />
      </div>

      <h2 className="text-2xl font-bold mb-1" style={{ color: theme.text }}>
        {t('creatingYourPosts')}
      </h2>
      <p className="text-sm mb-10" style={{ color: theme.textSecondary }}>
        {t('aiCraftingContent')}
      </p>

      {/* 3-step progress */}
      <div className="w-full max-w-lg mb-10">
        {/* Steps row */}
        <div className="flex items-start justify-between relative">
          {/* Connector line */}
          <div className="absolute top-5 left-[calc(16.67%)] right-[calc(16.67%)] h-0.5" style={{ background: theme.border }}>
            <div className="h-full transition-all duration-700 rounded-full" style={{
              width: activeStep === 0 ? '0%' : activeStep === 1 ? '50%' : '100%',
              background: 'linear-gradient(90deg, #4A7CFF, #7C3AED)',
            }} />
          </div>

          {GENERATION_STEPS.map((step, i) => {
            const StepIcon = step.icon
            const isDone = i < activeStep
            const isActive = i === activeStep
            return (
              <div key={i} className="flex flex-col items-center relative z-10" style={{ width: '33.33%' }}>
                <div className="w-10 h-10 rounded-full flex items-center justify-center transition-all duration-500" style={{
                  background: isDone ? '#22C55E' : isActive ? 'linear-gradient(135deg, #4A7CFF, #7C3AED)' : theme.card,
                  border: isDone || isActive ? 'none' : `2px solid ${theme.border}`,
                  boxShadow: isActive ? '0 4px 20px rgba(74,124,255,0.35)' : undefined,
                }}>
                  {isDone ? (
                    <Check size={18} className="text-white" />
                  ) : isActive ? (
                    <Loader2 size={18} className="text-white animate-spin" />
                  ) : (
                    <StepIcon size={18} style={{ color: theme.textMuted }} />
                  )}
                </div>
                <span className="text-xs font-bold mt-2.5 text-center" style={{
                  color: isDone ? '#22C55E' : isActive ? theme.accent : theme.textMuted,
                }}>{step.label}</span>
                <span className="text-[10px] mt-0.5 text-center" style={{ color: theme.textMuted }}>
                  {step.description}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Main progress bar */}
      <div className="w-full max-w-md mb-8">
        <div className="h-2 rounded-full overflow-hidden" style={{ background: theme.border }}>
          <div className="h-full rounded-full transition-all duration-700" style={{
            width: `${progress}%`,
            background: 'linear-gradient(90deg, #4A7CFF, #7C3AED)',
          }} />
        </div>
        <p className="text-xs text-center mt-2" style={{ color: theme.textSecondary }}>{progress}%</p>
      </div>

      {/* Per-platform status */}
      <div className="space-y-2 w-full max-w-sm">
        {Object.entries(platformStatus).map(([platform, status]) => (
          <div key={platform} className="flex items-center gap-3 px-4 py-2 rounded-xl" style={{ background: theme.card }}>
            {status === 'done' ? (
              <Check size={16} className="text-green-500 shrink-0" />
            ) : (
              <Loader2 size={16} className="animate-spin shrink-0" style={{ color: theme.accent }} />
            )}
            <span className="text-sm font-medium" style={{ color: theme.text }}>
              {platformLabels[platform] || platform}
            </span>
            {status === 'done' && (
              <span className="ml-auto text-[11px] text-green-500 font-semibold">{t('ready')}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

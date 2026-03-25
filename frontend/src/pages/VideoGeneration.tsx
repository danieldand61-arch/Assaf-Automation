import { useState, useCallback, useEffect, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useApp } from '../contexts/AppContext'
import {
  Download, Send, Play, Loader2, Film, ImageIcon, Wand2,
  Volume2, VolumeX, Clock, Maximize, FolderDown, CheckCircle2,
  ChevronLeft, ChevronRight, Sparkles, User, Upload,
  Video, Clapperboard, MonitorPlay,
} from 'lucide-react'
import { getApiUrl } from '../lib/api'
import { SubtitlePicker, type SubtitleStyle, type SubtitleLang } from '../components/SubtitlePicker'

const API_URL = getApiUrl()

interface VideoTask {
  task_id: string
  status: string
  video_urls?: string[]
  consumed_credits?: number
  error_message?: string
  created_at?: string
  estimated_credits?: number
}

interface VideoGenerationProps {
  onSendToPostGenerator?: (videoUrl: string, videoPrompt: string) => void
  onNeedCredits?: () => void
}

type VideoStyle = 'ugc' | 'product' | 'cinematic'
type GenerationMode = 'text' | 'image'
type Quality = 'pro' | 'std'
type WizardStep = 1 | 1.5 | 2 | 3

const CREDITS_PER_SEC: Record<string, number> = {
  std_no_audio: 200,
  std_audio: 300,
  pro_no_audio: 270,
  pro_audio: 400,
}

const AVATARS = [
  { id: 'young-woman', name: 'Sofia', desc: 'young woman, mid-20s, friendly smile, casual look', img: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop&crop=face', style: 'friendly' },
  { id: 'young-man', name: 'Marcus', desc: 'young man, late-20s, confident look, modern style', img: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&crop=face', style: 'confident' },
  { id: 'pro-woman', name: 'Elena', desc: 'professional woman, early-30s, business attire, warm expression', img: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200&h=200&fit=crop&crop=face', style: 'professional' },
  { id: 'creative-man', name: 'Jordan', desc: 'creative man, mid-20s, casual streetwear, energetic vibe', img: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=200&h=200&fit=crop&crop=face', style: 'creative' },
  { id: 'mature-woman', name: 'Diana', desc: 'mature woman, 40s, elegant, authoritative yet approachable', img: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&h=200&fit=crop&crop=face', style: 'authoritative' },
  { id: 'chill-man', name: 'Liam', desc: 'relaxed man, early-30s, casual, genuine and trustworthy look', img: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop&crop=face', style: 'casual' },
]

const STYLE_CARDS: { id: VideoStyle; icon: typeof Film; gradient: string }[] = [
  { id: 'ugc', icon: User, gradient: 'from-pink-500 to-rose-600' },
  { id: 'product', icon: Clapperboard, gradient: 'from-violet-500 to-blue-600' },
  { id: 'cinematic', icon: MonitorPlay, gradient: 'from-amber-500 to-orange-600' },
]

const AR_PREVIEWS: { value: string; w: number; h: number }[] = [
  { value: '16:9', w: 64, h: 36 },
  { value: '9:16', w: 36, h: 64 },
  { value: '1:1', w: 48, h: 48 },
]

export default function VideoGeneration({ onSendToPostGenerator, onNeedCredits }: VideoGenerationProps) {
  const { session } = useAuth()
  const { t } = useApp()

  // Wizard state
  const [step, setStep] = useState<WizardStep>(1)
  const [videoStyle, setVideoStyle] = useState<VideoStyle>('product')
  const [selectedAvatar, setSelectedAvatar] = useState(AVATARS[0].id)
  const [customAvatarUrl, setCustomAvatarUrl] = useState('')

  // Generation state (kept from original)
  const [mode, setMode] = useState<GenerationMode>('text')
  const [prompt, setPrompt] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [aspectRatio, setAspectRatio] = useState('16:9')
  const [duration, setDuration] = useState(5)
  const [sound, setSound] = useState(false)
  const [quality, setQuality] = useState<Quality>('pro')
  const [magicPromptLoading, setMagicPromptLoading] = useState(false)

  const [isGenerating, setIsGenerating] = useState(false)
  const [currentTask, setCurrentTask] = useState<VideoTask | null>(null)
  const [error, setError] = useState('')
  const [savedToLibrary, setSavedToLibrary] = useState(false)
  const [fakeProgress, setFakeProgress] = useState(0)
  const progressInterval = useRef<ReturnType<typeof setInterval> | null>(null)
  const [isAddingSubtitles, setIsAddingSubtitles] = useState(false)
  const [subtitledVideoUrl, setSubtitledVideoUrl] = useState<string | null>(null)
  const [subtitleLang, setSubtitleLang] = useState<SubtitleLang>('en')
  const [subtitleStyle, setSubtitleStyle] = useState<SubtitleStyle>('classic')

  const estimatedCredits = CREDITS_PER_SEC[`${quality}_${sound ? 'audio' : 'no_audio'}`] * duration

  // ─── helpers ───────────────────────────────────────────────

  const nextStep = () => {
    if (step === 1 && videoStyle === 'ugc') setStep(1.5)
    else if (step === 1) setStep(2)
    else if (step === 1.5) setStep(2)
    else if (step === 2) setStep(3)
  }

  const prevStep = () => {
    if (step === 3) setStep(2)
    else if (step === 2 && videoStyle === 'ugc') setStep(1.5)
    else if (step === 2) setStep(1)
    else if (step === 1.5) setStep(1)
  }

  const totalSteps = videoStyle === 'ugc' ? 4 : 3
  const progressPct = step === 1 ? 25 : step === 1.5 ? 37 : step === 2 ? (videoStyle === 'ugc' ? 62 : 66) : 100

  // ─── Magic Prompt ──────────────────────────────────────────

  const handleMagicPrompt = async () => {
    if (!prompt.trim() || magicPromptLoading) return
    setMagicPromptLoading(true)
    try {
      const styleCtx = videoStyle === 'ugc'
        ? 'UGC style — person talking to camera, authentic feel'
        : videoStyle === 'product'
        ? 'Product showcase — cinematic product-focused visuals'
        : 'Cinematic mood — atmospheric, emotional, text overlays'
      const res = await fetch(`${API_URL}/api/content/edit-text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({
          original_text: prompt,
          instruction: `Enhance this video prompt for AI video generation. Style: ${styleCtx}. Make it vivid, cinematic, with clear visual directions. Keep it under 500 chars. Return ONLY the enhanced prompt, nothing else.`,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.edited_text) setPrompt(data.edited_text)
      }
    } catch { /* ignore */ }
    setMagicPromptLoading(false)
  }

  // ─── Generation logic (unchanged) ─────────────────────────

  const startFakeProgress = useCallback((videoDuration: number, videoQuality: string) => {
    setFakeProgress(0)
    if (progressInterval.current) clearInterval(progressInterval.current)
    const estimatedMs = (videoQuality === 'pro' ? 120_000 : 60_000) + videoDuration * 5_000
    const tickMs = 2500
    const totalTicks = estimatedMs / tickMs
    let tick = 0
    progressInterval.current = setInterval(() => {
      tick++
      const raw = (tick / totalTicks) * 100
      const progress = Math.min(92, raw < 60 ? raw * 1.1 : 60 + (raw - 60) * 0.4)
      setFakeProgress(Math.round(progress))
      if (progress >= 92 && progressInterval.current) clearInterval(progressInterval.current)
    }, tickMs)
  }, [])

  useEffect(() => {
    if (currentTask?.status === 'SUCCESS' || currentTask?.status === 'FAILED') {
      if (progressInterval.current) clearInterval(progressInterval.current)
      setFakeProgress(currentTask.status === 'SUCCESS' ? 100 : 0)
    }
  }, [currentTask?.status])

  useEffect(() => () => { if (progressInterval.current) clearInterval(progressInterval.current) }, [])

  const pollStatus = useCallback(async (taskId: string) => {
    const poll = async () => {
      try {
        const response = await fetch(`${API_URL}/api/video-gen/status/${taskId}`, {
          headers: { Authorization: `Bearer ${session?.access_token}` },
        })
        if (!response.ok) throw new Error(t('failedToGetStatus'))
        const data = await response.json()
        setCurrentTask(prev => ({ ...prev!, ...data }))
        if (data.status === 'IN_PROGRESS') setTimeout(poll, 5000)
        else setIsGenerating(false)
      } catch (err: any) {
        setError(`Status check failed: ${err.message}`)
        setIsGenerating(false)
      }
    }
    poll()
  }, [session, t])

  const buildFinalPrompt = () => {
    let p = prompt.trim()
    if (videoStyle === 'ugc') {
      const avatar = AVATARS.find(a => a.id === selectedAvatar)
      const personDesc = avatar ? avatar.desc : (customAvatarUrl ? customAvatarUrl : 'a young, friendly person')
      p = `UGC-style video: ${personDesc} speaking directly to camera in a natural, authentic way. They are talking about: ${p}. The person should look directly at the camera, use natural hand gestures, and feel like a real social media review or testimonial. Natural lighting, casual setting.`
    } else if (videoStyle === 'product') {
      p = `Cinematic product showcase video: ${p}. Professional product photography in motion, smooth camera movements, studio-quality lighting, clean background. Focus on the product details, textures, and premium feel.`
    } else if (videoStyle === 'cinematic') {
      p = `Cinematic atmospheric mood video: ${p}. Dramatic lighting, slow motion elements, rich color grading, emotional storytelling. Suitable for text overlays and brand storytelling.`
    }
    return p
  }

  const handleGenerate = async () => {
    if (!prompt.trim()) { setError(t('pleaseEnterPrompt')); return }
    if (mode === 'image' && !imageUrl.trim()) { setError(t('pleaseEnterImageUrl')); return }

    setIsGenerating(true)
    setError('')
    setCurrentTask(null)
    setSavedToLibrary(false)
    setSubtitledVideoUrl(null)

    const finalPrompt = buildFinalPrompt()
    const endpoint = mode === 'text' ? 'text-to-video' : 'image-to-video'
    const body: any = { prompt: finalPrompt, duration, sound, quality, aspect_ratio: aspectRatio }
    if (mode === 'image') body.image_url = imageUrl

    try {
      const response = await fetch(`${API_URL}/api/video-gen/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify(body),
      })
      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.detail || t('failedToGenerateVideo'))
      }
      const data = await response.json()
      setCurrentTask({ task_id: data.task_id, status: 'IN_PROGRESS', estimated_credits: data.estimated_credits })
      startFakeProgress(duration, quality)
      pollStatus(data.task_id)
    } catch (err: any) {
      const msg = err.message || ''
      if ((msg.includes('credit') || msg.includes('402') || msg.includes('balance')) && onNeedCredits) onNeedCredits()
      else setError(msg)
      setIsGenerating(false)
    }
  }

  const handleSaveToLibrary = async () => {
    if (!currentTask?.video_urls?.[0] || !session) return
    try {
      const res = await fetch(`${API_URL}/api/saved-posts/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          text: prompt, image_url: subtitledVideoUrl || currentTask.video_urls[0],
          title: `AI Video — ${prompt.slice(0, 60)}`, platforms: [], hashtags: [],
        }),
      })
      if (res.ok) setSavedToLibrary(true)
      else setError(t('failedToSaveToLibrary'))
    } catch { setError(t('failedToSaveToLibrary')) }
  }

  const handleAddSubtitles = async () => {
    if (!currentTask?.video_urls?.[0] || !session) return
    setIsAddingSubtitles(true)
    try {
      const res = await fetch(`${API_URL}/api/video-gen/add-subtitles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ video_url: currentTask.video_urls[0], language: subtitleLang, style: subtitleStyle }),
      })
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.detail || t('failedToAddSubtitles')) }
      const data = await res.json()
      setSubtitledVideoUrl(data.video_url)
    } catch (e: any) { setError(e.message || t('failedToAddSubtitles')) }
    finally { setIsAddingSubtitles(false) }
  }

  const handleDownload = async (url: string) => {
    try {
      const res = await fetch(url)
      const blob = await res.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `video-${Date.now()}.mp4`
      a.click()
      URL.revokeObjectURL(a.href)
    } catch { window.open(url, '_blank') }
  }

  const handleNewVideo = () => {
    setCurrentTask(null)
    setFakeProgress(0)
    setError('')
    setSavedToLibrary(false)
    setSubtitledVideoUrl(null)
    setStep(1)
  }

  const videoReady = currentTask?.status === 'SUCCESS' && currentTask.video_urls?.length

  // ─── If generating or result, show that instead of wizard ──

  if (isGenerating || currentTask) {
    return (
      <div className="max-w-3xl mx-auto">
        <Header t={t} />

        {error && (
          <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 flex items-center justify-between">
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            <button onClick={() => setError('')} className="text-red-400 hover:text-red-600 text-lg ml-3">&times;</button>
          </div>
        )}

        {currentTask?.status === 'IN_PROGRESS' && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-8 flex flex-col items-center justify-center" style={{ minHeight: 400 }}>
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center mb-6">
              <Loader2 size={28} className="text-white animate-spin" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">{t('generatingYourVideo')}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 text-center max-w-sm">
              {fakeProgress < 20 ? t('videoStageInit') : fakeProgress < 50 ? t('videoStageFrames') : fakeProgress < 80 ? t('videoStageRender') : t('videoStageFinalize')}
            </p>
            <div className="w-full max-w-xs mb-2">
              <div className="h-2.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-blue-600 transition-all duration-[2500ms] ease-out" style={{ width: `${fakeProgress}%` }} />
              </div>
            </div>
            <p className="text-sm font-semibold text-violet-600 dark:text-violet-400">{fakeProgress}%</p>
            <p className="text-[11px] text-gray-400 mt-2">{t('task')}{currentTask.task_id}</p>
          </div>
        )}

        {currentTask?.status === 'FAILED' && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-red-200 dark:border-red-800 p-8 flex flex-col items-center justify-center" style={{ minHeight: 300 }}>
            <div className="w-14 h-14 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4">
              <span className="text-2xl">⚠️</span>
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">{t('videoFailed')}</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 text-center max-w-md mb-4">{currentTask.error_message || t('unknownError')}</p>
            <button onClick={handleNewVideo} className="px-5 py-2 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-violet-600 to-blue-600">{t('tryAgain')}</button>
          </div>
        )}

        {videoReady && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700">
            <div className="bg-black rounded-t-2xl">
              <video key={subtitledVideoUrl || currentTask.video_urls![0]} src={subtitledVideoUrl || currentTask.video_urls![0]} controls autoPlay className="w-full" style={{ maxHeight: 500 }} />
            </div>
            <div className="p-5 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">{t('creditsUsed')}<strong className="text-gray-900 dark:text-white">{currentTask.consumed_credits || currentTask.estimated_credits}</strong></span>
                {currentTask.created_at && <span className="text-gray-400">{new Date(currentTask.created_at).toLocaleString()}</span>}
              </div>
              <div className="flex gap-3 flex-wrap">
                <button onClick={() => handleDownload(subtitledVideoUrl || currentTask.video_urls![0])} className="flex-1 min-w-[140px] flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-semibold text-sm transition-all">
                  <Download size={16} /> {t('downloadMp4')}
                </button>
                <button onClick={handleSaveToLibrary} disabled={savedToLibrary} className={`flex-1 min-w-[140px] flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold text-sm transition-all ${savedToLibrary ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-800' : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200'}`}>
                  {savedToLibrary ? <><CheckCircle2 size={16} /> {t('saved')}</> : <><FolderDown size={16} /> {t('saveToLibrary')}</>}
                </button>
                {onSendToPostGenerator && (
                  <button onClick={() => onSendToPostGenerator(subtitledVideoUrl || currentTask.video_urls![0], prompt)} className="flex-1 min-w-[140px] flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white font-semibold text-sm transition-all shadow-lg shadow-violet-200 dark:shadow-violet-900/30">
                    <Send size={16} /> {t('sendToPostGenerator')}
                  </button>
                )}
              </div>
              <SubtitlePicker lang={subtitleLang} style={subtitleStyle} isProcessing={isAddingSubtitles} hasSubtitles={!!subtitledVideoUrl} onLangChange={setSubtitleLang} onStyleChange={setSubtitleStyle} onGenerate={handleAddSubtitles} onRevert={() => setSubtitledVideoUrl(null)} />
              <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-2 text-center">{t('videoStorageNote')}</p>
              <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
                <button onClick={handleNewVideo} className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-violet-600 dark:text-violet-400 hover:text-violet-700 transition">
                  <Video size={16} /> {t('createNewVideo')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ─── WIZARD UI ─────────────────────────────────────────────

  return (
    <div className="max-w-3xl mx-auto">
      <Header t={t} />

      {/* Progress bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
            {step === 1 && t('wizStep1Title')}
            {step === 1.5 && t('wizStep15Title')}
            {step === 2 && t('wizStep2Title')}
            {step === 3 && t('wizStep3Title')}
          </span>
          <span className="text-xs text-gray-400">
            {step === 1 ? '1' : step === 1.5 ? '2' : step === 2 ? (videoStyle === 'ugc' ? '3' : '2') : (videoStyle === 'ugc' ? '4' : '3')}/{totalSteps}
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-blue-600 transition-all duration-500" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 flex items-center justify-between">
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-600 text-lg ml-3">&times;</button>
        </div>
      )}

      {/* ═══ STEP 1: Choose Style ═══ */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {STYLE_CARDS.map(card => {
              const Icon = card.icon
              const labels: Record<VideoStyle, { title: string; desc: string }> = {
                ugc: { title: t('styleUgcTitle'), desc: t('styleUgcDesc') },
                product: { title: t('styleProductTitle'), desc: t('styleProductDesc') },
                cinematic: { title: t('styleCinematicTitle'), desc: t('styleCinematicDesc') },
              }
              const selected = videoStyle === card.id
              return (
                <button
                  key={card.id}
                  onClick={() => setVideoStyle(card.id)}
                  className={`relative group rounded-2xl border-2 p-6 text-left transition-all ${
                    selected
                      ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/20 shadow-lg shadow-violet-100 dark:shadow-violet-900/20'
                      : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  {selected && (
                    <div className="absolute top-3 right-3">
                      <CheckCircle2 size={20} className="text-violet-500" />
                    </div>
                  )}
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${card.gradient} flex items-center justify-center mb-4`}>
                    <Icon size={22} className="text-white" />
                  </div>
                  <h3 className="font-bold text-gray-900 dark:text-white mb-1">{labels[card.id].title}</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{labels[card.id].desc}</p>
                </button>
              )
            })}
          </div>
          <div className="flex justify-end pt-2">
            <button onClick={nextStep} className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 text-white font-semibold text-sm shadow-lg shadow-violet-200 dark:shadow-violet-900/30 hover:from-violet-700 hover:to-blue-700 transition-all">
              {t('next')} <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ═══ STEP 1.5: Choose Avatar (UGC only) ═══ */}
      {step === 1.5 && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {AVATARS.map(avatar => {
              const selected = selectedAvatar === avatar.id
              return (
                <button
                  key={avatar.id}
                  onClick={() => { setSelectedAvatar(avatar.id); setCustomAvatarUrl('') }}
                  className={`relative rounded-2xl border-2 p-4 text-center transition-all ${
                    selected
                      ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/20 shadow-lg shadow-violet-100 dark:shadow-violet-900/20'
                      : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300'
                  }`}
                >
                  {selected && <CheckCircle2 size={16} className="absolute top-2 right-2 text-violet-500" />}
                  <img
                    src={avatar.img}
                    alt={avatar.name}
                    className="w-16 h-16 rounded-full object-cover mx-auto mb-2 ring-2 ring-white dark:ring-gray-700 shadow"
                  />
                  <p className="text-sm font-bold text-gray-900 dark:text-white">{avatar.name}</p>
                  <p className="text-[10px] text-gray-400 capitalize">{avatar.style}</p>
                </button>
              )
            })}
          </div>

          {/* Custom avatar description */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-dashed border-gray-300 dark:border-gray-600 p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                <Upload size={18} className="text-gray-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-gray-700 dark:text-gray-300">{t('customAvatarDesc')}</p>
                <input
                  type="text"
                  value={customAvatarUrl}
                  onChange={(e) => { setCustomAvatarUrl(e.target.value); setSelectedAvatar('') }}
                  placeholder={t('customAvatarPlaceholder')}
                  className="w-full mt-1.5 px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700/50 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none transition"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-between pt-2">
            <button onClick={prevStep} className="flex items-center gap-2 px-5 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 font-medium text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition">
              <ChevronLeft size={16} /> {t('back')}
            </button>
            <button onClick={nextStep} className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 text-white font-semibold text-sm shadow-lg shadow-violet-200 dark:shadow-violet-900/30 hover:from-violet-700 hover:to-blue-700 transition-all">
              {t('next')} <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ═══ STEP 2: Script & Format ═══ */}
      {step === 2 && (
        <div className="space-y-4">
          {/* Mode Toggle */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-1.5 flex">
            <button onClick={() => setMode('text')} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${mode === 'text' ? 'bg-gradient-to-r from-violet-500 to-blue-600 text-white shadow-lg shadow-violet-200 dark:shadow-violet-900/30' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
              <Wand2 size={16} /> {t('textToVideo')}
            </button>
            <button onClick={() => setMode('image')} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${mode === 'image' ? 'bg-gradient-to-r from-violet-500 to-blue-600 text-white shadow-lg shadow-violet-200 dark:shadow-violet-900/30' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
              <ImageIcon size={16} /> {t('imageToVideo')}
            </button>
          </div>

          {/* Prompt */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 space-y-3">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">{t('prompt')}</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              maxLength={2000}
              rows={4}
              placeholder={mode === 'text' ? t('promptPlaceholderText') : t('promptPlaceholderImage')}
              className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700/50 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none resize-none transition"
            />
            <div className="flex items-center justify-between">
              <button
                onClick={handleMagicPrompt}
                disabled={!prompt.trim() || magicPromptLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/20 hover:bg-violet-100 dark:hover:bg-violet-900/30 transition disabled:opacity-40"
              >
                {magicPromptLoading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                {t('magicPrompt')}
              </button>
              <span className="text-[11px] text-gray-400">{prompt.length}/2000</span>
            </div>

            {mode === 'image' && (
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">{t('imageUrl')}</label>
                <input type="url" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder={t('imageUrlPlaceholder')} className="w-full mt-2 px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700/50 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none transition" />
              </div>
            )}
          </div>

          {/* Aspect Ratio with visual previews */}
          {mode === 'text' && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
              <span className="flex items-center gap-1.5 text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                <Maximize size={14} /> {t('aspectRatio')}
              </span>
              <div className="flex gap-3">
                {AR_PREVIEWS.map(ar => (
                  <button
                    key={ar.value}
                    onClick={() => setAspectRatio(ar.value)}
                    className={`flex-1 flex flex-col items-center gap-2 py-4 rounded-xl border-2 transition-all ${
                      aspectRatio === ar.value
                        ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-center" style={{ width: 64, height: 64 }}>
                      <div
                        className={`rounded-md ${aspectRatio === ar.value ? 'bg-violet-400' : 'bg-gray-300 dark:bg-gray-600'}`}
                        style={{ width: ar.w, height: ar.h }}
                      />
                    </div>
                    <span className={`text-xs font-bold ${aspectRatio === ar.value ? 'text-violet-600 dark:text-violet-400' : 'text-gray-500'}`}>{ar.value}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-between pt-2">
            <button onClick={prevStep} className="flex items-center gap-2 px-5 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 font-medium text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition">
              <ChevronLeft size={16} /> {t('back')}
            </button>
            <button onClick={nextStep} disabled={!prompt.trim()} className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 text-white font-semibold text-sm shadow-lg shadow-violet-200 dark:shadow-violet-900/30 hover:from-violet-700 hover:to-blue-700 transition-all disabled:opacity-40">
              {t('next')} <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ═══ STEP 3: Settings & Generate ═══ */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 space-y-5">
            {/* Quality */}
            <div>
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{t('quality')}</span>
              <div className="flex gap-3 mt-2">
                {(['pro', 'std'] as const).map(q => (
                  <button
                    key={q}
                    onClick={() => setQuality(q)}
                    className={`flex-1 py-3 rounded-xl text-sm font-semibold border-2 transition-all ${
                      quality === q
                        ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300'
                        : 'border-gray-200 dark:border-gray-600 text-gray-500 hover:border-gray-300'
                    }`}
                  >
                    {q === 'pro' ? `⚡ ${t('proQuality')}` : `📦 ${t('standard')}`}
                  </button>
                ))}
              </div>
            </div>

            {/* Duration Slider */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="flex items-center gap-1.5 text-xs font-bold text-gray-400 uppercase tracking-wider">
                  <Clock size={14} /> {t('duration')}
                </span>
                <span className="text-lg font-bold text-gray-900 dark:text-white">{duration}s</span>
              </div>
              <input type="range" min={3} max={15} value={duration} onChange={(e) => setDuration(Number(e.target.value))} className="w-full accent-violet-500" />
              <div className="flex justify-between text-[10px] text-gray-400 mt-1"><span>3s</span><span>15s</span></div>
            </div>

            {/* Sound Toggle */}
            <button
              onClick={() => setSound(!sound)}
              className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl border-2 transition-all ${
                sound ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/20' : 'border-gray-200 dark:border-gray-600'
              }`}
            >
              <span className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                {sound ? <Volume2 size={16} className="text-violet-500" /> : <VolumeX size={16} />}
                {t('audioGeneration')}
              </span>
              <div className={`w-10 h-5 rounded-full transition-all relative ${sound ? 'bg-violet-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${sound ? 'left-5' : 'left-0.5'}`} />
              </div>
            </button>
          </div>

          {/* Summary & Cost */}
          <div className="bg-gradient-to-r from-violet-50 to-blue-50 dark:from-violet-900/20 dark:to-blue-900/20 rounded-2xl border border-violet-200 dark:border-violet-800 p-5">
            {/* Summary badges */}
            <div className="flex flex-wrap gap-2 mb-4">
              <span className="px-2.5 py-1 rounded-lg bg-white/70 dark:bg-gray-800/50 text-xs font-medium text-gray-600 dark:text-gray-300">
                {videoStyle === 'ugc' ? '🎤 UGC' : videoStyle === 'product' ? '📦 Product' : '🎬 Cinematic'}
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-white/70 dark:bg-gray-800/50 text-xs font-medium text-gray-600 dark:text-gray-300">
                {quality === 'pro' ? '⚡ Pro' : '📦 Standard'}
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-white/70 dark:bg-gray-800/50 text-xs font-medium text-gray-600 dark:text-gray-300">
                ⏱ {duration}s
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-white/70 dark:bg-gray-800/50 text-xs font-medium text-gray-600 dark:text-gray-300">
                {aspectRatio}
              </span>
              {sound && (
                <span className="px-2.5 py-1 rounded-lg bg-white/70 dark:bg-gray-800/50 text-xs font-medium text-gray-600 dark:text-gray-300">
                  🔊 Audio
                </span>
              )}
            </div>

            <div className="flex justify-between items-center mb-4">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-300">{t('estimatedCost')}</span>
              <span className="text-2xl font-bold text-violet-600 dark:text-violet-400">{estimatedCredits} {t('creditsUnit')}</span>
            </div>

            <button
              onClick={handleGenerate}
              disabled={isGenerating || !prompt.trim()}
              className="w-full bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white px-6 py-4 rounded-xl font-bold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-violet-200 dark:shadow-violet-900/30"
            >
              <Play size={18} /> {t('generateVideo')}
            </button>
          </div>

          <div className="flex justify-start pt-1">
            <button onClick={prevStep} className="flex items-center gap-2 px-5 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 font-medium text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition">
              <ChevronLeft size={16} /> {t('back')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Header({ t }: { t: (k: any) => string }) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center">
          <Film className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('videoStudio')}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('videoStudioDesc')}</p>
        </div>
      </div>
    </div>
  )
}

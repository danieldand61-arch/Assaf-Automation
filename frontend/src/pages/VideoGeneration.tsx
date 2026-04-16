import { useState, useCallback, useEffect, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useApp } from '../contexts/AppContext'
import { useAccount } from '../contexts/AccountContext'
import {
  Download, Send, Play, Loader2, Film, ImageIcon, Wand2, PenLine,
  Volume2, VolumeX, Clock, Maximize, FolderDown, CheckCircle2,
  ChevronLeft, ChevronRight, Sparkles, User, Upload,
  Video, Clapperboard, MonitorPlay, Building2,
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
  {
    id: 'young-woman', name: 'Sofia', desc: 'young woman, mid-20s, friendly smile, casual look', style: 'friendly',
    imgs: [
      'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop&crop=face',
      'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=400&h=400&fit=crop&crop=face',
    ],
  },
  {
    id: 'young-man', name: 'Marcus', desc: 'young man, late-20s, confident look, modern style', style: 'confident',
    imgs: [
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&crop=face',
      'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&h=400&fit=crop&crop=face',
    ],
  },
  {
    id: 'pro-woman', name: 'Elena', desc: 'professional woman, early-30s, business attire, warm expression', style: 'professional',
    imgs: [
      'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&h=400&fit=crop&crop=face',
      'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&h=400&fit=crop&crop=face',
    ],
  },
  {
    id: 'mature-man', name: 'David', desc: 'mature man, mid-40s, distinguished, warm fatherly look, salt-and-pepper hair', style: 'trustworthy',
    imgs: [
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop&crop=face',
      'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=400&fit=crop&crop=face',
    ],
  },
  {
    id: 'golden-retriever', name: 'Buddy', desc: 'friendly golden retriever dog, close-up portrait, happy expression, tongue out', style: 'animal',
    imgs: [
      'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=400&h=400&fit=crop&crop=face',
      'https://images.unsplash.com/photo-1601758228041-f3b2795255f1?w=400&h=400&fit=crop&crop=face',
    ],
  },
  {
    id: 'teen-girl', name: 'Mia', desc: 'young teenage girl, around 16, bright smile, casual trendy clothes, expressive', style: 'youthful',
    imgs: [
      'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&h=400&fit=crop&crop=face',
      'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=400&h=400&fit=crop&crop=face',
    ],
  },
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
  const { t, language } = useApp()
  const { activeAccount } = useAccount()

  const bk = activeAccount?.metadata?.brand_kit || {} as Record<string, any>
  const brandName = bk.business_name || activeAccount?.name || ''
  const brandDesc = activeAccount?.description || ''
  const brandIndustry = activeAccount?.industry || ''
  const brandAudience = activeAccount?.target_audience || ''
  const hasBrandInfo = !!(brandName || brandDesc)

  // Wizard state
  const [step, setStep] = useState<WizardStep>(1)
  const [videoStyle, setVideoStyle] = useState<VideoStyle>('product')
  const [selectedAvatar, setSelectedAvatar] = useState('random')
  const [customAvatarUrls, setCustomAvatarUrls] = useState<string[]>([])
  const [customAvatarPreviews, setCustomAvatarPreviews] = useState<string[]>([])
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [preparingElements, setPreparingElements] = useState(false)
  const [useBrand, setUseBrand] = useState(true)
  const [showBrandText, setShowBrandText] = useState(false)
  const avatarFileRef = useRef<HTMLInputElement>(null)

  // Generation state (kept from original)
  const [mode, setMode] = useState<GenerationMode>('text')
  const [prompt, setPrompt] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [imagePreview, setImagePreview] = useState('')
  const [uploadingImage, setUploadingImage] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const imageFileRef = useRef<HTMLInputElement>(null)
  const [aspectRatio, setAspectRatio] = useState('16:9')
  const [duration, setDuration] = useState(5)
  const [sound, setSound] = useState(false)
  const [quality, setQuality] = useState<Quality>('pro')
  const [magicPromptLoading, setMagicPromptLoading] = useState(false)
  const [improvePromptLoading, setImprovePromptLoading] = useState(false)

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

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !session) return
    if (!file.type.startsWith('image/')) { setError(t('uploadImageAlert')); return }
    if (file.size > 10 * 1024 * 1024) { setError(t('imageSizeAlert')); return }

    setUploadingAvatar(true)
    setError('')
    setSelectedAvatar('')
    setCustomAvatarPreviews([URL.createObjectURL(file)])

    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch(`${API_URL}/api/video-gen/upload-avatar`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: formData,
      })
      if (!res.ok) throw new Error('Upload failed')
      const data = await res.json()
      setCustomAvatarUrls([data.url])
    } catch {
      setError('Upload failed')
      setCustomAvatarPreviews([])
    }
    setUploadingAvatar(false)
  }

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
    if (magicPromptLoading || improvePromptLoading) return
    setMagicPromptLoading(true)
    try {
      const useBk = useBrand && hasBrandInfo
      const res = await fetch(`${API_URL}/api/content/magic-prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) },
        body: JSON.stringify({
          user_prompt: prompt.trim() || 'promotional video for the brand',
          goal: 'product',
          strategy: 'professional',
          brand_name: useBk ? brandName : '',
          industry: useBk ? (bk.industry || brandIndustry) : '',
          brand_colors: useBk ? (bk.brand_colors || []) : [],
          language,
          output_kind: 'video',
          video_style: videoStyle,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.enhanced_prompt) setPrompt(data.enhanced_prompt)
      }
    } catch { /* ignore */ }
    setMagicPromptLoading(false)
  }

  const handleImprovePrompt = async () => {
    if (!prompt.trim() || improvePromptLoading || magicPromptLoading) return
    setImprovePromptLoading(true)
    try {
      const useBk = useBrand && hasBrandInfo
      const res = await fetch(`${API_URL}/api/content/improve-prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) },
        body: JSON.stringify({
          user_prompt: prompt,
          language,
          output_kind: 'video',
          video_style: videoStyle,
          brand_name: useBk ? brandName : '',
          industry: useBk ? (bk.industry || brandIndustry) : '',
          brand_voice: useBk ? (bk.brand_voice || '') : '',
          target_audience: useBk ? brandAudience : '',
          products: useBk && Array.isArray(bk.products) ? bk.products : [],
          key_features: useBk && Array.isArray(bk.key_features) ? bk.key_features : [],
          description: useBk ? (bk.description || brandDesc || '') : '',
          brand_colors: useBk ? (bk.brand_colors || []) : [],
        }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.enhanced_prompt) setPrompt(data.enhanced_prompt)
      }
    } catch { /* ignore */ }
    setImprovePromptLoading(false)
  }

  // ─── Image upload for image-to-video ──────────────────────

  const handleImageUpload = async (file: File) => {
    if (!session) return
    if (!file.type.startsWith('image/')) { setError(t('uploadImageAlert')); return }
    if (file.size > 10 * 1024 * 1024) { setError(t('imageSizeAlert')); return }

    setUploadingImage(true)
    setError('')
    setImagePreview(URL.createObjectURL(file))

    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch(`${API_URL}/api/video-gen/upload-image`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: formData,
      })
      if (!res.ok) throw new Error('Upload failed')
      const data = await res.json()
      setImageUrl(data.url)
    } catch {
      setError(t('uploadFailed'))
      setImagePreview('')
      setImageUrl('')
    }
    setUploadingImage(false)
  }

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleImageUpload(file)
  }

  const handleImageDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleImageUpload(file)
  }

  const clearUploadedImage = () => {
    setImagePreview('')
    setImageUrl('')
    if (imageFileRef.current) imageFileRef.current.value = ''
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

  const getAvatarImageUrls = (): string[] => {
    if (selectedAvatar === 'random') return []
    if (selectedAvatar) {
      const avatar = AVATARS.find(a => a.id === selectedAvatar)
      return avatar?.imgs ?? []
    }
    if (customAvatarUrls.length === 1) return [customAvatarUrls[0], customAvatarUrls[0]]
    return customAvatarUrls
  }

  const buildFinalPrompt = (useElement: boolean) => {
    let p = prompt.trim()
    const noText = 'IMPORTANT: Do not render any text, titles, captions, watermarks, labels, logos, letters or words anywhere in the video. The video must be completely free of any written text or typography.'
    const yesText = brandName
      ? `IMPORTANT: Any text shown in the video must spell the brand name exactly as "${brandName}" — letter by letter, no variations, no misspellings. Render "${brandName}" clearly and legibly whenever text appears on screen.`
      : ''
    const textRule = showBrandText && brandName ? yesText : noText

    const brandCtx = useBrand && hasBrandInfo
      ? `Brand: ${brandName}${brandDesc ? `. ${brandDesc}` : ''}${brandIndustry ? `. Industry: ${brandIndustry}` : ''}${brandAudience ? `. Target audience: ${brandAudience}` : ''}.`
      : ''

    if (videoStyle === 'ugc') {
      const avatar = AVATARS.find(a => a.id === selectedAvatar)
      const isRandom = selectedAvatar === 'random'
      const personDesc = isRandom ? 'a relatable, friendly person' : (avatar?.desc ?? 'a young, friendly person')
      const person = useElement ? '@avatar' : personDesc
      p = `UGC-style promotional video: ${person} holding and showcasing the product to camera. ${brandCtx} Scene: ${p}. The person holds the product up, shows it from different angles, points at key features, smiles genuinely. Close-up shots of the product intercut with the person demonstrating it. The product must be clearly visible in frame throughout the video. Natural lighting, casual lifestyle setting, authentic social media ad feel. ${textRule}`
    } else if (videoStyle === 'product') {
      p = `Cinematic product showcase video: ${brandCtx} ${p}. Professional product photography in motion, smooth camera movements, studio-quality lighting, clean background. Focus on the product details, textures, and premium feel. ${textRule}`
    } else if (videoStyle === 'cinematic') {
      p = `Cinematic atmospheric mood video: ${brandCtx} ${p}. Dramatic lighting, slow motion elements, rich color grading, emotional storytelling. Visual-only storytelling without any on-screen text. ${textRule}`
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

    try {
      const avatarImgs = videoStyle === 'ugc' ? getAvatarImageUrls() : []
      const hasElements = avatarImgs.length >= 2
      let klingElements: { name: string; description: string; element_input_urls: string[] }[] | undefined

      if (hasElements) {
        setPreparingElements(true)
        const prepRes = await fetch(`${API_URL}/api/video-gen/prepare-elements`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
          body: JSON.stringify({ image_urls: avatarImgs.slice(0, 4) }),
        })
        setPreparingElements(false)
        if (!prepRes.ok) {
          const err = await prepRes.json().catch(() => ({}))
          throw new Error(err.detail || 'Failed to prepare avatar elements')
        }
        const prepData = await prepRes.json()
        const avatar = AVATARS.find(a => a.id === selectedAvatar)
        klingElements = [{
          name: 'avatar',
          description: avatar?.desc ?? 'person',
          element_input_urls: prepData.kie_urls,
        }]
      }

      const finalPrompt = buildFinalPrompt(hasElements)
      const endpoint = mode === 'image' ? 'image-to-video' : 'text-to-video'
      const body: any = { prompt: finalPrompt, duration, sound, quality, aspect_ratio: aspectRatio }
      if (mode === 'image') body.image_url = imageUrl
      if (klingElements) body.kling_elements = klingElements

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
      setPreparingElements(false)
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
    setPreparingElements(false)
    setImagePreview('')
    setImageUrl('')
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
            <button onClick={() => setError('')} className="text-red-400 hover:text-red-600 text-lg ms-3">&times;</button>
          </div>
        )}

        {currentTask?.status === 'IN_PROGRESS' && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-8 flex flex-col items-center justify-center" style={{ minHeight: 400 }}>
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center mb-6">
              <Loader2 size={28} className="text-white animate-spin" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">{t('generatingYourVideo')}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 text-center max-w-sm">
              {preparingElements ? t('preparingAvatar') : fakeProgress < 20 ? t('videoStageInit') : fakeProgress < 50 ? t('videoStageFrames') : fakeProgress < 80 ? t('videoStageRender') : t('videoStageFinalize')}
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
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-600 text-lg ms-3">&times;</button>
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
                  className={`relative group rounded-2xl border-2 p-6 text-start transition-all ${
                    selected
                      ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/20 shadow-lg shadow-violet-100 dark:shadow-violet-900/20'
                      : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  {selected && (
                    <div className="absolute top-3 end-3">
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
            {/* Random / no avatar option */}
            <button
              onClick={() => { setSelectedAvatar('random'); setCustomAvatarUrls([]); setCustomAvatarPreviews([]); if (avatarFileRef.current) avatarFileRef.current.value = '' }}
              className={`relative rounded-2xl border-2 p-4 text-center transition-all ${
                selectedAvatar === 'random'
                  ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/20 shadow-lg shadow-violet-100 dark:shadow-violet-900/20'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300'
              }`}
            >
              {selectedAvatar === 'random' && <CheckCircle2 size={16} className="absolute top-2 end-2 text-violet-500" />}
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-violet-400 to-blue-500 flex items-center justify-center mx-auto mb-2 ring-2 ring-white dark:ring-gray-700 shadow">
                <Sparkles size={24} className="text-white" />
              </div>
              <p className="text-sm font-bold text-gray-900 dark:text-white">{t('randomAvatar')}</p>
              <p className="text-[10px] text-gray-400">{t('randomAvatarDesc')}</p>
            </button>
            {AVATARS.map(avatar => {
              const selected = selectedAvatar === avatar.id
              return (
                <button
                  key={avatar.id}
                  onClick={() => { setSelectedAvatar(avatar.id); setCustomAvatarUrls([]); setCustomAvatarPreviews([]); if (avatarFileRef.current) avatarFileRef.current.value = '' }}
                  className={`relative rounded-2xl border-2 p-4 text-center transition-all ${
                    selected
                      ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/20 shadow-lg shadow-violet-100 dark:shadow-violet-900/20'
                      : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300'
                  }`}
                >
                  {selected && <CheckCircle2 size={16} className="absolute top-2 end-2 text-violet-500" />}
                  <img
                    src={avatar.imgs[0]}
                    alt={avatar.name}
                    className="w-16 h-16 rounded-full object-cover mx-auto mb-2 ring-2 ring-white dark:ring-gray-700 shadow"
                  />
                  <p className="text-sm font-bold text-gray-900 dark:text-white">{avatar.name}</p>
                  <p className="text-[10px] text-gray-400 capitalize">
                    {avatar.style === 'animal' ? '🐾 ' : avatar.style === 'youthful' ? '✨ ' : ''}
                    {avatar.style}
                  </p>
                </button>
              )
            })}
          </div>

          {/* Custom avatar: upload photo */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-dashed border-gray-300 dark:border-gray-600 p-5">
            <input ref={avatarFileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleAvatarUpload} />
            <div className="flex items-center gap-3">
              {customAvatarPreviews[0] ? (
                <div className="relative group shrink-0">
                  <img src={customAvatarPreviews[0]} alt="custom avatar" className="w-14 h-14 rounded-xl object-cover ring-2 ring-violet-400" />
                  <button
                    onClick={() => { setCustomAvatarPreviews([]); setCustomAvatarUrls([]); if (avatarFileRef.current) avatarFileRef.current.value = '' }}
                    className="absolute -top-1.5 -end-1.5 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                  >✕</button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => avatarFileRef.current?.click()}
                  disabled={uploadingAvatar}
                  className="w-14 h-14 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center hover:bg-violet-200 dark:hover:bg-violet-900/50 transition cursor-pointer shrink-0"
                >
                  {uploadingAvatar ? <Loader2 size={20} className="text-violet-500 animate-spin" /> : <Upload size={20} className="text-violet-500" />}
                </button>
              )}
              <div className="flex-1">
                <p className="text-sm font-bold text-gray-700 dark:text-gray-300">{t('uploadCustomAvatar')}</p>
                <p className="text-xs text-gray-400 mt-0.5">{t('uploadAvatarHint')}</p>
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

          {/* Brand Kit toggle */}
          {hasBrandInfo && (
            <button
              onClick={() => setUseBrand(!useBrand)}
              className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl border-2 transition-all ${
                useBrand ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/20' : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800'
              }`}
            >
              <span className="flex items-center gap-2.5 text-sm font-medium text-gray-700 dark:text-gray-300">
                <Building2 size={16} className={useBrand ? 'text-violet-500' : 'text-gray-400'} />
                <span>
                  {t('useBrandKit')}
                  {useBrand && brandName && <span className="ms-1.5 text-xs text-violet-500 font-semibold">({brandName})</span>}
                </span>
              </span>
              <div className={`w-10 h-5 rounded-full transition-all relative ${useBrand ? 'bg-violet-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${useBrand ? 'start-5' : 'start-0.5'}`} />
              </div>
            </button>
          )}

          {/* Show brand text in video toggle */}
          {useBrand && brandName && (
            <button
              onClick={() => setShowBrandText(!showBrandText)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl border-2 transition-all ${
                showBrandText ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20' : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800'
              }`}
            >
              <span className="flex items-center gap-2.5 text-sm font-medium text-gray-700 dark:text-gray-300">
                <PenLine size={16} className={showBrandText ? 'text-amber-500' : 'text-gray-400'} />
                <span>
                  Show brand text in video
                  {showBrandText && <span className="ms-1.5 text-xs text-amber-500 font-semibold">"{brandName}"</span>}
                  {!showBrandText && <span className="ms-1.5 text-xs text-gray-400">(off = cleaner video)</span>}
                </span>
              </span>
              <div className={`w-10 h-5 rounded-full transition-all relative ${showBrandText ? 'bg-amber-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${showBrandText ? 'start-5' : 'start-0.5'}`} />
              </div>
            </button>
          )}

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
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleMagicPrompt}
                  disabled={magicPromptLoading || improvePromptLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-violet-500 to-indigo-500 hover:from-violet-600 hover:to-indigo-600 shadow-sm transition disabled:opacity-40"
                >
                  {magicPromptLoading ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
                  {t('magicPrompt')}
                </button>
                <button
                  type="button"
                  onClick={handleImprovePrompt}
                  disabled={!prompt.trim() || magicPromptLoading || improvePromptLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-violet-600 dark:text-violet-400 border border-violet-300 dark:border-violet-700 bg-white dark:bg-gray-800 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition disabled:opacity-40"
                >
                  {improvePromptLoading ? <Loader2 size={12} className="animate-spin" /> : <PenLine size={12} />}
                  {t('improveMyPrompt')}
                </button>
              </div>
              <span className="text-[11px] text-gray-400">{prompt.length}/2000</span>
            </div>

            {mode === 'image' && (
              <div className="space-y-3">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">{t('sourceImage')}</label>
                <input ref={imageFileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleImageFileChange} />

                {imagePreview ? (
                  <div className="relative group">
                    <img src={imagePreview} alt="source" className="w-full max-h-48 object-contain rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900" />
                    {uploadingImage && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-xl">
                        <Loader2 size={28} className="text-white animate-spin" />
                      </div>
                    )}
                    <button
                      onClick={clearUploadedImage}
                      className="absolute top-2 end-2 w-7 h-7 rounded-full bg-red-500 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition shadow"
                    >✕</button>
                  </div>
                ) : (
                  <div
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleImageDrop}
                    onClick={() => imageFileRef.current?.click()}
                    className={`flex flex-col items-center justify-center gap-2 py-8 rounded-xl border-2 border-dashed cursor-pointer transition-all ${
                      dragOver
                        ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/20'
                        : 'border-gray-300 dark:border-gray-600 hover:border-violet-400 hover:bg-gray-50 dark:hover:bg-gray-700/30'
                    }`}
                  >
                    <Upload size={28} className={dragOver ? 'text-violet-500' : 'text-gray-400'} />
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('dragDropImage')}</p>
                    <p className="text-xs text-gray-400">{t('orClickToUpload')}</p>
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                  <span className="text-xs text-gray-400 font-medium">{t('orPasteUrl')}</span>
                  <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                </div>

                <input
                  type="url"
                  value={imagePreview ? '' : imageUrl}
                  onChange={(e) => { setImageUrl(e.target.value); setImagePreview('') }}
                  disabled={!!imagePreview}
                  placeholder={t('imageUrlPlaceholder')}
                  className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700/50 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none transition disabled:opacity-40"
                />
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
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${sound ? 'start-5' : 'start-0.5'}`} />
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
              {useBrand && hasBrandInfo && (
                <span className="px-2.5 py-1 rounded-lg bg-violet-100 dark:bg-violet-900/30 text-xs font-medium text-violet-600 dark:text-violet-400">
                  🏢 {brandName || t('brandKit')}
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

import { useState, useCallback, useEffect, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { Download, Send, Play, Loader2, Film, ImageIcon, Wand2, Volume2, VolumeX, Clock, Maximize, FolderDown, CheckCircle2, Captions } from 'lucide-react'
import { getApiUrl } from '../lib/api'

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

type GenerationMode = 'text' | 'image'
type Quality = 'pro' | 'std'

const CREDITS_PER_SEC: Record<string, number> = {
  std_no_audio: 200,
  std_audio: 300,
  pro_no_audio: 270,
  pro_audio: 400,
}

export default function VideoGeneration({ onSendToPostGenerator, onNeedCredits }: VideoGenerationProps) {
  const { session } = useAuth()
  const [mode, setMode] = useState<GenerationMode>('text')

  const [prompt, setPrompt] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [aspectRatio, setAspectRatio] = useState('16:9')
  const [duration, setDuration] = useState(5)
  const [sound, setSound] = useState(false)
  const [quality, setQuality] = useState<Quality>('pro')

  const [isGenerating, setIsGenerating] = useState(false)
  const [currentTask, setCurrentTask] = useState<VideoTask | null>(null)
  const [error, setError] = useState('')
  const [savedToLibrary, setSavedToLibrary] = useState(false)
  const [fakeProgress, setFakeProgress] = useState(0)
  const progressInterval = useRef<ReturnType<typeof setInterval> | null>(null)
  const [isAddingSubtitles, setIsAddingSubtitles] = useState(false)
  const [subtitledVideoUrl, setSubtitledVideoUrl] = useState<string | null>(null)

  const estimatedCredits = CREDITS_PER_SEC[`${quality}_${sound ? 'audio' : 'no_audio'}`] * duration

  const startFakeProgress = useCallback((videoDuration: number, videoQuality: string) => {
    setFakeProgress(0)
    if (progressInterval.current) clearInterval(progressInterval.current)
    // Pro ~2min, Std ~1min base + ~5s per second of video
    const estimatedMs = (videoQuality === 'pro' ? 120_000 : 60_000) + videoDuration * 5_000
    const tickMs = 2500
    const totalTicks = estimatedMs / tickMs
    let tick = 0
    progressInterval.current = setInterval(() => {
      tick++
      // Ease-out curve: fast start, slow near 90%, never reaches 100% until done
      const raw = (tick / totalTicks) * 100
      const progress = Math.min(92, raw < 60 ? raw * 1.1 : 60 + (raw - 60) * 0.4)
      setFakeProgress(Math.round(progress))
      if (progress >= 92) {
        if (progressInterval.current) clearInterval(progressInterval.current)
      }
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
        if (!response.ok) throw new Error('Failed to get status')
        const data = await response.json()
        setCurrentTask(prev => ({ ...prev!, ...data }))
        if (data.status === 'IN_PROGRESS') {
          setTimeout(poll, 5000)
        } else {
          setIsGenerating(false)
        }
      } catch (err: any) {
        setError(`Status check failed: ${err.message}`)
        setIsGenerating(false)
      }
    }
    poll()
  }, [session])

  const handleGenerate = async () => {
    if (!prompt.trim()) { setError('Please enter a prompt'); return }
    if (mode === 'image' && !imageUrl.trim()) { setError('Please enter an image URL'); return }

    setIsGenerating(true)
    setError('')
    setCurrentTask(null)
    setSavedToLibrary(false)
    setSubtitledVideoUrl(null)

    const endpoint = mode === 'text' ? 'text-to-video' : 'image-to-video'
    const body: any = { prompt, duration, sound, quality, aspect_ratio: aspectRatio }
    if (mode === 'image') body.image_url = imageUrl

    try {
      const response = await fetch(`${API_URL}/api/video-gen/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.detail || 'Failed to generate video')
      }

      const data = await response.json()
      setCurrentTask({ task_id: data.task_id, status: 'IN_PROGRESS', estimated_credits: data.estimated_credits })
      startFakeProgress(duration, quality)
      pollStatus(data.task_id)
    } catch (err: any) {
      const msg = err.message || ''
      if ((msg.includes('credit') || msg.includes('402') || msg.includes('balance')) && onNeedCredits) {
        onNeedCredits()
      } else {
        setError(msg)
      }
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
          text: prompt,
          image_url: currentTask.video_urls[0],
          title: `AI Video — ${prompt.slice(0, 60)}`,
          platforms: [],
          hashtags: [],
        }),
      })
      if (res.ok) setSavedToLibrary(true)
      else setError('Failed to save to library')
    } catch { setError('Failed to save to library') }
  }

  const handleAddSubtitles = async () => {
    if (!currentTask?.video_urls?.[0] || !session) return
    setIsAddingSubtitles(true)
    try {
      const res = await fetch(`${API_URL}/api/video-gen/add-subtitles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ video_url: currentTask.video_urls[0], language: 'he' }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || 'Failed to add subtitles')
      }
      const data = await res.json()
      setSubtitledVideoUrl(data.video_url)
    } catch (e: any) {
      setError(e.message || 'Failed to add subtitles')
    } finally {
      setIsAddingSubtitles(false)
    }
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
    } catch {
      window.open(url, '_blank')
    }
  }

  const videoReady = currentTask?.status === 'SUCCESS' && currentTask.video_urls?.length

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center">
            <Film className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Video Studio</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Kling 3.0 AI — Generate UGC & promotional videos</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left: Controls */}
        <div className="lg:col-span-2 space-y-5">
          {/* Mode Toggle */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-1.5 flex">
            <button
              onClick={() => setMode('text')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                mode === 'text'
                  ? 'bg-gradient-to-r from-violet-500 to-blue-600 text-white shadow-lg shadow-violet-200 dark:shadow-violet-900/30'
                  : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <Wand2 size={16} /> Text to Video
            </button>
            <button
              onClick={() => setMode('image')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                mode === 'image'
                  ? 'bg-gradient-to-r from-violet-500 to-blue-600 text-white shadow-lg shadow-violet-200 dark:shadow-violet-900/30'
                  : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <ImageIcon size={16} /> Image to Video
            </button>
          </div>

          {/* Prompt */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Prompt</label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                maxLength={2000}
                rows={4}
                placeholder={mode === 'text'
                  ? 'A person holding a product and talking to camera in a natural UGC style...'
                  : 'Animate the product — slowly rotate with particles around it...'}
                className="w-full mt-2 px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700/50 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none resize-none transition"
              />
              <div className="text-[11px] text-gray-400 mt-1 text-right">{prompt.length}/2000</div>
            </div>

            {mode === 'image' && (
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Image URL</label>
                <input
                  type="url"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://example.com/product.jpg"
                  className="w-full mt-2 px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700/50 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none transition"
                />
              </div>
            )}
          </div>

          {/* Settings */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Settings</h3>

            {/* Quality */}
            <div className="flex gap-2">
              {(['pro', 'std'] as const).map(q => (
                <button
                  key={q}
                  onClick={() => setQuality(q)}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-all ${
                    quality === q
                      ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300'
                      : 'border-gray-200 dark:border-gray-600 text-gray-500 hover:border-gray-300'
                  }`}
                >
                  {q === 'pro' ? 'Pro Quality' : 'Standard'}
                </button>
              ))}
            </div>

            {/* Duration Slider */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-300">
                  <Clock size={14} /> Duration
                </span>
                <span className="text-sm font-bold text-gray-900 dark:text-white">{duration}s</span>
              </div>
              <input
                type="range"
                min={3}
                max={15}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="w-full accent-violet-500"
              />
              <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                <span>3s</span><span>15s</span>
              </div>
            </div>

            {/* Aspect Ratio */}
            {mode === 'text' && (
              <div>
                <span className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-300 mb-2">
                  <Maximize size={14} /> Aspect Ratio
                </span>
                <div className="flex gap-2">
                  {['16:9', '9:16', '1:1'].map(ar => (
                    <button
                      key={ar}
                      onClick={() => setAspectRatio(ar)}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-all ${
                        aspectRatio === ar
                          ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300'
                          : 'border-gray-200 dark:border-gray-600 text-gray-500 hover:border-gray-300'
                      }`}
                    >
                      {ar}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Sound Toggle */}
            <button
              onClick={() => setSound(!sound)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${
                sound
                  ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/20'
                  : 'border-gray-200 dark:border-gray-600'
              }`}
            >
              <span className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                {sound ? <Volume2 size={16} className="text-violet-500" /> : <VolumeX size={16} />}
                Audio Generation
              </span>
              <div className={`w-10 h-5 rounded-full transition-all relative ${sound ? 'bg-violet-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${sound ? 'left-5' : 'left-0.5'}`} />
              </div>
            </button>
          </div>

          {/* Cost & Generate */}
          <div className="bg-gradient-to-r from-violet-50 to-blue-50 dark:from-violet-900/20 dark:to-blue-900/20 rounded-2xl border border-violet-200 dark:border-violet-800 p-5">
            <div className="flex justify-between items-center mb-4">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Estimated Cost</span>
              <span className="text-xl font-bold text-violet-600 dark:text-violet-400">{estimatedCredits} credits</span>
            </div>
            <button
              onClick={handleGenerate}
              disabled={isGenerating || !prompt.trim()}
              className="w-full bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white px-6 py-3.5 rounded-xl font-bold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-violet-200 dark:shadow-violet-900/30"
            >
              {isGenerating ? (
                <><Loader2 size={18} className="animate-spin" /> Generating...</>
              ) : (
                <><Play size={18} /> Generate Video</>
              )}
            </button>
          </div>
        </div>

        {/* Right: Preview / Status */}
        <div className="lg:col-span-3">
          {/* Error */}
          {error && (
            <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 flex items-center justify-between">
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
              <button onClick={() => setError('')} className="text-red-400 hover:text-red-600 text-lg ml-3">&times;</button>
            </div>
          )}

          {/* Generating State */}
          {currentTask && currentTask.status === 'IN_PROGRESS' && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-8 flex flex-col items-center justify-center" style={{ minHeight: 400 }}>
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center mb-6">
                <Loader2 size={28} className="text-white animate-spin" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Generating Your Video</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 text-center max-w-sm">
                {fakeProgress < 20 ? 'Initializing Kling 3.0 engine...'
                  : fakeProgress < 50 ? 'Generating frames and scene composition...'
                  : fakeProgress < 80 ? 'Rendering video and applying effects...'
                  : 'Finalizing and encoding your video...'}
              </p>
              <div className="w-full max-w-xs mb-2">
                <div className="h-2.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-violet-500 to-blue-600 transition-all duration-[2500ms] ease-out"
                    style={{ width: `${fakeProgress}%` }}
                  />
                </div>
              </div>
              <p className="text-sm font-semibold text-violet-600 dark:text-violet-400">{fakeProgress}%</p>
              <p className="text-[11px] text-gray-400 mt-2">Task: {currentTask.task_id}</p>
            </div>
          )}

          {/* Failed State */}
          {currentTask && currentTask.status === 'FAILED' && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-red-200 dark:border-red-800 p-8 flex flex-col items-center justify-center" style={{ minHeight: 300 }}>
              <div className="w-14 h-14 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4">
                <span className="text-2xl">⚠️</span>
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Generation Failed</h3>
              <p className="text-sm text-gray-600 dark:text-gray-300 text-center max-w-md mb-4">{currentTask.error_message || 'Unknown error'}</p>
              <button
                onClick={() => { setCurrentTask(null); setFakeProgress(0) }}
                className="px-5 py-2 rounded-xl text-sm font-medium text-white transition"
                style={{ background: 'linear-gradient(135deg, #4A7CFF, #7C3AED)' }}
              >
                Try Again
              </button>
            </div>
          )}

          {/* Success: Video Player */}
          {videoReady && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="bg-black rounded-t-2xl">
                <video
                  key={subtitledVideoUrl || currentTask.video_urls![0]}
                  src={subtitledVideoUrl || currentTask.video_urls![0]}
                  controls
                  autoPlay
                  className="w-full"
                  style={{ maxHeight: 500 }}
                />
              </div>

              <div className="p-5 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Credits used: <strong className="text-gray-900 dark:text-white">{currentTask.consumed_credits || currentTask.estimated_credits}</strong></span>
                  {currentTask.created_at && (
                    <span className="text-gray-400">{new Date(currentTask.created_at).toLocaleString()}</span>
                  )}
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => handleDownload(subtitledVideoUrl || currentTask.video_urls![0])}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-semibold text-sm transition-all"
                  >
                    <Download size={16} /> Download MP4
                  </button>
                  <button
                    onClick={handleSaveToLibrary}
                    disabled={savedToLibrary}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold text-sm transition-all ${
                      savedToLibrary
                        ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-800'
                        : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200'
                    }`}
                  >
                    {savedToLibrary ? <><CheckCircle2 size={16} /> Saved</> : <><FolderDown size={16} /> Save to Library</>}
                  </button>
                  {onSendToPostGenerator && (
                    <button
                      onClick={() => onSendToPostGenerator(subtitledVideoUrl || currentTask.video_urls![0], prompt)}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white font-semibold text-sm transition-all shadow-lg shadow-violet-200 dark:shadow-violet-900/30"
                    >
                      <Send size={16} /> Send to Post Generator
                    </button>
                  )}
                </div>

                {/* Subtitles */}
                {!subtitledVideoUrl ? (
                  <button
                    onClick={handleAddSubtitles}
                    disabled={isAddingSubtitles}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-violet-300 dark:border-violet-700 text-violet-600 dark:text-violet-400 font-semibold text-sm hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-all disabled:opacity-50"
                  >
                    {isAddingSubtitles
                      ? <><Loader2 size={15} className="animate-spin" /> Adding subtitles...</>
                      : <><Captions size={15} /> Add Subtitles (Auto)</>
                    }
                  </button>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-green-600 dark:text-green-400 font-semibold text-center flex items-center justify-center gap-1">
                      <CheckCircle2 size={13} /> Subtitles added — video updated above
                    </p>
                  </div>
                )}
                <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-2 text-center">
                  Videos are stored in the library for 7 days. Download to keep permanently.
                </p>
              </div>
            </div>
          )}

          {/* Empty State */}
          {!currentTask && !error && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-8 flex flex-col items-center justify-center" style={{ minHeight: 400 }}>
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-violet-100 to-blue-100 dark:from-violet-900/30 dark:to-blue-900/30 flex items-center justify-center mb-6 rotate-3">
                <Film size={36} className="text-violet-500" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Create Your First Video</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center max-w-sm mb-6">
                Write a prompt describing your video, adjust settings, and hit Generate. Your AI-powered video will appear here.
              </p>
              <div className="grid grid-cols-2 gap-3 w-full max-w-sm">
                {[
                  { icon: '🎤', label: 'UGC Reviews', desc: 'Person talking to camera' },
                  { icon: '📦', label: 'Product Demos', desc: 'Showcase & unboxing' },
                  { icon: '🎬', label: 'Promo Clips', desc: 'Ad-style short videos' },
                  { icon: '✨', label: 'Social Stories', desc: 'Quick story-format' },
                ].map(item => (
                  <div key={item.label} className="p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-600">
                    <span className="text-lg">{item.icon}</span>
                    <p className="text-xs font-bold text-gray-700 dark:text-gray-300 mt-1">{item.label}</p>
                    <p className="text-[10px] text-gray-400">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

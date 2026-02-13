import { useState } from 'react'
import { getApiUrl } from '../lib/api'
import { SchedulePostModal } from './SchedulePostModal'
import { useAuth } from '../contexts/AuthContext'

interface TranslationJob {
  job_id: string
  status: 'processing' | 'completed' | 'failed' | 'cancelled' | 'partial'
  original_video: string
  target_languages: string[]
  translated_videos: Record<string, string>
  download_urls?: Record<string, string>  // Download endpoints for completed dubs
  created_at: string
  completed_at?: string
  error?: string
}

const LANGUAGE_OPTIONS = [
  { code: 'he', name: 'Hebrew (עברית) - NOT SUPPORTED YET', flag: '🇮🇱', alpha: true, disabled: true },
  { code: 'en', name: 'English (English)', flag: '🇺🇸', alpha: false, disabled: false },
  { code: 'es', name: 'Spanish (Español)', flag: '🇪🇸', alpha: false, disabled: false },
  { code: 'fr', name: 'French (Français)', flag: '🇫🇷', alpha: false, disabled: false },
  { code: 'pt', name: 'Portuguese (Português)', flag: '🇵🇹', alpha: false, disabled: false },
  { code: 'de', name: 'German (Deutsch)', flag: '🇩🇪', alpha: false, disabled: false },
  { code: 'it', name: 'Italian (Italiano)', flag: '🇮🇹', alpha: false, disabled: false },
  { code: 'pl', name: 'Polish (Polski)', flag: '🇵🇱', alpha: false, disabled: false },
  { code: 'ru', name: 'Russian (Русский)', flag: '🇷🇺', alpha: false, disabled: false },
  { code: 'ar', name: 'Arabic (العربية)', flag: '🇸🇦', alpha: false, disabled: false },
  { code: 'zh', name: 'Chinese (中文)', flag: '🇨🇳', alpha: false, disabled: false },
  { code: 'ja', name: 'Japanese (日本語)', flag: '🇯🇵', alpha: false, disabled: false },
  { code: 'ko', name: 'Korean (한국어)', flag: '🇰🇷', alpha: false, disabled: false },
  { code: 'tr', name: 'Turkish (Türkçe)', flag: '🇹🇷', alpha: false, disabled: false },
]

interface VideoTranslationProps {
  initialJob?: TranslationJob | null
  onJobUpdate?: (job: TranslationJob | null) => void
}

export function VideoTranslation({ initialJob, onJobUpdate }: VideoTranslationProps = {}) {
  const { session } = useAuth()
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [selectedLanguage, setSelectedLanguage] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [currentJob, setCurrentJob] = useState<TranslationJob | null>(initialJob || null)
  const [error, setError] = useState<string | null>(null)
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null)
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [selectedVideoForSchedule, setSelectedVideoForSchedule] = useState<{ url: string; lang: string } | null>(null)
  const [savingToLibrary, setSavingToLibrary] = useState<Record<string, boolean>>({})

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 500 * 1024 * 1024) {
        setError('Video too large (max 500MB)')
        return
      }
      if (!file.type.startsWith('video/')) {
        setError('Please select a video file')
        return
      }
      
      // Revoke previous preview URL to avoid memory leaks
      if (videoPreviewUrl) {
        URL.revokeObjectURL(videoPreviewUrl)
      }
      
      // Create preview URL
      const previewUrl = URL.createObjectURL(file)
      setVideoPreviewUrl(previewUrl)
      setSelectedFile(file)
      setError(null)
    }
  }
  
  const handleScheduleClick = (videoUrl: string, lang: string) => {
    setSelectedVideoForSchedule({ url: videoUrl, lang })
    setShowScheduleModal(true)
  }
  
  const handleSaveToLibrary = async (videoUrl: string, lang: string) => {
    if (!session) {
      alert('Please sign in to save videos')
      return
    }
    
    setSavingToLibrary(prev => ({ ...prev, [lang]: true }))
    
    try {
      const apiUrl = getApiUrl()
      const langName = LANGUAGE_OPTIONS.find(l => l.code === lang)?.name || lang
      
      const response = await fetch(`${apiUrl}/api/saved-posts/save`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          text: `Video translated to ${langName}`,
          hashtags: ['VideoTranslation', 'AI', 'Dubbing'],
          call_to_action: 'Watch Now',
          image_url: videoUrl,
          platforms: []
        })
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || 'Failed to save video')
      }
      
      alert('✅ Video saved to library!')
    } catch (error) {
      console.error('Save error:', error)
      alert(`❌ Failed to save video: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setSavingToLibrary(prev => ({ ...prev, [lang]: false }))
    }
  }

  const selectLanguage = (code: string) => {
    setSelectedLanguage(code)
  }

  const handleTranslate = async () => {
    console.log('🎬 handleTranslate called')
    console.log('  selectedFile:', selectedFile?.name, selectedFile?.size)
    console.log('  selectedLanguage:', selectedLanguage)
    
    if (!selectedFile || !selectedLanguage) {
      setError('Please select a video and a target language')
      return
    }

    setIsUploading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('video', selectedFile)
      formData.append('target_languages', selectedLanguage)
      
      console.log('📤 Sending video translation request...')

      const apiUrl = getApiUrl()
      
      if (!session) {
        throw new Error('Please sign in to translate videos')
      }
      
      // For large videos, we need a longer timeout (5 minutes)
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 300000) // 5 min
      
      const response = await fetch(`${apiUrl}/api/video/translate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        },
        body: formData,
        signal: controller.signal,
      })
      
      clearTimeout(timeoutId)
      
      console.log('📥 Response status:', response.status, response.statusText)

      if (!response.ok) {
        const errorData = await response.json()
        console.error('❌ Translation failed:', errorData)
        throw new Error(errorData.detail || 'Translation failed')
      }

      const data = await response.json()
      console.log('✅ Translation started:', data)
      
      // Start polling for status
      pollJobStatus(data.job_id)
      
    } catch (err) {
      console.error('❌ handleTranslate error:', err)
      setError(err instanceof Error ? err.message : 'Translation failed')
    } finally {
      setIsUploading(false)
    }
  }

  const pollJobStatus = async (jobId: string) => {
    console.log('🔄 Starting to poll job status:', jobId)
    const apiUrl = getApiUrl()
    
    const poll = async () => {
      try {
        if (!session) {
          setError('Session expired. Please sign in again.')
          return
        }
        
        console.log('📡 Checking status for job:', jobId)
        const response = await fetch(`${apiUrl}/api/video/status/${jobId}`, {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        })
        
        console.log('📥 Status response:', response.status)
        if (!response.ok) throw new Error('Failed to get status')
        
        const job: TranslationJob = await response.json()
        console.log('📊 Job status:', job.status, job)
        
        setCurrentJob(job)
        if (onJobUpdate) onJobUpdate(job)
        
        if (job.status === 'processing') {
          console.log('⏳ Still processing, will check again in 5s...')
          setTimeout(poll, 5000) // Poll every 5 seconds
        } else {
          console.log('✅ Job finished with status:', job.status)
        }
      } catch (err) {
        console.error('❌ Poll error:', err)
        setError('Failed to check status')
      }
    }
    
    poll()
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 mb-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-3 rounded-xl">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
              Video Dubbing
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Automatically dub your video into another language with AI
            </p>
          </div>
        </div>

        {/* Important Info */}
        <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4 rounded-lg">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <div>
              <h3 className="font-semibold text-red-900 dark:text-red-200">
                🇮🇱 Hebrew NOT Supported Yet
              </h3>
              <p className="text-sm text-red-800 dark:text-red-300 mt-1">
                ElevenLabs Dubbing API doesn't support Hebrew yet. Hebrew is available in Text-to-Speech v3, but not in video dubbing.  
                Contact ElevenLabs support to request Hebrew dubbing access or try alternatives: Azure Video Indexer, Google Cloud Video Intelligence, or Papercup.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Upload Section */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 mb-6">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
          1. Upload Video
        </h3>

        {/* File Upload */}
        <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-8 text-center">
          {!selectedFile ? (
            <label className="cursor-pointer block">
              <input
                type="file"
                accept="video/*"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="flex flex-col items-center gap-4">
                <div className="bg-gray-100 dark:bg-gray-700 p-6 rounded-full">
                  <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <div>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">
                    Click to upload video
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    MP4, MOV, AVI (max 500MB)
                  </p>
                </div>
              </div>
            </label>
          ) : (
            <>
              <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg mb-4">
                <div className="flex items-center gap-3">
                  <div className="bg-purple-100 dark:bg-purple-900/30 p-3 rounded-lg">
                    <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-gray-900 dark:text-white">
                      {selectedFile.name}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {formatFileSize(selectedFile.size)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setSelectedFile(null)
                    if (videoPreviewUrl) {
                      URL.revokeObjectURL(videoPreviewUrl)
                      setVideoPreviewUrl(null)
                    }
                  }}
                  className="text-red-600 hover:text-red-700 dark:text-red-400"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              {/* Video Preview */}
              {videoPreviewUrl && (
                <div className="mt-4">
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Original Video Preview:
                  </h4>
                  <video
                    src={videoPreviewUrl}
                    controls
                    className="w-full rounded-lg bg-black max-h-96"
                  >
                    Your browser does not support the video tag.
                  </video>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Language Selection */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 mb-6">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
          2. Select Target Language
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {LANGUAGE_OPTIONS.map((lang) => (
            <label
              key={lang.code}
              className={`
                relative flex items-center gap-4 p-4 rounded-xl border-2 transition-all
                ${lang.disabled 
                  ? 'opacity-50 cursor-not-allowed border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800' 
                  : 'cursor-pointer'}
                ${!lang.disabled && selectedLanguage === lang.code
                  ? 'border-purple-600 bg-purple-50 dark:bg-purple-900/20'
                  : !lang.disabled ? 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600' : ''}
              `}
            >
              <input
                type="radio"
                name="target-language"
                checked={selectedLanguage === lang.code}
                onChange={() => !lang.disabled && selectLanguage(lang.code)}
                disabled={lang.disabled}
                className="sr-only"
              />
              <div className="flex items-center gap-4 flex-1">
                <span className="text-4xl">{lang.flag}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-gray-900 dark:text-white">
                      {lang.name}
                    </p>
                    {lang.disabled && (
                      <span className="text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-2 py-1 rounded-full font-medium">
                        NOT SUPPORTED
                      </span>
                    )}
                    {lang.alpha && !lang.disabled && (
                      <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-1 rounded-full font-medium">
                        ALPHA
                      </span>
                    )}
                  </div>
                  {lang.disabled && (
                    <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                      ElevenLabs Dubbing API doesn't support this language yet
                    </p>
                  )}
                  {lang.alpha && !lang.disabled && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      API-only early access
                    </p>
                  )}
                </div>
              </div>
              {selectedLanguage === lang.code && !lang.disabled && (
                <div className="text-purple-600 dark:text-purple-400">
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                    <circle cx="10" cy="10" r="6" />
                  </svg>
                </div>
              )}
            </label>
          ))}
        </div>

        {selectedLanguage && (
          <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <p className="text-sm text-green-800 dark:text-green-300">
              ✅ Target language: {LANGUAGE_OPTIONS.find(l => l.code === selectedLanguage)?.name}
              {' • '}Estimated time: ~5 minutes
            </p>
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4 rounded-lg mb-6">
          <p className="text-red-800 dark:text-red-300">{error}</p>
        </div>
      )}

      {/* Translate Button */}
      <button
        onClick={handleTranslate}
        disabled={!selectedFile || !selectedLanguage || isUploading}
        className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold py-4 px-6 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
      >
        {isUploading ? (
          <span className="flex items-center justify-center gap-3">
            <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Uploading & Starting Translation...
          </span>
        ) : (
          '🚀 Start Translation'
        )}
      </button>

      {/* Job Status */}
      {currentJob && (
        <div className="mt-6 bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
            Translation Progress
          </h3>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-400">Status:</span>
              <span className={`
                px-3 py-1 rounded-full text-sm font-medium
                ${currentJob.status === 'completed' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' : ''}
                ${currentJob.status === 'processing' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : ''}
                ${currentJob.status === 'failed' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' : ''}
              `}>
                {currentJob.status.toUpperCase()}
              </span>
            </div>

            {currentJob.status === 'processing' && (
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div className="bg-gradient-to-r from-purple-600 to-pink-600 h-2 rounded-full animate-pulse" style={{ width: '60%' }} />
              </div>
            )}

            {currentJob.status === 'completed' && currentJob.download_urls && Object.keys(currentJob.download_urls).length > 0 && (
              <div className="mt-6">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-4">
                  📥 Download Translated Videos:
                </h4>
                <div className="space-y-6">
                  {Object.entries(currentJob.download_urls).map(([lang, path]) => {
                    const apiUrl = getApiUrl()
                    const fullUrl = `${apiUrl}${path}`
                    const langName = LANGUAGE_OPTIONS.find(l => l.code === lang)?.name || lang
                    
                    return (
                      <div key={lang} className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
                        {/* Language Header */}
                        <div className="flex items-center justify-between mb-3">
                          <span className="font-medium text-gray-900 dark:text-white">
                            {langName} ({lang.toUpperCase()})
                          </span>
                        </div>
                        
                        {/* Video Preview */}
                        <div className="mb-4">
                          <video
                            src={fullUrl}
                            controls
                            className="w-full rounded-lg bg-black max-h-96"
                          >
                            Your browser does not support the video tag.
                          </video>
                        </div>
                        
                        {/* Action Buttons */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <a
                            href={fullUrl}
                            download
                            className="flex items-center justify-center gap-2 px-4 py-3 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors border border-gray-300 dark:border-gray-600"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            Download
                          </a>
                          
                          <button
                            onClick={() => handleSaveToLibrary(fullUrl, lang)}
                            disabled={savingToLibrary[lang]}
                            className="flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {savingToLibrary[lang] ? (
                              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                              </svg>
                            ) : (
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                              </svg>
                            )}
                            Save to Library
                          </button>
                          
                          <button
                            onClick={() => handleScheduleClick(fullUrl, lang)}
                            className="flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-lg transition-colors"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            Schedule Post
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {currentJob.error && (
              <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4 rounded-lg">
                <p className="text-red-800 dark:text-red-300">{currentJob.error}</p>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Schedule Post Modal */}
      {showScheduleModal && selectedVideoForSchedule && (
        <SchedulePostModal
          isOpen={showScheduleModal}
          onClose={() => {
            setShowScheduleModal(false)
            setSelectedVideoForSchedule(null)
          }}
          postData={{
            text: `Video translated to ${LANGUAGE_OPTIONS.find(l => l.code === selectedVideoForSchedule.lang)?.name || selectedVideoForSchedule.lang}`,
            imageUrl: selectedVideoForSchedule.url,
            hashtags: ['#VideoTranslation', '#AI', '#Dubbing'],
            cta: 'Watch Now'
          }}
          platforms={['tiktok']}
        />
      )}
    </div>
  )
}

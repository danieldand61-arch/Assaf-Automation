import { useState } from 'react'
import { useApp } from '../contexts/AppContext'

interface TranslationJob {
  job_id: string
  status: 'processing' | 'completed' | 'failed' | 'cancelled'
  original_video: string
  target_languages: string[]
  translated_videos: Record<string, string>
  created_at: string
  completed_at?: string
  error?: string
}

const LANGUAGE_OPTIONS = [
  { code: 'he', name: 'Hebrew (עברית)', flag: '🇮🇱', alpha: true },
  { code: 'es', name: 'Spanish (Español)', flag: '🇪🇸', alpha: false },
  { code: 'fr', name: 'French (Français)', flag: '🇫🇷', alpha: false },
  { code: 'pt', name: 'Portuguese (Português)', flag: '🇵🇹', alpha: false },
]

export function VideoTranslation() {
  const { t } = useApp()
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [currentJob, setCurrentJob] = useState<TranslationJob | null>(null)
  const [error, setError] = useState<string | null>(null)

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
      setSelectedFile(file)
      setError(null)
    }
  }

  const toggleLanguage = (code: string) => {
    setSelectedLanguages(prev =>
      prev.includes(code)
        ? prev.filter(l => l !== code)
        : [...prev, code]
    )
  }

  const handleTranslate = async () => {
    if (!selectedFile || selectedLanguages.length === 0) {
      setError('Please select a video and at least one language')
      return
    }

    setIsUploading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('video', selectedFile)
      formData.append('target_languages', selectedLanguages.join(','))

      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'
      const response = await fetch(`${apiUrl}/api/video/translate`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || 'Translation failed')
      }

      const data = await response.json()
      
      // Start polling for status
      pollJobStatus(data.job_id)
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Translation failed')
    } finally {
      setIsUploading(false)
    }
  }

  const pollJobStatus = async (jobId: string) => {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'
    
    const poll = async () => {
      try {
        const response = await fetch(`${apiUrl}/api/video/status/${jobId}`)
        if (!response.ok) throw new Error('Failed to get status')
        
        const job: TranslationJob = await response.json()
        setCurrentJob(job)
        
        if (job.status === 'processing') {
          setTimeout(poll, 5000) // Poll every 5 seconds
        }
      } catch (err) {
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
              Video Translation
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Automatically dub your videos into multiple languages with AI
            </p>
          </div>
        </div>

        {/* Priority Info */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 p-4 rounded-lg">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <div>
              <h3 className="font-semibold text-blue-900 dark:text-blue-200">
                🇮🇱 Hebrew Translation (Alpha Access)
              </h3>
              <p className="text-sm text-blue-800 dark:text-blue-300 mt-1">
                Hebrew translation is only available via API (not in ElevenLabs UI). You have early access!
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
            <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
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
                onClick={() => setSelectedFile(null)}
                className="text-red-600 hover:text-red-700 dark:text-red-400"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Language Selection */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 mb-6">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
          2. Select Target Languages
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {LANGUAGE_OPTIONS.map((lang) => (
            <label
              key={lang.code}
              className={`
                relative flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all
                ${selectedLanguages.includes(lang.code)
                  ? 'border-purple-600 bg-purple-50 dark:bg-purple-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }
              `}
            >
              <input
                type="checkbox"
                checked={selectedLanguages.includes(lang.code)}
                onChange={() => toggleLanguage(lang.code)}
                className="sr-only"
              />
              <div className="flex items-center gap-4 flex-1">
                <span className="text-4xl">{lang.flag}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-gray-900 dark:text-white">
                      {lang.name}
                    </p>
                    {lang.alpha && (
                      <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-1 rounded-full font-medium">
                        ALPHA
                      </span>
                    )}
                  </div>
                  {lang.alpha && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      API-only early access
                    </p>
                  )}
                </div>
              </div>
              {selectedLanguages.includes(lang.code) && (
                <div className="text-purple-600 dark:text-purple-400">
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
            </label>
          ))}
        </div>

        {selectedLanguages.length > 0 && (
          <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <p className="text-sm text-green-800 dark:text-green-300">
              ✅ Selected {selectedLanguages.length} language{selectedLanguages.length > 1 ? 's' : ''}
              {' • '}Estimated time: ~{selectedLanguages.length * 5} minutes
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
        disabled={!selectedFile || selectedLanguages.length === 0 || isUploading}
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

            {currentJob.status === 'completed' && Object.keys(currentJob.translated_videos).length > 0 && (
              <div className="mt-6">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-4">
                  📥 Download Translated Videos:
                </h4>
                <div className="space-y-3">
                  {Object.entries(currentJob.translated_videos).map(([lang, url]) => (
                    <a
                      key={lang}
                      href={url}
                      download
                      className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      <span className="font-medium text-gray-900 dark:text-white">
                        {LANGUAGE_OPTIONS.find(l => l.code === lang)?.name || lang}
                      </span>
                      <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                    </a>
                  ))}
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
    </div>
  )
}

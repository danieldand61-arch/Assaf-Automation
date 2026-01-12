import { useState } from 'react'
import { Sparkles, Globe } from 'lucide-react'
import { useApp } from '../contexts/AppContext'

interface InputSectionProps {
  onGenerate: (data: any) => void
}

export function InputSection({ onGenerate }: InputSectionProps) {
  const { t } = useApp()
  const [url, setUrl] = useState('')
  const [keywords, setKeywords] = useState('')
  const [platforms, setPlatforms] = useState<string[]>(['facebook', 'instagram'])
  const [imageSize, setImageSize] = useState('1080x1080')
  const [style, setStyle] = useState('professional')
  const [targetAudience, setTargetAudience] = useState('b2c')
  const [includeEmojis, setIncludeEmojis] = useState(true)
  const [includeLogo, setIncludeLogo] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!url || !keywords) {
      alert(t('fillRequired'))
      return
    }

    onGenerate({
      url,
      keywords,
      platforms,
      image_size: imageSize,
      style,
      target_audience: targetAudience,
      include_emojis: includeEmojis,
      include_logo: includeLogo
    })
  }

  const togglePlatform = (platform: string) => {
    setPlatforms(prev => 
      prev.includes(platform) 
        ? prev.filter(p => p !== platform)
        : [...prev, platform]
    )
  }

  return (
    <div className="max-w-3xl mx-auto">
      <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 space-y-6">
        
        {/* URL Input */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            <Globe className="inline w-4 h-4 mr-1 ltr:mr-1 rtl:ml-1" />
            {t('websiteUrl')}
          </label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none transition"
            required
          />
        </div>

        {/* Keywords */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            {t('keywords')}
          </label>
          <textarea
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            placeholder={t('keywordsPlaceholder')}
            className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none transition h-24 resize-none"
            required
          />
        </div>

        {/* Platforms */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            {t('platforms')}
          </label>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => togglePlatform('facebook')}
              className={`flex-1 py-3 rounded-lg font-medium transition ${
                platforms.includes('facebook')
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              Facebook
            </button>
            <button
              type="button"
              onClick={() => togglePlatform('instagram')}
              className={`flex-1 py-3 rounded-lg font-medium transition ${
                platforms.includes('instagram')
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              Instagram
            </button>
          </div>
        </div>

        {/* Image Size */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            {t('imageSize')}
          </label>
          <select
            value={imageSize}
            onChange={(e) => setImageSize(e.target.value)}
            className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none transition"
          >
            <option value="1080x1080">📱 Square (1080x1080) - Instagram Feed</option>
            <option value="1200x630">🖼️ Landscape (1200x630) - Facebook</option>
            <option value="1080x1920">📲 Stories/Reels (1080x1920) - Vertical</option>
          </select>
        </div>

        {/* Style */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            {t('style')}
          </label>
          <select
            value={style}
            onChange={(e) => setStyle(e.target.value)}
            className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none transition"
          >
            <option value="professional">{t('professional')}</option>
            <option value="casual">{t('casual')}</option>
            <option value="funny">{t('funny')}</option>
            <option value="inspirational">{t('inspirational')}</option>
            <option value="educational">{t('educational')}</option>
            <option value="sales">{t('salesFocused')}</option>
          </select>
        </div>

        {/* Target Audience */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            {t('targetAudience')}
          </label>
          <select
            value={targetAudience}
            onChange={(e) => setTargetAudience(e.target.value)}
            className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none transition"
          >
            <option value="b2b">{t('b2b')}</option>
            <option value="b2c">{t('b2c')}</option>
            <option value="young_adults">{t('youngAdults')}</option>
            <option value="parents">{t('parents')}</option>
            <option value="business_owners">{t('businessOwners')}</option>
            <option value="tech_enthusiasts">{t('techEnthusiasts')}</option>
          </select>
        </div>

        {/* Options */}
        <div className="flex gap-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={includeEmojis}
              onChange={(e) => setIncludeEmojis(e.target.checked)}
              className="w-5 h-5 text-blue-600 rounded"
            />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('includeEmojis')}</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={includeLogo}
              onChange={(e) => setIncludeLogo(e.target.checked)}
              className="w-5 h-5 text-blue-600 rounded"
            />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('includeLogo')}</span>
          </label>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-4 rounded-lg font-semibold text-lg hover:from-blue-700 hover:to-purple-700 transition flex items-center justify-center gap-2 shadow-lg"
        >
          <Sparkles className="w-5 h-5" />
          {t('generateButton')}
        </button>
      </form>
    </div>
  )
}


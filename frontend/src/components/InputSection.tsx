import { useState } from 'react'
import { Sparkles, Globe } from 'lucide-react'

interface InputSectionProps {
  onGenerate: (data: any) => void
}

export function InputSection({ onGenerate }: InputSectionProps) {
  const [url, setUrl] = useState('')
  const [keywords, setKeywords] = useState('')
  const [platforms, setPlatforms] = useState<string[]>(['facebook', 'instagram'])
  const [style, setStyle] = useState('professional')
  const [targetAudience, setTargetAudience] = useState('b2c')
  const [industry, setIndustry] = useState('business')
  const [includeEmojis, setIncludeEmojis] = useState(true)
  const [includeLogo, setIncludeLogo] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!url || !keywords) {
      alert('Please fill in URL and keywords!')
      return
    }

    onGenerate({
      url,
      keywords,
      platforms,
      style,
      target_audience: targetAudience,
      industry,
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
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-xl p-8 space-y-6">
        
        {/* URL Input */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            <Globe className="inline w-4 h-4 mr-1" />
            Website URL
          </label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none transition"
            required
          />
        </div>

        {/* Keywords */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Keywords / Description
          </label>
          <textarea
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            placeholder="New product launch, innovative solutions, technology..."
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none transition h-24 resize-none"
            required
          />
        </div>

        {/* Platforms */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-3">
            Platforms
          </label>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => togglePlatform('facebook')}
              className={`flex-1 py-3 rounded-lg font-medium transition ${
                platforms.includes('facebook')
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
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
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Instagram
            </button>
          </div>
        </div>

        {/* Style */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Style
          </label>
          <select
            value={style}
            onChange={(e) => setStyle(e.target.value)}
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none transition"
          >
            <option value="professional">Professional</option>
            <option value="casual">Casual</option>
            <option value="funny">Funny</option>
            <option value="inspirational">Inspirational</option>
            <option value="educational">Educational</option>
            <option value="sales">Sales-focused</option>
          </select>
        </div>

        {/* Target Audience */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Target Audience
          </label>
          <select
            value={targetAudience}
            onChange={(e) => setTargetAudience(e.target.value)}
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none transition"
          >
            <option value="b2b">B2B</option>
            <option value="b2c">B2C</option>
            <option value="young_adults">Young Adults</option>
            <option value="parents">Parents</option>
            <option value="business_owners">Business Owners</option>
            <option value="tech_enthusiasts">Tech Enthusiasts</option>
          </select>
        </div>

        {/* Industry */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Industry
          </label>
          <input
            type="text"
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            placeholder="E-commerce, SaaS, Healthcare..."
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none transition"
          />
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
            <span className="text-sm font-medium text-gray-700">Include Emojis</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={includeLogo}
              onChange={(e) => setIncludeLogo(e.target.checked)}
              className="w-5 h-5 text-blue-600 rounded"
            />
            <span className="text-sm font-medium text-gray-700">Include Logo</span>
          </label>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-4 rounded-lg font-semibold text-lg hover:from-blue-700 hover:to-purple-700 transition flex items-center justify-center gap-2 shadow-lg"
        >
          <Sparkles className="w-5 h-5" />
          Generate Content
        </button>
      </form>
    </div>
  )
}


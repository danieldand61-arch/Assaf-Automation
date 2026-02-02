import { useState } from 'react'
import { getApiUrl } from '../lib/api'
import { Loader2, Copy, Download, Check } from 'lucide-react'

interface GoogleAdsGenerationProps {
  onGenerate?: (data: any) => void
  initialData?: GoogleAdsPackage | null
}

interface GoogleAdsPackage {
  headlines: string[]
  descriptions: string[]
  display_paths: string[]
  callouts: string[]
  sitelinks: Array<{
    text: string
    description1: string
    description2: string
  }>
  structured_snippets: {
    [key: string]: string[]
  }
}

export function GoogleAdsGeneration({ onGenerate, initialData }: GoogleAdsGenerationProps) {
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [keywords, setKeywords] = useState('')
  const [targetLocation, setTargetLocation] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [adsPackage, setAdsPackage] = useState<GoogleAdsPackage | null>(initialData || null)
  const [copiedField, setCopiedField] = useState<string | null>(null)

  const handleGenerate = async () => {
    if (!websiteUrl || !keywords) {
      alert('Please enter website URL and keywords')
      return
    }

    setIsGenerating(true)
    console.log('🎯 Starting Google Ads generation...')
    console.log('🎯 Website URL:', websiteUrl)
    console.log('🎯 Keywords:', keywords)

    try {
      // First, scrape website
      const apiUrl = getApiUrl()
      console.log('🎯 API URL:', apiUrl)
      console.log('🎯 Scraping website...')
      
      const scrapeResponse = await fetch(`${apiUrl}/api/scrape`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: websiteUrl })
      })

      console.log('🎯 Scrape response status:', scrapeResponse.status)

      let websiteData
      
      if (!scrapeResponse.ok) {
        console.warn('⚠️ Scraping failed, using fallback data')
        // Fallback: use basic data from URL
        websiteData = {
          title: websiteUrl.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''),
          description: keywords,
          products: keywords.split(',').map(k => k.trim()),
          key_features: [],
          industry: 'general'
        }
        console.log('🎯 Using fallback website data:', websiteData)
      } else {
        websiteData = await scrapeResponse.json()
        console.log('✅ Website scraped successfully:', websiteData)
      }

      // Then, generate Google Ads
      console.log('🎯 Calling Google Ads generation endpoint...')
      const adsResponse = await fetch(`${apiUrl}/api/content/generate-google-ads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          website_data: websiteData,
          keywords,
          target_location: targetLocation,
          language: 'en'
        })
      })

      console.log('🎯 Ads generation response status:', adsResponse.status)

      if (!adsResponse.ok) {
        const errorText = await adsResponse.text()
        console.error('❌ Ads generation error response:', errorText)
        throw new Error(`Failed to generate Google Ads: ${errorText}`)
      }

      const data = await adsResponse.json()
      console.log('✅ Google Ads generated successfully:', data)
      
      const adsPackageData = data.ads_package
      setAdsPackage(adsPackageData)
      
      if (onGenerate) {
        onGenerate(adsPackageData)
      }
    } catch (error) {
      console.error('❌ Error:', error)
      alert(`Failed to generate Google Ads: ${error}`)
    } finally {
      setIsGenerating(false)
    }
  }

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text)
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 2000)
  }

  const exportToCsv = () => {
    if (!adsPackage) return

    let csv = 'Type,Content,Character Count\n'
    
    adsPackage.headlines.forEach((h, i) => {
      csv += `Headline ${i + 1},"${h}",${h.length}\n`
    })
    
    adsPackage.descriptions.forEach((d, i) => {
      csv += `Description ${i + 1},"${d}",${d.length}\n`
    })

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'google-ads-rsa.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      {/* Input Form */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Website URL *
          </label>
          <input
            type="url"
            value={websiteUrl}
            onChange={(e) => setWebsiteUrl(e.target.value)}
            placeholder="https://example.com"
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            disabled={isGenerating}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Keywords *
          </label>
          <input
            type="text"
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            placeholder="water damage repair, emergency service, LA"
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            disabled={isGenerating}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Target Location (optional)
          </label>
          <input
            type="text"
            value={targetLocation}
            onChange={(e) => setTargetLocation(e.target.value)}
            placeholder="Los Angeles, CA"
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            disabled={isGenerating}
          />
        </div>

        <button
          onClick={handleGenerate}
          disabled={isGenerating || !websiteUrl || !keywords}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Generating Google Ads...
            </>
          ) : (
            'Generate Google Ads RSA'
          )}
        </button>
      </div>

      {/* Results */}
      {adsPackage && (
        <div className="space-y-6 border-t border-gray-200 dark:border-gray-700 pt-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              Google Ads Package Ready! 🎯
            </h3>
            <button
              onClick={exportToCsv}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>

          {/* Headlines */}
          <div>
            <h4 className="font-bold text-gray-900 dark:text-white mb-3">
              Headlines (15) - 30 chars max
            </h4>
            <div className="space-y-2">
              {adsPackage.headlines.map((headline, i) => (
                <div key={i} className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400 w-6">
                    {i + 1}
                  </span>
                  <span className="flex-1 text-sm text-gray-900 dark:text-white">
                    {headline}
                  </span>
                  <span className={`text-xs font-medium ${headline.length > 30 ? 'text-red-600' : 'text-green-600'}`}>
                    {headline.length}/30
                  </span>
                  <button
                    onClick={() => copyToClipboard(headline, `headline-${i}`)}
                    className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition"
                  >
                    {copiedField === `headline-${i}` ? (
                      <Check className="w-4 h-4 text-green-600" />
                    ) : (
                      <Copy className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Descriptions */}
          <div>
            <h4 className="font-bold text-gray-900 dark:text-white mb-3">
              Descriptions (4) - 90 chars max
            </h4>
            <div className="space-y-2">
              {adsPackage.descriptions.map((desc, i) => (
                <div key={i} className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400 w-6">
                    {i + 1}
                  </span>
                  <span className="flex-1 text-sm text-gray-900 dark:text-white">
                    {desc}
                  </span>
                  <span className={`text-xs font-medium ${desc.length > 90 ? 'text-red-600' : 'text-green-600'}`}>
                    {desc.length}/90
                  </span>
                  <button
                    onClick={() => copyToClipboard(desc, `desc-${i}`)}
                    className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition"
                  >
                    {copiedField === `desc-${i}` ? (
                      <Check className="w-4 h-4 text-green-600" />
                    ) : (
                      <Copy className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Callouts */}
          {adsPackage.callouts && adsPackage.callouts.length > 0 && (
            <div>
              <h4 className="font-bold text-gray-900 dark:text-white mb-3">
                Callout Extensions ({adsPackage.callouts.length})
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {adsPackage.callouts.map((callout, i) => (
                  <div key={i} className="p-2 bg-gray-50 dark:bg-gray-800 rounded text-sm text-gray-900 dark:text-white">
                    {callout}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sitelinks */}
          {adsPackage.sitelinks && adsPackage.sitelinks.length > 0 && (
            <div>
              <h4 className="font-bold text-gray-900 dark:text-white mb-3">
                Sitelinks ({adsPackage.sitelinks.length})
              </h4>
              <div className="space-y-2">
                {adsPackage.sitelinks.map((link, i) => (
                  <div key={i} className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div className="font-medium text-sm text-gray-900 dark:text-white mb-1">
                      {link.text}
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      {link.description1}
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      {link.description2}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

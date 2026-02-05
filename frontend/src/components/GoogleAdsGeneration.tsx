import { useState, useEffect } from 'react'
import { getApiUrl } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import { Loader2, Copy, Download, Check, Upload, X } from 'lucide-react'

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
  const { session } = useAuth()
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [keywords, setKeywords] = useState('')
  const [targetLocation, setTargetLocation] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [adsPackage, setAdsPackage] = useState<GoogleAdsPackage | null>(initialData || null)
  const [copiedField, setCopiedField] = useState<string | null>(null)
  
  // Google Ads publishing
  const [isPublishing, setIsPublishing] = useState(false)
  const [showPublishModal, setShowPublishModal] = useState(false)
  const [googleAdsConnected, setGoogleAdsConnected] = useState(false)
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('')
  const [adGroups, setAdGroups] = useState<any[]>([])
  const [selectedAdGroupId, setSelectedAdGroupId] = useState<string>('')
  const [finalUrl, setFinalUrl] = useState('')

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

  // Check Google Ads connection status
  useEffect(() => {
    const checkGoogleAdsConnection = async () => {
      if (!session) return
      
      try {
        const apiUrl = getApiUrl()
        const response = await fetch(`${apiUrl}/api/google-ads/status`, {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        })
        
        if (response.ok) {
          const data = await response.json()
          setGoogleAdsConnected(data.connected)
        }
      } catch (error) {
        console.error('Failed to check Google Ads status:', error)
      }
    }
    
    checkGoogleAdsConnection()
  }, [session])

  // Fetch campaigns when modal opens
  const handleOpenPublishModal = async () => {
    if (!googleAdsConnected) {
      alert('Please connect your Google Ads account first in Settings')
      return
    }
    
    setShowPublishModal(true)
    setFinalUrl(websiteUrl)
    
    try {
      const apiUrl = getApiUrl()
      const response = await fetch(`${apiUrl}/api/google-ads/campaigns`, {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        setCampaigns(data.campaigns)
      } else {
        throw new Error('Failed to fetch campaigns')
      }
    } catch (error) {
      console.error('Failed to fetch campaigns:', error)
      alert('Failed to load campaigns. Please check your connection.')
    }
  }

  // Fetch ad groups when campaign is selected
  useEffect(() => {
    if (!selectedCampaignId) return
    
    const fetchAdGroups = async () => {
      try {
        const apiUrl = getApiUrl()
        const response = await fetch(
          `${apiUrl}/api/google-ads/campaigns/${selectedCampaignId}/ad-groups`,
          {
            headers: {
              'Authorization': `Bearer ${session?.access_token}`
            }
          }
        )
        
        if (response.ok) {
          const data = await response.json()
          setAdGroups(data.ad_groups)
        }
      } catch (error) {
        console.error('Failed to fetch ad groups:', error)
      }
    }
    
    fetchAdGroups()
  }, [selectedCampaignId, session])

  // Publish RSA to Google Ads
  const handlePublishToGoogleAds = async () => {
    if (!selectedAdGroupId || !finalUrl || !adsPackage) {
      alert('Please select campaign, ad group, and enter final URL')
      return
    }
    
    setIsPublishing(true)
    
    try {
      const apiUrl = getApiUrl()
      const response = await fetch(`${apiUrl}/api/google-ads/create-rsa`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ad_group_id: parseInt(selectedAdGroupId),
          headlines: adsPackage.headlines,
          descriptions: adsPackage.descriptions,
          final_url: finalUrl,
          path1: adsPackage.display_paths[0] || '',
          path2: adsPackage.display_paths[1] || ''
        })
      })
      
      if (response.ok) {
        const data = await response.json()
        alert(`✅ RSA created successfully!\n\nStatus: ${data.status}\n\n${data.message}`)
        setShowPublishModal(false)
      } else {
        const error = await response.json()
        throw new Error(error.detail || 'Failed to create RSA')
      }
    } catch (error: any) {
      console.error('Failed to publish RSA:', error)
      alert(`❌ Failed to publish RSA:\n\n${error.message}`)
    } finally {
      setIsPublishing(false)
    }
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
            Tell us about your ad *
          </label>
          <input
            type="text"
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            placeholder="e.g., emergency water damage repair services in Los Angeles"
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
            
            <button
              onClick={handleOpenPublishModal}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!googleAdsConnected}
              title={googleAdsConnected ? 'Publish to Google Ads' : 'Connect Google Ads account first in Settings'}
            >
              <Upload className="w-4 h-4" />
              Publish to Google Ads
              {!googleAdsConnected && ' (Not Connected)'}
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
      
      {/* Publish to Google Ads Modal */}
      {showPublishModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                  📤 Publish to Google Ads
                </h3>
                <button
                  onClick={() => setShowPublishModal(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
                  disabled={isPublishing}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              {/* Form */}
              <div className="space-y-4">
                {/* Campaign Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Select Campaign *
                  </label>
                  <select
                    value={selectedCampaignId}
                    onChange={(e) => {
                      setSelectedCampaignId(e.target.value)
                      setSelectedAdGroupId('')
                      setAdGroups([])
                    }}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    disabled={isPublishing}
                  >
                    <option value="">-- Select Campaign --</option>
                    {campaigns.map((campaign) => (
                      <option key={campaign.id} value={campaign.id}>
                        {campaign.name} ({campaign.status})
                      </option>
                    ))}
                  </select>
                </div>
                
                {/* Ad Group Selection */}
                {selectedCampaignId && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Select Ad Group *
                    </label>
                    <select
                      value={selectedAdGroupId}
                      onChange={(e) => setSelectedAdGroupId(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                      disabled={isPublishing}
                    >
                      <option value="">-- Select Ad Group --</option>
                      {adGroups.map((adGroup) => (
                        <option key={adGroup.id} value={adGroup.id}>
                          {adGroup.name} ({adGroup.status})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                
                {/* Final URL */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Final URL (Landing Page) *
                  </label>
                  <input
                    type="url"
                    value={finalUrl}
                    onChange={(e) => setFinalUrl(e.target.value)}
                    placeholder="https://example.com/landing-page"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    disabled={isPublishing}
                  />
                </div>
                
                {/* Summary */}
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                  <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                    📊 This will create:
                  </h4>
                  <ul className="space-y-1 text-sm text-blue-800 dark:text-blue-200">
                    <li>• {adsPackage?.headlines.length} headlines</li>
                    <li>• {adsPackage?.descriptions.length} descriptions</li>
                    <li>• RSA ad in PAUSED status (review before activating)</li>
                  </ul>
                </div>
                
                {/* Warning */}
                <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4">
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    ⚠️ <strong>Important:</strong> The ad will be created in <strong>PAUSED</strong> status for safety. 
                    Review it in Google Ads and activate when ready.
                  </p>
                </div>
                
                {/* Actions */}
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => setShowPublishModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                    disabled={isPublishing}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handlePublishToGoogleAds}
                    className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    disabled={isPublishing || !selectedAdGroupId || !finalUrl}
                  >
                    {isPublishing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Publishing...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4" />
                        Create RSA Ad
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

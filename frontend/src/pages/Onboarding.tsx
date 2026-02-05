import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { getApiUrl } from '../lib/api'
import { Loader2, Sparkles, Building2, Users, Package, MessageSquare, Mic } from 'lucide-react'

export function Onboarding() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  // Form data
  const [companyName, setCompanyName] = useState('')
  const [industry, setIndustry] = useState('')
  const [products, setProducts] = useState('')
  const [targetAudience, setTargetAudience] = useState('')
  const [brandVoice, setBrandVoice] = useState('professional')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (!companyName || !industry) {
      setError('Please fill in at least company name and industry')
      setLoading(false)
      return
    }

    try {
      const apiUrl = getApiUrl()
      
      // Create account with company info
      const response = await fetch(`${apiUrl}/api/accounts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          name: companyName,
          industry: industry,
          description: products,
          target_audience: targetAudience,
          brand_voice: brandVoice
        })
      })

      if (!response.ok) {
        throw new Error('Failed to create account')
      }

      // Navigate to main app
      navigate('/')
    } catch (err: any) {
      setError(err.message || 'Failed to complete onboarding')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl mb-4">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Welcome to Joyo Marketing! 🎉
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Tell us about your company so we can create better marketing content for you
          </p>
        </div>

        {/* Onboarding Form */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Company Name */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                <div className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-blue-600" />
                  Company Name *
                </div>
              </label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none transition"
                placeholder="e.g., Sweet Bakery"
                required
              />
            </div>

            {/* Industry */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                <div className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-purple-600" />
                  Industry / Niche *
                </div>
              </label>
              <input
                type="text"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none transition"
                placeholder="e.g., Bakery & Confectionery"
                required
              />
            </div>

            {/* Products/Services */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                <div className="flex items-center gap-2">
                  <Package className="w-5 h-5 text-green-600" />
                  What do you sell or offer?
                </div>
              </label>
              <textarea
                value={products}
                onChange={(e) => setProducts(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none transition"
                placeholder="e.g., Fresh bread, custom cakes, croissants, cookies, and pastries made daily with organic ingredients"
                rows={3}
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Describe your products, services, or what makes your business unique
              </p>
            </div>

            {/* Target Audience */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-orange-600" />
                  Who is your target audience?
                </div>
              </label>
              <input
                type="text"
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none transition"
                placeholder="e.g., Young families, 25-40 years old, health-conscious"
              />
            </div>

            {/* Brand Voice */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                <div className="flex items-center gap-2">
                  <Mic className="w-5 h-5 text-pink-600" />
                  Brand Voice / Tone
                </div>
              </label>
              <select
                value={brandVoice}
                onChange={(e) => setBrandVoice(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none transition"
              >
                <option value="professional">Professional & Trustworthy</option>
                <option value="friendly">Friendly & Warm</option>
                <option value="casual">Casual & Conversational</option>
                <option value="creative">Creative & Playful</option>
                <option value="educational">Educational & Informative</option>
                <option value="luxury">Luxury & Premium</option>
              </select>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                How should we communicate with your audience?
              </p>
            </div>

            {/* Info Box */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex gap-3">
                <MessageSquare className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-800 dark:text-blue-300">
                  <p className="font-semibold mb-1">How we use this information:</p>
                  <ul className="list-disc list-inside space-y-1 text-blue-700 dark:text-blue-400">
                    <li>AI will understand your business context</li>
                    <li>Generate relevant content automatically</li>
                    <li>Match your brand voice and tone</li>
                    <li>You can always override with custom prompts</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg font-semibold transition disabled:opacity-50 flex items-center justify-center gap-2 text-lg"
            >
              {loading && <Loader2 className="w-5 h-5 animate-spin" />}
              {loading ? 'Setting up...' : 'Continue to Joyo Marketing'}
            </button>

            {/* Skip Option */}
            <button
              type="button"
              onClick={() => navigate('/')}
              className="w-full py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 text-sm transition"
            >
              Skip for now (you can add this later in Settings)
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

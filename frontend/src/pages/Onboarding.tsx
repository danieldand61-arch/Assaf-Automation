import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { getApiUrl } from '../lib/api'
import { Loader2, Sparkles, Building2, Users, Package, Mic, Target, Globe, DollarSign, Link as LinkIcon, ChevronRight, ChevronLeft } from 'lucide-react'

export function Onboarding() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [step, setStep] = useState(1)
  
  // Form data
  const [companyName, setCompanyName] = useState('')
  const [industry, setIndustry] = useState('')
  const [products, setProducts] = useState('')
  const [targetAudience, setTargetAudience] = useState('')
  const [brandVoice, setBrandVoice] = useState('professional')
  
  // New fields
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [marketingGoal, setMarketingGoal] = useState('')
  const [geographicFocus, setGeographicFocus] = useState('')
  const [budgetRange, setBudgetRange] = useState('')
  
  const totalSteps = 3

  const nextStep = () => {
    if (step === 1 && (!companyName || !industry)) {
      setError('Please fill in company name and industry')
      return
    }
    setError('')
    setStep(prev => Math.min(prev + 1, totalSteps))
  }
  
  const prevStep = () => {
    setError('')
    setStep(prev => Math.max(prev - 1, 1))
  }

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
      
      // Create account with extended company info
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
          brand_voice: brandVoice,
          // Extended metadata
          metadata: {
            website_url: websiteUrl,
            marketing_goal: marketingGoal,
            geographic_focus: geographicFocus,
            budget_range: budgetRange
          }
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

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Step {step} of {totalSteps}
            </span>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {Math.round((step / totalSteps) * 100)}% Complete
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div 
              className="bg-gradient-to-r from-blue-600 to-purple-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(step / totalSteps) * 100}%` }}
            />
          </div>
        </div>

        {/* Onboarding Form */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
          <form onSubmit={step === totalSteps ? handleSubmit : (e) => { e.preventDefault(); nextStep(); }} className="space-y-6">
            {/* Step 1: Basic Information */}
            {step === 1 && (
              <>
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                    Tell us about your business
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400">
                    Basic information to help us understand your company
                  </p>
                </div>
            
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

            </>
            )}

            {/* Step 2: Marketing Details */}
            {step === 2 && (
              <>
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                    Marketing & Audience
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400">
                    Help us target the right people
                  </p>
                </div>

                {/* Marketing Goal */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                    <div className="flex items-center gap-2">
                      <Target className="w-5 h-5 text-blue-600" />
                      What's your primary marketing goal?
                    </div>
                  </label>
                  <div className="space-y-2">
                    {[
                      { value: 'brand_awareness', label: 'Brand Awareness', desc: 'Increase awareness of your brand' },
                      { value: 'website_engagement', label: 'Website Engagement', desc: 'Increase user engagement and pageviews' },
                      { value: 'lead_generation', label: 'Lead Generation', desc: 'Drive leads, such as email signups' },
                      { value: 'online_purchases', label: 'Online Purchases', desc: 'Get people to buy your products' },
                      { value: 'app_promotion', label: 'App Promotion', desc: 'Get people to install your app' }
                    ].map((goal) => (
                      <button
                        key={goal.value}
                        type="button"
                        onClick={() => setMarketingGoal(goal.value)}
                        className={`w-full text-left p-4 border-2 rounded-lg transition ${
                          marketingGoal === goal.value
                            ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                            : 'border-gray-200 dark:border-gray-600 hover:border-blue-300'
                        }`}
                      >
                        <div className="font-semibold text-gray-900 dark:text-white">{goal.label}</div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">{goal.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Website URL */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    <div className="flex items-center gap-2">
                      <LinkIcon className="w-5 h-5 text-purple-600" />
                      Website URL
                    </div>
                  </label>
                  <input
                    type="url"
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none transition"
                    placeholder="https://example.com"
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    We'll analyze your website to create better ads
                  </p>
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
                </div>
              </>
            )}

            {/* Step 3: Geographic & Budget */}
            {step === 3 && (
              <>
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                    Location & Budget
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400">
                    Where you operate and your marketing scale
                  </p>
                </div>

                {/* Geographic Focus */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    <div className="flex items-center gap-2">
                      <Globe className="w-5 h-5 text-green-600" />
                      Where is your target audience located?
                    </div>
                  </label>
                  <input
                    type="text"
                    value={geographicFocus}
                    onChange={(e) => setGeographicFocus(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none transition"
                    placeholder="e.g., United States, New York, Global"
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Country, city, or region where you want to advertise
                  </p>
                </div>

                {/* Budget Range */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-5 h-5 text-yellow-600" />
                      Monthly Marketing Budget Range
                    </div>
                  </label>
                  <select
                    value={budgetRange}
                    onChange={(e) => setBudgetRange(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none transition"
                  >
                    <option value="">Select budget range</option>
                    <option value="0-500">$0 - $500 (Small business)</option>
                    <option value="500-2000">$500 - $2,000 (Growing business)</option>
                    <option value="2000-5000">$2,000 - $5,000 (Established business)</option>
                    <option value="5000-10000">$5,000 - $10,000 (Mid-size)</option>
                    <option value="10000+">$10,000+ (Enterprise)</option>
                  </select>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    This helps us understand your business scale
                  </p>
                </div>
              </>
            )}

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex gap-3 pt-4">
              {step > 1 && (
                <button
                  type="button"
                  onClick={prevStep}
                  className="flex-1 py-3 border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-semibold hover:bg-gray-50 dark:hover:bg-gray-700 transition flex items-center justify-center gap-2"
                >
                  <ChevronLeft className="w-5 h-5" />
                  Back
                </button>
              )}
              
              {step < totalSteps ? (
                <button
                  type="submit"
                  className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg font-semibold transition flex items-center justify-center gap-2"
                >
                  Next
                  <ChevronRight className="w-5 h-5" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg font-semibold transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading && <Loader2 className="w-5 h-5 animate-spin" />}
                  {loading ? 'Setting up...' : 'Complete Setup'}
                  <Sparkles className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* Skip Option */}
            <button
              type="button"
              onClick={() => navigate('/')}
              className="w-full py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 text-sm transition"
            >
              Skip for now
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

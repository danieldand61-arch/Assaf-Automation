import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkles, Loader2 } from 'lucide-react'
import { useAccount } from '../contexts/AccountContext'
import { useAuth } from '../contexts/AuthContext'

export function Onboarding() {
  const { user } = useAuth()
  const { createAccount, updateAccount, accounts, loading: accountsLoading } = useAccount()
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Step 1
  const [companyName, setCompanyName] = useState('')
  const [industry, setIndustry] = useState('')
  const [products, setProducts] = useState('')
  const [targetAudience, setTargetAudience] = useState('')

  // Step 2
  const [marketingGoal, setMarketingGoal] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [brandVoice, setBrandVoice] = useState('professional')

  // Step 3
  const [geographicFocus, setGeographicFocus] = useState('')
  const [budgetRange, setBudgetRange] = useState('')

  // Find existing account that needs onboarding (created by DB trigger)
  const incompleteAccount = useMemo(
    () => accounts.find(a => a.metadata?.onboarding_complete === false),
    [accounts]
  )

  // Redirect if not logged in
  useEffect(() => {
    if (!user) {
      navigate('/login', { replace: true })
    }
  }, [user, navigate])

  // Redirect if all accounts already completed onboarding
  useEffect(() => {
    if (!accountsLoading && accounts.length > 0 && !incompleteAccount) {
      navigate('/app', { replace: true })
    }
  }, [accountsLoading, accounts, incompleteAccount, navigate])

  // Pre-fill form with existing account data (if trigger created one)
  useEffect(() => {
    if (incompleteAccount) {
      if (incompleteAccount.name && !incompleteAccount.name.endsWith(' Account')) {
        setCompanyName(incompleteAccount.name)
      }
      if (incompleteAccount.industry) setIndustry(incompleteAccount.industry)
      if (incompleteAccount.description) setProducts(incompleteAccount.description)
      if (incompleteAccount.target_audience) setTargetAudience(incompleteAccount.target_audience)
      if (incompleteAccount.brand_voice) setBrandVoice(incompleteAccount.brand_voice)
      if (incompleteAccount.metadata?.marketing_goal) setMarketingGoal(incompleteAccount.metadata.marketing_goal)
      if (incompleteAccount.metadata?.website_url) setWebsiteUrl(incompleteAccount.metadata.website_url)
      if (incompleteAccount.metadata?.geographic_focus) setGeographicFocus(incompleteAccount.metadata.geographic_focus)
      if (incompleteAccount.metadata?.budget_range) setBudgetRange(incompleteAccount.metadata.budget_range)
    }
  }, [incompleteAccount])

  if (!user || accountsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <Loader2 className="w-12 h-12 animate-spin text-purple-600" />
      </div>
    )
  }

  const nextStep = () => {
    if (currentStep < 3) setCurrentStep(currentStep + 1)
  }

  const prevStep = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1)
  }

  const buildAccountData = (onboardingComplete: boolean) => ({
    name: companyName || user?.email?.split('@')[0] || 'My Business',
    description: products || undefined,
    industry: industry || undefined,
    target_audience: targetAudience || undefined,
    brand_voice: brandVoice,
    metadata: {
      marketing_goal: marketingGoal || undefined,
      website_url: websiteUrl || undefined,
      geographic_focus: geographicFocus || undefined,
      budget_range: budgetRange || undefined,
      onboarding_complete: onboardingComplete,
    }
  })

  const saveAccount = async (onboardingComplete: boolean) => {
    setLoading(true)
    setError('')

    try {
      if (incompleteAccount) {
        // UPDATE existing account (created by DB trigger)
        await updateAccount(incompleteAccount.id, buildAccountData(onboardingComplete))
      } else {
        // Fallback: CREATE new account (if trigger wasn't deployed)
        await createAccount({
          ...buildAccountData(onboardingComplete),
          metadata: { ...buildAccountData(onboardingComplete).metadata }
        })
      }
      navigate('/app', { replace: true })
    } catch (err: any) {
      console.error('❌ Onboarding error:', err)
      setError(err.response?.data?.detail || err.message || 'Failed to save. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = () => {
    if (!companyName) {
      setError('Company name is required')
      return
    }
    saveAccount(true)
  }

  const handleSkip = () => saveAccount(true)

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-purple-600 to-pink-600 rounded-2xl mb-4">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Welcome to Joyo Marketing! 🎉
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mb-3">
              Tell us about your company so we can create better marketing content for you
            </p>
            <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-sm text-blue-700 dark:text-blue-300">
              💡 <strong>Note:</strong> This information will be used as context for AI content generation. You can override it anytime by saying "don't use my company data" in your prompts.
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Step {currentStep} of 3
              </span>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {Math.round((currentStep / 3) * 100)}% Complete
              </span>
            </div>
            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-600 to-pink-600 transition-all duration-300"
                style={{ width: `${(currentStep / 3) * 100}%` }}
              />
            </div>
          </div>

          {/* Step Content */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Company Information
              </h2>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Company Name *
                </label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Acme Inc"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Industry / Niche
                </label>
                <input
                  type="text"
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="E-commerce, SaaS, Healthcare, etc."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Products / Services
                </label>
                <textarea
                  value={products}
                  onChange={(e) => setProducts(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="What do you offer?"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Target Audience
                </label>
                <input
                  type="text"
                  value={targetAudience}
                  onChange={(e) => setTargetAudience(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Small business owners, young professionals, etc."
                />
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Marketing Goals
              </h2>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Primary Marketing Goal
                </label>
                <select
                  value={marketingGoal}
                  onChange={(e) => setMarketingGoal(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="">Select a goal...</option>
                  <option value="brand_awareness">Brand Awareness</option>
                  <option value="lead_generation">Lead Generation</option>
                  <option value="sales">Sales / Conversions</option>
                  <option value="engagement">Social Media Engagement</option>
                  <option value="traffic">Website Traffic</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Website URL
                </label>
                <input
                  type="url"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="https://example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Brand Voice / Tone
                </label>
                <select
                  value={brandVoice}
                  onChange={(e) => setBrandVoice(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="professional">Professional</option>
                  <option value="casual">Casual / Friendly</option>
                  <option value="luxury">Luxury / Premium</option>
                  <option value="playful">Playful / Fun</option>
                  <option value="authoritative">Authoritative / Expert</option>
                </select>
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Location & Budget
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Where you operate and your marketing scale
              </p>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  🌍 Where is your target audience located?
                </label>
                <input
                  type="text"
                  value={geographicFocus}
                  onChange={(e) => setGeographicFocus(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="United States, Europe, Global, etc."
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Country, city, or region where you want to advertise
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  💰 Monthly Marketing Budget Range
                </label>
                <select
                  value={budgetRange}
                  onChange={(e) => setBudgetRange(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="">Select budget range...</option>
                  <option value="under_500">Under $500 (Starting out)</option>
                  <option value="500_2000">$500 - $2,000 (Growing business)</option>
                  <option value="2000_5000">$2,000 - $5,000 (Established)</option>
                  <option value="5000_10000">$5,000 - $10,000 (Scaling)</option>
                  <option value="over_10000">$10,000+ (Enterprise)</option>
                </select>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  This helps us understand your business scale
                </p>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mt-6 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex gap-4 mt-8">
            {currentStep > 1 && (
              <button
                onClick={prevStep}
                disabled={loading}
                className="flex-1 px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-semibold hover:bg-gray-300 dark:hover:bg-gray-600 transition disabled:opacity-50"
              >
                ← Back
              </button>
            )}

            {currentStep < 3 ? (
              <button
                onClick={nextStep}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-lg font-semibold shadow-lg hover:shadow-xl transition transform hover:scale-105"
              >
                Next Step →
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-lg font-semibold shadow-lg hover:shadow-xl transition transform hover:scale-105 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    Complete Setup
                  </>
                )}
              </button>
            )}
          </div>

          {/* Skip Button */}
          <button
            onClick={handleSkip}
            disabled={loading}
            className="w-full mt-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition"
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  )
}

import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkles, Loader2, Globe, Check } from 'lucide-react'
import { useAccount } from '../contexts/AccountContext'
import { useAuth } from '../contexts/AuthContext'
import { getApiUrl } from '../lib/api'

export function Onboarding() {
  const { user, session } = useAuth()
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

  // Brand Kit from URL analysis
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzed, setAnalyzed] = useState(false)
  const [brandKit, setBrandKit] = useState<any>(null)

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

  const handleAnalyzeUrl = async () => {
    if (!websiteUrl.trim() || !session) return
    setAnalyzing(true)
    setError('')
    try {
      const res = await fetch(`${getApiUrl()}/api/accounts/analyze-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ url: websiteUrl }),
      })
      if (!res.ok) throw new Error((await res.json()).detail || 'Analysis failed')
      const { brand_kit } = await res.json()
      setBrandKit(brand_kit)
      setAnalyzed(true)
      // Auto-fill fields from brand kit
      if (brand_kit.business_name && !companyName) setCompanyName(brand_kit.business_name)
      if (brand_kit.industry && !industry) setIndustry(brand_kit.industry)
      if (brand_kit.products?.length && !products) setProducts(brand_kit.products.slice(0, 5).join(', '))
      if (brand_kit.brand_voice) setBrandVoice(brand_kit.brand_voice)
    } catch (e: any) {
      setError(e.message || 'Could not analyze website')
    } finally {
      setAnalyzing(false)
    }
  }

  const buildAccountData = (onboardingComplete: boolean) => ({
    name: companyName || user?.email?.split('@')[0] || 'My Business',
    description: products || undefined,
    industry: industry || undefined,
    target_audience: targetAudience || undefined,
    brand_voice: brandVoice,
    logo_url: brandKit?.logo_url || undefined,
    brand_colors: brandKit?.brand_colors || [],
    metadata: {
      marketing_goal: marketingGoal || undefined,
      website_url: websiteUrl || undefined,
      geographic_focus: geographicFocus || undefined,
      budget_range: budgetRange || undefined,
      onboarding_complete: onboardingComplete,
      brand_kit: brandKit || undefined,
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
    <div style={{ minHeight: '100vh', background: '#F7F8FB', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, fontFamily: "'Plus Jakarta Sans','Inter',sans-serif" }}>
      <div style={{ maxWidth: 640, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
        {/* Card with gradient accent line */}
        <div style={{
          background: '#FFFFFF',
          borderRadius: 20,
          boxShadow: '0 8px 40px rgba(0,0,0,0.06)',
          overflow: 'hidden',
        }}>
          {/* Gradient accent line */}
          <div style={{ height: 4, background: 'linear-gradient(135deg, #4A7CFF, #6366F1, #8B5CF6)' }} />

          <div style={{ padding: '36px 32px 28px' }}>
            {/* Header */}
            <div className="text-center mb-8">
              <div style={{
                width: 56, height: 56, borderRadius: 16,
                background: 'linear-gradient(135deg, #4A7CFF, #8B5CF6)',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 16, boxShadow: '0 4px 16px rgba(74,124,255,0.3)'
              }}>
                <Sparkles className="w-7 h-7 text-white" />
              </div>
              <h1 style={{ fontSize: 26, fontWeight: 800, color: '#151821', marginBottom: 6 }}>
                Welcome to JOYO
              </h1>
              <p style={{ fontSize: 14, color: '#5C6478' }}>
                Tell us about your business so AI can create better content for you
              </p>
            </div>

            {/* Progress Bar */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-2">
                <span style={{ fontSize: 13, fontWeight: 600, color: '#151821' }}>
                  Step {currentStep} of 3
                </span>
                <span style={{ fontSize: 12, color: '#959DAF' }}>
                  {Math.round((currentStep / 3) * 100)}%
                </span>
              </div>
              <div style={{ height: 6, background: '#E5E9F0', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 99,
                  background: 'linear-gradient(135deg, #4A7CFF, #8B5CF6)',
                  transition: 'width 0.3s',
                  width: `${(currentStep / 3) * 100}%`,
                }} />
              </div>
            </div>

          {/* Step Content */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#151821', marginBottom: 4 }}>
                Your Business
              </h2>

              {/* URL Analyze */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: '#5C6478' }}>
                  <Globe className="inline w-4 h-4 mr-1" style={{ verticalAlign: '-2px' }} />
                  Website URL
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={websiteUrl}
                    onChange={(e) => { setWebsiteUrl(e.target.value); setAnalyzed(false) }}
                    className="flex-1 px-4 py-3 border border-gray-200 bg-white text-gray-900 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition text-sm"
                    placeholder="yourbusiness.com"
                  />
                  <button
                    type="button"
                    onClick={handleAnalyzeUrl}
                    disabled={!websiteUrl.trim() || analyzing}
                    style={{
                      padding: '0 20px', borderRadius: 12, border: 'none',
                      background: analyzed ? '#10B981' : 'linear-gradient(135deg, #4A7CFF, #8B5CF6)',
                      color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                      opacity: (!websiteUrl.trim() || analyzing) ? 0.5 : 1,
                      display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' as const,
                    }}
                  >
                    {analyzing ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing...</> :
                     analyzed ? <><Check className="w-4 h-4" /> Analyzed</> :
                     'Analyze'}
                  </button>
                </div>
                <p style={{ fontSize: 11, color: '#959DAF', marginTop: 4 }}>
                  Paste your URL and click Analyze — AI will extract your brand data automatically
                </p>
              </div>

              {/* Auto-filled brand colors preview */}
              {brandKit?.brand_colors?.length > 0 && (
                <div className="flex items-center gap-2">
                  <span style={{ fontSize: 12, color: '#5C6478', fontWeight: 600 }}>Detected colors:</span>
                  {brandKit.brand_colors.slice(0, 5).map((c: string, i: number) => (
                    <div key={i} style={{ width: 20, height: 20, borderRadius: 6, background: c, border: '1px solid #E5E9F0' }} />
                  ))}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Company Name *
                </label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 bg-white text-gray-900 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition text-sm"
                  placeholder="Acme Inc"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Industry / Niche
                </label>
                <input
                  type="text"
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 bg-white text-gray-900 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition text-sm"
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
                  className="w-full px-4 py-3 border border-gray-200 bg-white text-gray-900 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition text-sm"
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
                  className="w-full px-4 py-3 border border-gray-200 bg-white text-gray-900 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition text-sm"
                  placeholder="Small business owners, young professionals, etc."
                />
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-6">
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#151821', marginBottom: 4 }}>
                Your Industry & Goals
              </h2>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Primary Marketing Goal
                </label>
                <select
                  value={marketingGoal}
                  onChange={(e) => setMarketingGoal(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 bg-white text-gray-900 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition text-sm"
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
                  Brand Voice / Tone
                </label>
                <select
                  value={brandVoice}
                  onChange={(e) => setBrandVoice(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 bg-white text-gray-900 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition text-sm"
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
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#151821', marginBottom: 4 }}>
                Your Goals
              </h2>
              <p style={{ fontSize: 13, color: '#5C6478' }}>
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
                  className="w-full px-4 py-3 border border-gray-200 bg-white text-gray-900 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition text-sm"
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
                  className="w-full px-4 py-3 border border-gray-200 bg-white text-gray-900 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition text-sm"
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
                style={{
                  flex: 1, padding: '12px 24px', borderRadius: 12,
                  border: '1px solid #E5E9F0', background: '#FFFFFF',
                  color: '#5C6478', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                }}
              >
                Back
              </button>
            )}

            {currentStep < 3 ? (
              <button
                onClick={nextStep}
                style={{
                  flex: 1, padding: '12px 24px', borderRadius: 12,
                  border: 'none', background: 'linear-gradient(135deg, #4A7CFF, #8B5CF6)',
                  color: 'white', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                  boxShadow: '0 4px 16px rgba(74,124,255,0.3)',
                }}
              >
                Next Step
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={loading}
                style={{
                  flex: 1, padding: '12px 24px', borderRadius: 12,
                  border: 'none', background: 'linear-gradient(135deg, #4A7CFF, #8B5CF6)',
                  color: 'white', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                  boxShadow: '0 4px 16px rgba(74,124,255,0.3)',
                  opacity: loading ? 0.6 : 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                {loading ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> Creating...</>
                ) : (
                  <><Sparkles className="w-5 h-5" /> Launch my dashboard</>
                )}
              </button>
            )}
          </div>

          {/* Skip Button */}
          <button
            onClick={handleSkip}
            disabled={loading}
            style={{
              width: '100%', marginTop: 12, padding: '8px 0',
              background: 'none', border: 'none',
              color: '#959DAF', fontSize: 13, cursor: 'pointer',
            }}
          >
            Skip for now
          </button>

          </div>
        </div>

        {/* Trust badges */}
        <div style={{
          display: 'flex', justifyContent: 'center', gap: 24,
          padding: '16px 0', marginTop: 16,
        }}>
          {['No credit card needed', '100 free credits', 'Ready in 60 seconds'].map((badge, i) => (
            <span key={i} style={{ fontSize: 12, color: '#959DAF', fontWeight: 500 }}>
              {['✨', '🚀', '⚡'][i]} {badge}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

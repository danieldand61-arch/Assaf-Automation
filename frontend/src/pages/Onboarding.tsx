import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkles, Loader2, Globe, Check, Mail } from 'lucide-react'
import { useAccount } from '../contexts/AccountContext'
import { useAuth } from '../contexts/AuthContext'
import { getApiUrl } from '../lib/api'

const GOAL_OPTIONS = [
  { id: 'brand_awareness', label: 'Brand Awareness', emoji: '📢' },
  { id: 'lead_generation', label: 'Lead Generation', emoji: '🎯' },
  { id: 'sales', label: 'Sales / Conversions', emoji: '💰' },
  { id: 'engagement', label: 'Social Engagement', emoji: '❤️' },
  { id: 'traffic', label: 'Website Traffic', emoji: '🌐' },
  { id: 'retention', label: 'Customer Retention', emoji: '🔄' },
]

const VOICE_OPTIONS = [
  { id: 'professional', label: 'Professional', emoji: '👔' },
  { id: 'casual', label: 'Casual / Friendly', emoji: '😊' },
  { id: 'luxury', label: 'Luxury / Premium', emoji: '✨' },
  { id: 'playful', label: 'Playful / Fun', emoji: '🎉' },
  { id: 'authoritative', label: 'Authoritative', emoji: '📚' },
  { id: 'bold', label: 'Bold / Edgy', emoji: '🔥' },
]

const TOTAL_STEPS = 4

export function Onboarding() {
  const { user, session } = useAuth()
  const { createAccount, updateAccount, accounts, loading: accountsLoading } = useAccount()
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [websiteUrl, setWebsiteUrl] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [industry, setIndustry] = useState('')

  const [products, setProducts] = useState('')
  const [targetAudience, setTargetAudience] = useState('')
  const [geographicFocus, setGeographicFocus] = useState('')

  const [marketingGoals, setMarketingGoals] = useState<string[]>([])
  const [brandVoices, setBrandVoices] = useState<string[]>(['professional'])

  const [email, setEmail] = useState('')

  const [analyzing, setAnalyzing] = useState(false)
  const [analyzed, setAnalyzed] = useState(false)
  const [brandKit, setBrandKit] = useState<any>(null)

  const incompleteAccount = useMemo(
    () => accounts.find(a => a.metadata?.onboarding_complete === false),
    [accounts]
  )

  useEffect(() => { if (!user) navigate('/login', { replace: true }) }, [user, navigate])
  useEffect(() => {
    if (!accountsLoading && accounts.length > 0 && !incompleteAccount) navigate('/app', { replace: true })
  }, [accountsLoading, accounts, incompleteAccount, navigate])

  useEffect(() => {
    if (incompleteAccount) {
      if (incompleteAccount.name && !incompleteAccount.name.endsWith(' Account')) setCompanyName(incompleteAccount.name)
      if (incompleteAccount.industry) setIndustry(incompleteAccount.industry)
      if (incompleteAccount.description) setProducts(incompleteAccount.description)
      if (incompleteAccount.target_audience) setTargetAudience(incompleteAccount.target_audience)
      if (incompleteAccount.brand_voice) setBrandVoices([incompleteAccount.brand_voice])
      if (incompleteAccount.metadata?.marketing_goal) setMarketingGoals(
        Array.isArray(incompleteAccount.metadata.marketing_goal) ? incompleteAccount.metadata.marketing_goal : [incompleteAccount.metadata.marketing_goal]
      )
      if (incompleteAccount.metadata?.website_url) setWebsiteUrl(incompleteAccount.metadata.website_url)
      if (incompleteAccount.metadata?.geographic_focus) setGeographicFocus(incompleteAccount.metadata.geographic_focus)
    }
    if (user?.email) setEmail(user.email)
  }, [incompleteAccount, user])

  if (!user || accountsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#F7F8FB' }}>
        <Loader2 className="w-12 h-12 animate-spin text-purple-600" />
      </div>
    )
  }

  const nextStep = () => { if (currentStep < TOTAL_STEPS) setCurrentStep(currentStep + 1) }
  const prevStep = () => { if (currentStep > 1) setCurrentStep(currentStep - 1) }

  const toggleGoal = (id: string) => setMarketingGoals(prev => prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id])
  const toggleVoice = (id: string) => setBrandVoices(prev => prev.includes(id) ? prev.filter(v => v !== id) : [...prev, id])

  const handleAnalyzeUrl = async () => {
    if (!websiteUrl.trim() || !session) return
    setAnalyzing(true); setError('')
    try {
      const res = await fetch(`${getApiUrl()}/api/accounts/analyze-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ url: websiteUrl }),
      })
      if (!res.ok) throw new Error((await res.json()).detail || 'Analysis failed')
      const { brand_kit } = await res.json()
      setBrandKit(brand_kit); setAnalyzed(true)
      if (brand_kit.business_name && !companyName) setCompanyName(brand_kit.business_name)
      if (brand_kit.industry && !industry) setIndustry(brand_kit.industry)
      if (brand_kit.products?.length && !products) setProducts(brand_kit.products.slice(0, 5).join(', '))
      if (brand_kit.brand_voice) setBrandVoices([brand_kit.brand_voice])
    } catch (e: any) {
      setError(e.message || 'Could not analyze website')
    } finally { setAnalyzing(false) }
  }

  const buildAccountData = (onboardingComplete: boolean) => ({
    name: companyName || user?.email?.split('@')[0] || 'My Business',
    description: products || undefined,
    industry: industry || undefined,
    target_audience: targetAudience || undefined,
    brand_voice: brandVoices[0] || 'professional',
    logo_url: brandKit?.logo_url || undefined,
    brand_colors: brandKit?.brand_colors || [],
    metadata: {
      marketing_goal: marketingGoals.join(','),
      brand_voices: brandVoices.join(','),
      website_url: websiteUrl || undefined,
      geographic_focus: geographicFocus || undefined,
      contact_email: email || undefined,
      onboarding_complete: onboardingComplete,
      brand_kit: brandKit || undefined,
    }
  })

  const saveAccount = async (onboardingComplete: boolean) => {
    setLoading(true); setError('')
    try {
      if (incompleteAccount) {
        await updateAccount(incompleteAccount.id, buildAccountData(onboardingComplete))
      } else {
        await createAccount({ ...buildAccountData(onboardingComplete) })
      }
      navigate('/app', { replace: true })
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Failed to save.')
    } finally { setLoading(false) }
  }

  const handleSubmit = () => {
    if (!companyName) { setError('Company name is required'); return }
    saveAccount(true)
  }

  const inputCls = "w-full px-4 py-3 border border-gray-200 bg-white text-gray-900 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition text-sm"

  return (
    <div style={{ minHeight: '100vh', background: '#F7F8FB', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, fontFamily: "'Plus Jakarta Sans','Inter',sans-serif" }}>
      <div style={{ maxWidth: 640, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ background: '#FFFFFF', borderRadius: 20, boxShadow: '0 8px 40px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
          <div style={{ height: 4, background: 'linear-gradient(135deg, #4A7CFF, #6366F1, #8B5CF6)' }} />
          <div style={{ padding: '36px 32px 28px' }}>

            {/* Header */}
            <div className="text-center mb-8">
              <div style={{ width: 56, height: 56, borderRadius: 16, background: 'linear-gradient(135deg, #4A7CFF, #8B5CF6)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16, boxShadow: '0 4px 16px rgba(74,124,255,0.3)' }}>
                <Sparkles className="w-7 h-7 text-white" />
              </div>
              <h1 style={{ fontSize: 26, fontWeight: 800, color: '#151821', marginBottom: 6 }}>Welcome to JOYO</h1>
              <p style={{ fontSize: 14, color: '#5C6478' }}>Tell us about your business so AI can create better content for you</p>
            </div>

            {/* Progress */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-2">
                <span style={{ fontSize: 13, fontWeight: 600, color: '#151821' }}>Step {currentStep} of {TOTAL_STEPS}</span>
                <span style={{ fontSize: 12, color: '#959DAF' }}>{Math.round((currentStep / TOTAL_STEPS) * 100)}%</span>
              </div>
              <div style={{ height: 6, background: '#E5E9F0', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 99, background: 'linear-gradient(135deg, #4A7CFF, #8B5CF6)', transition: 'width 0.3s', width: `${(currentStep / TOTAL_STEPS) * 100}%` }} />
              </div>
            </div>

            {/* Step 1: Business Info */}
            {currentStep === 1 && (
              <div className="space-y-5">
                <h2 style={{ fontSize: 18, fontWeight: 700, color: '#151821' }}>Your Business</h2>

                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: '#5C6478' }}>
                    <Globe className="inline w-4 h-4 mr-1" style={{ verticalAlign: '-2px' }} /> Website URL
                  </label>
                  <div className="flex gap-2">
                    <input type="text" value={websiteUrl} onChange={e => { setWebsiteUrl(e.target.value); setAnalyzed(false) }} className={inputCls} style={{ flex: 1 }} placeholder="yourbusiness.com" />
                    <button type="button" onClick={handleAnalyzeUrl} disabled={!websiteUrl.trim() || analyzing}
                      style={{ padding: '0 20px', borderRadius: 12, border: 'none', background: analyzed ? '#10B981' : 'linear-gradient(135deg, #4A7CFF, #8B5CF6)', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: (!websiteUrl.trim() || analyzing) ? 0.5 : 1, display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' as const }}>
                      {analyzing ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing...</> : analyzed ? <><Check className="w-4 h-4" /> Analyzed</> : 'Analyze'}
                    </button>
                  </div>
                  <p style={{ fontSize: 11, color: '#959DAF', marginTop: 4 }}>Paste your URL and click Analyze — AI will extract your brand data automatically</p>
                </div>

                {brandKit?.brand_colors?.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span style={{ fontSize: 12, color: '#5C6478', fontWeight: 600 }}>Detected colors:</span>
                    {brandKit.brand_colors.slice(0, 6).map((c: string, i: number) => (
                      <div key={i} style={{ width: 22, height: 22, borderRadius: 6, background: c, border: '1px solid #E5E9F0' }} />
                    ))}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Company Name *</label>
                  <input type="text" value={companyName} onChange={e => setCompanyName(e.target.value)} className={inputCls} placeholder="Acme Inc" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Industry / Niche</label>
                  <input type="text" value={industry} onChange={e => setIndustry(e.target.value)} className={inputCls} placeholder="E-commerce, SaaS, Healthcare, etc." />
                </div>
              </div>
            )}

            {/* Step 2: Products & Audience */}
            {currentStep === 2 && (
              <div className="space-y-5">
                <h2 style={{ fontSize: 18, fontWeight: 700, color: '#151821' }}>Products & Audience</h2>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Products / Services</label>
                  <textarea value={products} onChange={e => setProducts(e.target.value)} rows={3} className={inputCls} placeholder="Describe what you offer..." />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Target Audience</label>
                  <input type="text" value={targetAudience} onChange={e => setTargetAudience(e.target.value)} className={inputCls} placeholder="Small business owners, young professionals, etc." />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Geographic Focus</label>
                  <input type="text" value={geographicFocus} onChange={e => setGeographicFocus(e.target.value)} className={inputCls} placeholder="United States, Europe, Global, etc." />
                </div>
              </div>
            )}

            {/* Step 3: Goals & Voice — multi-select buttons */}
            {currentStep === 3 && (
              <div className="space-y-6">
                <h2 style={{ fontSize: 18, fontWeight: 700, color: '#151821' }}>Your Industry & Goals</h2>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">Primary Marketing Goals <span style={{ fontSize: 11, color: '#959DAF' }}>(select multiple)</span></label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {GOAL_OPTIONS.map(g => {
                      const active = marketingGoals.includes(g.id)
                      return (
                        <button key={g.id} type="button" onClick={() => toggleGoal(g.id)}
                          className="relative flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition border-2"
                          style={{ borderColor: active ? '#4A7CFF' : '#E5E9F0', background: active ? '#4A7CFF10' : '#FAFBFC', color: active ? '#4A7CFF' : '#5C6478' }}>
                          {active && <Check size={14} className="absolute top-1.5 right-1.5" style={{ color: '#4A7CFF' }} />}
                          <span>{g.emoji}</span> {g.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">Brand Voice / Tone <span style={{ fontSize: 11, color: '#959DAF' }}>(select multiple)</span></label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {VOICE_OPTIONS.map(v => {
                      const active = brandVoices.includes(v.id)
                      return (
                        <button key={v.id} type="button" onClick={() => toggleVoice(v.id)}
                          className="relative flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition border-2"
                          style={{ borderColor: active ? '#8B5CF6' : '#E5E9F0', background: active ? '#8B5CF610' : '#FAFBFC', color: active ? '#8B5CF6' : '#5C6478' }}>
                          {active && <Check size={14} className="absolute top-1.5 right-1.5" style={{ color: '#8B5CF6' }} />}
                          <span>{v.emoji}</span> {v.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: Email */}
            {currentStep === 4 && (
              <div className="space-y-6">
                <h2 style={{ fontSize: 18, fontWeight: 700, color: '#151821' }}>Almost there!</h2>
                <p style={{ fontSize: 14, color: '#5C6478' }}>Confirm your email to get started</p>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Mail className="inline w-4 h-4 mr-1" style={{ verticalAlign: '-2px' }} /> Email Address
                  </label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={inputCls} placeholder="your@email.com" />
                </div>

                <div style={{ background: '#F0F4FF', borderRadius: 14, padding: '16px 20px' }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#4A7CFF', marginBottom: 8 }}>Your setup summary:</p>
                  <div className="space-y-1 text-sm" style={{ color: '#5C6478' }}>
                    {companyName && <p>🏢 {companyName} {industry ? `· ${industry}` : ''}</p>}
                    {marketingGoals.length > 0 && <p>🎯 {marketingGoals.map(g => GOAL_OPTIONS.find(o => o.id === g)?.label).join(', ')}</p>}
                    {brandVoices.length > 0 && <p>🗣️ {brandVoices.map(v => VOICE_OPTIONS.find(o => o.id === v)?.label).join(', ')}</p>}
                    {geographicFocus && <p>🌍 {geographicFocus}</p>}
                  </div>
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="mt-6 bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">{error}</div>
            )}

            {/* Navigation */}
            <div className="flex gap-4 mt-8">
              {currentStep > 1 && (
                <button onClick={prevStep} disabled={loading}
                  style={{ flex: 1, padding: '12px 24px', borderRadius: 12, border: '1px solid #E5E9F0', background: '#FFFFFF', color: '#5C6478', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                  Back
                </button>
              )}
              {currentStep < TOTAL_STEPS ? (
                <button onClick={nextStep}
                  style={{ flex: 1, padding: '12px 24px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg, #4A7CFF, #8B5CF6)', color: 'white', fontSize: 14, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 16px rgba(74,124,255,0.3)' }}>
                  Next Step
                </button>
              ) : (
                <button onClick={handleSubmit} disabled={loading}
                  style={{ flex: 1, padding: '12px 24px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg, #4A7CFF, #8B5CF6)', color: 'white', fontSize: 14, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 16px rgba(74,124,255,0.3)', opacity: loading ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  {loading ? <><Loader2 className="w-5 h-5 animate-spin" /> Creating...</> : <><Sparkles className="w-5 h-5" /> Launch my dashboard</>}
                </button>
              )}
            </div>

            <button onClick={() => saveAccount(true)} disabled={loading}
              style={{ width: '100%', marginTop: 12, padding: '8px 0', background: 'none', border: 'none', color: '#959DAF', fontSize: 13, cursor: 'pointer' }}>
              Skip for now
            </button>

          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 24, padding: '16px 0', marginTop: 16 }}>
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

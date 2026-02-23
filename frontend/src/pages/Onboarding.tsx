import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkles, Loader2, Globe, Check, Mail, Link2 } from 'lucide-react'
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

const TOTAL_STEPS = 5

const PLATFORMS_LIST = [
  { id: 'facebook', label: 'Facebook', icon: '📘', oauth: true },
  { id: 'instagram', label: 'Instagram', icon: '📸', oauth: true },
  { id: 'linkedin', label: 'LinkedIn', icon: '💼', oauth: true },
  { id: 'tiktok', label: 'TikTok', icon: '🎵', oauth: true },
  { id: 'x', label: 'X (Twitter)', icon: '🐦', oauth: true },
  { id: 'google_business', label: 'Google Business', icon: '📍', oauth: false },
  { id: 'meta_ads', label: 'Meta Ads', icon: '📊', oauth: true },
  { id: 'google_ads', label: 'Google Ads', icon: '📈', oauth: false },
]

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
  const [marketingGoals, setMarketingGoals] = useState<string[]>([])
  const [brandVoices, setBrandVoices] = useState<string[]>(['professional'])
  const [email, setEmail] = useState('')

  const [analyzing, setAnalyzing] = useState(false)
  const [brandKit, setBrandKit] = useState<any>(null)
  const [connectedPlatforms, setConnectedPlatforms] = useState<string[]>([])
  const [connectingPlatform, setConnectingPlatform] = useState<string | null>(null)

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== 'oauth_result' || !e.newValue) return
      try {
        const { platform, error: oauthErr } = JSON.parse(e.newValue)
        if (oauthErr) { setError(`Connection failed: ${oauthErr}`) }
        else if (platform) { setConnectedPlatforms(prev => prev.includes(platform) ? prev : [...prev, platform]) }
      } catch { /* ignore */ }
      setConnectingPlatform(null)
      localStorage.removeItem('oauth_result')
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

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
      if (incompleteAccount.brand_voice) setBrandVoices([incompleteAccount.brand_voice])
      if (incompleteAccount.metadata?.marketing_goal) setMarketingGoals(
        Array.isArray(incompleteAccount.metadata.marketing_goal) ? incompleteAccount.metadata.marketing_goal : [incompleteAccount.metadata.marketing_goal]
      )
      if (incompleteAccount.metadata?.website_url) setWebsiteUrl(incompleteAccount.metadata.website_url)
      if (incompleteAccount.metadata?.brand_kit) setBrandKit(incompleteAccount.metadata.brand_kit)
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

  const analyzeAndNext = async () => {
    setError('')
    if (websiteUrl.trim() && session && !brandKit) {
      setAnalyzing(true)
      try {
        let url = websiteUrl.trim()
        if (!/^https?:\/\//i.test(url)) url = `https://${url}`
        const res = await fetch(`${getApiUrl()}/api/accounts/analyze-url`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
          body: JSON.stringify({ url }),
        })
        if (!res.ok) throw new Error((await res.json()).detail || 'Analysis failed')
        const { brand_kit } = await res.json()
        setBrandKit(brand_kit)
        if (brand_kit.business_name) setCompanyName(brand_kit.business_name)
        if (brand_kit.industry) setIndustry(brand_kit.industry)
        if (brand_kit.products?.length) setProducts(brand_kit.products.slice(0, 5).join(', '))
        if (brand_kit.description && !products) setProducts(brand_kit.description.slice(0, 300))
        if (brand_kit.brand_voice) setBrandVoices([brand_kit.brand_voice])
      } catch (e: any) {
        setError(e.message || 'Could not analyze website — you can fill details manually')
      } finally { setAnalyzing(false) }
    }
    setCurrentStep(2)
  }

  const validateStep = (step: number): string | null => {
    if (step === 2 && !companyName.trim()) return 'Company name is required'
    if (step === 3 && marketingGoals.length === 0) return 'Select at least one marketing goal'
    return null
  }

  const nextStep = () => {
    if (currentStep === 1) { analyzeAndNext(); return }
    const err = validateStep(currentStep)
    if (err) { setError(err); return }
    setError('')
    if (currentStep < TOTAL_STEPS) setCurrentStep(currentStep + 1)
  }
  const prevStep = () => { setError(''); if (currentStep > 1) setCurrentStep(currentStep - 1) }

  const toggleGoal = (id: string) => setMarketingGoals(prev => prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id])
  const toggleVoice = (id: string) => setBrandVoices(prev => prev.includes(id) ? prev.filter(v => v !== id) : [...prev, id])

  const buildAccountData = (onboardingComplete: boolean) => {
    const mergedBrandKit = {
      ...(brandKit || {}),
      business_name: companyName || brandKit?.business_name,
      industry: industry || brandKit?.industry,
      description: products || brandKit?.description,
      products: products ? products.split(',').map((s: string) => s.trim()).filter(Boolean) : (brandKit?.products || []),
      website_url: websiteUrl || brandKit?.website_url,
    }
    return {
      name: companyName || user?.email?.split('@')[0] || 'My Business',
      description: products || undefined,
      industry: industry || undefined,
      brand_voice: brandVoices[0] || 'professional',
      logo_url: brandKit?.logo_url || undefined,
      brand_colors: brandKit?.brand_colors || [],
      metadata: {
        marketing_goal: marketingGoals.join(','),
        brand_voices: brandVoices.join(','),
        website_url: websiteUrl || undefined,
        contact_email: email || undefined,
        onboarding_complete: onboardingComplete,
        brand_kit: mergedBrandKit,
        scraped_description: brandKit?.description || brandKit?.content_preview || undefined,
      }
    }
  }

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

  const handleSubmit = () => saveAccount(true)

  const handleConnectPlatform = async (platformId: string) => {
    if (connectingPlatform) return

    // Open popup SYNCHRONOUSLY (before any await) to avoid browser popup blocker
    const popup = window.open('about:blank', '_blank', 'width=600,height=700,left=200,top=100')

    setConnectingPlatform(platformId)
    setError('')
    try {
      if (incompleteAccount) {
        await updateAccount(incompleteAccount.id, buildAccountData(true))
      } else if (!accounts.some(a => a.metadata?.onboarding_complete)) {
        await createAccount({ ...buildAccountData(true) })
      }

      const apiUrl = getApiUrl()
      const endpoint = platformId === 'meta_ads'
        ? `${apiUrl}/api/social/meta-ads/connect`
        : platformId === 'google_ads'
          ? `${apiUrl}/api/google-ads/oauth/init`
          : `${apiUrl}/api/social/${platformId}/connect`
      const res = await fetch(endpoint, {
        headers: { 'Authorization': `Bearer ${session?.access_token}` },
      })
      if (!res.ok) throw new Error('Failed to start OAuth')
      const data = await res.json()
      localStorage.removeItem('oauth_result')

      if (popup && !popup.closed) {
        popup.location.href = data.auth_url
        const timer = setInterval(() => {
          if (popup.closed) { clearInterval(timer); setConnectingPlatform(null) }
        }, 500)
      } else {
        window.location.href = data.auth_url
      }
    } catch (err: any) {
      if (popup && !popup.closed) popup.close()
      setError(err.message || 'Connection failed')
      setConnectingPlatform(null)
    }
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

            {/* Step 1: Website URL only */}
            {currentStep === 1 && (
              <div className="space-y-5">
                <h2 style={{ fontSize: 18, fontWeight: 700, color: '#151821' }}>Your Website</h2>
                <p style={{ fontSize: 14, color: '#5C6478' }}>Paste your website URL — AI will automatically extract your business info</p>

                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: '#5C6478' }}>
                    <Globe className="inline w-4 h-4 mr-1" style={{ verticalAlign: '-2px' }} /> Website URL
                  </label>
                  <input type="text" value={websiteUrl} onChange={e => { setWebsiteUrl(e.target.value); setBrandKit(null) }} className={inputCls} placeholder="yourbusiness.com" />
                  <p style={{ fontSize: 11, color: '#959DAF', marginTop: 6 }}>Don't have a website? No problem — click Next and fill in your info manually</p>
                </div>

                {analyzing && (
                  <div className="flex items-center gap-3 p-4 rounded-xl" style={{ background: '#F0F4FF' }}>
                    <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                    <span style={{ fontSize: 14, color: '#4A7CFF', fontWeight: 600 }}>Analyzing your website...</span>
                  </div>
                )}
              </div>
            )}

            {/* Step 2: Business Details (pre-filled from analysis) */}
            {currentStep === 2 && (
              <div className="space-y-5">
                <h2 style={{ fontSize: 18, fontWeight: 700, color: '#151821' }}>Your Business</h2>
                {brandKit && (
                  <div className="flex items-center gap-2 p-3 rounded-xl" style={{ background: '#ECFDF5', border: '1px solid #A7F3D0' }}>
                    <Check size={16} className="text-green-600" />
                    <span style={{ fontSize: 13, color: '#059669', fontWeight: 600 }}>Website analyzed — we pre-filled what we found</span>
                  </div>
                )}

                {brandKit?.brand_colors?.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span style={{ fontSize: 12, color: '#5C6478', fontWeight: 600 }}>Brand colors:</span>
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
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Products / Services</label>
                  <textarea value={products} onChange={e => setProducts(e.target.value)} rows={3} className={inputCls} placeholder="Describe what you offer..." />
                </div>
              </div>
            )}

            {/* Step 3: Goals & Voice */}
            {currentStep === 3 && (
              <div className="space-y-6">
                <h2 style={{ fontSize: 18, fontWeight: 700, color: '#151821' }}>Goals & Voice</h2>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">Marketing Goals <span style={{ fontSize: 11, color: '#959DAF' }}>(select multiple)</span></label>
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
                  <label className="block text-sm font-medium text-gray-700 mb-3">Brand Voice <span style={{ fontSize: 11, color: '#959DAF' }}>(select multiple)</span></label>
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

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Mail className="inline w-4 h-4 mr-1" style={{ verticalAlign: '-2px' }} /> Email Address
                  </label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={inputCls} placeholder="your@email.com" />
                </div>

                <div style={{ background: '#F0F4FF', borderRadius: 14, padding: '16px 20px' }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#4A7CFF', marginBottom: 8 }}>Summary:</p>
                  <div className="space-y-1 text-sm" style={{ color: '#5C6478' }}>
                    {companyName && <p>🏢 {companyName} {industry ? `· ${industry}` : ''}</p>}
                    {marketingGoals.length > 0 && <p>🎯 {marketingGoals.map(g => GOAL_OPTIONS.find(o => o.id === g)?.label).join(', ')}</p>}
                    {brandVoices.length > 0 && <p>🗣️ {brandVoices.map(v => VOICE_OPTIONS.find(o => o.id === v)?.label).join(', ')}</p>}
                    {websiteUrl && <p>🌐 {websiteUrl}</p>}
                  </div>
                </div>
              </div>
            )}

            {/* Step 5: Connect Platforms — click to OAuth */}
            {currentStep === 5 && (
              <div className="space-y-6">
                <h2 style={{ fontSize: 18, fontWeight: 700, color: '#151821' }}>
                  <Link2 className="inline w-5 h-5 mr-2" style={{ verticalAlign: '-3px' }} />
                  Connect Your Platforms
                </h2>
                <p style={{ fontSize: 14, color: '#5C6478' }}>Click a platform to connect it. You can connect more later in Settings.</p>

                <div className="grid grid-cols-2 gap-3">
                  {PLATFORMS_LIST.map(p => {
                    const connected = connectedPlatforms.includes(p.id)
                    const connecting = connectingPlatform === p.id
                    const disabled = connecting || connected || !p.oauth
                    return (
                      <button key={p.id} type="button" disabled={disabled}
                        onClick={() => p.oauth && handleConnectPlatform(p.id)}
                        className="relative flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition border-2"
                        style={{
                          borderColor: connected ? '#10B981' : connecting ? '#4A7CFF' : '#E5E9F0',
                          background: connected ? '#ECFDF5' : connecting ? '#4A7CFF10' : '#FAFBFC',
                          color: connected ? '#059669' : connecting ? '#4A7CFF' : !p.oauth ? '#B0B8C9' : '#5C6478',
                          opacity: connecting || !p.oauth ? 0.6 : 1,
                        }}>
                        {connected && <Check size={14} className="absolute top-1.5 right-1.5" style={{ color: '#10B981' }} />}
                        {connecting && <Loader2 size={14} className="absolute top-1.5 right-1.5 animate-spin" style={{ color: '#4A7CFF' }} />}
                        <span style={{ fontSize: 20 }}>{p.icon}</span>
                        <span>{connected ? `${p.label} ✓` : connecting ? 'Connecting...' : !p.oauth ? `${p.label} (Settings)` : p.label}</span>
                      </button>
                    )
                  })}
                </div>

                <p style={{ fontSize: 12, color: '#959DAF', textAlign: 'center' }}>
                  You can always connect more platforms later in Integrations
                </p>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="mt-6 bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">{error}</div>
            )}

            {/* Navigation */}
            <div className="flex gap-4 mt-8">
              {currentStep > 1 && (
                <button onClick={prevStep} disabled={loading || analyzing}
                  style={{ flex: 1, padding: '12px 24px', borderRadius: 12, border: '1px solid #E5E9F0', background: '#FFFFFF', color: '#5C6478', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                  Back
                </button>
              )}
              {currentStep < TOTAL_STEPS ? (
                <button onClick={nextStep} disabled={analyzing}
                  style={{ flex: 1, padding: '12px 24px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg, #4A7CFF, #8B5CF6)', color: 'white', fontSize: 14, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 16px rgba(74,124,255,0.3)', opacity: analyzing ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  {analyzing ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing...</> : 'Next Step'}
                </button>
              ) : (
                <button onClick={handleSubmit} disabled={loading}
                  style={{ flex: 1, padding: '12px 24px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg, #4A7CFF, #8B5CF6)', color: 'white', fontSize: 14, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 16px rgba(74,124,255,0.3)', opacity: loading ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  {loading ? <><Loader2 className="w-5 h-5 animate-spin" /> Creating...</> : <><Sparkles className="w-5 h-5" /> Launch my dashboard</>}
                </button>
              )}
            </div>

            <button onClick={() => saveAccount(true)} disabled={loading || analyzing}
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

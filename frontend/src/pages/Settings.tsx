import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useAccount } from '../contexts/AccountContext'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Connections } from './Connections'
import { CreditsUsage } from './CreditsUsage'
import { ArrowLeft, Loader2, Globe } from 'lucide-react'
import { getApiUrl } from '../lib/api'

type Tab = 'brandkit' | 'connections' | 'profile' | 'accounts' | 'credits'

export function Settings() {
  const { user } = useAuth()
  const { activeAccount } = useAccount()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState<Tab>('brandkit')

  // Read tab from URL params
  useEffect(() => {
    const tabParam = searchParams.get('tab')
    if (tabParam === 'brandkit' || tabParam === 'brand-kit') {
      setActiveTab('brandkit')
    } else if (tabParam === 'social' || tabParam === 'connections') {
      setActiveTab('connections')
    } else if (tabParam === 'profile') {
      setActiveTab('profile')
    } else if (tabParam === 'accounts') {
      setActiveTab('accounts')
    } else if (tabParam === 'credits') {
      setActiveTab('credits')
    }

    // Show error/success notifications
    const error = searchParams.get('error')
    const success = searchParams.get('success')
    
    if (error) {
      // You can use toast notifications here
      console.error('Connection error:', error)
      alert(`Connection failed: ${error}`)
    }
    
    if (success) {
      console.log('Connection successful:', success)
      alert(`Successfully connected ${success}!`)
    }
  }, [searchParams])

  if (!user) {
    navigate('/login', { replace: true })
    return null
  }

  const tabs = [
    {
      id: 'brandkit' as Tab,
      name: 'Brand Kit',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
        </svg>
      )
    },
    {
      id: 'connections' as Tab,
      name: 'Integrations',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
      )
    },
    {
      id: 'credits' as Tab,
      name: 'Credits Usage',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    },
    {
      id: 'profile' as Tab,
      name: 'Profile',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      )
    },
    {
      id: 'accounts' as Tab,
      name: 'Business Accounts',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      )
    }
  ]

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={() => navigate('/app')}
              className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="font-medium">Back to App</span>
            </button>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Settings
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage your account settings and preferences
          </p>
          {activeAccount && (
            <p className="text-sm text-purple-600 dark:text-purple-400 mt-2">
              Current account: <strong>{activeAccount.name}</strong>
            </p>
          )}
        </div>

        <div className="flex flex-col md:flex-row gap-6">
          {/* Sidebar Tabs */}
          <div className="w-full md:w-64 flex-shrink-0">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
              <nav className="flex flex-col">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`
                      flex items-center gap-3 px-6 py-4 text-left transition-all
                      ${activeTab === tab.id
                        ? 'bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 border-l-4 border-purple-600'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 border-l-4 border-transparent'
                      }
                    `}
                  >
                    {tab.icon}
                    <span className="font-medium">{tab.name}</span>
                  </button>
                ))}
              </nav>
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1">
            {activeTab === 'brandkit' && (
              <BrandKitTab />
            )}
            {activeTab === 'connections' && (
              <ConnectionsTab />
            )}
            {activeTab === 'credits' && (
              <CreditsTab />
            )}
            {activeTab === 'profile' && (
              <ProfileTab />
            )}
            {activeTab === 'accounts' && (
              <AccountsTab />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// Brand Kit Tab
function BrandKitTab() {
  const { activeAccount, updateAccount } = useAccount()
  const { session } = useAuth()
  const bk = activeAccount?.metadata?.brand_kit || {}

  const [name, setName] = useState(activeAccount?.name || '')
  const [industry, setIndustry] = useState(activeAccount?.industry || '')
  const [description, setDescription] = useState(activeAccount?.description || '')
  const [voice, setVoice] = useState(activeAccount?.brand_voice || 'professional')
  const [logoUrl, setLogoUrl] = useState(activeAccount?.logo_url || '')
  const [colors, setColors] = useState<string[]>(activeAccount?.brand_colors || [])
  const [websiteUrl, setWebsiteUrl] = useState(bk.website_url || activeAccount?.metadata?.website_url || '')
  const [products, setProducts] = useState((bk.products || []).join(', '))
  const [features, setFeatures] = useState((bk.key_features || []).join(', '))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)

  const handleReAnalyze = async () => {
    if (!websiteUrl.trim() || !session) return
    setAnalyzing(true)
    try {
      let url = websiteUrl.trim()
      if (!/^https?:\/\//.test(url)) url = `https://${url}`
      const res = await fetch(`${getApiUrl()}/api/accounts/analyze-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ url }),
      })
      if (!res.ok) throw new Error('Analysis failed')
      const { brand_kit } = await res.json()
      if (brand_kit.business_name) setName(brand_kit.business_name)
      if (brand_kit.industry) setIndustry(brand_kit.industry)
      if (brand_kit.description) setDescription(brand_kit.description)
      if (brand_kit.brand_voice) setVoice(brand_kit.brand_voice)
      if (brand_kit.logo_url) setLogoUrl(brand_kit.logo_url)
      if (brand_kit.brand_colors?.length) setColors(brand_kit.brand_colors)
      if (brand_kit.products?.length) setProducts(brand_kit.products.join(', '))
      if (brand_kit.key_features?.length) setFeatures(brand_kit.key_features.join(', '))
    } catch { alert('Could not analyze website') }
    finally { setAnalyzing(false) }
  }

  const handleSave = async () => {
    if (!activeAccount) return
    setSaving(true)
    try {
      await updateAccount(activeAccount.id, {
        name, industry, description, brand_voice: voice,
        logo_url: logoUrl || undefined,
        brand_colors: colors,
        metadata: {
          ...activeAccount.metadata,
          website_url: websiteUrl,
          brand_kit: {
            business_name: name, industry, description,
            brand_voice: voice, logo_url: logoUrl,
            brand_colors: colors, website_url: websiteUrl,
            products: products.split(',').map((s: string) => s.trim()).filter(Boolean),
            key_features: features.split(',').map((s: string) => s.trim()).filter(Boolean),
          }
        }
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch { alert('Failed to save') }
    finally { setSaving(false) }
  }

  const fieldCls = "w-full px-4 py-2.5 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition text-sm"

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Brand Kit</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        This data is used by AI when generating posts, ads, and images for your brand.
      </p>

      <div className="space-y-5">
        {/* Re-analyze URL */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Website URL</label>
          <div className="flex gap-2">
            <input value={websiteUrl} onChange={e => setWebsiteUrl(e.target.value)} className={fieldCls + ' flex-1'} placeholder="yourbusiness.com" />
            <button onClick={handleReAnalyze} disabled={analyzing || !websiteUrl.trim()}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-40 flex items-center gap-1.5"
              style={{ background: 'linear-gradient(135deg, #4A7CFF, #8B5CF6)' }}
            >
              {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
              {analyzing ? 'Analyzing...' : 'Re-analyze'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Business Name</label>
            <input value={name} onChange={e => setName(e.target.value)} className={fieldCls} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Industry</label>
            <input value={industry} onChange={e => setIndustry(e.target.value)} className={fieldCls} />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Description</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} className={fieldCls + ' resize-none'} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Brand Voice</label>
            <select value={voice} onChange={e => setVoice(e.target.value)} className={fieldCls}>
              <option value="professional">Professional</option>
              <option value="casual">Casual / Friendly</option>
              <option value="luxury">Luxury / Premium</option>
              <option value="playful">Playful / Fun</option>
              <option value="authoritative">Authoritative / Expert</option>
              <option value="balanced">Balanced</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Logo URL</label>
            <input value={logoUrl} onChange={e => setLogoUrl(e.target.value)} className={fieldCls} placeholder="https://..." />
          </div>
        </div>

        {/* Colors */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Brand Colors</label>
          <div className="flex items-center gap-2 flex-wrap">
            {colors.map((c, i) => (
              <div key={i} className="flex items-center gap-1 px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-600">
                <div style={{ width: 16, height: 16, borderRadius: 4, background: c }} />
                <input value={c} onChange={e => { const nc = [...colors]; nc[i] = e.target.value; setColors(nc) }}
                  className="w-20 text-xs bg-transparent outline-none" />
                <button onClick={() => setColors(colors.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-500 text-xs">&times;</button>
              </div>
            ))}
            <button onClick={() => setColors([...colors, '#000000'])} className="text-xs text-blue-500 hover:text-blue-600 font-medium">+ Add</button>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Products / Services (comma-separated)</label>
          <input value={products} onChange={e => setProducts(e.target.value)} className={fieldCls} placeholder="Product A, Service B, ..." />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Key Features (comma-separated)</label>
          <input value={features} onChange={e => setFeatures(e.target.value)} className={fieldCls} placeholder="Fast delivery, 24/7 support, ..." />
        </div>

        <button onClick={handleSave} disabled={saving}
          className="w-full py-3 rounded-xl text-sm font-bold text-white transition disabled:opacity-50"
          style={{ background: saved ? '#10B981' : 'linear-gradient(135deg, #4A7CFF, #8B5CF6)' }}
        >
          {saving ? 'Saving...' : saved ? 'Saved ✓' : 'Save Brand Kit'}
        </button>
      </div>
    </div>
  )
}

// Connections Tab (uses existing Connections component)
function ConnectionsTab() {
  return <Connections />
}

// Credits Tab (uses existing CreditsUsage component)
function CreditsTab() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        Credits Usage & Billing
      </h2>
      <CreditsUsage />
    </div>
  )
}

// Profile Tab
function ProfileTab() {
  const { user } = useAuth()

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        Profile Settings
      </h2>

      <div className="space-y-6">
        {/* User Info */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Email
          </label>
          <input
            type="email"
            value={user?.email || ''}
            disabled
            className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Email cannot be changed
          </p>
        </div>

        {/* Full Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Full Name
          </label>
          <input
            type="text"
            value={user?.user_metadata?.full_name || ''}
            disabled
            className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
          />
        </div>

        {/* Coming Soon Notice */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 p-4 rounded-lg">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <div>
              <h3 className="font-semibold text-blue-900 dark:text-blue-200">
                More settings coming soon!
              </h3>
              <p className="text-sm text-blue-800 dark:text-blue-300 mt-1">
                Profile editing, password change, and notification preferences will be available in the next update.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Accounts Tab
function AccountsTab() {
  const { accounts } = useAccount()

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        Business Accounts
      </h2>

      <div className="space-y-4">
        {accounts.map((account) => (
          <div
            key={account.id}
            className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg"
          >
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">
                {account.name}
              </h3>
              {account.description && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {account.description}
                </p>
              )}
            </div>
            <span className="text-sm text-green-600 dark:text-green-400 font-medium">
              Active
            </span>
          </div>
        ))}

        {accounts.length === 0 && (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            No business accounts found
          </div>
        )}

        {/* Coming Soon Notice */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 p-4 rounded-lg mt-6">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <div>
              <h3 className="font-semibold text-blue-900 dark:text-blue-200">
                Account management coming soon!
              </h3>
              <p className="text-sm text-blue-800 dark:text-blue-300 mt-1">
                Create, edit, and delete business accounts. Switch between accounts easily.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

import { Sparkles, Zap, Users, Image as ImageIcon, ArrowRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useAccount } from '../contexts/AccountContext'

export function LandingPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { accounts, loading: accountsLoading } = useAccount()

  const handleGetStarted = () => {
    if (!user) {
      // Not logged in -> go to signup (FIRST!)
      navigate('/signup')
    } else if (accounts.length === 0 && !accountsLoading) {
      // Logged in but no accounts -> go to onboarding
      navigate('/onboarding')
    } else {
      // Logged in with accounts -> go to app
      navigate('/app')
    }
  }
  
  // Button text based on state
  const getButtonText = () => {
    if (!user) return 'Get Started Free'
    if (accountsLoading) return 'Loading...'
    if (accounts.length === 0) return 'Complete Setup'
    return 'Go to App'
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Joyo Marketing</h1>
              <p className="text-xs text-gray-600 dark:text-gray-400">AI-Powered Marketing Automation</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {user ? (
              <>
                {accounts.length === 0 && !accountsLoading && (
                  <button
                    onClick={() => navigate('/onboarding')}
                    className="px-4 py-2 text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 transition font-medium"
                  >
                    Complete Setup
                  </button>
                )}
                <button
                  onClick={() => navigate('/app')}
                  className="px-6 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold hover:shadow-lg transition"
                >
                  {accounts.length === 0 ? 'Skip to App' : 'Go to App'}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => navigate('/login')}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-purple-600 dark:hover:text-purple-400 transition"
                >
                  Login
                </button>
                <button
                  onClick={() => navigate('/signup')}
                  className="px-6 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold hover:shadow-lg transition"
                >
                  Sign Up
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-purple-600 to-pink-600 rounded-3xl mb-8 shadow-2xl">
            <Sparkles className="w-10 h-10 text-white" />
          </div>
          
          <h1 className="text-5xl font-bold text-gray-900 dark:text-white mb-4">
            Create Stunning Social Posts
          </h1>
          <p className="text-2xl text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600 font-semibold mb-6">
            in Seconds, Not Hours
          </p>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto mb-12">
            Transform any website into engaging social media content with AI. Generate posts, images, and captions tailored for Instagram, Facebook, LinkedIn, and more.
          </p>

          <button
            onClick={handleGetStarted}
            disabled={accountsLoading}
            className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white text-lg font-semibold rounded-xl shadow-xl hover:shadow-2xl transition transform hover:scale-105 disabled:opacity-50"
          >
            <Sparkles className="w-6 h-6" />
            {getButtonText()}
            <ArrowRight className="w-5 h-5" />
          </button>

          <div className="flex items-center justify-center gap-6 text-sm text-gray-600 dark:text-gray-400 mt-8">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              No credit card required
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              Start generating in 30 seconds
            </div>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-8 mt-16">
          {/* AI-Powered Generation */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-xl border border-gray-200 dark:border-gray-700 hover:shadow-2xl transition">
            <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl flex items-center justify-center mb-6">
              <Zap className="w-7 h-7 text-white" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              AI-Powered Generation
            </h3>
            <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
              Advanced AI analyzes your website and generates perfectly crafted posts optimized for engagement. Multiple variations for A/B testing.
            </p>
          </div>

          {/* Multi-Platform Support */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-xl border border-gray-200 dark:border-gray-700 hover:shadow-2xl transition">
            <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center mb-6">
              <Users className="w-7 h-7 text-white" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Multi-Platform Support
            </h3>
            <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
              Create content optimized for Instagram, Facebook, LinkedIn, Twitter, and TikTok. Each platform gets tailored copy and formatting.
            </p>
          </div>

          {/* Custom Image Generation */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-xl border border-gray-200 dark:border-gray-700 hover:shadow-2xl transition">
            <div className="w-14 h-14 bg-gradient-to-br from-pink-500 to-red-500 rounded-xl flex items-center justify-center mb-6">
              <ImageIcon className="w-7 h-7 text-white" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Custom Image Generation
            </h3>
            <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
              Generate eye-catching images that match your brand. AI creates unique visuals or enhances your existing photos.
            </p>
          </div>
        </div>

        {/* Additional Features */}
        <div className="mt-16 bg-white dark:bg-gray-800 rounded-2xl p-12 shadow-xl border border-gray-200 dark:border-gray-700">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-8 text-center">
            Everything You Need to Scale Your Social Media
          </h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="flex gap-4">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
              </div>
              <div>
                <h4 className="font-bold text-gray-900 dark:text-white mb-2">Google Ads Generation</h4>
                <p className="text-gray-600 dark:text-gray-300">Create high-performing Google Ads campaigns with AI-optimized headlines and descriptions.</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
              </div>
              <div>
                <h4 className="font-bold text-gray-900 dark:text-white mb-2">Video Translation</h4>
                <p className="text-gray-600 dark:text-gray-300">Translate and dub your videos into multiple languages with AI-powered voice cloning.</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-violet-500 rounded-lg flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
              </div>
              <div>
                <h4 className="font-bold text-gray-900 dark:text-white mb-2">AI Chat Assistant</h4>
                <p className="text-gray-600 dark:text-gray-300">Chat with AI to generate content, get marketing advice, and optimize your campaigns.</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
              </div>
              <div>
                <h4 className="font-bold text-gray-900 dark:text-white mb-2">Smart Scheduling</h4>
                <p className="text-gray-600 dark:text-gray-300">Schedule posts across all platforms with optimal timing suggestions based on your audience.</p>
              </div>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="mt-16 text-center">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
            Ready to Transform Your Social Media?
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
            Get started with Joyo Marketing today. No credit card required.
          </p>
        </div>
      </div>
    </div>
  )
}

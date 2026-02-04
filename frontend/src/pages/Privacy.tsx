export function Privacy() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4">
      <div className="max-w-4xl mx-auto bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
          Privacy Policy
        </h1>
        
        <div className="space-y-6 text-gray-700 dark:text-gray-300">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Last updated: February 4, 2026
          </p>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
              1. Information We Collect
            </h2>
            <p>
              Assaf Automation collects the following information:
            </p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>Account information (email, name)</li>
              <li>Social media account credentials (OAuth tokens)</li>
              <li>Content created and scheduled through our platform</li>
              <li>Usage data and analytics</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
              2. How We Use Your Information
            </h2>
            <p>We use your information to:</p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>Provide and maintain our services</li>
              <li>Authenticate and connect your social media accounts</li>
              <li>Schedule and publish content on your behalf</li>
              <li>Improve our platform and user experience</li>
              <li>Send service-related notifications</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
              3. Social Media Data
            </h2>
            <p>
              When you connect social media accounts (TikTok, Instagram, Facebook, LinkedIn, Twitter):
            </p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>We only access data necessary for posting content</li>
              <li>We store OAuth tokens securely</li>
              <li>We do NOT access, store, or redistribute your followers' data</li>
              <li>We do NOT scrape or collect public data from social platforms</li>
              <li>You can disconnect accounts at any time</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
              3.1. Google Ads API Usage
            </h2>
            <p>
              When you connect your Google Ads account via OAuth 2.0:
            </p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li><strong>Access scope:</strong> We request access to manage your Google Ads campaigns (scope: adwords)</li>
              <li><strong>Data we access:</strong> Campaign data, ad groups, ads, keywords, and performance metrics</li>
              <li><strong>What we do:</strong> Create and optimize ad campaigns, generate ad copy, manage budgets</li>
              <li><strong>What we DON'T do:</strong> We do NOT access billing information, payment methods, or personal financial data</li>
              <li><strong>Token storage:</strong> OAuth refresh tokens are encrypted and stored securely in our database</li>
              <li><strong>Token usage:</strong> Tokens are ONLY used to make authorized API calls on your behalf</li>
              <li><strong>Revoke access:</strong> You can disconnect Google Ads at any time from Settings</li>
              <li><strong>Google's control:</strong> You can revoke app access anytime at <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Google Account Permissions</a></li>
            </ul>
            <p className="mt-3 text-sm bg-blue-50 dark:bg-blue-900/20 p-3 rounded">
              <strong>Note:</strong> We comply with Google API Services User Data Policy, including Limited Use requirements.
              Your Google Ads data is used solely to provide ad management services and is not shared with third parties.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
              4. Data Security
            </h2>
            <p>
              We implement industry-standard security measures to protect your data:
            </p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>Encrypted data transmission (HTTPS/SSL)</li>
              <li>Secure token storage</li>
              <li>Regular security audits</li>
              <li>Access controls and authentication</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
              5. Data Sharing
            </h2>
            <p>
              We do NOT sell, trade, or rent your personal information to third parties.
              We only share data with:
            </p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>Social media platforms (to post your content)</li>
              <li>Service providers (hosting, analytics)</li>
              <li>When required by law</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
              6. Your Rights
            </h2>
            <p>You have the right to:</p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>Access your personal data</li>
              <li>Correct inaccurate data</li>
              <li>Request deletion of your data</li>
              <li>Disconnect social media accounts</li>
              <li>Export your data</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
              7. Cookies
            </h2>
            <p>
              We use cookies and similar technologies to maintain your session and improve user experience.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
              8. Changes to Privacy Policy
            </h2>
            <p>
              We may update this Privacy Policy from time to time. Changes will be posted on this page.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
              9. Contact Us
            </h2>
            <p>
              For privacy-related questions, please contact us at:{' '}
              <a href="mailto:privacy@assaf-automation.com" className="text-blue-600 hover:underline">
                privacy@assaf-automation.com
              </a>
            </p>
          </section>
        </div>

        <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
          <a
            href="/"
            className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
          >
            ← Back to Home
          </a>
        </div>
      </div>
    </div>
  )
}

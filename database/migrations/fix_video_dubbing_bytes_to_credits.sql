/app/main.py:4: FutureWarning: 
All support for the `google.generativeai` package has ended. It will no longer be receiving 
updates or bug fixes. Please switch to the `google.genai` package as soon as possible.
See README for more details:
https://github.com/google-gemini/deprecated-generative-ai-python/blob/main/README.md
  import google.generativeai as genai
INFO:main:🔄 Attempting to import content router...
INFO:main:✅ Content router imported successfully
INFO:main:🔄 Registering content router endpoints...
INFO:main:✅ Content router registered:
INFO:main:   📝 POST /api/content/edit-text
INFO:main:   📝 POST /api/content/regenerate-text
INFO:main:   🖼️  POST /api/content/regenerate-image
INFO:main:   🎯 POST /api/content/generate-google-ads
INFO:main:🔄 Attempting to import scheduling router...
INFO:database.supabase_client:✅ Supabase client initialized successfully
INFO:main:✅ Scheduling router imported successfully
INFO:main:🔄 Registering scheduling router endpoints...
INFO:main:✅ Scheduling router registered
INFO:main:🔄 Attempting to import auth router...
INFO:main:✅ Auth router imported successfully
INFO:main:🔄 Registering auth router endpoints...
INFO:main:✅ Auth router registered
INFO:main:🔄 Attempting to import accounts router...
INFO:main:✅ Accounts router imported successfully
INFO:main:🔄 Registering accounts router endpoints...
INFO:main:✅ Accounts router registered
INFO:main:🔄 Attempting to import credits router...
INFO:main:✅ Credits router imported successfully
INFO:main:🔄 Registering credits router endpoints...
INFO:main:✅ Credits router registered
INFO:main:🔄 Attempting to import admin router...
INFO:main:✅ Admin router imported successfully
INFO:main:🔄 Registering admin router endpoints...
INFO:main:✅ Admin router registered
INFO:main:🔄 Attempting to import video translation router...
INFO:main:✅ Video translation router imported successfully
INFO:main:🔄 Registering video translation router endpoints...
INFO:main:✅ Video translation router registered
INFO:main:🔄 Attempting to import social connections router...
INFO:main:✅ Social connections router imported successfully
INFO:main:🔄 Registering social connections router endpoints...
INFO:main:🔄 Registering saved posts router endpoints...
INFO:main:✅ Saved posts router registered
INFO:main:🔄 Attempting to import chats router...
INFO:main:✅ Chats router imported successfully
INFO:main:✅ Social connections router registered
INFO:main:🔄 Attempting to import TikTok upload router...
INFO:main:✅ TikTok upload router imported successfully
INFO:main:🔄 Registering TikTok upload router endpoints...
INFO:main:✅ TikTok upload router registered
INFO:main:🔄 Attempting to import social post router...
INFO:main:✅ Social post router imported successfully
INFO:main:🔄 Registering social post router endpoints...
INFO:main:✅ Social post router registered
INFO:main:🔄 Attempting to import Google Ads router...
INFO:main:✅ Google Ads router imported successfully
INFO:main:🔄 Registering Google Ads router endpoints...
INFO:main:✅ Google Ads router registered
INFO:main:   🔗 POST /api/google-ads/connect
INFO:main:   📊 GET /api/google-ads/campaigns
INFO:main:   📝 POST /api/google-ads/create-rsa
INFO:main:🔄 Attempting to import saved posts router...
INFO:main:✅ Saved posts router imported successfully
INFO:main:✅ Application startup complete
INFO:     Application startup complete.
INFO:main:🔄 Registering chats router endpoints...
INFO:     Uvicorn running on http://0.0.0.0:8080 (Press CTRL+C to quit)
INFO:main:✅ Chats router registered
INFO:main:ℹ️ All routers loaded successfully!
INFO:main:🔍 DEBUG: Checking API key...
INFO:main:🔍 DEBUG: API key exists: True
INFO:main:🔍 DEBUG: API key length: 39
INFO:main:🔍 DEBUG: API key starts with: AIzaSyBYsF...
INFO:main:🔍 DEBUG: API key ends with: ...pNsO4
INFO:main:✅ Google AI configured successfully
INFO:     Started server process [1]
INFO:     Waiting for application startup.
INFO:main:🚀 Application starting up...
INFO:main:✅ Google AI API key found
INFO:services.scheduler:🚀 Starting background scheduler...
INFO:apscheduler.scheduler:Adding job tentatively -- it will be properly scheduled when the scheduler starts
INFO:apscheduler.scheduler:Added job "Check and publish scheduled posts" to job store "default"
INFO:apscheduler.scheduler:Scheduler started
INFO:services.scheduler:✅ Scheduler started successfully
INFO:main:✅ Background scheduler started
INFO:main:📥 Incoming request: GET /
INFO:main:   Origin: No origin
INFO:main:✅ Root endpoint called
INFO:main:📤 Response status: 200
INFO:     100.64.0.2:52927 - "GET / HTTP/1.1" 200 OK
INFO:services.scheduler:🔍 Checking for posts to publish...
INFO:httpx:HTTP Request: GET https://zginpuizzwalrvyxrrmw.supabase.co/rest/v1/scheduled_posts?select=%2A&status=eq.pending&scheduled_time=lte.2026-02-11T11%3A14%3A03.145743%2B00%3A00 "HTTP/2 200 OK"
INFO:services.scheduler:✅ No posts to publish
INFO:apscheduler.executors.default:Job "Check and publish scheduled posts (trigger: interval[0:01:00], next run at: 2026-02-11 11:15:03 UTC)" executed successfully
INFO:apscheduler.executors.default:Running job "Check and publish scheduled posts (trigger: interval[0:01:00], next run at: 2026-02-11 11:15:03 UTC)" (scheduled at 2026-02-11 11:14:03.145448+00:00)
INFO:apscheduler.executors.default:Running job "Check and publish scheduled posts (trigger: interval[0:01:00], next run at: 2026-02-11 11:16:03 UTC)" (scheduled at 2026-02-11 11:15:03.145448+00:00)
INFO:services.scheduler:🔍 Checking for posts to publish...
INFO:httpx:HTTP Request: GET https://zginpuizzwalrvyxrrmw.supabase.co/rest/v1/scheduled_posts?select=%2A&status=eq.pending&scheduled_time=lte.2026-02-11T11%3A15%3A03.145759%2B00%3A00 "HTTP/2 200 OK"
INFO:services.scheduler:✅ No posts to publish
INFO:apscheduler.executors.default:Job "Check and publish scheduled posts (trigger: interval[0:01:00], next run at: 2026-02-11 11:16:03 UTC)" executed successfully
INFO:apscheduler.executors.default:Running job "Check and publish scheduled posts (trigger: interval[0:01:00], next run at: 2026-02-11 11:17:03 UTC)" (scheduled at 2026-02-11 11:16:03.145448+00:00)
INFO:services.scheduler:🔍 Checking for posts to publish...
INFO:httpx:HTTP Request: GET https://zginpuizzwalrvyxrrmw.supabase.co/rest/v1/scheduled_posts?select=%2A&status=eq.pending&scheduled_time=lte.2026-02-11T11%3A16%3A03.145949%2B00%3A00 "HTTP/2 200 OK"
INFO:services.scheduler:✅ No posts to publish
INFO:apscheduler.executors.default:Job "Check and publish scheduled posts (trigger: interval[0:01:00], next run at: 2026-02-11 11:17:03 UTC)" executed successfully
INFO:main:📥 Incoming request: OPTIONS /api/accounts
INFO:main:   Origin: https://assaf-automation.vercel.app
INFO:     100.64.0.3:39464 - "OPTIONS /api/accounts HTTP/1.1" 200 OK
INFO:     100.64.0.3:39450 - "OPTIONS /api/accounts HTTP/1.1" 200 OK
INFO:     100.64.0.3:39480 - "OPTIONS /api/accounts HTTP/1.1" 200 OK
INFO:main:📥 Incoming request: OPTIONS /api/accounts
INFO:main:   Origin: https://assaf-automation.vercel.app
INFO:main:📥 Incoming request: OPTIONS /api/accounts
INFO:main:   Origin: https://assaf-automation.vercel.app
INFO:main:📤 Response status: 200
INFO:main:📤 Response status: 200
INFO:main:📤 Response status: 200
INFO:main:📥 Incoming request: GET /api/accounts
INFO:main:   Origin: https://assaf-automation.vercel.app
INFO:middleware.auth:🔍 Token algorithm: ES256
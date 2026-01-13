# Social Media Automation Tool

AI-powered tool for generating and scheduling social media content with multi-account management, team collaboration, and automatic publishing.

---

## 📋 Что реализовано

✅ **Multi-language** (English, Hebrew, Spanish, Portuguese)  
✅ **Post Editing** (regenerate text/images, AI editing)  
✅ **Scheduling** (calendar, auto-publish, recurring posts)  
✅ **Multi-Account** (switch between business accounts)  
✅ **Social Media APIs** (Facebook, Instagram, LinkedIn, Twitter, TikTok)  
✅ **Product Library** (upload, categorize, search products)  
✅ **Person Images** (upload reference photos for consistent generation)  
✅ **Image Overlay Editor** (add text, shapes, arrows for real estate/promo)  
✅ **Design References** (save & reuse styles)  
✅ **Team Permissions** (admin/manager/creator roles)  

---

## 🚀 Пошаговая инструкция

### ШАГ 1: Supabase (база данных)

1. Зайти на [supabase.com](https://supabase.com) → Sign up
2. **New Project**:
   - Name: `social-media-automation`
   - Password: (сохранить!)
   - Region: ближайший к пользователям
3. **SQL Editor** → New Query → скопировать весь файл `database/schema.sql` → RUN
4. **Storage** → Create 4 buckets:
   - `products` (public) - для фото товаров
   - `persons` (private) - для фото людей
   - `designs` (private) - для дизайн-референсов
   - `generated-images` (public) - для AI изображений
5. **Settings** → **API** → скопировать:
   - Project URL: `https://xxx.supabase.co`
   - anon public key: `eyJhbGc...`

---

### ШАГ 2: Railway (backend деплой)

1. Зайти на [railway.app](https://railway.app) → Login with GitHub
2. **New Project** → Deploy from GitHub repo
3. Выбрать этот репозиторий
4. **Variables** → добавить:
   ```
   GOOGLE_AI_API_KEY=твой_ключ_от_gemini
   SUPABASE_URL=https://xxx.supabase.co
   SUPABASE_KEY=твой_supabase_anon_key
   ```
5. Railway автоматически деплоит backend
6. Скопировать URL: `https://твой-проект.railway.app`
7. Проверить: открыть `https://твой-проект.railway.app/health` → должен ответить `{"status":"healthy"}`

---

### ШАГ 3: Frontend (настройка)

1. Открыть `frontend/.env` (создать если нет):
   ```
   VITE_API_URL=https://твой-проект.railway.app
   VITE_SUPABASE_URL=https://xxx.supabase.co
   VITE_SUPABASE_ANON_KEY=твой_supabase_anon_key
   ```

2. Установить новые зависимости:
   ```bash
   cd frontend
   npm install @supabase/supabase-js
   npm install react-datepicker date-fns
   npm install react-big-calendar
   npm install jwt-decode
   npm install react-dropzone
   npm install konva react-konva
   ```

3. Создать файлы (см. раздел "Frontend файлы" ниже)

4. Запустить локально для проверки:
   ```bash
   npm run dev
   ```

5. Деплой на Vercel:
   ```bash
   npm run build
   npx vercel --prod
   ```

---

### ШАГ 4: Facebook & Instagram API (опционально)

Для автопостинга нужно:

1. **Facebook App**:
   - [developers.facebook.com](https://developers.facebook.com) → Create App
   - Type: Business
   - Add products: Facebook Login + Instagram Graph API
   - Settings → Basic → скопировать App ID и App Secret

2. **Facebook Business Manager**:
   - [business.facebook.com](https://business.facebook.com)
   - Добавить страницу Facebook
   - Подключить Instagram Business аккаунт

3. **OAuth Flow**:
   - Пользователь логинится через Facebook
   - Даёт доступ к страницам
   - Токен сохраняется в таблицу `social_connections`

4. **Тестирование**:
   - Запланировать пост
   - Scheduler автоматически опубликует в назначенное время

---

### ШАГ 5: LinkedIn / Twitter / TikTok (опционально)

- **LinkedIn**: [linkedin.com/developers](https://www.linkedin.com/developers/) → Create app
- **Twitter**: [developer.twitter.com](https://developer.twitter.com/) → Apply for access
- **TikTok**: [developers.tiktok.com](https://developers.tiktok.com/) → Business API

Для каждого:
1. Создать App
2. Настроить OAuth
3. Получить Access Token
4. Сохранить в `social_connections` через UI

---

## 📁 Frontend файлы (что нужно создать)

### 1. Supabase Client
```typescript
// frontend/src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)
```

### 2. Auth Context
```typescript
// frontend/src/contexts/AuthContext.tsx
import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext<any>(null)

export const AuthProvider = ({ children }: any) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signUp = (email: string, password: string) => supabase.auth.signUp({ email, password })
  const signIn = (email: string, password: string) => supabase.auth.signInWithPassword({ email, password })
  const signOut = () => supabase.auth.signOut()

  return (
    <AuthContext.Provider value={{ user, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
```

### 3. Login Page
```typescript
// frontend/src/pages/Login.tsx
import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'

export const Login = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const { signIn } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: any) => {
    e.preventDefault()
    const { error } = await signIn(email, password)
    if (!error) navigate('/')
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <form onSubmit={handleSubmit} className="max-w-md w-full space-y-4 p-8 bg-white rounded-lg shadow">
        <h2 className="text-2xl font-bold">Login</h2>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full p-2 border rounded"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full p-2 border rounded"
        />
        <button type="submit" className="w-full bg-blue-600 text-white p-2 rounded">
          Login
        </button>
      </form>
    </div>
  )
}
```

### 4. Account Switcher (добавить в Header)
```typescript
// frontend/src/components/AccountSwitcher.tsx
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export const AccountSwitcher = () => {
  const [accounts, setAccounts] = useState([])
  const [current, setCurrent] = useState(null)

  useEffect(() => {
    const fetchAccounts = async () => {
      const token = (await supabase.auth.getSession()).data.session?.access_token
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/accounts`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      setAccounts(data)
      if (data.length > 0) setCurrent(data[0].id)
    }
    fetchAccounts()
  }, [])

  return (
    <select value={current || ''} onChange={(e) => setCurrent(e.target.value)} className="p-2 border rounded">
      {accounts.map((acc: any) => (
        <option key={acc.id} value={acc.id}>{acc.name}</option>
      ))}
    </select>
  )
}
```

### 5. Language Selector (добавить в InputSection)
```typescript
// В frontend/src/components/InputSection.tsx добавить:

const [language, setLanguage] = useState('en')

<select value={language} onChange={(e) => setLanguage(e.target.value)}>
  <option value="en">English</option>
  <option value="he">עברית</option>
  <option value="es">Español</option>
  <option value="pt">Português</option>
</select>

// При вызове API добавить:
language: language
```

### 6. Schedule Modal
```typescript
// frontend/src/components/ScheduleModal.tsx
import { useState } from 'react'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'

export const ScheduleModal = ({ post, onClose }: any) => {
  const [scheduledAt, setScheduledAt] = useState(new Date())

  const handleSchedule = async () => {
    const token = (await supabase.auth.getSession()).data.session?.access_token
    await fetch(`${import.meta.env.VITE_API_URL}/api/scheduling/schedule`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        account_id: currentAccountId,
        platforms: ['facebook', 'instagram'],
        content: post.text,
        scheduled_at: scheduledAt.toISOString()
      })
    })
    onClose()
  }

  return (
    <div className="modal">
      <h3>Schedule Post</h3>
      <DatePicker
        selected={scheduledAt}
        onChange={(date: Date) => setScheduledAt(date)}
        showTimeSelect
        dateFormat="Pp"
      />
      <button onClick={handleSchedule}>Schedule</button>
    </div>
  )
}
```

---

## 🎯 Порядок имплементации

1. **День 1-2**: Auth (Login, Signup, Context)
2. **День 3**: Account Switcher + Language Selector
3. **День 4-5**: Scheduling (Calendar, Modal)
4. **День 6-7**: Post Editing (Regenerate, Edit text)
5. **День 8-9**: Product Library (Upload, Grid)
6. **День 10-12**: Image Overlay Editor (Canvas, Tools)
7. **День 13-14**: Design References + Team Management
8. **День 15**: Testing + Deployment

---

## 🗄️ База данных (таблицы)

После запуска `database/schema.sql` в Supabase создаются:

- `accounts` - бизнес аккаунты
- `social_connections` - токены для Facebook/Instagram/etc
- `scheduled_posts` - запланированные посты
- `post_history` - опубликованные посты + аналитика
- `products` - библиотека продуктов
- `person_images` - фото людей для генерации
- `design_references` - дизайн референсы
- `content_templates` - шаблоны текстов
- `team_members` - команда + права доступа

---

## 🔌 API Endpoints

**Auth:**
- `POST /api/auth/signup` - регистрация
- `POST /api/auth/login` - вход
- `POST /api/auth/logout` - выход

**Accounts:**
- `GET /api/accounts` - список аккаунтов
- `POST /api/accounts` - создать аккаунт
- `PATCH /api/accounts/{id}` - обновить

**Content:**
- `POST /api/generate` - сгенерировать контент (работает без авторизации)
- `POST /api/content/regenerate-text` - перегенерировать текст
- `POST /api/content/regenerate-image` - перегенерировать изображение
- `POST /api/content/edit-text` - редактировать текст (shorten, add_emojis, etc)

**Scheduling:**
- `POST /api/scheduling/schedule` - запланировать пост
- `GET /api/scheduling/posts` - список запланированных
- `GET /api/scheduling/calendar` - календарь

**Products:**
- `POST /api/products/upload` - загрузить фото
- `POST /api/products` - создать продукт
- `GET /api/products` - список (поиск, фильтры)

**Persons:**
- `POST /api/persons/upload` - загрузить фото человека
- `POST /api/persons` - создать person
- `GET /api/persons` - список

**Designs:**
- `POST /api/designs/upload` - загрузить референс
- `POST /api/designs/analyze-style` - AI анализ стиля
- `GET /api/designs` - список

**Image Editor:**
- `POST /api/image-editor/edit` - добавить текст, фигуры, стрелки
- `GET /api/image-editor/presets` - пресеты (для недвижимости, промо)

**Team:**
- `POST /api/team/{account_id}/invite` - пригласить в команду
- `GET /api/team/{account_id}/members` - список команды
- `PATCH /api/team/{account_id}/members/{id}` - изменить права

---

## 🔐 Безопасность

- Все пароли хешируются Supabase Auth
- JWT токены для API
- RLS (Row Level Security) - каждый видит только свои данные
- Токены соцсетей хранятся зашифрованными
- Валидация загружаемых файлов

---

## 💰 Стоимость (месяц)

- Supabase Free: 500MB DB, 1GB хранилище - **$0**
- Railway: ~$5-20 (зависит от трафика)
- Vercel: Free для hobby
- Google Gemini API: ~$0.01-0.10 за пост

**Итого: $5-30/мес**

---

## ❓ Проблемы и решения

### Backend не запускается
```bash
cd backend
pip install -r requirements.txt
python main.py
# Проверить http://localhost:8000/health
```

### Frontend не видит API
- Проверить `frontend/.env` → `VITE_API_URL`
- Проверить CORS в `main.py`

### Supabase ошибка
- Проверить правильность `SUPABASE_URL` и `SUPABASE_KEY`
- Запущен ли schema.sql?

### Посты не публикуются
- Проверить токены в таблице `social_connections`
- Токен Facebook истекает через 60 дней (нужен refresh)
- Scheduler запущен? (в Railway логах должно быть "Scheduler started")

---

## 📞 Поддержка

- **Supabase docs**: https://supabase.com/docs
- **Gemini API**: https://ai.google.dev/docs
- **Meta API**: https://developers.facebook.com/docs
- **Railway**: https://docs.railway.app

---

## ✅ Чеклист готовности

- [ ] Supabase проект создан + schema запущена
- [ ] Railway backend задеплоен + переменные настроены
- [ ] Frontend `.env` настроен
- [ ] Supabase client создан (`lib/supabase.ts`)
- [ ] AuthContext работает
- [ ] Login/Signup страницы созданы
- [ ] Account Switcher добавлен
- [ ] Language selector работает
- [ ] Scheduling modal создан
- [ ] Calendar интегрирован
- [ ] Product upload работает
- [ ] Image editor функционален
- [ ] Team management настроен
- [ ] Facebook App создан (опционально)
- [ ] Первый пост успешно сгенерирован и запланирован!

---

**Готово! После всех шагов приложение полностью функционально.** 🚀

import express from 'express';
import cors from 'cors';
import pg from 'pg';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.VERCEL ? '/tmp' : path.join(__dirname, 'data');
const STORE_FILE = path.join(DATA_DIR, 'patrik-store.json');

const app = express();
const PORT = process.env.PORT || 3001;

// Отключаем заголовок X-Powered-By
app.disable('x-powered-by');

// Ограничиваем CORS локальным фронтендом, доменом Vercel или ALLOWED_ORIGIN из .env
const ALLOWED_ORIGINS = new Set([
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : []),
  ...(process.env.ALLOWED_ORIGIN ? [process.env.ALLOWED_ORIGIN] : []),
]);

app.use(
  cors({
    origin(origin, callback) {
      if (
        !origin ||
        ALLOWED_ORIGINS.has(origin) ||
        /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin)
      ) {
        return callback(null, true);
      }
      return callback(new Error('CORS policy blocked'));
    },
    credentials: true,
  })
);

// Ограничение размера JSON-тела (защита от DoS)
app.use(express.json({ limit: '32kb' }));

// Базовые заголовки безопасности
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  next();
});

// Rate Limiter (защита от брутфорса и спама + очистка устаревших записей)
const rateBuckets = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of rateBuckets.entries()) {
    if (now > v.resetAt) rateBuckets.delete(k);
  }
}, 5 * 60 * 1000).unref();

function rateLimit(maxRequests, windowMs) {
  return (req, res, next) => {
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    const key = `${req.path}:${ip}`;
    const now = Date.now();
    const bucket = rateBuckets.get(key);
    if (!bucket || now > bucket.resetAt) {
      rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    if (bucket.count >= maxRequests) {
      return res.status(429).json({ error: 'Слишком много запросов. Повторите позже.' });
    }
    bucket.count += 1;
    next();
  };
}

app.use('/api', rateLimit(120, 60 * 1000));

const pool = new pg.Pool({
  connectionString:
    process.env.DATABASE_URL ||
    'postgresql://patrik:patrik_secret_password@localhost:5432/patrik_ai',
  connectionTimeoutMillis: 1500,
});

let pgAvailable = false;

async function checkPostgres() {
  try {
    await pool.query('SELECT 1');
    pgAvailable = true;
    console.log('✅ Connected to PostgreSQL');
  } catch {
    pgAvailable = false;
    console.log('ℹ️ PostgreSQL not detected locally — running with secure server store');
  }
}
checkPostgres();

// Безопасная очистка строк от управляющих символов и угловых скобок
function sanitizeText(val, maxLen = 200) {
  return String(val ?? '')
    .replace(/[<>]/g, '')
    .trim()
    .slice(0, maxLen);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Криптостойкое хеширование пароля: scrypt + уникальная 16-байтная соль
function hashPassword(pwd) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(String(pwd), salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPassword(pwd, storedHash) {
  if (!storedHash || typeof storedHash !== 'string') return false;
  // Обратная совместимость со старым SHA-256 из раннего store.json
  if (!storedHash.includes(':')) {
    const legacy = crypto.createHash('sha256').update(String(pwd)).digest('hex');
    const a = Buffer.from(legacy, 'hex');
    const b = Buffer.from(storedHash, 'hex');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }
  const [salt, keyHex] = storedHash.split(':');
  if (!salt || !keyHex) return false;
  const derived = crypto.scryptSync(String(pwd), salt, 64);
  const keyBuf = Buffer.from(keyHex, 'hex');
  return derived.length === keyBuf.length && crypto.timingSafeEqual(derived, keyBuf);
}

// Публичный каталог тарифов
const PLANS = [
  {
    id: 1,
    tier: 1,
    slug: 'starter',
    name: 'Starter',
    description: 'Базовый доступ для знакомства с возможностями PATRIK AI.',
    price_monthly: 0,
    price_yearly: 0,
    token_limit: 100000,
    api_calls_limit: 0,
    max_team_members: 1,
    is_popular: false,
    features: [
      '50 запросов в сутки',
      'Модель PATRIK Text 2.5',
      'Контекст до 8K токенов',
      'Доступ через браузер и телефон',
      'История чатов за 7 дней',
    ],
  },
  {
    id: 2,
    tier: 2,
    slug: 'pro-creator',
    name: 'Pro Creator',
    description: 'Оптимально для студентов, разработчиков, дизайнеров и авторов.',
    price_monthly: 990,
    price_yearly: 792,
    token_limit: 1000000,
    api_calls_limit: 10000,
    max_team_members: 1,
    is_popular: true,
    features: [
      'Безлимитные запросы ко всем моделям',
      'Приоритетный GPU-инференс (120ms)',
      'Контекст до 128K токенов',
      'Генерация кода, UI и 4K-картинок',
      'Доступ к REST API (10K вызовов)',
      'Поддержка 24/7 в личном кабинете',
    ],
  },
  {
    id: 3,
    tier: 3,
    slug: 'ultra-team',
    name: 'Ultra Team',
    description: 'Для команд, агентств и коммерческих проектов.',
    price_monthly: 3490,
    price_yearly: 2792,
    token_limit: -1,
    api_calls_limit: -1,
    max_team_members: 5,
    is_popular: false,
    features: [
      'Всё из тарифа Pro Creator',
      'До 5 участников в одном аккаунте',
      'Выделенный сервер без лимитов',
      'Контекст до 1M токенов',
      'Безлимитный API + SDK',
      'Персональный менеджер и SLA 99.9%',
    ],
  },
];

let siteConfig = {
  brandName: 'PATRIK AI',
  heroBadge: 'PATRIK AI 2.5 — Мультимодальная нейросеть нового поколения',
  heroTitle: 'Интеллект со скоростью вашей мысли.',
  heroSubtitle:
    'Генерируйте код, тексты, изображения и анализируйте данные в одном окне. Единая подписка вместо десятка разрозненных сервисов.',
  stat1Value: '3x',
  stat1Label: 'быстрее аналогичных моделей',
  stat2Value: '99.9%',
  stat2Label: 'доступность серверов',
  stat3Value: '120K+',
  stat3Label: 'активных подписчиков',
  stat4Value: '2.4M',
  stat4Label: 'запросов ежедневно',
  supportEmail: 'support@patrik.ai',
};

const usersByEmail = new Map();
const sessions = new Map(); // token -> { email, expiresAt }
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

function seedDefaultUsers() {
  const adminPass = process.env.ADMIN_PASSWORD || 'admin1234';
  const demoPass = process.env.DEMO_PASSWORD || 'demo1234';

  usersByEmail.set('admin@patrik.ai', {
    id: 1,
    email: 'admin@patrik.ai',
    passwordHash: hashPassword(adminPass),
    full_name: 'Администратор PATRIK AI',
    role: 'admin',
    subscription: null,
    transactions: [],
    apiKeys: [],
  });

  usersByEmail.set('student@college.ru', {
    id: 2,
    email: 'student@college.ru',
    passwordHash: hashPassword(demoPass),
    full_name: 'Студент Колледжа',
    role: 'user',
    subscription: null,
    transactions: [],
    apiKeys: [],
  });
}

function saveStore() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    const payload = {
      siteConfig,
      plans: PLANS,
      users: Array.from(usersByEmail.entries()),
      sessions: Array.from(sessions.entries()),
    };
    fs.writeFileSync(STORE_FILE, JSON.stringify(payload, null, 2), 'utf8');
  } catch (e) {
    console.error('Ошибка сохранения store.json:', e);
  }
}

function loadStore() {
  try {
    if (!fs.existsSync(STORE_FILE)) {
      seedDefaultUsers();
      saveStore();
      return;
    }
    const raw = fs.readFileSync(STORE_FILE, 'utf8');
    const data = JSON.parse(raw);
    if (data.siteConfig) {
      for (const k of Object.keys(siteConfig)) {
        if (Object.hasOwn(data.siteConfig, k)) siteConfig[k] = data.siteConfig[k];
      }
    }
    if (Array.isArray(data.plans) && data.plans.length > 0) {
      PLANS.splice(0, PLANS.length, ...data.plans);
    }
    if (Array.isArray(data.users)) {
      for (const [email, u] of data.users) usersByEmail.set(email, u);
    }
    if (Array.isArray(data.sessions)) {
      const now = Date.now();
      for (const [tok, val] of data.sessions) {
        if (typeof val === 'string') {
          sessions.set(tok, { email: val, expiresAt: now + SESSION_TTL_MS });
        } else if (val && val.expiresAt > now) {
          sessions.set(tok, val);
        }
      }
    }
    console.log('💾 Состояние сервера загружено из backend/data/store.json');
  } catch (e) {
    console.error('Ошибка чтения store.json, создаём заново:', e);
    seedDefaultUsers();
    saveStore();
  }
}

loadStore();

// Middleware авторизации
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const session = sessions.get(token);
  if (!session || session.expiresAt < Date.now()) {
    if (session) {
      sessions.delete(token);
      saveStore();
    }
    return res.status(401).json({ error: 'Пожалуйста, войдите или зарегистрируйте аккаунт' });
  }
  const user = usersByEmail.get(session.email);
  if (!user) {
    return res.status(401).json({ error: 'Пожалуйста, войдите или зарегистрируйте аккаунт' });
  }
  req.user = user;
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Доступ запрещён: требуются права администратора' });
  }
  next();
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, database: pgAvailable ? 'postgresql' : 'server-store' });
});

app.get('/api/config', (_req, res) => {
  res.json(siteConfig);
});

app.get('/api/plans', (_req, res) => {
  res.json(PLANS);
});

// Авторизация (строгий rate-limit от подбора пароля)
app.post('/api/auth/login', rateLimit(15, 5 * 60 * 1000), (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Введите корректный email и пароль' });
  }
  const normalized = email.trim().toLowerCase();
  if (!EMAIL_RE.test(normalized)) {
    return res.status(400).json({ error: 'Некорректный формат email' });
  }

  const user = usersByEmail.get(normalized);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return res.status(401).json({ error: 'Неверный email или пароль' });
  }

  // Автоматическая миграция старого SHA-256 на scrypt при успешном входе
  if (!user.passwordHash.includes(':')) {
    user.passwordHash = hashPassword(password);
  }

  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { email: normalized, expiresAt: Date.now() + SESSION_TTL_MS });
  saveStore();

  res.json({
    token,
    user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role },
  });
});

// Регистрация
app.post('/api/auth/register', rateLimit(10, 5 * 60 * 1000), async (req, res) => {
  const { email, password, full_name } = req.body || {};
  if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Заполните email и пароль' });
  }
  const normalized = email.trim().toLowerCase();
  if (!EMAIL_RE.test(normalized) || normalized.length > 150) {
    return res.status(400).json({ error: 'Введите корректный email' });
  }
  if (password.length < 6 || password.length > 128) {
    return res.status(400).json({ error: 'Пароль должен быть от 6 до 128 символов' });
  }
  if (usersByEmail.has(normalized)) {
    return res.status(409).json({ error: 'Аккаунт с таким email уже существует' });
  }

  const safeName = sanitizeText(full_name, 80) || 'Пользователь';
  const newUser = {
    id: usersByEmail.size + 1,
    email: normalized,
    passwordHash: hashPassword(password),
    full_name: safeName,
    role: 'user',
    subscription: null,
    transactions: [],
    apiKeys: [],
  };
  usersByEmail.set(normalized, newUser);

  if (pgAvailable) {
    try {
      await pool.query('INSERT INTO users (email, password, name) VALUES ($1, $2, $3)', [
        newUser.email,
        newUser.passwordHash,
        newUser.full_name,
      ]);
    } catch (e) {
      console.error(e);
    }
  }

  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { email: normalized, expiresAt: Date.now() + SESSION_TTL_MS });
  saveStore();

  res.json({
    token,
    user: { id: newUser.id, email: newUser.email, full_name: newUser.full_name, role: newUser.role },
  });
});

app.post('/api/auth/logout', (req, res) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  sessions.delete(token);
  saveStore();
  res.json({ ok: true });
});

// Личный кабинет
app.get('/api/dashboard', requireAuth, (req, res) => {
  const u = req.user;
  res.json({
    user: { id: u.id, email: u.email, full_name: u.full_name, role: u.role },
    subscription: u.subscription,
    transactions: u.transactions,
    apiKeys: u.apiKeys.map(({ keyHash, ...safe }) => safe),
  });
});

// Оформление / продление / апгрейд подписки
app.post('/api/subscribe', requireAuth, async (req, res) => {
  const { planSlug, billingCycle = 'monthly', paymentMethod = 'card', cardDetails } = req.body || {};

  if (typeof planSlug !== 'string' || !planSlug.trim()) {
    return res.status(400).json({ error: 'Некорректный идентификатор тарифа' });
  }
  if (!['monthly', 'yearly'].includes(billingCycle)) {
    return res.status(400).json({ error: 'Некорректный период подписки' });
  }
  if (!['card', 'sbp'].includes(paymentMethod)) {
    return res.status(400).json({ error: 'Некорректный способ оплаты' });
  }

  const plan = PLANS.find((p) => p.slug === planSlug);
  if (!plan) return res.status(404).json({ error: 'Тариф не найден' });

  const u = req.user;

  if (u.subscription && u.subscription.status === 'active') {
    const currentPlan = PLANS.find((p) => p.slug === u.subscription.plan_slug);
    if (currentPlan) {
      if (plan.tier < currentPlan.tier) {
        return res.status(400).json({
          error: `Нельзя купить тариф ниже вашего текущего («${currentPlan.name}»).`,
        });
      }
      if (plan.tier === currentPlan.tier && plan.price_monthly === 0) {
        return res.status(400).json({ error: `Тариф «${currentPlan.name}» уже активен у вас.` });
      }
    }
  }

  const amount = billingCycle === 'yearly' ? plan.price_yearly * 12 : plan.price_monthly;
  if (amount > 0 && paymentMethod === 'card') {
    const num = String(cardDetails?.number || '').replace(/\D/g, '');
    const exp = String(cardDetails?.expiry || '').trim();
    const cvc = String(cardDetails?.cvc || '').replace(/\D/g, '');
    if (num.length !== 16) {
      return res.status(400).json({ error: 'Введите корректный 16-значный номер карты' });
    }
    if (exp && !/^\d{2}\/\d{2}$/.test(exp)) {
      return res.status(400).json({ error: 'Некорректный срок карты (ММ/ГГ)' });
    }
    if (cvc && cvc.length !== 3) {
      return res.status(400).json({ error: 'Некорректный CVC код (3 цифры)' });
    }
    // Номер карты и CVC не сохраняются на сервере
  }

  const txCode = `#TX-${crypto.randomInt(1000, 9999)}`;

  const isRenewal = u.subscription && u.subscription.plan_slug === plan.slug;
  const baseDate = isRenewal && u.subscription.expires_at
    ? new Date(u.subscription.expires_at)
    : new Date();
  if (billingCycle === 'yearly') {
    baseDate.setFullYear(baseDate.getFullYear() + 1);
  } else {
    baseDate.setMonth(baseDate.getMonth() + 1);
  }
  const newExpiresAt = baseDate.toISOString().slice(0, 10);

  u.subscription = {
    plan_slug: plan.slug,
    plan_name: plan.name,
    tier: plan.tier,
    billing_cycle: billingCycle,
    status: 'active',
    tokens_used: isRenewal ? u.subscription.tokens_used : 0,
    token_limit: plan.token_limit,
    expires_at: newExpiresAt,
  };

  u.transactions.unshift({
    tx_code: txCode,
    plan_name: `${plan.name} (${billingCycle === 'yearly' ? '1 год' : '1 мес'})`,
    amount,
    payment_method: amount === 0 ? 'free' : paymentMethod,
    status: amount === 0 ? 'Активировано' : 'Оплачено',
  });
  saveStore();

  if (pgAvailable) {
    try {
      await pool.query(
        'INSERT INTO payments (user_id, plan_id, amount, method, status) VALUES ($1, $2, $3, $4, $5)',
        [u.id, plan.id, amount, amount === 0 ? 'free' : paymentMethod, amount === 0 ? 'Активировано' : 'Оплачено']
      );
    } catch (e) {
      console.error(e);
    }
  }

  res.json({
    success: true,
    tx_code: txCode,
    subscription: u.subscription,
    transactions: u.transactions,
  });
});

// Создание нового API-ключа
app.post('/api/keys', requireAuth, (req, res) => {
  const { name, tokenLimit } = req.body || {};
  const cleanName = sanitizeText(name, 60);
  if (!cleanName) {
    return res.status(400).json({ error: 'Укажите название API-ключа' });
  }
  if (req.user.apiKeys.length >= 20) {
    return res.status(400).json({ error: 'Достигнут лимит количества API-ключей (макс. 20)' });
  }

  let parsedLimit = null;
  if (tokenLimit !== undefined && tokenLimit !== '' && tokenLimit !== null) {
    const num = Number(tokenLimit);
    if (!Number.isInteger(num) || num <= 0 || num > 100_000_000) {
      return res.status(400).json({ error: 'Лимит токенов должен быть положительным целым числом' });
    }
    parsedLimit = num;
  }

  const rawSecret = crypto.randomBytes(24).toString('base64url');
  const fullKey = `sk-patrik-${rawSecret}`;
  const maskedKey = `sk-patrik-...${fullKey.slice(-4)}`;

  const keyRecord = {
    id: crypto.randomUUID(),
    name: cleanName,
    maskedKey,
    keyHash: crypto.createHash('sha256').update(fullKey).digest('hex'),
    createdAt: new Date().toLocaleDateString('ru-RU'),
    spentRub: 0,
    tokensUsed: 0,
    tokenLimit: parsedLimit,
    lastUsed: 'Никогда',
    status: 'Активен',
  };

  req.user.apiKeys.unshift(keyRecord);
  saveStore();

  const { keyHash, ...safeRecord } = keyRecord;
  res.json({
    key: safeRecord,
    fullKey,
  });
});

app.delete('/api/keys/:id', requireAuth, (req, res) => {
  const keyId = String(req.params.id || '');
  if (!/^[0-9a-f-]{36}$/i.test(keyId)) {
    return res.status(400).json({ error: 'Некорректный ID ключа' });
  }
  const before = req.user.apiKeys.length;
  req.user.apiKeys = req.user.apiKeys.filter((k) => k.id !== keyId);
  if (req.user.apiKeys.length === before) {
    return res.status(404).json({ error: 'Ключ не найден' });
  }
  saveStore();
  res.json({
    apiKeys: req.user.apiKeys.map(({ keyHash, ...safe }) => safe),
  });
});

// ================= АДМИН-ПАНЕЛЬ =================
app.put('/api/admin/config', requireAuth, requireAdmin, (req, res) => {
  const body = req.body || {};
  for (const key of Object.keys(siteConfig)) {
    if (Object.hasOwn(body, key) && body[key] !== undefined) {
      siteConfig[key] = sanitizeText(body[key], 400);
    }
  }
  saveStore();
  res.json({ ok: true, config: siteConfig });
});

app.put('/api/admin/plans/:id', requireAuth, requireAdmin, (req, res) => {
  const planId = Number(req.params.id);
  const plan = PLANS.find((p) => p.id === planId);
  if (!plan) return res.status(404).json({ error: 'Тариф не найден' });

  const { name, description, price_monthly, price_year, price_yearly, token_limit, features } = req.body || {};
  if (name !== undefined) plan.name = sanitizeText(name, 80) || plan.name;
  if (description !== undefined) plan.description = sanitizeText(description, 300);

  if (price_monthly !== undefined) {
    const pm = Number(price_monthly);
    if (!Number.isFinite(pm) || pm < 0 || pm > 1_000_000) {
      return res.status(400).json({ error: 'Некорректная цена за месяц' });
    }
    plan.price_monthly = Math.round(pm);
  }
  const pyRaw = price_yearly !== undefined ? price_yearly : price_year;
  if (pyRaw !== undefined) {
    const py = Number(pyRaw);
    if (!Number.isFinite(py) || py < 0 || py > 1_000_000) {
      return res.status(400).json({ error: 'Некорректная цена за год' });
    }
    plan.price_yearly = Math.round(py);
  }
  if (token_limit !== undefined) {
    const tl = Number(token_limit);
    if (!Number.isInteger(tl) || tl < -1) {
      return res.status(400).json({ error: 'Некорректный лимит токенов' });
    }
    plan.token_limit = tl;
  }
  if (Array.isArray(features)) {
    plan.features = features.slice(0, 15).map((f) => sanitizeText(f, 150)).filter(Boolean);
  }

  saveStore();
  res.json({ ok: true, plan, plans: PLANS });
});

app.get('/api/admin/users', requireAuth, requireAdmin, (_req, res) => {
  const list = Array.from(usersByEmail.values()).map((u) => ({
    id: u.id,
    email: u.email,
    full_name: u.full_name,
    role: u.role,
    plan_name: u.subscription ? u.subscription.plan_name : 'Нет подписки',
    transactions_count: u.transactions.length,
    keys_count: u.apiKeys.length,
  }));
  res.json(list);
});

// Глобальный обработчик ошибок (не раскрывает стек-трейс клиенту)
app.use((err, _req, res, _next) => {
  console.error(err.message);
  res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`🚀 PATRIK AI Backend running at http://localhost:${PORT}`);
  });
}

export default app;

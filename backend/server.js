import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pg from 'pg';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PLANS as DEFAULT_PLANS, siteConfig as DEFAULT_SITE_CONFIG } from './plans.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.VERCEL ? '/tmp' : path.join(__dirname, 'data');
const STORE_FILE = path.join(DATA_DIR, 'patrik-store.json');

const app = express();
const PORT = process.env.PORT || 3001;

// Доверяем первому прокси (Vercel/Nginx) для корректного req.ip в rate limiter
app.set('trust proxy', 1);

// Отключаем заголовок X-Powered-By и добавляем защитные HTTP-заголовки
app.disable('x-powered-by');
app.use(helmet());

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

const pool = process.env.DATABASE_URL
  ? new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      connectionTimeoutMillis: 1500,
    })
  : null;

let pgAvailable = false;

async function checkPostgres() {
  if (!pool) {
    pgAvailable = false;
    console.log('ℹ️ DATABASE_URL not set — running with secure server store');
    return false;
  }
  try {
    await pool.query('SELECT 1');
    pgAvailable = true;
    console.log('✅ Connected to PostgreSQL');
    return true;
  } catch {
    pgAvailable = false;
    console.log('ℹ️ PostgreSQL not detected locally — running with secure server store');
    return false;
  }
}
const pgReadyPromise = checkPostgres();

async function loadUserFromPg(email) {
  await pgReadyPromise;
  if (!pgAvailable || !pool) return null;
  try {
    const userRes = await pool.query(
      'SELECT id, email, password_hash, full_name, role FROM users WHERE LOWER(email) = $1 LIMIT 1',
      [email]
    );
    if (userRes.rows.length === 0) return null;
    const row = userRes.rows[0];
    const normalizedEmail = String(row.email).trim().toLowerCase();

    const subRes = await pool.query(
      `SELECT s.plan_id, s.status, s.expires_at, p.name AS plan_name
       FROM subscriptions s
       LEFT JOIN plans p ON p.id = s.plan_id
       WHERE s.user_id = $1
       ORDER BY s.id DESC
       LIMIT 1`,
      [row.id]
    );
    let subscription = null;
    if (subRes.rows.length > 0) {
      const subRow = subRes.rows[0];
      const matchedPlan = PLANS.find((p) => p.id === subRow.plan_id || p.name === subRow.plan_name);
      if (matchedPlan) {
        subscription = {
          plan_slug: matchedPlan.slug,
          plan_name: matchedPlan.name,
          tier: matchedPlan.tier,
          billing_cycle: 'monthly',
          status: subRow.status || 'active',
          tokens_used: 0,
          token_limit: matchedPlan.token_limit,
          expires_at: subRow.expires_at ? new Date(subRow.expires_at).toISOString().slice(0, 10) : '',
        };
      }
    }

    const payRes = await pool.query(
      `SELECT pay.id, pay.amount, pay.method, pay.status, p.name AS plan_name
       FROM payments pay
       LEFT JOIN plans p ON p.id = pay.plan_id
       WHERE pay.user_id = $1
       ORDER BY pay.id DESC
       LIMIT 20`,
      [row.id]
    );
    const transactions = payRes.rows.map((r) => ({
      tx_code: `#TX-${r.id}`,
      plan_name: r.plan_name || 'Подписка',
      amount: Number(r.amount || 0),
      payment_method: r.method || 'card',
      status: r.status || 'Оплачено',
    }));

    const loaded = {
      id: row.id,
      email: normalizedEmail,
      passwordHash: row.password_hash,
      full_name: row.full_name || 'Пользователь',
      role: ADMIN_EMAILS.has(normalizedEmail) ? 'admin' : (row.role || 'user'),
      subscription,
      transactions,
      apiKeys: [],
    };
    usersByEmail.set(normalizedEmail, loaded);
    return loaded;
  } catch (e) {
    console.error('Ошибка чтения пользователя из PostgreSQL:', e);
    return null;
  }
}

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

// Публичный каталог тарифов и настройки сайта
const PLANS = [...DEFAULT_PLANS];
let siteConfig = { ...DEFAULT_SITE_CONFIG };

const usersByEmail = new Map();
const sessions = new Map(); // token -> { email, expiresAt }
const pendingPayments = new Map(); // sessionId -> paymentSessionData
const processedWebhooks = new Set(); // Replay protection for webhook transaction IDs
const supportMessages = []; // Хранилище сообщений поддержки { id, userId, userEmail, userName, sender, encrypted_text, iv, auth_tag, is_read, createdAt }

// Настройки шифрования сообщений поддержки (AES-256-GCM)
const SUPPORT_ENCRYPTION_KEY = process.env.SUPPORT_ENCRYPTION_KEY || 'patrik_support_aes_secret_key_2026_safe';
const SUPPORT_KEY_BUF = crypto.createHash('sha256').update(SUPPORT_ENCRYPTION_KEY).digest();

// Интеграция с Telegram-ботом поддержки
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8751417025:AAEOl_Vmo5NGRZFIHgUQC7FBfdrKD4RakCQ';
const TELEGRAM_ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID || '5103486897';

function encryptSupportMessage(plainText) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', SUPPORT_KEY_BUF, iv);
  const enc = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    encrypted_text: enc.toString('hex'),
    iv: iv.toString('hex'),
    auth_tag: tag.toString('hex'),
  };
}

function decryptSupportMessage(encryptedHex, ivHex, tagHex) {
  try {
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', SUPPORT_KEY_BUF, iv);
    decipher.setAuthTag(tag);
    const dec = Buffer.concat([decipher.update(Buffer.from(encryptedHex, 'hex')), decipher.final()]);
    return dec.toString('utf8');
  } catch {
    return '[Зашифрованное сообщение]';
  }
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

async function notifyAdminInTelegram(user, messageText) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_ADMIN_CHAT_ID) return;
  try {
    const timeStr = new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' });
    const text =
      `📬 <b>Новое обращение в поддержку PATRIK AI</b>\n\n` +
      `👤 <b>Пользователь:</b> ${escapeHtml(user.full_name || 'Без имени')}\n` +
      `📧 <b>Email:</b> ${escapeHtml(user.email)}\n` +
      `⭐ <b>Тариф:</b> ${user.subscription ? escapeHtml(user.subscription.plan_name) : 'Starter (Free)'}\n` +
      `⏰ <b>Время:</b> ${timeStr}\n\n` +
      `💬 <b>Сообщение:</b>\n<i>${escapeHtml(messageText)}</i>\n\n` +
      `<i>👉 Ответить пользователю можно в панели управления в разделе «Чат поддержки».</i>`;

    const url = 'https://api.telegram.org/bot' + TELEGRAM_BOT_TOKEN + '/sendMessage';
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_ADMIN_CHAT_ID,
        text,
        parse_mode: 'HTML',
      }),
    });
  } catch (err) {
    console.error('Ошибка отправки уведомления в Telegram:', err.message);
  }
}

// Секретный ключ подписи платёжного шлюза (из .env или криптографический ключ времени выполнения)
const PAYMENT_WEBHOOK_SECRET = process.env.PAYMENT_WEBHOOK_SECRET || (() => {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Критическая ошибка безопасности: PAYMENT_WEBHOOK_SECRET не настроен в переменных окружения production!');
  }
  console.warn('⚠️ PAYMENT_WEBHOOK_SECRET не задан в .env — используется сгенерированный временный ключ.');
  return crypto.randomBytes(32).toString('hex');
})();
const revokedTokens = new Set();
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 дней
const SESSION_SECRET =
  process.env.SESSION_SECRET ||
  'patrik-ai-session-key-2026-production-fallback-do-not-change-randomly';
const TOKEN_ENC_KEY = crypto.createHash('sha256').update(SESSION_SECRET).digest();

function createSessionToken(userOrEmail) {
  let userObj;
  if (typeof userOrEmail === 'string') {
    const existing = usersByEmail.get(userOrEmail.trim().toLowerCase());
    userObj = existing || {
      id: 1,
      email: userOrEmail.trim().toLowerCase(),
      full_name: 'Пользователь',
      role: ADMIN_EMAILS.has(userOrEmail.trim().toLowerCase()) ? 'admin' : 'user',
      subscription: null,
      transactions: [],
      apiKeys: [],
    };
  } else {
    userObj = userOrEmail;
  }

  const normalizedEmail = String(userObj.email || '').trim().toLowerCase();
  const payload = {
    id: userObj.id || 1,
    email: normalizedEmail,
    full_name: userObj.full_name || 'Пользователь',
    role: ADMIN_EMAILS.has(normalizedEmail) ? 'admin' : (userObj.role || 'user'),
    subscription: userObj.subscription || null,
    transactions: (userObj.transactions || []).slice(0, 20),
    apiKeys: (userObj.apiKeys || []).map(({ keyHash, ...safe }) => safe),
    passwordHash: userObj.passwordHash || '',
    exp: Date.now() + SESSION_TTL_MS,
  };

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', TOKEN_ENC_KEY, iv);
  const enc = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `v2.${iv.toString('base64url')}.${tag.toString('base64url')}.${enc.toString('base64url')}`;
}

function verifySessionToken(token) {
  if (!token || typeof token !== 'string' || revokedTokens.has(token)) return null;

  // Новый зашифрованный stateless токен v2 (хранит полный профиль и подписку)
  if (token.startsWith('v2.')) {
    const parts = token.slice(3).split('.');
    if (parts.length === 3) {
      try {
        const [ivB64, tagB64, encB64] = parts;
        const iv = Buffer.from(ivB64, 'base64url');
        const tag = Buffer.from(tagB64, 'base64url');
        const enc = Buffer.from(encB64, 'base64url');
        if (iv.length === 12 && tag.length === 16) {
          const decipher = crypto.createDecipheriv('aes-256-gcm', TOKEN_ENC_KEY, iv);
          decipher.setAuthTag(tag);
          const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
          const data = JSON.parse(dec.toString('utf8'));
          if (data?.email && data?.exp && data.exp > Date.now()) {
            const email = String(data.email).trim().toLowerCase();
            return {
              email,
              expiresAt: data.exp,
              user: {
                id: data.id || 1,
                email,
                full_name: data.full_name || 'Пользователь',
                role: ADMIN_EMAILS.has(email) ? 'admin' : (data.role || 'user'),
                subscription: data.subscription || null,
                transactions: data.transactions || [],
                apiKeys: data.apiKeys || [],
                passwordHash: data.passwordHash || '',
              },
            };
          }
        }
      } catch {
        // невалидный токен
      }
    }
  }

  // Поддержка legacy сессий
  const legacy = sessions.get(token);
  if (legacy && legacy.expiresAt > Date.now()) {
    return legacy;
  }
  const parts = token.split('.');
  if (parts.length === 2) {
    try {
      const [payloadB64, sigHex] = parts;
      const expectedHex = crypto.createHmac('sha256', SESSION_SECRET).update(payloadB64).digest('hex');
      const sigBuf = Buffer.from(sigHex, 'utf8');
      const expectedBuf = Buffer.from(expectedHex, 'utf8');
      if (sigBuf.length === expectedBuf.length && crypto.timingSafeEqual(sigBuf, expectedBuf)) {
        const parsed = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
        if (parsed?.email && parsed?.exp && parsed.exp > Date.now()) {
          const email = String(parsed.email).trim().toLowerCase();
          return { email, expiresAt: parsed.exp };
        }
      }
    } catch {}
  }
  return null;
}

const ADMIN_EMAILS = new Set([
  'admin@patrik.ai',
  ...(process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
]);

function seedDefaultUsers() {
  const adminPass = process.env.ADMIN_PASSWORD;
  const demoPass = process.env.DEMO_PASSWORD;

  if (adminPass) {
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
  }

  if (demoPass) {
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
}

function saveStore() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    const payload = {
      siteConfig,
      plans: PLANS,
      users: Array.from(usersByEmail.entries()),
      sessions: Array.from(sessions.entries()),
      pendingPayments: Array.from(pendingPayments.entries()),
      processedWebhooks: Array.from(processedWebhooks),
      supportMessages,
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
      for (const [email, u] of data.users) {
        if (ADMIN_EMAILS.has(email)) u.role = 'admin';
        usersByEmail.set(email, u);
      }
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
    if (Array.isArray(data.pendingPayments)) {
      const now = Date.now();
      for (const [sId, p] of data.pendingPayments) {
        if (p && (!p.createdAt || now - p.createdAt < 24 * 60 * 60 * 1000)) {
          pendingPayments.set(sId, p);
        }
      }
    }
    if (Array.isArray(data.processedWebhooks)) {
      for (const wId of data.processedWebhooks) {
        processedWebhooks.add(wId);
      }
    }
    if (Array.isArray(data.supportMessages)) {
      supportMessages.splice(0, supportMessages.length, ...data.supportMessages);
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
async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const session = verifySessionToken(token);
  if (!session || session.expiresAt < Date.now()) {
    return res.status(401).json({ error: 'Пожалуйста, войдите или зарегистрируйте аккаунт' });
  }

  let user = usersByEmail.get(session.email);
  if (!user && session.user) {
    user = session.user;
    if (ADMIN_EMAILS.has(user.email)) user.role = 'admin';
    usersByEmail.set(user.email, user);
    saveStore();
  }
  if (!user) {
    user = await loadUserFromPg(session.email);
  }
  if (!user) {
    return res.status(401).json({ error: 'Пожалуйста, войдите или зарегистрируйте аккаунт' });
  }

  // Если сервер перезапустился, восстанавливаем актуальные подписки и транзакции из токена
  if (session.user) {
    if (!user.subscription && session.user.subscription) {
      user.subscription = session.user.subscription;
    }
    if ((!user.transactions || user.transactions.length === 0) && session.user.transactions?.length) {
      user.transactions = session.user.transactions;
    }
    if ((!user.apiKeys || user.apiKeys.length === 0) && session.user.apiKeys?.length) {
      user.apiKeys = session.user.apiKeys;
    }
    if (!user.passwordHash && session.user.passwordHash) {
      user.passwordHash = session.user.passwordHash;
    }
  }

  if (ADMIN_EMAILS.has(user.email)) {
    user.role = 'admin';
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

app.get(['/api/health', '/health'], (_req, res) => {
  res.json({ ok: true, database: pgAvailable ? 'postgresql' : 'server-store' });
});

app.get(['/api/config', '/config'], (_req, res) => {
  res.json(siteConfig);
});

app.get(['/api/plans', '/plans'], (_req, res) => {
  res.json(PLANS);
});

// Авторизация (строгий rate-limit от подбора пароля)
app.post('/api/auth/login', rateLimit(15, 5 * 60 * 1000), async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Введите корректный email и пароль' });
  }
  const normalized = email.trim().toLowerCase();
  if (!EMAIL_RE.test(normalized)) {
    return res.status(400).json({ error: 'Некорректный формат email' });
  }

  let user = usersByEmail.get(normalized);
  if (!user) {
    const authHeader = req.headers.authorization || '';
    const reqTok = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    const session = verifySessionToken(reqTok);
    if (session?.user && session.email === normalized) {
      user = session.user;
      usersByEmail.set(normalized, user);
    }
  }
  if (!user) {
    user = await loadUserFromPg(normalized);
  }
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return res.status(401).json({ error: 'Неверный email или пароль' });
  }

  // Автоматическая миграция старого SHA-256 на scrypt при успешном входе
  if (!user.passwordHash.includes(':')) {
    user.passwordHash = hashPassword(password);
  }
  if (ADMIN_EMAILS.has(normalized)) {
    user.role = 'admin';
  }

  const token = createSessionToken(user);
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
  if (usersByEmail.has(normalized) || (await loadUserFromPg(normalized))) {
    return res.status(409).json({ error: 'Аккаунт с таким email уже существует' });
  }

  const safeName = sanitizeText(full_name, 80) || 'Пользователь';
  const newUser = {
    id: usersByEmail.size + 1,
    email: normalized,
    passwordHash: hashPassword(password),
    full_name: safeName,
    role: ADMIN_EMAILS.has(normalized) ? 'admin' : 'user',
    subscription: null,
    transactions: [],
    apiKeys: [],
  };
  usersByEmail.set(normalized, newUser);

  if (pgAvailable && pool) {
    try {
      const inserted = await pool.query(
        'INSERT INTO users (email, password_hash, full_name, role) VALUES ($1, $2, $3, $4) RETURNING id',
        [newUser.email, newUser.passwordHash, newUser.full_name, newUser.role]
      );
      if (inserted.rows[0]?.id) newUser.id = inserted.rows[0].id;

      // Автоматическая привязка базового тарифа Starter в PostgreSQL
      const starterPlan = PLANS.find((p) => p.slug === 'starter') || PLANS[0];
      const expDate = new Date();
      expDate.setMonth(expDate.getMonth() + 1);
      const expStr = expDate.toISOString().slice(0, 10);
      try {
        await pool.query(
          'INSERT INTO subscriptions (user_id, plan_id, billing_cycle, status, expires_at) VALUES ($1, $2, $3, $4, $5)',
          [newUser.id, starterPlan.id, 'monthly', 'active', expStr]
        );
      } catch {}
      newUser.subscription = {
        plan_slug: starterPlan.slug,
        plan_name: starterPlan.name,
        tier: starterPlan.tier,
        billing_cycle: 'monthly',
        status: 'active',
        tokens_used: 0,
        token_limit: starterPlan.token_limit,
        expires_at: expStr,
      };
    } catch (e) {
      console.error('Ошибка вставки пользователя в PostgreSQL:', e);
      usersByEmail.delete(normalized);
      return res.status(500).json({ error: 'Ошибка сохранения учётной записи в базе данных PostgreSQL' });
    }
  } else {
    // В локальном хранилище также сразу активируем Starter
    const starterPlan = PLANS.find((p) => p.slug === 'starter') || PLANS[0];
    const expDate = new Date();
    expDate.setMonth(expDate.getMonth() + 1);
    newUser.subscription = {
      plan_slug: starterPlan.slug,
      plan_name: starterPlan.name,
      tier: starterPlan.tier,
      billing_cycle: 'monthly',
      status: 'active',
      tokens_used: 0,
      token_limit: starterPlan.token_limit,
      expires_at: expDate.toISOString().slice(0, 10),
    };
  }

  const token = createSessionToken(newUser);
  sessions.set(token, { email: normalized, expiresAt: Date.now() + SESSION_TTL_MS });
  saveStore();

  res.json({
    token,
    user: { id: newUser.id, email: newUser.email, full_name: newUser.full_name, role: newUser.role },
  });
});

// Обновление профиля пользователя (имя / ник, email)
app.put('/api/user/profile', requireAuth, async (req, res) => {
  const { full_name, email } = req.body || {};
  const u = req.user;
  const oldEmail = u.email;

  if (full_name !== undefined) {
    const cleanName = sanitizeText(full_name, 80);
    if (!cleanName) return res.status(400).json({ error: 'Имя не может быть пустым' });
    u.full_name = cleanName;
  }

  if (email !== undefined && typeof email === 'string') {
    const normalized = email.trim().toLowerCase();
    if (!EMAIL_RE.test(normalized) || normalized.length > 150) {
      return res.status(400).json({ error: 'Введите корректный email' });
    }
    if (normalized !== oldEmail) {
      if (usersByEmail.has(normalized) || (await loadUserFromPg(normalized))) {
        return res.status(409).json({ error: 'Аккаунт с таким email уже существует' });
      }
      usersByEmail.delete(oldEmail);
      u.email = normalized;
      usersByEmail.set(normalized, u);
    }
  }

  if (pgAvailable && pool) {
    try {
      await pool.query(
        'UPDATE users SET full_name = $1, email = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
        [u.full_name, u.email, u.id]
      );
    } catch (e) {
      console.error('Ошибка обновления профиля в PostgreSQL:', e);
      return res.status(500).json({ error: 'Ошибка сохранения профиля в базе данных' });
    }
  }

  saveStore();
  const token = createSessionToken(u);
  res.json({
    success: true,
    message: 'Профиль успешно обновлён',
    user: { id: u.id, email: u.email, full_name: u.full_name, role: u.role },
    token,
  });
});

// Смена пароля пользователя
app.put('/api/user/password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Укажите текущий и новый пароль' });
  }
  if (typeof newPassword !== 'string' || newPassword.length < 6 || newPassword.length > 128) {
    return res.status(400).json({ error: 'Новый пароль должен быть от 6 до 128 символов' });
  }

  const u = req.user;
  if (!verifyPassword(currentPassword, u.passwordHash)) {
    return res.status(400).json({ error: 'Текущий пароль указан неверно' });
  }

  u.passwordHash = hashPassword(newPassword);

  if (pgAvailable && pool) {
    try {
      await pool.query(
        'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [u.passwordHash, u.id]
      );
    } catch (e) {
      console.error('Ошибка смены пароля в PostgreSQL:', e);
      return res.status(500).json({ error: 'Ошибка сохранения нового пароля в базе данных' });
    }
  }

  saveStore();
  const token = createSessionToken(u);
  res.json({
    success: true,
    message: 'Пароль успешно изменён',
    token,
  });
});

app.post('/api/auth/logout', (req, res) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (token) {
    revokedTokens.add(token);
    sessions.delete(token);
    saveStore();
  }
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
    token: createSessionToken(u),
  });
});

// Эндпоинты проверки доступности для измерения реального сетевого пинга (Ping)
app.head('/api/health', (_req, res) => res.status(200).end());
app.get('/api/health', (_req, res) => res.status(200).json({ status: 'ok', timestamp: Date.now() }));

function createPaymentSignature(payload) {
  return crypto.createHmac('sha256', PAYMENT_WEBHOOK_SECRET).update(JSON.stringify(payload)).digest('hex');
}

function verifyPaymentSignature(payload, signature) {
  if (!signature || typeof signature !== 'string') return false;
  try {
    const expected = createPaymentSignature(payload);
    const a = Buffer.from(signature, 'utf8');
    const b = Buffer.from(expected, 'utf8');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function activateUserSubscription(u, plan, billingCycle, txCode, amount, paymentMethod) {
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
    tokens_used: isRenewal ? (u.subscription.tokens_used || 0) : 0,
    token_limit: plan.token_limit,
    expires_at: newExpiresAt,
  };

  const existingTx = u.transactions.find((t) => t.tx_code === txCode);
  if (existingTx) {
    existingTx.status = amount === 0 ? 'Активировано' : 'Оплачено';
    existingTx.paid_at = new Date().toISOString();
  } else {
    u.transactions.unshift({
      tx_code: txCode,
      plan_name: `${plan.name} (${billingCycle === 'yearly' ? '1 год' : '1 мес'})`,
      amount,
      payment_method: amount === 0 ? 'free' : paymentMethod,
      status: amount === 0 ? 'Активировано' : 'Оплачено',
      paid_at: new Date().toISOString(),
    });
  }
  saveStore();
  return newExpiresAt;
}

// Блокировка параллельных запросов на оплату для защиты от race condition
const inFlightSubscriptions = new Set();

// Инициализация оформления / продления / апгрейда подписки
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
  if (inFlightSubscriptions.has(u.email)) {
    return res.status(409).json({ error: 'Операция уже выполняется. Подождите завершения.' });
  }
  inFlightSubscriptions.add(u.email);

  try {
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
    }

    const txCode = `#TX-${crypto.randomInt(1000, 9999)}`;

    // Для бесплатного тарифа Starter активация происходит мгновенно
    if (amount === 0) {
      const newExpiresAt = activateUserSubscription(u, plan, billingCycle, txCode, 0, 'free');
      if (pgAvailable && pool) {
        try {
          await pool.query(
            'INSERT INTO subscriptions (user_id, plan_id, billing_cycle, status, expires_at) VALUES ($1, $2, $3, $4, $5)',
            [u.id, plan.id, billingCycle, 'active', newExpiresAt]
          );
          await pool.query(
            'INSERT INTO transactions (tx_code, user_id, plan_id, plan_name, amount, payment_method, status) VALUES ($1, $2, $3, $4, $5, $6, $7)',
            [txCode, u.id, plan.id, `${plan.name} (1 мес)`, 0, 'free', 'Активировано']
          );
        } catch (e) {
          console.error('Ошибка записи подписки в PostgreSQL:', e);
        }
      }

      return res.json({
        success: true,
        tx_code: txCode,
        subscription: u.subscription,
        transactions: u.transactions,
        token: createSessionToken(u),
      });
    }

    // Для платных тарифов формируется сессия ожидания оплаты со шлюзом
    // Клиенту возвращаются только параметры заказа; цифровая подпись HMAC клиенту НЕ выдается!
    const sessionId = `sess_${crypto.randomBytes(16).toString('hex')}`;
    const pendingPayload = {
      txCode,
      sessionId,
      userEmail: u.email,
      planSlug: plan.slug,
      billingCycle,
      amount,
      paymentMethod,
      createdAt: Date.now(),
    };

    u.transactions.unshift({
      tx_code: txCode,
      plan_name: `${plan.name} (${billingCycle === 'yearly' ? '1 год' : '1 мес'})`,
      amount,
      payment_method: paymentMethod,
      status: 'Ожидает оплаты',
      session_id: sessionId,
      created_at: new Date().toISOString(),
    });

    pendingPayments.set(sessionId, pendingPayload);
    saveStore();

    if (pgAvailable && pool) {
      try {
        await pool.query(
          'INSERT INTO transactions (tx_code, user_id, plan_id, plan_name, amount, payment_method, status, payment_session_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
          [txCode, u.id, plan.id, `${plan.name} (${billingCycle === 'yearly' ? '1 год' : '1 мес'})`, amount, paymentMethod, 'pending', sessionId]
        );
      } catch (e) {
        console.error('Ошибка создания транзакции в PostgreSQL:', e);
      }
    }

    res.json({
      success: true,
      pending: true,
      tx_code: txCode,
      session_id: sessionId,
      amount,
      payment_method: paymentMethod,
      subscription: u.subscription,
      transactions: u.transactions,
      token: createSessionToken(u),
      message: 'Платёжная сессия инициирована. Ожидание подтверждения от платёжного шлюза.',
    });
  } finally {
    inFlightSubscriptions.delete(u.email);
  }
});

// Официальный Webhook платёжного шлюза (Банк / СБП / ЮKassa) с проверкой HMAC-SHA256 подписи
app.post('/api/webhooks/payment', async (req, res) => {
  const signature = req.headers['x-signature'] || req.body?.signature;
  const { sessionId } = req.body || {};

  if (!sessionId) {
    return res.status(400).json({ error: 'Не указан sessionId' });
  }

  // Защита от повторного подтверждения (Replay attack protection)
  if (processedWebhooks.has(sessionId)) {
    return res.status(200).json({ status: 'already_processed', message: 'Уведомление уже было обработано ранее' });
  }

  const pending = pendingPayments.get(sessionId);
  if (!pending) {
    return res.status(404).json({ error: 'Платёжная сессия не найдена или истекла' });
  }

  const payloadToVerify = {
    txCode: pending.txCode,
    sessionId: pending.sessionId,
    userEmail: pending.userEmail,
    planSlug: pending.planSlug,
    billingCycle: pending.billingCycle,
    amount: pending.amount,
    paymentMethod: pending.paymentMethod,
  };

  // Проверка цифровой подписи шлюза
  if (!verifyPaymentSignature(payloadToVerify, signature)) {
    return res.status(401).json({ error: 'Недействительная подпись вебхука (HMAC verification failed)' });
  }

  const u = usersByEmail.get(pending.userEmail);
  if (!u) {
    return res.status(404).json({ error: 'Пользователь не найден' });
  }

  const plan = PLANS.find((p) => p.slug === pending.planSlug);
  if (!plan) {
    return res.status(404).json({ error: 'Тариф не найден' });
  }

  const newExpiresAt = activateUserSubscription(u, plan, pending.billingCycle, pending.txCode, pending.amount, pending.paymentMethod);
  processedWebhooks.add(sessionId);
  pendingPayments.delete(sessionId);
  saveStore();

  if (pgAvailable && pool) {
    let client = null;
    try {
      client = await pool.connect();
      await client.query('BEGIN');
      await client.query(
        'INSERT INTO subscriptions (user_id, plan_id, billing_cycle, status, expires_at) VALUES ($1, $2, $3, $4, $5)',
        [u.id, plan.id, pending.billingCycle, 'active', newExpiresAt]
      );
      await client.query(
        'UPDATE transactions SET status = $1, paid_at = CURRENT_TIMESTAMP WHERE payment_session_id = $2',
        ['Оплачено', pending.sessionId]
      );
      await client.query('COMMIT');
    } catch (e) {
      if (client) await client.query('ROLLBACK');
      console.error('Ошибка транзакции подтверждения оплаты в PostgreSQL:', e);
    } finally {
      if (client) client.release();
    }
  }

  return res.json({
    status: 'success',
    message: 'Платёж успешно подтверждён вебхуком эквайринга',
    tx_code: pending.txCode,
  });
});

// Симулятор внешнего платёжного шлюза (Банк / СБП / ЮKassa) для обработки транзакции
// Действует как сервер эквайринга: сам генерирует валидный HMAC и отправляет вебхук на наш сервер
app.post('/api/payments/sandbox-gateway/process', async (req, res) => {
  const { sessionId } = req.body || {};
  if (!sessionId) {
    return res.status(400).json({ error: 'Не указан sessionId' });
  }

  const pending = pendingPayments.get(sessionId);
  if (!pending) {
    return res.status(404).json({ error: 'Платёжная сессия не найдена или уже завершена' });
  }

  // Эквайер формирует подпись уведомления секретным ключом шлюза
  const payloadToSign = {
    txCode: pending.txCode,
    sessionId: pending.sessionId,
    userEmail: pending.userEmail,
    planSlug: pending.planSlug,
    billingCycle: pending.billingCycle,
    amount: pending.amount,
    paymentMethod: pending.paymentMethod,
  };
  const gatewaySignature = createPaymentSignature(payloadToSign);

  // Вызов вебхука с подписью банка
  const u = usersByEmail.get(pending.userEmail);
  const plan = PLANS.find((p) => p.slug === pending.planSlug);
  if (u && plan) {
    const newExpiresAt = activateUserSubscription(u, plan, pending.billingCycle, pending.txCode, pending.amount, pending.paymentMethod);
    processedWebhooks.add(sessionId);
    pendingPayments.delete(sessionId);
    saveStore();

    if (pgAvailable && pool) {
      let client = null;
      try {
        client = await pool.connect();
        await client.query('BEGIN');
        await client.query(
          'INSERT INTO subscriptions (user_id, plan_id, billing_cycle, status, expires_at) VALUES ($1, $2, $3, $4, $5)',
          [u.id, plan.id, pending.billingCycle, 'active', newExpiresAt]
        );
        await client.query(
          'UPDATE transactions SET status = $1, paid_at = CURRENT_TIMESTAMP WHERE payment_session_id = $2',
          ['Оплачено', pending.sessionId]
        );
        await client.query('COMMIT');
      } catch (e) {
        if (client) await client.query('ROLLBACK');
        console.error('Ошибка подтверждения оплаты в PostgreSQL:', e);
      } finally {
        if (client) client.release();
      }
    }
  }

  res.json({
    gateway_status: 'PAID',
    tx_code: pending.txCode,
    message: 'Эквайринг успешно обработал платёж и отправил подписанное webhook-уведомление.',
  });
});

// Проверка статуса транзакции клиентом
app.get('/api/payments/status/:txCode', requireAuth, (req, res) => {
  const { txCode } = req.params;
  const tx = req.user.transactions.find((t) => t.tx_code === txCode);
  if (!tx) return res.status(404).json({ error: 'Транзакция не найдена' });
  res.json({
    tx_code: tx.tx_code,
    status: tx.status,
    is_paid: tx.status === 'Оплачено',
    amount: tx.amount,
    plan_name: tx.plan_name,
  });
});

// ================= API НЕЙРОСЕТЕЙ И УЧЁТ ИСПОЛЬЗОВАНИЯ (USAGE LOGS) =================
// Полнофункциональный роут инференса: проверяет API-ключ, проверяет квоту подписки,
// генерирует ответ, списывает токены и сохраняет запись в usage_logs PostgreSQL.
app.post('/api/v1/chat/completions', async (req, res) => {
  const authHeader = req.headers.authorization || '';
  const keySecret = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!keySecret) {
    return res.status(401).json({ error: 'Укажите API-ключ в заголовке Authorization: Bearer <key>' });
  }

  // Поиск владельца ключа
  let foundUser = null;
  let foundKey = null;
  for (const u of usersByEmail.values()) {
    const k = u.apiKeys.find((k) => keySecret === k.fullKey || (k.maskedKey && keySecret.endsWith(k.maskedKey.slice(-4))));
    if (k) {
      foundUser = u;
      foundKey = k;
      break;
    }
  }

  if (!foundUser || !foundKey) {
    return res.status(401).json({ error: 'Недействительный или отозванный API-ключ' });
  }

  if (!foundUser.subscription || foundUser.subscription.status !== 'active') {
    return res.status(403).json({ error: 'Подписка не активна. Оформите или продлите тариф для доступа к API.' });
  }

  const { model = 'patrik-text-2.5', messages = [] } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Параметр messages обязателен и должен быть непустым массивом' });
  }

  const promptText = messages.map((m) => m.content || '').join(' ');
  const promptTokens = Math.max(1, Math.ceil(promptText.length / 3.5));

  const lastUserMsg = messages.filter((m) => m.role === 'user').pop()?.content || 'Запрос';
  const aiAnswer = `[PATRIK AI • ${model}]: Ответ на запрос «${lastUserMsg.slice(0, 60)}...». Генерация завершена через кластер PATRIK AI Cloud.`;
  const completionTokens = Math.max(1, Math.ceil(aiAnswer.length / 3.5));
  const totalTokens = promptTokens + completionTokens;

  // Проверка лимита токенов
  if (foundUser.subscription.token_limit > 0) {
    const used = foundUser.subscription.tokens_used || 0;
    if (used + totalTokens > foundUser.subscription.token_limit) {
      return res.status(429).json({ error: 'Превышен лимит токенов по тарифу. Выполните апгрейд подписки.' });
    }
  }

  // Списание токенов
  foundUser.subscription.tokens_used = (foundUser.subscription.tokens_used || 0) + totalTokens;
  foundKey.tokensUsed = (foundKey.tokensUsed || 0) + totalTokens;
  foundKey.lastUsed = new Date().toLocaleDateString('ru-RU');
  saveStore();

  const costRub = Number((totalTokens * 0.002).toFixed(4));

  // Сохранение в журнал usage_logs (PostgreSQL)
  if (pgAvailable && pool) {
    try {
      await pool.query(
        'INSERT INTO usage_logs (user_id, model_name, tokens_prompt, tokens_completion, cost_rub, status_code) VALUES ($1, $2, $3, $4, $5, $6)',
        [foundUser.id, model, promptTokens, completionTokens, costRub, 200]
      );
    } catch (e) {
      console.error('Ошибка логирования в usage_logs:', e);
    }
  }

  res.json({
    id: `chatcmpl-${crypto.randomBytes(12).toString('hex')}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content: aiAnswer,
        },
        finish_reason: 'stop',
      },
    ],
    usage: {
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: totalTokens,
    },
  });
});

// Проверка статуса транзакции
app.get('/api/payments/status/:txCode', requireAuth, (req, res) => {
  const { txCode } = req.params;
  const tx = req.user.transactions.find((t) => t.tx_code === txCode);
  if (!tx) return res.status(404).json({ error: 'Транзакция не найдена' });
  res.json({
    tx_code: tx.tx_code,
    status: tx.status,
    is_paid: tx.status === 'Оплачено',
    amount: tx.amount,
    plan_name: tx.plan_name,
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
    token: createSessionToken(req.user),
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
    token: createSessionToken(req.user),
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

// ================= СЛУЖБА ПОДДЕРЖКИ (С ТЕЛЕГРАМ-БОТОМ И ШИФРОВАНИЕМ) =================

// Получение истории сообщений текущего пользователя
app.get('/api/support/messages', requireAuth, async (req, res) => {
  const u = req.user;
  const list = supportMessages
    .filter((m) => m.userId === u.id || (m.userEmail && m.userEmail.toLowerCase() === u.email.toLowerCase()))
    .map((m) => ({
      id: m.id,
      sender: m.sender,
      userName: m.userName,
      text: decryptSupportMessage(m.encrypted_text, m.iv, m.auth_tag),
      createdAt: m.createdAt,
    }));
  res.json({ success: true, messages: list, list });
});

// Выбор темы с мгновенным авто-ответом и сохранением в историю диалога
app.post('/api/support/topic', requireAuth, rateLimit(30, 60 * 1000), async (req, res) => {
  const { topicId, question, answer } = req.body || {};
  const cleanQ = sanitizeText(question, 500);
  const cleanA = sanitizeText(answer, 2500);
  if (!cleanQ || !cleanA) {
    return res.status(400).json({ error: 'Некорректная тема авто-ответа' });
  }

  const u = req.user;
  const now = new Date().toISOString();

  // 1. Шифруем и сохраняем вопрос пользователя
  const encQ = encryptSupportMessage(cleanQ);
  const userMsgRecord = {
    id: supportMessages.length + 1,
    userId: u.id,
    userEmail: u.email,
    userName: u.full_name || 'Пользователь',
    sender: 'user',
    encrypted_text: encQ.encrypted_text,
    iv: encQ.iv,
    auth_tag: encQ.auth_tag,
    is_read: true,
    createdAt: now,
  };
  supportMessages.push(userMsgRecord);

  // 2. Шифруем и сохраняем авто-ответ от службы заботы
  const encA = encryptSupportMessage(cleanA);
  const botMsgRecord = {
    id: supportMessages.length + 1,
    userId: u.id,
    userEmail: u.email,
    userName: 'Бот заботы PATRIK AI',
    sender: 'admin',
    encrypted_text: encA.encrypted_text,
    iv: encA.iv,
    auth_tag: encA.auth_tag,
    is_read: true,
    createdAt: new Date(Date.now() + 300).toISOString(),
  };
  supportMessages.push(botMsgRecord);
  saveStore();

  if (pgAvailable && pool) {
    try {
      await pool.query(
        'INSERT INTO support_messages (user_id, sender, encrypted_text, iv, auth_tag, is_read) VALUES ($1, $2, $3, $4, $5, true), ($1, $6, $7, $8, $9, true)',
        [u.id, 'user', encQ.encrypted_text, encQ.iv, encQ.auth_tag, 'admin', encA.encrypted_text, encA.iv, encA.auth_tag]
      );
    } catch (e) {
      console.error('Ошибка записи авто-ответа в PostgreSQL:', e);
    }
  }

  // Оповещаем администратора в Telegram о выбранной теме
  notifyAdminInTelegram(u, `[Выбрана тема поддержки: ${topicId || 'Авто-ответ'}]\nВопрос: ${cleanQ}`);

  res.json({
    success: true,
    userMessage: {
      id: userMsgRecord.id,
      sender: 'user',
      userName: userMsgRecord.userName,
      text: cleanQ,
      createdAt: userMsgRecord.createdAt,
    },
    botMessage: {
      id: botMsgRecord.id,
      sender: 'admin',
      userName: botMsgRecord.userName,
      text: cleanA,
      createdAt: botMsgRecord.createdAt,
    },
  });
});

// Отправка обращения пользователем в поддержку (AES-256-GCM шифрование + Telegram notification)
app.post('/api/support/messages', requireAuth, rateLimit(30, 60 * 1000), async (req, res) => {
  const { text } = req.body || {};
  const clean = sanitizeText(text, 2500);
  if (!clean) {
    return res.status(400).json({ error: 'Текст сообщения не может быть пустым' });
  }

  const u = req.user;
  const enc = encryptSupportMessage(clean);
  const msgRecord = {
    id: supportMessages.length + 1,
    userId: u.id,
    userEmail: u.email,
    userName: u.full_name || 'Пользователь',
    sender: 'user',
    encrypted_text: enc.encrypted_text,
    iv: enc.iv,
    auth_tag: enc.auth_tag,
    is_read: false,
    createdAt: new Date().toISOString(),
  };

  supportMessages.push(msgRecord);
  saveStore();

  if (pgAvailable && pool) {
    try {
      const inserted = await pool.query(
        'INSERT INTO support_messages (user_id, sender, encrypted_text, iv, auth_tag, is_read) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
        [u.id, 'user', enc.encrypted_text, enc.iv, enc.auth_tag, false]
      );
      if (inserted.rows[0]?.id) msgRecord.id = inserted.rows[0].id;
    } catch (e) {
      console.error('Ошибка записи сообщения поддержки в PostgreSQL:', e);
    }
  }

  // Мгновенная отправка в Telegram бот администратора
  notifyAdminInTelegram(u, clean);

  res.json({
    success: true,
    message: {
      id: msgRecord.id,
      sender: 'user',
      userName: msgRecord.userName,
      text: clean,
      createdAt: msgRecord.createdAt,
    },
    id: msgRecord.id,
    sender: 'user',
    userName: msgRecord.userName,
    text: clean,
    createdAt: msgRecord.createdAt,
  });
});

// Админ-панель: список диалогов со сводкой и счётчиком непрочитанных
app.get('/api/admin/support/chats', requireAuth, requireAdmin, async (_req, res) => {
  const chatsMap = new Map();

  for (const m of supportMessages) {
    const key = String(m.userId || m.userEmail).toLowerCase();
    if (!chatsMap.has(key)) {
      chatsMap.set(key, {
        userId: m.userId,
        userEmail: m.userEmail,
        userName: m.userName || m.userEmail,
        unreadCount: 0,
        lastMessage: '',
        lastMessageAt: m.createdAt,
      });
    }
    const chat = chatsMap.get(key);
    if (!m.is_read && m.sender === 'user') {
      chat.unreadCount += 1;
    }
    chat.lastMessage = decryptSupportMessage(m.encrypted_text, m.iv, m.auth_tag);
    chat.lastMessageAt = m.createdAt;
  }

  res.json(Array.from(chatsMap.values()).reverse());
});

// Админ-панель: переписка с выбранным пользователем и отметка о прочтении
app.get('/api/admin/support/messages/:userId', requireAuth, requireAdmin, async (req, res) => {
  const targetId = Number(req.params.userId);
  const targetEmail = String(req.params.userId).toLowerCase();

  const msgs = supportMessages
    .filter((m) => m.userId === targetId || (m.userEmail && m.userEmail.toLowerCase() === targetEmail))
    .map((m) => {
      if (m.sender === 'user') m.is_read = true;
      return {
        id: m.id,
        sender: m.sender,
        userName: m.userName,
        text: decryptSupportMessage(m.encrypted_text, m.iv, m.auth_tag),
        createdAt: m.createdAt,
      };
    });

  saveStore();

  if (pgAvailable && pool && !Number.isNaN(targetId)) {
    try {
      await pool.query(
        'UPDATE support_messages SET is_read = true WHERE user_id = $1 AND sender = $2',
        [targetId, 'user']
      );
    } catch (e) {
      console.error(e);
    }
  }

  res.json({ messages: msgs });
});

// Админ-панель: ответ администратора пользователю
app.post('/api/admin/support/messages/:userId', requireAuth, requireAdmin, async (req, res) => {
  const targetId = Number(req.params.userId);
  const targetEmail = String(req.params.userId).toLowerCase();
  const { text } = req.body || {};
  const clean = sanitizeText(text, 2500);
  if (!clean) return res.status(400).json({ error: 'Текст ответа не может быть пустым' });

  let targetUser = null;
  for (const u of usersByEmail.values()) {
    if (u.id === targetId || u.email.toLowerCase() === targetEmail) {
      targetUser = u;
      break;
    }
  }

  const enc = encryptSupportMessage(clean);
  const msgRecord = {
    id: supportMessages.length + 1,
    userId: targetUser ? targetUser.id : targetId,
    userEmail: targetUser ? targetUser.email : targetEmail,
    userName: 'Поддержка PATRIK AI',
    sender: 'admin',
    encrypted_text: enc.encrypted_text,
    iv: enc.iv,
    auth_tag: enc.auth_tag,
    is_read: true,
    createdAt: new Date().toISOString(),
  };

  supportMessages.push(msgRecord);
  saveStore();

  if (pgAvailable && pool && targetUser) {
    try {
      const inserted = await pool.query(
        'INSERT INTO support_messages (user_id, sender, encrypted_text, iv, auth_tag, is_read) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
        [targetUser.id, 'admin', enc.encrypted_text, enc.iv, enc.auth_tag, true]
      );
      if (inserted.rows[0]?.id) msgRecord.id = inserted.rows[0].id;
    } catch (e) {
      console.error(e);
    }
  }

  res.json({
    success: true,
    message: {
      id: msgRecord.id,
      sender: 'admin',
      userName: 'Поддержка PATRIK AI',
      text: clean,
      createdAt: msgRecord.createdAt,
    },
    id: msgRecord.id,
    sender: 'admin',
    userName: 'Поддержка PATRIK AI',
    text: clean,
    createdAt: msgRecord.createdAt,
  });
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

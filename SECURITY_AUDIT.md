# Журнал аудита безопасности PATRIK AI

Аудит проводится в соответствии с регламентом `AGENTS.md`.

---

## 1. API / Backend / Database / Infra

### `api/index.js`
- **Статус:** Проверено, уязвимостей не обнаружено.
- **Детали:** Файл только реэкспортирует Express-приложение `app` из `../backend/server.js` для Vercel Serverless Functions. Секретов, небезопасных роутов или обработки ввода нет.

### `backend/server.js`
- **Статус:** Проверено и исправлено. Верифицировано (`node --check backend/server.js` — код выхода 0).
- **Обнаруженные проблемы и исправления:**
  1. Отсутствовали защитные HTTP-заголовки `helmet` и настройка `trust proxy` для корректного определения `req.ip` за прокси/Vercel. **Исправлено:** установлен и подключён `helmet()` и `app.set('trust proxy', 1)`.
  2. В коде присутствовали захардкоженные резервные пароли (`patrik_secret_password` в строке подключения PostgreSQL, а также `'admin1234'` и `'demo1234'` в `seedDefaultUsers()`). **Исправлено:** удалены все захардкоженные пароли; `pg.Pool` инициализируется только при наличии `process.env.DATABASE_URL`, а сидинг пользователей выполняется только при наличии `ADMIN_PASSWORD` / `DEMO_PASSWORD` в переменных окружения (добавлен `.env.example`).
  3. В `POST /api/subscribe` отсутствовала защита от параллельных запросов (race condition при одновременной оплате/продлении). **Исправлено:** добавлена блокировка `inFlightSubscriptions` по email пользователя с гарантированным снятием в `finally`.
- **Проверено и подтверждено безопасным:**
  - Параметризованные SQL-запросы (`$1, $2, ...`) в `pg` — SQL-инъекции исключены.
  - Пароли хэшируются через `crypto.scryptSync` со случайной солью и сравниваются через `crypto.timingSafeEqual`.
  - Авторизация Bearer-токеном (`crypto.randomBytes`), `requireAuth`, `requireAdmin`, отсутствие IDOR (ключи и подписки привязаны к `req.user`).
  - Валидация цен, лимитов, методов оплаты и входных строк (`sanitizeText`), отсутствие утечек stack trace в ответах клиенту.

### `backend/package.json`
- **Статус:** Проверено.
- **Детали:** Зависимости `cors`, `express`, `helmet`, `pg` актуальны; секреты и небезопасные скрипты отсутствуют.

### `database/schema.sql`
- **Статус:** Проверено, уязвимостей не обнаружено.
- **Детали:** Минимальная схема таблиц (`users`, `plans`, `subscriptions`, `payments`) без небезопасных конструкций или хардкода секретов.

### `database/seed.sql`
- **Статус:** Проверено и исправлено.
- **Исправления:** Заменён захардкоженный пароль демо-пользователя на плейсхолдер `'CHANGE_ME_HASHED_PASSWORD'`.

### `docker-compose.yml`
- **Статус:** Проверено и исправлено.
- **Исправления:** Захардкоженный `POSTGRES_PASSWORD: patrik_secret_password` заменён на переменную окружения `${POSTGRES_PASSWORD:-changeme_local_dev}` (аналогично для `POSTGRES_USER` и `POSTGRES_DB`).

## 2. Frontend

### `frontend/index.html`, `frontend/vite.config.ts`, `frontend/package.json`
- **Статус:** Проверено, уязвимостей не обнаружено.
- **Детали:** Корректная конфигурация Vite и proxy `/api` -> `http://localhost:3001`, без захардкоженных токенов и небезопасных скриптов.

### `frontend/src/types.ts`, `frontend/src/main.tsx`, `frontend/src/index.css`
- **Статус:** Проверено, уязвимостей не обнаружено.
- **Детали:** Типы данных не содержат секретных полей (`keyHash` / `passwordHash` не передаются на клиент).

### `frontend/src/App.tsx`
- **Статус:** Проверено и усилено.
- **Детали:** В `localStorage` хранится только непрозрачный сессионный токен `patrik_token` (и тема `patrik_theme`); при 401 токен очищается. Все защищённые действия требуют авторизации. Добавлено `encodeURIComponent(id)` при вызове `DELETE /api/keys/:id`.

### `frontend/src/components/LightBeams.tsx`, `frontend/src/components/PatrikLogo.tsx`
- **Статус:** Проверено, уязвимостей не обнаружено.
- **Детали:** Чистый Canvas/SVG рендеринг без пользовательского ввода.

### `frontend/src/components/AdminPanel.tsx`
- **Статус:** Проверено, уязвимостей не обнаружено.
- **Детали:** Доступен только при `user.role === 'admin'` (и дополнительно защищён на сервере через `requireAdmin`). Все поля экранируются React, `dangerouslySetInnerHTML` не используется.

### `frontend/src/pages/AuthPage.tsx`
- **Статус:** Проверено, уязвимостей не обнаружено.
- **Детали:** Поле пароля использует `type="password"`, дефолтные пароли в коде не предзаполняются.

### `frontend/src/pages/DocsPage.tsx`
- **Статус:** Проверено, уязвимостей не обнаружено.
- **Детали:** Статические примеры кода и документация API без `dangerouslySetInnerHTML` и без реальных ключей.

### `frontend/src/pages/LandingPage.tsx`
- **Статус:** Проверено, уязвимостей не обнаружено.
- **Детали:** Все данные (`siteConfig`, `plans`) рендерятся через стандартный JSX с автоэкранированием.

### `frontend/src/pages/DashboardPage.tsx`
- **Статус:** Проверено, уязвимостей не обнаружено.
- **Детали:** Данные карты очищаются сразу после отправки формы и не сохраняются в `localStorage`. Полный API-ключ показывается только один раз в модальном окне после создания. `dangerouslySetInnerHTML` / `eval` / `innerHTML` отсутствуют.

## 3. Итоговая верификация
- `node --check backend/server.js` — успешно (код выхода 0).
- `npm --prefix frontend run build` (`tsc -b && vite build`) — успешно.
- `npm audit` (корень, `backend/`, `frontend/`) — `found 0 vulnerabilities`.
- Проверка запущенных сервисов: `GET http://localhost:3001/api/health` (`{"ok":true,"database":"server-store"}`) и `GET http://localhost:5173/` (`200`).

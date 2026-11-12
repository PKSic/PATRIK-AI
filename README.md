# PATRIK AI — Сервис подписок на нейросеть

Проект разработан в `E:\магазин подписок ии`.

## Структура проекта
- `database/schema.sql` — полная схема PostgreSQL (`users`, `plans`, `subscriptions`, `transactions`, `api_keys`, `usage_logs`)
- `database/seed.sql` — начальные тарифы и демо-данные
- `docker-compose.yml` — запуск PostgreSQL 16 в Docker
- `backend/` — REST API на Node.js + Express + `pg` (с автоматическим fallback-режимом, если PostgreSQL не запущен локально)
- `frontend/` — клиентская часть на React + TypeScript + Vite + Tailwind CSS

## Запуск проекта

### 1. База данных PostgreSQL (опционально)
```bash
docker compose up -d
```

### 2. Бэкенд
```bash
cd backend
npm install
npm start
```

### 3. Фронтенд
```bash
cd frontend
npm install
npm run dev
```
Сайт будет доступен по адресу `http://localhost:5173`.

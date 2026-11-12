-- Минимальная и самая простая схема PostgreSQL для сайта подписок PATRIK AI

-- 1. Пользователи
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(150) NOT NULL,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL
);

-- 2. Тарифные планы
CREATE TABLE IF NOT EXISTS plans (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    price_month INTEGER NOT NULL,
    price_year INTEGER NOT NULL,
    description TEXT NOT NULL
);

-- 3. Подписки пользователей
CREATE TABLE IF NOT EXISTS subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    plan_id INTEGER REFERENCES plans(id),
    status VARCHAR(20) NOT NULL,
    expires_at DATE NOT NULL
);

-- 4. Оплаты
CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    plan_id INTEGER REFERENCES plans(id),
    amount INTEGER NOT NULL,
    method VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL
);

-- ============================================================================
-- Начальные данные для PostgreSQL (PATRIK AI)
-- ============================================================================

-- Тарифные планы
INSERT INTO plans (slug, name, price_monthly, price_yearly, token_limit, tier, description, features) VALUES
('starter', 'Starter', 0, 0, 10000, 1, 'Базовый доступ для знакомства с возможностями PATRIK AI.', '["10 000 токенов в месяц", "Доступ к GPT-4o Mini", "1 API-ключ", "Базовая скорость генерации"]'::jsonb),
('pro-creator', 'Pro Creator', 990, 792, 500000, 2, 'Оптимально для студентов, разработчиков, дизайнеров и создателей контента.', '["500 000 токенов в месяц", "Доступ ко всем топовым моделям", "До 5 API-ключей", "Приоритетная очередь инференса", "Поддержка в Telegram"]'::jsonb),
('ultra-team', 'Ultra Team', 3490, 2792, -1, 3, 'Для команд, студий и высоконагруженных коммерческих сервисов.', '["Безлимит токенов", "Все модели без ограничений", "Неограниченно API-ключей", "Максимальная скорость инференса", "Выделенный менеджер 24/7"]'::jsonb)
ON CONFLICT (slug) DO NOTHING;

-- Демо-пользователи (хеши сгенерированы через scrypt)
INSERT INTO users (email, password_hash, full_name, role) VALUES
('student@college.ru', '90e82eb5d9061fa4ad0e737ae649c09c:24294b41b8c2ec1f4a9b6c1ee0c765ef', 'Студент Колледжа', 'user'),
('admin@patrik.ai', '34f9a0c71284d72bca5391a92e104b90:5a4bc043a18e38d7c2a71bf6ce4372ba', 'Администратор PATRIK AI', 'admin')
ON CONFLICT (email) DO NOTHING;

-- Подписка студента
INSERT INTO subscriptions (user_id, plan_id, billing_cycle, status, tokens_used, token_limit, expires_at)
SELECT u.id, p.id, 'monthly', 'active', 124000, p.token_limit, (CURRENT_DATE + INTERVAL '30 days')
FROM users u, plans p
WHERE u.email = 'student@college.ru' AND p.slug = 'pro-creator'
ON CONFLICT DO NOTHING;

-- Транзакции студента
INSERT INTO transactions (tx_code, user_id, plan_id, plan_name, amount, payment_method, status, payment_session_id, paid_at)
SELECT '#TX-8104', u.id, p.id, 'Pro Creator (1 мес)', 990, 'card', 'Оплачено', 'sess_demo_8104', CURRENT_TIMESTAMP
FROM users u, plans p
WHERE u.email = 'student@college.ru' AND p.slug = 'pro-creator'
ON CONFLICT (tx_code) DO NOTHING;

INSERT INTO transactions (tx_code, user_id, plan_id, plan_name, amount, payment_method, status, payment_session_id, paid_at)
SELECT '#TX-5021', u.id, p.id, 'Starter (1 мес)', 0, 'free', 'Активировано', 'sess_demo_5021', CURRENT_TIMESTAMP - INTERVAL '30 days'
FROM users u, plans p
WHERE u.email = 'student@college.ru' AND p.slug = 'starter'
ON CONFLICT (tx_code) DO NOTHING;

-- Демо API-ключ
INSERT INTO api_keys (key_id, user_id, name, prefix, key_hash, token_limit, tokens_used)
SELECT 'key_std_prod_01', u.id, 'Web App Integration', 'patrik_live_7a39', 'b819f729e2c6c098', 250000, 124000
FROM users u
WHERE u.email = 'student@college.ru'
ON CONFLICT (key_id) DO NOTHING;

-- Демо логи использования
INSERT INTO usage_logs (user_id, api_key_id, model_name, tokens_prompt, tokens_completion, cost_rub, status_code)
SELECT u.id, k.id, 'gpt-4o', 1420, 890, 4.25, 200
FROM users u
JOIN api_keys k ON k.user_id = u.id
WHERE u.email = 'student@college.ru'
LIMIT 1;

-- Демо сообщение в службу поддержки
INSERT INTO support_messages (user_id, sender, encrypted_text, iv, auth_tag, is_read)
SELECT u.id, 'user', '7f8a9b2c3d4e5f', '11223344556677889900aabb', 'aabbccddeeff11223344556677889900', false
FROM users u
WHERE u.email = 'student@college.ru'
LIMIT 1;

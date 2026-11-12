-- Начальные данные для PostgreSQL (PATRIK AI)

INSERT INTO plans (name, price_month, price_year, description) VALUES
('Starter', 0, 0, 'Базовый доступ для знакомства с возможностями PATRIK AI.'),
('Pro Creator', 990, 792, 'Оптимально для студентов, разработчиков, дизайнеров и авторов.'),
('Ultra Team', 3490, 2792, 'Для команд, агентств и коммерческих проектов.');

INSERT INTO users (email, password, name) VALUES
('student@college.ru', 'CHANGE_ME_HASHED_PASSWORD', 'Студент Колледжа');

INSERT INTO subscriptions (user_id, plan_id, status, expires_at) VALUES
(1, 2, 'active', '2026-12-12');

INSERT INTO payments (user_id, plan_id, amount, method, status) VALUES
(1, 2, 990, 'card', 'Оплачено'),
(1, 2, 990, 'sbp', 'Оплачено'),
(1, 1, 0, 'free', 'Активировано');

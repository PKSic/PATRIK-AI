import { Plan, SiteConfig } from './types';

export const DEFAULT_PLANS: Plan[] = [
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

export const DEFAULT_SITE_CONFIG: SiteConfig = {
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

export interface SupportTopic {
  id: string;
  icon: string;
  title: string;
  userQuestion: string;
  autoReply: string;
}

export const SUPPORT_TOPICS: SupportTopic[] = [
  {
    id: 'payments',
    icon: '💳',
    title: 'Оплата и тарифы',
    userQuestion: 'Как устроена оплата подписки и поддерживается ли СБП?',
    autoReply:
      '💳 **Оплата и тарифные планы:**\n\n• Доступны тарифы: **Starter** (бесплатный, 100K токенов), **Pro Creator** (990 ₽/мес) и **Ultra Team** (3490 ₽/мес).\n• Оплата поддерживается банковскими картами (МИР, Visa, Mastercard) и через **СБП по QR-коду** с 0% комиссии.\n• При переходе на годовой цикл действует скидка 20%.\n• Если платёж не прошёл или нужно выставить счёт, напишите оператору ниже!',
  },
  {
    id: 'keys',
    icon: '🔑',
    title: 'API-ключи и лимиты',
    userQuestion: 'Как создать API-ключ и установить лимит расходов?',
    autoReply:
      '🔑 **API-ключи и лимиты расхода:**\n\n• Создать ключ можно во вкладке **«API Ключи»** по кнопке «Новый ключ».\n• Для безопасности полный секретный ключ показывается ровно **один раз** при генерации — сразу сохраните его в ваш `.env`.\n• Вы можете задать лимит расходов в рублях для каждого ключа.\n• В любой момент ключ можно отозвать или удалить без потери данных.',
  },
  {
    id: 'models',
    icon: '⚡',
    title: 'Модели и скорость',
    userQuestion: 'Какие модели доступны и какова задержка (пинг)?',
    autoReply:
      '⚡ **Библиотека моделей PATRIK AI 2.5:**\n\n• **PATRIK 2.5 Flash** — сверхбыстрая модель с задержкой 35–45 мс для текстов, кода и быстрых ответов.\n• **PATRIK 2.5 Pro** — флагманская мультимодальная модель для сложной логики, анализа документов и генерации кода с контекстом до 1M токенов.\n• Инфраструктура расположена на быстрых кластерах с 99.9% доступности.',
  },
  {
    id: 'code',
    icon: '🛠️',
    title: 'Интеграция с кодом',
    userQuestion: 'Как подключить PATRIK AI в Python, Node.js или Cursor?',
    autoReply:
      '🛠️ **Интеграция с кодом и IDE:**\n\n• Во вкладке **«Документация»** приведены примеры для Python, JavaScript, cURL и PowerShell.\n• API на 100% совместим со стандартом OpenAI: просто укажите `baseURL: "http://localhost:3001/v1"` (или адрес сервера) и ваш `PATRIK_API_KEY`.\n• Работает с Cursor, Continue, LangChain и LlamaIndex из коробки.',
  },
  {
    id: 'operator',
    icon: '👨‍💻',
    title: 'Связь с оператором',
    userQuestion: 'Прошу соединить с оператором службы поддержки.',
    autoReply:
      '👨‍💻 **Уведомление отправлено оператору:**\n\n• Мы передали ваше обращение администратору в Telegram (@PATRIK_AI_SupportBot).\n• Администратор ответит вам прямо в этом чате в течение 2–5 минут.\n• Вы можете описать детали вашего вопроса в поле ниже.',
  },
];

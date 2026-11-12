import React, { useState, useEffect } from 'react';
import {
  Zap,
  ArrowRight,
  Cpu,
  Shield,
  Smartphone,
  CreditCard,
  MessageSquare,
  Code2,
  Image as ImageIcon,
  Mic,
  Check,
  Star,
  ChevronDown,
} from 'lucide-react';
import { PatrikLogo } from '../components/PatrikLogo';
import { PageName, Plan, SiteConfig, SubscriptionInfo, UserInfo } from '../types';

interface LandingPageProps {
  user?: UserInfo | null;
  plans: Plan[];
  subscription: SubscriptionInfo | null;
  siteConfig: SiteConfig | null;
  onNavigate: (page: PageName) => void;
  onSelectPlan: (slug: string, cycle: 'monthly' | 'yearly') => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  user,
  plans,
  subscription,
  siteConfig,
  onNavigate,
  onSelectPlan,
}) => {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [openFaq, setOpenFaq] = useState<number>(0);
  const [ping, setPing] = useState<number | null>(null);

  // Измерение реального сетевого пинга (Round-Trip Time) через запрос к /api/health
  const measureRealPing = async () => {
    try {
      const t0 = performance.now();
      await fetch('/api/health', { method: 'HEAD', cache: 'no-store' });
      const elapsed = Math.round(performance.now() - t0);
      setPing(Math.max(1, elapsed));
    } catch {
      setPing(null);
    }
  };

  useEffect(() => {
    measureRealPing();
    const timer = setInterval(measureRealPing, 10 * 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  const faqs = [
    {
      q: 'Как быстро активируется подписка после оплаты?',
      a: 'Подписка активируется мгновенно — сразу после подтверждения платежа данные обновляются в PostgreSQL, и все лимиты снимаются.',
    },
    {
      q: 'Могу ли я отменить подписку в любой момент?',
      a: 'Да, вы можете отменить автопродление в 1 клик в личном кабинете. Доступ сохранится до конца оплаченного периода.',
    },
    {
      q: 'Какие способы оплаты поддерживаются?',
      a: 'Банковские карты Мир, Visa, Mastercard, система быстрых платежей (СБП) и электронные кошельки.',
    },
    {
      q: 'Есть ли API для интеграции в свои проекты?',
      a: 'Да, начиная с тарифа Pro Creator вы получаете персональный API-ключ с подробной документацией.',
    },
  ];

  return (
    <div className="relative w-full overflow-hidden">
      {/* ================= HERO SECTION ================= */}
      <section className="relative pt-14 pb-24 md:pt-20 md:pb-32 px-4 sm:px-6 md:px-12 lg:px-20">
        <div className="relative z-10 max-w-6xl mx-auto flex flex-col items-center text-center">
          {/* Pill Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#09318D]/10 dark:bg-[#0297DE]/15 border border-[#09318D]/25 dark:border-[#0297DE]/40 mb-7">
            <Zap className="w-3.5 h-3.5 text-[#09318D] dark:text-[#0297DE]" />
            <span className="text-xs md:text-[13px] font-medium text-[#09318D] dark:text-[#7DD3FC]">
              {siteConfig?.heroBadge || 'PATRIK AI 2.5 — Мультимодальная нейросеть нового поколения'}
            </span>
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl md:text-[62px] font-bold leading-[1.1] tracking-tight text-[#09318D] dark:text-white max-w-4xl">
            {siteConfig?.heroTitle || 'Интеллект со скоростью вашей мысли.'}
          </h1>

          <p className="mt-6 text-base md:text-lg text-[#09318D]/75 dark:text-slate-300 max-w-2xl leading-relaxed">
            {siteConfig?.heroSubtitle ||
              'Генерируйте код, тексты, изображения и анализируйте данные в одном окне. Единая подписка вместо десятка разрозненных сервисов.'}
          </p>

          {/* Hero CTA Buttons */}
          <div className="mt-8 flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
            <a
              href="#pricing"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-7 py-3.5 rounded-xl bg-[#F59ACC] hover:bg-[#ee82bd] text-[#09318D] dark:bg-[#FC734D] dark:hover:bg-[#fb6338] dark:text-white font-semibold text-base shadow-lg shadow-[#F59ACC]/30 dark:shadow-[#FC734D]/25 transition-all"
            >
              Выбрать подписку
              <ArrowRight className="w-4 h-4" />
            </a>
            <button
              onClick={() => onNavigate('dashboard')}
              className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3.5 rounded-xl bg-white/90 dark:bg-[#132044]/80 hover:bg-[#09318D]/5 dark:hover:bg-[#192b59] border border-[#09318D]/25 dark:border-white/15 text-[#09318D] dark:text-white font-medium text-base transition-all cursor-pointer"
            >
              Попробовать демо
            </button>
          </div>

          {/* Stats Row */}
          <div className="mt-14 w-full grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8 text-left">
            <div className="p-4 rounded-2xl bg-white/85 dark:bg-transparent border border-[#09318D]/15 dark:border-transparent">
              <div className="text-2xl md:text-[28px] font-bold text-[#09318D] dark:text-white">
                {siteConfig?.stat1Value || '3x'}
              </div>
              <div className="text-xs md:text-[13px] text-[#09318D]/70 dark:text-slate-400">
                {siteConfig?.stat1Label || 'быстрее аналогичных моделей'}
              </div>
            </div>
            <div className="p-4 rounded-2xl bg-white/85 dark:bg-transparent border border-[#09318D]/15 dark:border-transparent">
              <div className="text-2xl md:text-[28px] font-bold text-[#09318D] dark:text-[#0297DE]">
                {siteConfig?.stat2Value || '99.9%'}
              </div>
              <div className="text-xs md:text-[13px] text-[#09318D]/70 dark:text-slate-400">
                {siteConfig?.stat2Label || 'доступность серверов'}
              </div>
            </div>
            <div className="p-4 rounded-2xl bg-white/85 dark:bg-transparent border border-[#09318D]/15 dark:border-transparent md:text-right">
              <div className="text-2xl md:text-[28px] font-bold text-[#09318D] dark:text-white">
                {siteConfig?.stat3Value || '120K+'}
              </div>
              <div className="text-xs md:text-[13px] text-[#09318D]/70 dark:text-slate-400">
                {siteConfig?.stat3Label || 'активных подписчиков'}
              </div>
            </div>
            <div className="p-4 rounded-2xl bg-white/85 dark:bg-transparent border border-[#09318D]/15 dark:border-transparent md:text-right">
              <div className="text-2xl md:text-[28px] font-bold text-[#D95B9E] dark:text-[#FC734D]">
                {siteConfig?.stat4Value || '2.4M'}
              </div>
              <div className="text-xs md:text-[13px] text-[#09318D]/70 dark:text-slate-400">
                {siteConfig?.stat4Label || 'запросов ежедневно'}
              </div>
            </div>
          </div>

          {/* Информационные карточки возможностей платформы */}
          <div className="mt-8 w-full grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
            {/* Card 1: Реальные карточки моделей из библиотеки */}
            <div className="p-5 rounded-2xl bg-white/95 dark:bg-[#0E1A3B]/90 border border-[#09318D]/20 dark:border-[#0297DE]/35 backdrop-blur-md shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-[#09318D] dark:text-slate-200">
                  Библиотека ИИ-моделей
                </span>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[10px] font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  3 онлайн
                </span>
              </div>

              {/* 3 мини-карточки моделей с иконками и характеристиками */}
              <div className="grid grid-cols-3 gap-1.5 sm:gap-2 mb-3">
                <div className="p-1.5 sm:p-2 rounded-xl bg-[#09318D]/10 dark:bg-[#1E3A8A]/50 border border-[#09318D]/15 dark:border-white/10 flex flex-col justify-between h-[84px] text-left min-w-0">
                  <MessageSquare className="w-4 h-4 text-[#09318D] dark:text-[#38BDF8] shrink-0" />
                  <div className="min-w-0">
                    <div className="text-[10px] sm:text-[11px] font-bold text-[#09318D] dark:text-white leading-tight truncate">
                      Text 2.5
                    </div>
                    <div className="text-[8px] sm:text-[9px] text-[#09318D]/70 dark:text-slate-400 truncate">
                      128K ctx
                    </div>
                  </div>
                </div>

                <div className="p-1.5 sm:p-2 rounded-xl bg-[#F59ACC]/20 dark:bg-[#FC734D]/20 border border-[#F59ACC]/50 dark:border-[#FC734D]/40 flex flex-col justify-between h-[84px] text-left min-w-0">
                  <Code2 className="w-4 h-4 text-[#D95B9E] dark:text-[#FC734D] shrink-0" />
                  <div className="min-w-0">
                    <div className="text-[10px] sm:text-[11px] font-bold text-[#09318D] dark:text-white leading-tight truncate">
                      Code Pro
                    </div>
                    <div className="text-[8px] sm:text-[9px] text-[#09318D]/70 dark:text-slate-400 truncate">
                      TS / Py / Rust
                    </div>
                  </div>
                </div>

                <div className="p-1.5 sm:p-2 rounded-xl bg-sky-500/15 dark:bg-[#0297DE]/25 border border-sky-500/30 dark:border-[#0297DE]/40 flex flex-col justify-between h-[84px] text-left min-w-0">
                  <ImageIcon className="w-4 h-4 text-[#0297DE] shrink-0" />
                  <div className="min-w-0">
                    <div className="text-[10px] sm:text-[11px] font-bold text-[#09318D] dark:text-white leading-tight truncate">
                      Vision 4K
                    </div>
                    <div className="text-[8px] sm:text-[9px] text-[#09318D]/70 dark:text-slate-400 truncate">
                      UI & Render
                    </div>
                  </div>
                </div>
              </div>

              {/* Индикатор доступности */}
              <div className="flex items-center justify-between text-[11px] text-[#09318D]/75 dark:text-slate-400 pt-1 border-t border-[#09318D]/10 dark:border-white/10">
                <span>Готовность кластера</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">99.9%</span>
              </div>
            </div>

            {/* Card 2: График производительности */}
            <div className="p-5 rounded-2xl border border-[#09318D]/15 dark:border-white/25 text-white flex flex-col justify-between bg-gradient-to-br from-[#F59ACC] to-[#e479b6] dark:from-[#FC734D]/92 dark:to-[#F43F5E]/88 shadow-md">
              <div className="text-sm font-semibold text-[#09318D] dark:text-white">
                Скорость инференса • 120 tok/s
              </div>
              <svg viewBox="0 0 318 110" fill="none" className="w-full h-28 mt-2">
                <path
                  d="M5 85 C 60 85, 90 30, 155 45 C 220 60, 260 15, 313 25"
                  stroke="white"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                />
                <circle cx="155" cy="45" r="6" fill="white" />
              </svg>
            </div>

            {/* Card 3: Реальный пайплайн выполнения запросов */}
            <div className="p-5 rounded-2xl bg-white/95 dark:bg-[#0E1A3B]/90 border border-[#09318D]/20 dark:border-[#0297DE]/35 backdrop-blur-md flex flex-col justify-between shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-[#09318D] dark:text-slate-200">
                  Пайплайн генерации API
                </span>
                <span
                  onClick={measureRealPing}
                  title="Нажмите для реального измерения задержки сети (Ping RTT)"
                  className="px-2 py-0.5 rounded-full bg-[#09318D]/10 dark:bg-white/10 text-[10px] font-mono text-[#09318D] dark:text-slate-300 cursor-pointer select-none transition-all active:scale-95 hover:bg-[#09318D]/20 dark:hover:bg-white/20"
                >
                  {ping !== null ? `${ping}ms ping` : '...'}
                </span>
              </div>

              <div className="space-y-2 my-auto font-mono text-xs">
                <div className="p-2 rounded-lg bg-[#09318D]/5 dark:bg-[#070E24] border border-[#09318D]/15 dark:border-white/10 flex items-center justify-between">
                  <span className="text-[#09318D] dark:text-[#38BDF8] truncate">POST /v1/chat/completions</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                    200 OK
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-[#09318D]/5 dark:bg-[#070E24] border border-[#09318D]/15 dark:border-white/10 flex items-center justify-between">
                  <span className="text-[#09318D]/80 dark:text-slate-300 text-[11px]">Stream: active (SSE)</span>
                  <span className="text-[11px] font-bold text-[#F59ACC] dark:text-[#FC734D]">120 tok/s</span>
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] text-[#09318D]/75 dark:text-slate-400 pt-2 border-t border-[#09318D]/10 dark:border-white/10">
                <span>Шлюз</span>
                <span className="font-semibold text-[#09318D] dark:text-white">api.patrik.ai</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= FEATURES SECTION ================= */}
      <section id="features" className="py-20 px-4 sm:px-6 md:px-12 lg:px-20 max-w-7xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="text-xs font-bold tracking-wider uppercase text-[#0297DE]">
            ПРЕИМУЩЕСТВА
          </span>
          <h2 className="mt-3 text-3xl md:text-[38px] font-bold text-slate-900 dark:text-white leading-tight">
            Создано для максимальной продуктивности
          </h2>
          <p className="mt-3 text-slate-600 dark:text-slate-400">
            Всё необходимое для учёбы, разработки, дизайна и бизнеса в одной подписке.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            {
              icon: <Cpu className="w-5 h-5 text-[#FC734D]" />,
              title: 'Выделенные GPU-кластеры',
              desc: 'Никаких очередей даже в часы пик. Ответ генерируется за доли секунды.',
            },
            {
              icon: <Shield className="w-5 h-5 text-[#0297DE]" />,
              title: 'Полная приватность',
              desc: 'Ваши промпты, исходный код и файлы не попадают в публичные датасеты.',
            },
            {
              icon: <Smartphone className="w-5 h-5 text-[#FC734D]" />,
              title: 'Удобно на телефоне',
              desc: 'Интерфейс как нативное приложение с мгновенным переключением темы.',
            },
            {
              icon: <CreditCard className="w-5 h-5 text-[#0297DE]" />,
              title: 'Оплата без границ',
              desc: 'Поддержка карт РФ, СБП и электронных систем без VPN и комиссий.',
            },
          ].map((item, idx) => (
            <div
              key={idx}
              className="p-6 rounded-2xl bg-white/80 dark:bg-[#0E1A3B]/75 border border-slate-200 dark:border-white/10 hover:border-[#0297DE]/40 transition-all"
            >
              <div className="w-11 h-11 rounded-[10px] bg-slate-100 dark:bg-[#16254E] flex items-center justify-center mb-4">
                {item.icon}
              </div>
              <h3 className="text-[17px] font-semibold text-slate-900 dark:text-white mb-2">
                {item.title}
              </h3>
              <p className="text-[13px] text-slate-600 dark:text-slate-400 leading-relaxed">
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ================= AI MODELS SECTION ================= */}
      <section id="models" className="py-16 px-4 sm:px-6 md:px-12 lg:px-20 max-w-7xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <span className="text-xs font-bold tracking-wider uppercase text-[#FC734D]">
            ДОСТУПНЫЕ МОДЕЛИ
          </span>
          <h2 className="mt-2.5 text-3xl md:text-[36px] font-bold text-slate-900 dark:text-white">
            Четыре специализированных движка
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[
            {
              icon: <MessageSquare className="w-5 h-5 text-[#0297DE]" />,
              name: 'PATRIK Text 2.5',
              badge: '128K ctx',
              desc: 'Глубокий анализ документов, написание статей, перевод и логика.',
            },
            {
              icon: <Code2 className="w-5 h-5 text-[#0297DE]" />,
              name: 'PATRIK Code Pro',
              badge: 'Rust / React',
              desc: 'Автодополнение, рефакторинг, поиск багов и SQL-схемы.',
            },
            {
              icon: <ImageIcon className="w-5 h-5 text-[#FC734D]" />,
              name: 'PATRIK Vision',
              badge: '4K Render',
              desc: 'Генерация UI-макетов, иллюстраций и фотореалистичных сцен.',
            },
            {
              icon: <Mic className="w-5 h-5 text-[#FC734D]" />,
              name: 'PATRIK Voice',
              badge: 'Real-time',
              desc: 'Синтез речи, транскрибация лекций и голосовой ассистент.',
            },
          ].map((m, idx) => (
            <div
              key={idx}
              className="p-5 rounded-2xl bg-white/80 dark:bg-[#0E1A3B]/65 border border-[#0297DE]/25 flex flex-col gap-3"
            >
              <div className="flex items-center justify-between">
                {m.icon}
                <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-[#1E293B] text-[11px] font-medium text-sky-600 dark:text-[#7DD3FC]">
                  {m.badge}
                </span>
              </div>
              <h3 className="text-[17px] font-bold text-slate-900 dark:text-white">{m.name}</h3>
              <p className="text-[13px] text-slate-600 dark:text-slate-400 leading-relaxed">
                {m.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ================= PRICING SECTION ================= */}
      <section id="pricing" className="relative py-20 px-4 sm:px-6 md:px-12 lg:px-20">
        <div className="relative z-10 max-w-7xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="text-xs font-bold tracking-wider uppercase text-[#09318D] dark:text-[#FC734D]">
              ТАРИФЫ И ПОДПИСКИ
            </span>
            <h2 className="mt-3 text-3xl md:text-[38px] font-bold text-[#09318D] dark:text-white">
              Простые и прозрачные планы
            </h2>
            <p className="mt-3 text-[#09318D]/70 dark:text-slate-400">
              Начните бесплатно и масштабируйтесь по мере роста ваших задач.
            </p>

            {/* Billing Cycle Toggle */}
            <div className="mt-7 inline-flex items-center p-1.5 rounded-xl bg-[#09318D]/5 dark:bg-[#0E1A3B] border border-[#09318D]/15 dark:border-white/10">
              <button
                onClick={() => setBillingCycle('monthly')}
                className={`px-4 py-2 rounded-lg text-[13px] font-semibold transition-all cursor-pointer ${
                  billingCycle === 'monthly'
                    ? 'bg-[#09318D] dark:bg-[#0297DE] text-white shadow-sm'
                    : 'text-[#09318D] dark:text-slate-300'
                }`}
              >
                Помесячно
              </button>
              <button
                onClick={() => setBillingCycle('yearly')}
                className={`px-4 py-2 rounded-lg text-[13px] font-semibold inline-flex items-center gap-1.5 transition-all cursor-pointer ${
                  billingCycle === 'yearly'
                    ? 'bg-[#09318D] dark:bg-[#0297DE] text-white shadow-sm'
                    : 'text-[#09318D] dark:text-slate-300'
                }`}
              >
                На год
                <span className="text-[11px] font-bold text-[#F59ACC] dark:text-[#FC734D]">-20%</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-7 items-stretch">
            {plans.map((plan) => {
              const price = billingCycle === 'yearly' ? plan.price_yearly : plan.price_monthly;
              return (
                <div
                  key={plan.slug}
                  className={`relative rounded-[20px] p-8 flex flex-col justify-between transition-all ${
                    plan.is_popular
                      ? 'bg-white dark:bg-[#111F46]/95 border-2 border-[#F59ACC] dark:border-[#FC734D] shadow-2xl shadow-[#F59ACC]/20 dark:shadow-[#FC734D]/10'
                      : 'bg-white/95 dark:bg-[#0E1A3B]/90 border border-[#09318D]/15 dark:border-white/10 shadow-sm'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-xl font-bold text-[#09318D] dark:text-white">
                        {plan.name}
                      </h3>
                      {plan.is_popular && (
                        <span className="px-2.5 py-1 rounded-full bg-[#F59ACC] text-[#09318D] dark:bg-[#FC734D] dark:text-white text-[10px] font-bold tracking-wide">
                          ХИТ ПРОДАЖ
                        </span>
                      )}
                    </div>
                    <p className="text-[13px] text-[#09318D]/70 dark:text-slate-400 min-h-[38px]">
                      {plan.description}
                    </p>

                    <div className="mt-5 mb-6 flex items-baseline gap-2">
                      <span className="text-[40px] font-bold text-[#09318D] dark:text-white">
                        {price.toLocaleString('ru-RU')} ₽
                      </span>
                      <span className="text-sm text-[#09318D]/60 dark:text-slate-400">
                        {price === 0 ? '/ навсегда' : '/ месяц'}
                      </span>
                    </div>

                    <div className="h-px w-full bg-[#09318D]/10 dark:bg-white/10 mb-6" />

                    <ul className="space-y-3.5 mb-8">
                      {plan.features.map((feat, i) => (
                        <li key={i} className="flex items-start gap-2.5 text-[13px]">
                          <Check
                            className={`w-4 h-4 shrink-0 mt-0.5 ${
                              plan.is_popular ? 'text-[#E068A8] dark:text-[#FC734D]' : 'text-[#09318D] dark:text-[#0297DE]'
                            }`}
                          />
                          <span className="text-[#09318D]/85 dark:text-slate-200 font-medium">
                            {feat}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {(() => {
                    const isCurrent = subscription?.tier === plan.tier;
                    const isDowngrade = subscription ? plan.tier < subscription.tier : false;
                    const isFreeCurrent = isCurrent && plan.price_monthly === 0;
                    const isDisabled = isFreeCurrent || isDowngrade;
                    return (
                      <button
                        disabled={isDisabled}
                        onClick={() => onSelectPlan(plan.slug, billingCycle)}
                        className={`w-full py-3.5 rounded-xl font-semibold text-sm transition-all ${
                          isDisabled
                            ? 'bg-slate-200 dark:bg-[#172754]/40 text-slate-400 cursor-not-allowed border border-slate-300 dark:border-white/5'
                            : plan.is_popular
                            ? 'bg-[#F59ACC] hover:bg-[#ee82bd] text-[#09318D] dark:bg-[#FC734D] dark:hover:bg-[#fb6338] dark:text-white shadow-lg shadow-[#F59ACC]/30 dark:shadow-[#FC734D]/25 cursor-pointer'
                            : 'bg-[#09318D] dark:bg-[#172754] hover:bg-[#07266e] dark:hover:bg-[#1e326a] text-white border border-transparent dark:border-white/15 cursor-pointer'
                        }`}
                      >
                        {isFreeCurrent
                          ? 'Текущий тариф активен'
                          : isDowngrade
                          ? 'Недоступно (ниже текущего)'
                          : isCurrent
                          ? billingCycle === 'yearly'
                            ? 'Продлить на год (-20%)'
                            : 'Продлить подписку'
                          : plan.price_monthly === 0
                          ? 'Начать бесплатно'
                          : plan.is_popular
                          ? 'Оформить Pro подписку'
                          : 'Подключить команду'}
                      </button>
                    );
                  })()}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ================= REVIEWS SECTION ================= */}
      <section id="reviews" className="py-20 px-4 sm:px-6 md:px-12 lg:px-20 max-w-7xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <span className="text-xs font-bold tracking-wider uppercase text-[#0297DE]">ОТЗЫВЫ</span>
          <h2 className="mt-2.5 text-3xl md:text-[34px] font-bold text-slate-900 dark:text-white">
            Что говорят наши пользователи
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              quote:
                '«Перенёс все рабочие задачи в PATRIK AI. Пишет код на Rust и React быстрее и чище любых аналогов, а цена в 990 ₽ просто подарок.»',
              author: 'Алексей Соколов',
              role: 'Fullstack-разработчик',
            },
            {
              quote:
                '«Очень нравится мобильная версия сайта и переключение темы. Использую для подготовки курсовых и генерации презентаций в колледже.»',
              author: 'Мария Волкова',
              role: 'Студентка, графический дизайн',
            },
            {
              quote:
                '«Подключили тариф Ultra на всю студию. API работает стабильно, задержка минимальная, техподдержка отвечает за 5 минут.»',
              author: 'Дмитрий Орлов',
              role: 'Руководитель веб-студии',
            },
          ].map((r, i) => (
            <div
              key={i}
              className="p-6 rounded-2xl bg-white/80 dark:bg-[#0E1A3B]/70 border border-slate-200 dark:border-white/10 flex flex-col justify-between gap-4"
            >
              <div className="flex gap-1">
                {Array.from({ length: 5 }).map((_, s) => (
                  <Star key={s} className="w-3.5 h-3.5 fill-[#FC734D] text-[#FC734D]" />
                ))}
              </div>
              <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed">{r.quote}</p>
              <div>
                <div className="text-sm font-semibold text-slate-900 dark:text-white">
                  {r.author}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">{r.role}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ================= FAQ SECTION ================= */}
      <section id="faq" className="py-16 px-4 sm:px-6 md:px-12 lg:px-20 max-w-4xl mx-auto">
        <h2 className="text-3xl md:text-[34px] font-bold text-center text-slate-900 dark:text-white mb-9">
          Частые вопросы
        </h2>
        <div className="space-y-3.5">
          {faqs.map((f, idx) => {
            const isOpen = openFaq === idx;
            return (
              <div
                key={idx}
                className="rounded-[14px] bg-white/85 dark:bg-[#0E1A3B]/80 border border-slate-200 dark:border-white/10 overflow-hidden"
              >
                <button
                  onClick={() => setOpenFaq(isOpen ? -1 : idx)}
                  className="w-full px-6 py-5 flex items-center justify-between text-left gap-4 cursor-pointer"
                >
                  <span className="text-[15px] md:text-base font-semibold text-slate-900 dark:text-white">
                    {f.q}
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${
                      isOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className="px-6 pb-5 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                    {f.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ================= CTA BANNER (скрывается, если пользователь уже авторизован) ================= */}
      {!user && (
        <section className="relative py-20 px-4 sm:px-6 md:px-12 lg:px-20">
          <div className="relative z-10 max-w-6xl mx-auto rounded-3xl bg-white/90 dark:bg-[#0E1A3B]/70 border border-[#F59ACC] dark:border-[#FC734D]/40 p-8 sm:p-10 md:p-14 text-center backdrop-blur-md shadow-lg shadow-[#09318D]/5">
            <h2 className="text-2xl md:text-4xl font-bold text-[#09318D] dark:text-white">
              Готовы ускорить свою работу в 3 раза?
            </h2>
            <p className="mt-3 text-[#09318D]/75 dark:text-slate-300">
              Присоединяйтесь к 120 000+ пользователей PATRIK AI уже сегодня.
            </p>
            <button
              onClick={() => onNavigate('auth')}
              className="mt-7 inline-flex items-center gap-2.5 px-8 py-4 rounded-xl bg-[#F59ACC] hover:bg-[#ee82bd] text-[#09318D] dark:bg-[#FC734D] dark:hover:bg-[#fb6338] dark:text-white font-semibold transition-all cursor-pointer shadow-lg shadow-[#F59ACC]/30 dark:shadow-[#FC734D]/25"
            >
              Создать аккаунт бесплатно
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </section>
      )}

      {/* ================= FOOTER ================= */}
      <footer className="bg-white/95 dark:bg-[#060D21] border-t border-[#09318D]/15 dark:border-white/10 pt-14 pb-28 md:pb-12 px-4 sm:px-6 md:px-12 lg:px-20">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-10 pb-10">
          <div>
            <PatrikLogo size={28} />
            <p className="mt-3 text-[13px] text-slate-500 dark:text-slate-400 leading-relaxed max-w-xs">
              Платформа подписок на передовые нейросети для учёбы, разработки и бизнеса.
            </p>
          </div>
          <div>
            <h4 className="text-[13px] font-semibold text-slate-900 dark:text-white mb-3">Продукт</h4>
            <ul className="space-y-2 text-[13px] text-slate-600 dark:text-slate-400">
              <li><a href="#features" className="hover:text-[#0297DE]">Возможности</a></li>
              <li><a href="#models" className="hover:text-[#0297DE]">Модели ИИ</a></li>
              <li><a href="#pricing" className="hover:text-[#0297DE]">Тарифы</a></li>
              <li><a href="#faq" className="hover:text-[#0297DE]">Частые вопросы</a></li>
            </ul>
          </div>
          <div>
            <h4 className="text-[13px] font-semibold text-slate-900 dark:text-white mb-3">Ресурсы</h4>
            <ul className="space-y-2 text-[13px] text-slate-600 dark:text-slate-400">
              <li><button onClick={() => onNavigate('dashboard')} className="hover:text-[#0297DE] cursor-pointer">Личный кабинет</button></li>
              <li><button onClick={() => onNavigate('docs')} className="hover:text-[#0297DE] cursor-pointer">Документация API</button></li>
              <li><a href="#reviews" className="hover:text-[#0297DE]">Отзывы</a></li>
            </ul>
          </div>
          <div>
            <h4 className="text-[13px] font-semibold text-slate-900 dark:text-white mb-3">Документы</h4>
            <ul className="space-y-2 text-[13px] text-slate-600 dark:text-slate-400">
              <li>Оферта</li>
              <li>Конфиденциальность</li>
              <li>Реквизиты</li>
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto pt-6 border-t border-slate-200 dark:border-white/10 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <span>© 2026 {siteConfig?.brandName || 'PATRIK AI'}. Все права защищены.</span>
          <span>{siteConfig?.supportEmail || 'support@patrik.ai'}</span>
        </div>
      </footer>
    </div>
  );
};

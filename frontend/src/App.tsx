import React, { useEffect, useState } from 'react';
import { Moon, Sun, Monitor, Home, LayoutGrid, CreditCard, User, BookOpen, Lock, X } from 'lucide-react';
import { PatrikLogo } from './components/PatrikLogo';
import { LightBeams } from './components/LightBeams';
import { LandingPage } from './pages/LandingPage';
import { DashboardPage } from './pages/DashboardPage';
import { AuthPage } from './pages/AuthPage';
import { DocsPage } from './pages/DocsPage';
import {
  ApiKeyItem,
  PageName,
  Plan,
  SiteConfig,
  SubscriptionInfo,
  ThemeMode,
  TransactionItem,
  UserInfo,
} from './types';

export const App: React.FC = () => {
  // Сессия хранится в localStorage браузера; восстанавливаем сразу при открытии и обновлении страницы
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('patrik_token'));
  const [user, setUser] = useState<UserInfo | null>(() => {
    try {
      const saved = localStorage.getItem('patrik_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(() => {
    try {
      const saved = localStorage.getItem('patrik_subscription');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [page, setPage] = useState<PageName>(() => {
    const saved = localStorage.getItem('patrik_page') as PageName;
    const hasAuth = Boolean(localStorage.getItem('patrik_token') || localStorage.getItem('patrik_user'));
    if (saved === 'dashboard') return hasAuth ? 'dashboard' : 'landing';
    if (saved === 'docs') return 'docs';
    if (saved === 'auth') return hasAuth ? 'dashboard' : 'auth';
    return 'landing';
  });

  const navigateTo = (target: PageName) => {
    setPage(target);
    localStorage.setItem('patrik_page', target);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const [theme, setTheme] = useState<ThemeMode>(() => {
    return (localStorage.getItem('patrik_theme') as ThemeMode) || 'dark';
  });
  const [plans, setPlans] = useState<Plan[]>([]);
  const [siteConfig, setSiteConfig] = useState<SiteConfig>({
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
  });
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKeyItem[]>([]);

  const [selectedPlanSlug, setSelectedPlanSlug] = useState('pro-creator');
  const [selectedCycle, setSelectedCycle] = useState<'monthly' | 'yearly'>('monthly');

  // Плашка "Пожалуйста, войдите или зарегистрируйте аккаунт"
  const [authPromptOpen, setAuthPromptOpen] = useState(false);

  // Тема Dark / Light / System
  useEffect(() => {
    const root = document.documentElement;
    const apply = (mode: ThemeMode) => {
      const isDark =
        mode === 'dark' ||
        (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      root.classList.toggle('dark', isDark);
    };
    apply(theme);
    localStorage.setItem('patrik_theme', theme);

    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = () => apply('system');
      mq.addEventListener('change', listener);
      return () => mq.removeEventListener('change', listener);
    }
  }, [theme]);

  // Загружаем публичный список тарифов и настройки сайта с сервера
  useEffect(() => {
    fetch('/api/plans')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (Array.isArray(data)) setPlans(data);
      })
      .catch(() => {});

    fetch('/api/config')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.brandName) setSiteConfig(data);
      })
      .catch(() => {});
  }, []);

  // Загружаем данные профиля, если есть токен сессии
  const fetchDashboard = async (authToken: string) => {
    try {
      const res = await fetch('/api/dashboard', {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.status === 401) {
        localStorage.removeItem('patrik_token');
        localStorage.removeItem('patrik_user');
        localStorage.removeItem('patrik_subscription');
        localStorage.setItem('patrik_page', 'landing');
        setToken(null);
        setUser(null);
        setSubscription(null);
        setTransactions([]);
        setApiKeys([]);
        setPage('landing');
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        localStorage.setItem('patrik_user', JSON.stringify(data.user));
        if (data.token) {
          setToken(data.token);
          localStorage.setItem('patrik_token', data.token);
        }
        setSubscription(data.subscription || null);
        if (data.subscription) {
          localStorage.setItem('patrik_subscription', JSON.stringify(data.subscription));
        } else {
          localStorage.removeItem('patrik_subscription');
        }
        setTransactions(data.transactions || []);
        setApiKeys(data.apiKeys || []);
      }
    } catch (e) {
      console.warn('Dashboard sync skipped (network/offline):', e);
    }
  };

  useEffect(() => {
    if (token) {
      fetchDashboard(token);
    }
  }, [token]);

  const cycleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : prev === 'light' ? 'system' : 'dark'));
  };

  const openProtectedPage = (target: PageName) => {
    if (!token && !user) {
      setAuthPromptOpen(true);
      return;
    }
    navigateTo(target);
  };

  const handleSelectPlan = (slug: string, cycle: 'monthly' | 'yearly') => {
    setSelectedPlanSlug(slug);
    setSelectedCycle(cycle);
    if (!token && !user) {
      setAuthPromptOpen(true);
      return;
    }
    navigateTo('dashboard');
  };

  const handleAuthSubmit = async (
    mode: 'login' | 'register',
    email: string,
    password: string,
    fullName?: string
  ) => {
    try {
      const url = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ email, password, full_name: fullName }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { ok: false, error: data.error || 'Ошибка входа' };
      }
      localStorage.setItem('patrik_token', data.token);
      localStorage.setItem('patrik_user', JSON.stringify(data.user));
      setToken(data.token);
      setUser(data.user);
      await fetchDashboard(data.token);
      navigateTo('dashboard');
      return { ok: true };
    } catch {
      return { ok: false, error: 'Сервер недоступен' };
    }
  };

  const handleLogout = async () => {
    if (token) {
      fetch('/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
    localStorage.removeItem('patrik_token');
    localStorage.removeItem('patrik_user');
    localStorage.removeItem('patrik_subscription');
    localStorage.setItem('patrik_page', 'landing');
    setToken(null);
    setUser(null);
    setSubscription(null);
    setTransactions([]);
    setApiKeys([]);
    setPage('landing');
  };

  const handleSubscribe = async (
    slug: string,
    cycle: 'monthly' | 'yearly',
    method: 'card' | 'sbp',
    cardDetails?: { number: string; expiry: string; cvc: string }
  ) => {
    if (!token) {
      setAuthPromptOpen(true);
      return { ok: false, error: 'Требуется авторизация' };
    }
    try {
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          planSlug: slug,
          billingCycle: cycle,
          paymentMethod: method,
          cardDetails,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { ok: false, error: data.error || 'Ошибка оплаты' };
      }
      if (data.token) {
        setToken(data.token);
        localStorage.setItem('patrik_token', data.token);
      }
      setSubscription(data.subscription);
      if (data.subscription) {
        localStorage.setItem('patrik_subscription', JSON.stringify(data.subscription));
      }
      setTransactions(data.transactions);
      return { ok: true };
    } catch {
      return { ok: false, error: 'Ошибка соединения с сервером' };
    }
  };

  const handleCreateKey = async (name: string, tokenLimit: string) => {
    if (!token) {
      setAuthPromptOpen(true);
      return { error: 'Требуется авторизация' };
    }
    try {
      const res = await fetch('/api/keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name, tokenLimit }),
      });
      const data = await res.json();
      if (!res.ok) return { error: data.error || 'Не удалось создать ключ' };
      if (data.token) {
        setToken(data.token);
        localStorage.setItem('patrik_token', data.token);
      }
      setApiKeys((prev) => [data.key, ...prev]);
      return { fullKey: data.fullKey };
    } catch {
      return { error: 'Сервер недоступен' };
    }
  };

  const handleDeleteKey = async (id: string) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/keys/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.token) {
          setToken(data.token);
          localStorage.setItem('patrik_token', data.token);
        }
        setApiKeys(data.apiKeys);
      }
    } catch {
      // ignore
    }
  };

  return (
    <div className="relative min-h-screen bg-white dark:bg-[#0A1430] text-[#09318D] dark:text-white transition-colors duration-300">
      {/* Живой анимированный фон на весь сайт */}
      <LightBeams />

      {/* ================= NAVBAR ================= */}
      <header className="sticky top-0 z-40 h-16 md:h-20 px-5 md:px-20 flex items-center justify-between bg-white/85 dark:bg-[#0A1430]/75 backdrop-blur-lg border-b border-[#09318D]/15 dark:border-white/10">
        <button
          onClick={() => navigateTo('landing')}
          className="cursor-pointer"
        >
          <PatrikLogo size={34} />
        </button>

        {/* Desktop Nav Links */}
        <nav className="hidden lg:flex items-center gap-8 text-sm font-medium text-[#09318D]/80 dark:text-slate-300">
          <a href="#features" onClick={() => navigateTo('landing')} className="hover:text-[#09318D] dark:hover:text-[#0297DE] transition-colors">
            Возможности
          </a>
          <a href="#models" onClick={() => navigateTo('landing')} className="hover:text-[#09318D] dark:hover:text-[#0297DE] transition-colors">
            Модели
          </a>
          <a href="#pricing" onClick={() => navigateTo('landing')} className="hover:text-[#09318D] dark:hover:text-[#0297DE] transition-colors">
            Тарифы
          </a>
          <button
            onClick={() => navigateTo('docs')}
            className={`hover:text-[#09318D] dark:hover:text-[#0297DE] transition-colors cursor-pointer ${
              page === 'docs' ? 'text-[#09318D] underline decoration-[#F59ACC] decoration-2 underline-offset-4 dark:no-underline dark:text-[#FC734D] font-semibold' : ''
            }`}
          >
            Документация
          </button>
          <a href="#faq" onClick={() => navigateTo('landing')} className="hover:text-[#09318D] dark:hover:text-[#0297DE] transition-colors">
            FAQ
          </a>
        </nav>

        {/* Actions + Theme Switcher */}
        <div className="flex items-center gap-3 md:gap-4">
          <button
            onClick={cycleTheme}
            title="Переключить тему (Тёмная / Светлая / Авто)"
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#09318D]/5 dark:bg-[#132044] border border-[#09318D]/20 dark:border-white/10 text-xs font-medium text-[#09318D] dark:text-slate-200 cursor-pointer hover:border-[#F59ACC] dark:hover:border-[#0297DE]/50 transition-all"
          >
            {theme === 'dark' && <Moon className="w-3.5 h-3.5 text-[#0297DE]" />}
            {theme === 'light' && <Sun className="w-3.5 h-3.5 text-[#09318D]" />}
            {theme === 'system' && <Monitor className="w-3.5 h-3.5 text-emerald-500" />}
            <span className="hidden sm:inline">
              {theme === 'dark' ? 'Тёмная' : theme === 'light' ? 'Светлая' : 'Авто'}
            </span>
          </button>

          {!user ? (
            <button
              onClick={() => navigateTo('auth')}
              className="px-4 md:px-5 py-2 md:py-2.5 rounded-[10px] bg-[#09318D] hover:bg-[#07266e] dark:bg-[#FC734D] dark:hover:bg-[#fb6338] text-white text-xs md:text-sm font-semibold transition-all cursor-pointer"
            >
              Войти
            </button>
          ) : (
            <button
              onClick={() => navigateTo(page === 'dashboard' ? 'landing' : 'dashboard')}
              className="px-4 md:px-5 py-2 md:py-2.5 rounded-[10px] bg-[#09318D] hover:bg-[#07266e] dark:bg-[#FC734D] dark:hover:bg-[#fb6338] text-white text-xs md:text-sm font-semibold transition-all cursor-pointer"
            >
              {page === 'dashboard' ? 'На главную' : 'Кабинет'}
            </button>
          )}
        </div>
      </header>

      {/* ================= PAGE ROUTER ================= */}
      {page === 'landing' && (
        <LandingPage
          plans={plans}
          subscription={subscription}
          siteConfig={siteConfig}
          onNavigate={(p) => (p === 'dashboard' ? openProtectedPage('dashboard') : navigateTo(p))}
          onSelectPlan={handleSelectPlan}
        />
      )}
      {page === 'dashboard' && user && (
        <DashboardPage
          token={token || ''}
          user={user}
          plans={plans}
          siteConfig={siteConfig}
          subscription={subscription}
          transactions={transactions}
          apiKeys={apiKeys}
          selectedPlanSlug={selectedPlanSlug}
          selectedCycle={selectedCycle}
          onNavigate={navigateTo}
          onPlansUpdated={setPlans}
          onConfigUpdated={setSiteConfig}
          onSubscribe={handleSubscribe}
          onCreateKey={handleCreateKey}
          onDeleteKey={handleDeleteKey}
          onLogout={handleLogout}
        />
      )}
      {page === 'auth' && <AuthPage onAuthSubmit={handleAuthSubmit} />}
      {page === 'docs' && <DocsPage />}

      {/* ================= AUTH REQUIRED MODAL (пункт 8) ================= */}
      {authPromptOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#0E1A3B] border border-[#09318D]/25 dark:border-[#0297DE]/40 p-7 shadow-2xl text-center space-y-5 relative">
            <button
              onClick={() => setAuthPromptOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-[#09318D] dark:hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="w-12 h-12 rounded-2xl bg-[#F59ACC]/25 dark:bg-[#FC734D]/15 text-[#09318D] dark:text-[#FC734D] flex items-center justify-center mx-auto">
              <Lock className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-[#09318D] dark:text-white">
              Требуется авторизация
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Пожалуйста, войдите или зарегистрируйте аккаунт, чтобы оформлять подписки и управлять
              API-ключами.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 pt-1">
              <button
                onClick={() => setAuthPromptOpen(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-white/10 text-[#09318D] dark:text-slate-200 text-sm font-medium cursor-pointer"
              >
                Отмена
              </button>
              <button
                onClick={() => {
                  setAuthPromptOpen(false);
                  navigateTo('auth');
                }}
                className="flex-1 py-2.5 rounded-xl bg-[#F59ACC] hover:bg-[#ee82bd] text-[#09318D] dark:bg-[#FC734D] dark:hover:bg-[#fb6338] dark:text-white text-sm font-semibold cursor-pointer"
              >
                Войти / Регистрация
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MOBILE BOTTOM TAB BAR ================= */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 h-[70px] px-5 flex items-center justify-between bg-white/95 dark:bg-[#060D21]/95 backdrop-blur-lg border-t border-slate-200 dark:border-white/10">
        <button
          onClick={() => navigateTo('landing')}
          className={`flex flex-col items-center gap-1 text-[11px] font-medium cursor-pointer ${
            page === 'landing' ? 'text-[#FC734D]' : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <Home className="w-5 h-5" />
          <span>Главная</span>
        </button>

        <a
          href="#pricing"
          onClick={() => navigateTo('landing')}
          className="flex flex-col items-center gap-1 text-[11px] font-medium text-slate-500 dark:text-slate-400"
        >
          <CreditCard className="w-5 h-5" />
          <span>Тарифы</span>
        </a>

        <button
          onClick={() => navigateTo('docs')}
          className={`flex flex-col items-center gap-1 text-[11px] font-medium cursor-pointer ${
            page === 'docs' ? 'text-[#FC734D]' : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <BookOpen className="w-5 h-5" />
          <span>Документация</span>
        </button>

        <a
          href="#models"
          onClick={() => navigateTo('landing')}
          className="flex flex-col items-center gap-1 text-[11px] font-medium text-slate-500 dark:text-slate-400"
        >
          <LayoutGrid className="w-5 h-5" />
          <span>Модели</span>
        </a>

        <button
          onClick={() => openProtectedPage('dashboard')}
          className={`flex flex-col items-center gap-1 text-[11px] font-medium cursor-pointer ${
            page === 'dashboard' || page === 'auth'
              ? 'text-[#FC734D]'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <User className="w-5 h-5" />
          <span>Кабинет</span>
        </button>
      </nav>
    </div>
  );
};

export default App;

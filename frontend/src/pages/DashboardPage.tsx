import React, { useState } from 'react';
import {
  LayoutDashboard,
  Key,
  CreditCard,
  Settings,
  CheckCircle2,
  Lock,
  Plus,
  Copy,
  Check,
  Trash2,
  X,
  AlertTriangle,
  LogOut,
  ShieldCheck,
  QrCode,
  Loader2,
} from 'lucide-react';
import { AdminPanel } from '../components/AdminPanel';
import { PatrikLogo } from '../components/PatrikLogo';
import {
  ApiKeyItem,
  PageName,
  Plan,
  SiteConfig,
  SubscriptionInfo,
  TransactionItem,
  UserInfo,
} from '../types';

interface DashboardPageProps {
  token: string;
  user: UserInfo;
  plans: Plan[];
  siteConfig: SiteConfig;
  subscription: SubscriptionInfo | null;
  transactions: TransactionItem[];
  apiKeys: ApiKeyItem[];
  selectedPlanSlug: string;
  selectedCycle: 'monthly' | 'yearly';
  onNavigate: (page: PageName) => void;
  onPlansUpdated: (plans: Plan[]) => void;
  onConfigUpdated: (cfg: SiteConfig) => void;
  onSubscribe: (
    slug: string,
    cycle: 'monthly' | 'yearly',
    method: 'card' | 'sbp',
    cardDetails?: { number: string; expiry: string; cvc: string }
  ) => Promise<{ ok: boolean; error?: string }>;
  onCreateKey: (name: string, tokenLimit: string) => Promise<{ fullKey?: string; error?: string }>;
  onDeleteKey: (id: string) => Promise<void>;
  onLogout: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  token,
  user,
  plans,
  siteConfig,
  subscription,
  transactions,
  apiKeys,
  selectedPlanSlug,
  selectedCycle,
  onNavigate,
  onPlansUpdated,
  onConfigUpdated,
  onSubscribe,
  onCreateKey,
  onDeleteKey,
  onLogout,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'keys' | 'history' | 'settings' | 'admin'>('overview');
  const [payPlan, setPayPlan] = useState(selectedPlanSlug || 'pro-creator');
  const [payCycle, setPayCycle] = useState<'monthly' | 'yearly'>(selectedCycle || 'monthly');
  const [payMethod, setPayMethod] = useState<'card' | 'sbp'>('card');

  // Модальное окно СБП QR (появляется только после нажатия "Оплатить")
  const [showSbpModal, setShowSbpModal] = useState(false);
  const [checkingSbp, setCheckingSbp] = useState(false);

  // Поля карты — пустые по умолчанию, пример только в placeholder
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvc, setCardCvc] = useState('');

  const [paying, setPaying] = useState(false);
  const [payMsg, setPayMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Модалка создания API-ключа
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyLimit, setNewKeyLimit] = useState('');
  const [creatingKey, setCreatingKey] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);

  // Модалка показа нового ключа 1 раз (как на скрине 3)
  const [createdFullKey, setCreatedFullKey] = useState<string | null>(null);
  const [copiedFlag, setCopiedFlag] = useState<string | null>(null);

  const currentPlanObj = plans.find((p) => p.slug === payPlan) || plans[1];
  const priceToPay = currentPlanObj
    ? payCycle === 'yearly'
      ? currentPlanObj.price_yearly * 12
      : currentPlanObj.price_monthly
    : 990;

  const isBlockedPlan = Boolean(
    subscription &&
      subscription.status === 'active' &&
      currentPlanObj &&
      (currentPlanObj.tier < subscription.tier ||
        (currentPlanObj.tier === subscription.tier && currentPlanObj.price_monthly === 0))
  );

  const isRenewal = Boolean(
    subscription &&
      subscription.status === 'active' &&
      currentPlanObj &&
      currentPlanObj.tier === subscription.tier &&
      currentPlanObj.price_monthly > 0
  );

  const tokensLeft = subscription
    ? subscription.token_limit < 0
      ? -1
      : Math.max(0, subscription.token_limit - subscription.tokens_used)
    : 0;

  const usagePercent =
    subscription && subscription.token_limit > 0
      ? Math.min(100, Math.round((subscription.tokens_used / subscription.token_limit) * 100))
      : subscription?.token_limit === -1
      ? 5
      : 0;

  const copyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedFlag(id);
    setTimeout(() => setCopiedFlag(null), 1800);
  };

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    setPayMsg(null);
    if (isBlockedPlan) {
      setPayMsg({
        type: 'err',
        text: 'Нельзя купить тариф ниже вашего текущего.',
      });
      return;
    }

    // Если выбран СБП и сумма > 0 — открываем модальное окно с QR-кодом
    if (priceToPay > 0 && payMethod === 'sbp') {
      setCheckingSbp(false);
      setShowSbpModal(true);
      return;
    }

    if (priceToPay > 0 && payMethod === 'card' && cardNumber.replace(/\s+/g, '').length < 16) {
      setPayMsg({ type: 'err', text: 'Введите полный 16-значный номер карты.' });
      return;
    }
    setPaying(true);
    const res = await onSubscribe(payPlan, payCycle, payMethod, {
      number: cardNumber,
      expiry: cardExpiry,
      cvc: cardCvc,
    });
    setPaying(false);
    if (res.ok) {
      setPayMsg({ type: 'ok', text: `Подписка «${currentPlanObj?.name}» успешно активирована!` });
      setCardNumber('');
      setCardExpiry('');
      setCardCvc('');
    } else {
      setPayMsg({ type: 'err', text: res.error || 'Ошибка оформления подписки' });
    }
  };

  const handleConfirmSbp = () => {
    if (checkingSbp) return;
    setCheckingSbp(true);
    setTimeout(async () => {
      const res = await onSubscribe(payPlan, payCycle, 'sbp');
      setCheckingSbp(false);
      setShowSbpModal(false);
      if (res.ok) {
        setPayMsg({ type: 'ok', text: `Оплата по СБП подтверждена! Тариф «${currentPlanObj?.name}» активирован.` });
      } else {
        setPayMsg({ type: 'err', text: res.error || 'Ошибка подтверждения оплаты' });
      }
    }, 2000);
  };

  const handleCreateKeySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setKeyError(null);
    if (!newKeyName.trim()) {
      setKeyError('Укажите название ключа');
      return;
    }
    setCreatingKey(true);
    const res = await onCreateKey(newKeyName.trim(), newKeyLimit.trim());
    setCreatingKey(false);
    if (res.fullKey) {
      setShowCreateModal(false);
      setNewKeyName('');
      setNewKeyLimit('');
      setCreatedFullKey(res.fullKey);
    } else {
      setKeyError(res.error || 'Ошибка создания ключа');
    }
  };

  return (
    <div className="relative z-10 min-h-[calc(100vh-80px)] pb-28 md:pb-12">
      <div className="max-w-7xl mx-auto px-5 md:px-10 pt-8 flex flex-col lg:flex-row gap-8">
        {/* Sidebar */}
        <aside className="w-full lg:w-[250px] shrink-0 rounded-2xl bg-white/85 dark:bg-[#070E24]/90 border border-slate-200 dark:border-white/10 p-4 h-fit backdrop-blur-md">
          <div className="flex lg:flex-col gap-1.5 overflow-x-auto">
            {[
              { id: 'overview', label: 'Обзор подписки', icon: <LayoutDashboard className="w-4 h-4" /> },
              { id: 'keys', label: 'API Ключи', icon: <Key className="w-4 h-4" /> },
              { id: 'history', label: 'История платежей', icon: <CreditCard className="w-4 h-4" /> },
              { id: 'settings', label: 'Настройки профиля', icon: <Settings className="w-4 h-4" /> },
              ...(user.role === 'admin'
                ? [{ id: 'admin', label: 'Админ-панель', icon: <ShieldCheck className="w-4 h-4" /> }]
                : []),
            ].map((item) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id as typeof activeTab)}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all cursor-pointer ${
                    active
                      ? 'bg-[#0297DE]/15 dark:bg-[#132044] text-[#0297DE] dark:text-white font-semibold'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5'
                  }`}
                >
                  <span className={active ? 'text-[#FC734D]' : ''}>{item.icon}</span>
                  {item.label}
                </button>
              );
            })}
            <button
              onClick={onLogout}
              className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap text-rose-500 hover:bg-rose-500/10 transition-all cursor-pointer lg:mt-4"
            >
              <LogOut className="w-4 h-4" />
              Выйти
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Личный кабинет — {user.full_name}
            </h1>
            <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-slate-200/80 dark:bg-[#132044] text-[13px] font-medium text-slate-800 dark:text-slate-200 w-fit">
              {user.email}
            </div>
          </div>

          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
              {/* Left Column: Current Subscription & Transactions */}
              <div className="xl:col-span-7 rounded-2xl bg-white/90 dark:bg-[#0E1A3B]/85 border border-[#0297DE]/35 p-6 md:p-7 space-y-6 backdrop-blur-md">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                    {subscription
                      ? `Текущий тариф: ${subscription.plan_name}`
                      : 'Подписка не оформлена'}
                  </h2>
                  {subscription ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Активна до {subscription.expires_at}
                    </span>
                  ) : (
                    <span className="px-3 py-1 rounded-full bg-amber-500/15 text-amber-500 text-xs font-semibold">
                      Нет активного плана
                    </span>
                  )}
                </div>

                {/* Progress Bar */}
                <div className="space-y-2">
                  <div className="text-[13px] font-medium text-slate-500 dark:text-slate-400">
                    Использовано токенов в текущем месяце
                  </div>
                  <div className="w-full h-3.5 rounded-full bg-slate-200 dark:bg-[#1E293B] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${usagePercent}%`,
                        background: 'linear-gradient(90deg, #0297DE, #FC734D)',
                      }}
                    />
                  </div>
                  <div className="text-[13px] font-semibold text-slate-900 dark:text-white">
                    {subscription
                      ? subscription.token_limit < 0
                        ? 'Безлимитные токены'
                        : `Осталось ${tokensLeft.toLocaleString('ru-RU')} из ${subscription.token_limit.toLocaleString('ru-RU')} токенов`
                      : 'Выберите любой тариф справа для начала работы'}
                  </div>
                </div>

                {/* Transactions List */}
                <div className="space-y-3">
                  <h3 className="text-[15px] font-semibold text-slate-900 dark:text-white">
                    Последние транзакции
                  </h3>
                  {transactions.length === 0 ? (
                    <div className="text-sm text-slate-500 dark:text-slate-400 py-3">
                      Платежей пока нет.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {transactions.slice(0, 5).map((tx) => (
                        <div
                          key={tx.tx_code}
                          className="flex items-center justify-between px-3.5 py-2.5 rounded-lg bg-slate-100 dark:bg-[#132044]/75 text-[13px]"
                        >
                          <span className="font-medium text-[#0297DE]">{tx.tx_code}</span>
                          <span className="text-slate-700 dark:text-slate-200">{tx.plan_name}</span>
                          <span className="font-semibold text-slate-900 dark:text-white">
                            {tx.amount.toLocaleString('ru-RU')} ₽
                          </span>
                          <span className="text-xs font-medium text-emerald-500">{tx.status}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Checkout / Upgrade Card */}
              <form
                onSubmit={handlePay}
                className="xl:col-span-5 rounded-2xl bg-white/95 dark:bg-[#111F46]/92 border-[1.5px] border-[#FC734D]/60 p-6 md:p-7 space-y-5 backdrop-blur-md"
              >
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                    Оформление / Улучшение подписки
                  </h2>
                  <p className="mt-1 text-[13px] text-slate-500 dark:text-slate-400">
                    Выберите тариф и удобный способ оплаты
                  </p>
                </div>

                {/* Select Plan */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                    Тарифный план
                  </label>
                  <select
                    value={payPlan}
                    onChange={(e) => {
                      setPayPlan(e.target.value);
                      setPayMsg(null);
                    }}
                    className="w-full px-3.5 py-2.5 rounded-lg bg-slate-100 dark:bg-[#0A1430] border border-slate-300 dark:border-white/15 text-sm text-slate-900 dark:text-white outline-none"
                  >
                    {plans.map((p) => {
                      const isLower = subscription && p.tier < subscription.tier;
                      const isFreeActive = subscription && p.tier === subscription.tier && p.price_monthly === 0;
                      const blocked = Boolean(isLower || isFreeActive);
                      return (
                        <option key={p.slug} value={p.slug} disabled={blocked}>
                          {p.name} — {p.price_monthly} ₽/мес{' '}
                          {subscription?.tier === p.tier
                            ? p.price_monthly === 0
                              ? '(Текущий)'
                              : '(Текущий • Продление)'
                            : isLower
                            ? '(Ниже текущего)'
                            : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Billing Period */}
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setPayCycle('monthly')}
                    className={`py-2 rounded-lg text-xs font-semibold cursor-pointer ${
                      payCycle === 'monthly'
                        ? 'bg-[#0297DE] text-white'
                        : 'bg-slate-200 dark:bg-[#172754] text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    1 месяц
                  </button>
                  <button
                    type="button"
                    onClick={() => setPayCycle('yearly')}
                    className={`py-2 rounded-lg text-xs font-semibold cursor-pointer ${
                      payCycle === 'yearly'
                        ? 'bg-[#0297DE] text-white'
                        : 'bg-slate-200 dark:bg-[#172754] text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    1 год (-20%)
                  </button>
                </div>

                {/* Payment Method */}
                {priceToPay > 0 && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setPayMethod('card')}
                        className={`py-2.5 rounded-lg text-[13px] font-semibold transition-all cursor-pointer ${
                          payMethod === 'card'
                            ? 'bg-[#0297DE] text-white'
                            : 'bg-slate-200 dark:bg-[#172754] text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        Банковская карта
                      </button>
                      <button
                        type="button"
                        onClick={() => setPayMethod('sbp')}
                        className={`py-2.5 rounded-lg text-[13px] font-semibold transition-all cursor-pointer ${
                          payMethod === 'sbp'
                            ? 'bg-[#0297DE] text-white'
                            : 'bg-slate-200 dark:bg-[#172754] text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        СБП (QR-код)
                      </button>
                    </div>

                    {payMethod === 'card' ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2.5 px-3.5 py-3 rounded-lg bg-slate-100 dark:bg-[#0A1430] border border-slate-300 dark:border-white/15">
                          <Lock className="w-4 h-4 text-slate-400 shrink-0" />
                          <input
                            type="text"
                            maxLength={19}
                            value={cardNumber}
                            onChange={(e) => setCardNumber(e.target.value)}
                            className="w-full bg-transparent text-sm text-slate-900 dark:text-slate-200 outline-none placeholder:text-slate-400/60"
                            placeholder="4276 0000 0000 0000"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <input
                            type="text"
                            maxLength={5}
                            value={cardExpiry}
                            onChange={(e) => setCardExpiry(e.target.value)}
                            className="px-3.5 py-2.5 rounded-lg bg-slate-100 dark:bg-[#0A1430] border border-slate-300 dark:border-white/15 text-sm text-slate-900 dark:text-slate-200 outline-none placeholder:text-slate-400/60"
                            placeholder="ММ/ГГ"
                          />
                          <input
                            type="password"
                            maxLength={3}
                            value={cardCvc}
                            onChange={(e) => setCardCvc(e.target.value)}
                            className="px-3.5 py-2.5 rounded-lg bg-slate-100 dark:bg-[#0A1430] border border-slate-300 dark:border-white/15 text-sm text-slate-900 dark:text-slate-200 outline-none placeholder:text-slate-400/60"
                            placeholder="CVC"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="p-3.5 rounded-xl bg-slate-100 dark:bg-[#0A1430] border border-[#0297DE]/30 text-xs text-slate-600 dark:text-slate-300 flex items-center gap-3">
                        <QrCode className="w-5 h-5 text-[#0297DE] shrink-0" />
                        <span>
                          Нажмите кнопку «Оплатить» ниже — откроется окно с QR-кодом СБП для оплаты.
                        </span>
                      </div>
                    )}
                  </>
                )}

                {payMsg && (
                  <div
                    className={`p-3 rounded-lg text-xs font-medium border ${
                      payMsg.type === 'ok'
                        ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-500'
                        : 'bg-rose-500/15 border-rose-500/30 text-rose-400'
                    }`}
                  >
                    {payMsg.text}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={paying || isBlockedPlan}
                  className="w-full py-3.5 rounded-xl bg-[#FC734D] hover:bg-[#fb6338] disabled:bg-slate-400/30 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-semibold text-[15px] transition-all cursor-pointer shadow-lg shadow-[#FC734D]/20"
                >
                  {isBlockedPlan
                    ? 'Тариф уже активен или ниже текущего'
                    : paying
                    ? 'Обработка платежа...'
                    : priceToPay === 0
                    ? 'Активировать бесплатно'
                    : isRenewal
                    ? `Продлить за ${priceToPay.toLocaleString('ru-RU')} ₽`
                    : `Оплатить ${priceToPay.toLocaleString('ru-RU')} ₽`}
                </button>
              </form>
            </div>
          )}

          {/* ================= TAB: API KEYS ================= */}
          {activeTab === 'keys' && (
            <div className="space-y-6">
              {/* Token Balance Banner (пункт 7) */}
              <div className="rounded-2xl bg-white/90 dark:bg-[#0E1A3B]/85 border border-[#0297DE]/35 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 backdrop-blur-md">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Баланс токенов по подписке
                  </div>
                  <div className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
                    {subscription
                      ? subscription.token_limit < 0
                        ? 'Безлимит токенов (Ultra)'
                        : `Осталось ${tokensLeft.toLocaleString('ru-RU')} токенов`
                      : '0 токенов (оформите подписку)'}
                  </div>
                </div>
                <button
                  onClick={() => {
                    setKeyError(null);
                    setShowCreateModal(true);
                  }}
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#FC734D] hover:bg-[#fb6338] text-white font-semibold text-sm transition-all cursor-pointer shadow-lg shadow-[#FC734D]/20"
                >
                  <Plus className="w-4 h-4" />
                  Создать API-ключ
                </button>
              </div>

              {/* Keys Table (как на скрине 4) */}
              <div className="rounded-2xl bg-white/90 dark:bg-[#0E1A3B]/85 border border-slate-200 dark:border-white/10 overflow-hidden backdrop-blur-md">
                {apiKeys.length === 0 ? (
                  <div className="p-10 text-center space-y-2">
                    <Key className="w-8 h-8 text-slate-400 mx-auto" />
                    <div className="text-base font-semibold text-slate-900 dark:text-white">
                      У вас пока нет API-ключей
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Нажмите «Создать API-ключ» выше, чтобы сгенерировать персональный ключ доступа.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-white/10 text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          <th className="py-4 px-5">Название</th>
                          <th className="py-4 px-4">Ключ</th>
                          <th className="py-4 px-4">Использование / Лимит</th>
                          <th className="py-4 px-4">Расход (₽)</th>
                          <th className="py-4 px-4">Последнее использование</th>
                          <th className="py-4 px-4">Статус</th>
                          <th className="py-4 px-4 text-right">Действия</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-white/10">
                        {apiKeys.map((k) => {
                          const ratio = k.tokenLimit
                            ? Math.min(100, Math.round((k.tokensUsed / k.tokenLimit) * 100))
                            : 0;
                          return (
                            <tr key={k.id} className="hover:bg-slate-100/60 dark:hover:bg-white/5">
                              <td className="py-4 px-5">
                                <div className="flex items-center gap-3">
                                  <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-white/10 flex items-center justify-center shrink-0">
                                    <Key className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                                  </div>
                                  <div>
                                    <div className="font-semibold text-slate-900 dark:text-white">
                                      {k.name}
                                    </div>
                                    <div className="text-xs text-slate-500 dark:text-slate-400">
                                      {k.createdAt}
                                    </div>
                                  </div>
                                </div>
                              </td>

                              <td className="py-4 px-4">
                                <button
                                  onClick={() => copyText(k.id, k.maskedKey)}
                                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 font-mono text-xs text-slate-700 dark:text-slate-200 cursor-pointer hover:border-[#0297DE]"
                                >
                                  <span>{k.maskedKey}</span>
                                  {copiedFlag === k.id ? (
                                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                                  ) : (
                                    <Copy className="w-3.5 h-3.5 text-slate-400" />
                                  )}
                                </button>
                              </td>

                              <td className="py-4 px-4 min-w-[170px]">
                                <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-white/10 mb-1.5 overflow-hidden">
                                  <div
                                    className="h-full bg-[#0297DE] rounded-full"
                                    style={{ width: `${ratio}%` }}
                                  />
                                </div>
                                <div className="text-xs text-slate-500 dark:text-slate-400">
                                  {k.tokensUsed.toLocaleString('ru-RU')} /{' '}
                                  {k.tokenLimit ? k.tokenLimit.toLocaleString('ru-RU') : 'unlimited'}
                                </div>
                              </td>

                              <td className="py-4 px-4 font-bold text-slate-900 dark:text-white">
                                {k.spentRub.toFixed(2)} ₽
                              </td>

                              <td className="py-4 px-4 text-xs text-slate-500 dark:text-slate-400">
                                {k.lastUsed}
                              </td>

                              <td className="py-4 px-4">
                                <span className="inline-block px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-500 text-xs font-semibold">
                                  {k.status}
                                </span>
                              </td>

                              <td className="py-4 px-4 text-right">
                                <button
                                  onClick={() => onDeleteKey(k.id)}
                                  title="Удалить ключ"
                                  className="p-2 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="rounded-2xl bg-white/90 dark:bg-[#0E1A3B]/85 border border-slate-200 dark:border-white/10 p-6 space-y-4">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">История всех транзакций</h2>
              {transactions.length === 0 ? (
                <p className="text-sm text-slate-500">Транзакций пока нет.</p>
              ) : (
                <div className="space-y-2.5">
                  {transactions.map((tx) => (
                    <div
                      key={tx.tx_code}
                      className="flex items-center justify-between px-4 py-3 rounded-xl bg-slate-100 dark:bg-[#132044]/70 text-sm"
                    >
                      <span className="font-semibold text-[#0297DE]">{tx.tx_code}</span>
                      <span className="text-slate-700 dark:text-slate-200">{tx.plan_name}</span>
                      <span className="uppercase text-xs text-slate-500">{tx.payment_method}</span>
                      <span className="font-bold text-slate-900 dark:text-white">{tx.amount} ₽</span>
                      <span className="text-emerald-500 font-medium">{tx.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="rounded-2xl bg-white/90 dark:bg-[#0E1A3B]/85 border border-slate-200 dark:border-white/10 p-6 space-y-4">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Настройки профиля</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-slate-500 dark:text-slate-400 mb-1">Имя</div>
                  <div className="font-semibold text-slate-900 dark:text-white">{user.full_name}</div>
                </div>
                <div>
                  <div className="text-slate-500 dark:text-slate-400 mb-1">Email</div>
                  <div className="font-semibold text-slate-900 dark:text-white">{user.email}</div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'admin' && user.role === 'admin' && (
            <AdminPanel
              token={token}
              plans={plans}
              siteConfig={siteConfig}
              onPlansUpdated={onPlansUpdated}
              onConfigUpdated={onConfigUpdated}
            />
          )}
        </main>
      </div>

      {/* ================= MODAL 3: ОПЛАТА ПО СБП (QR-КОД В СТИЛЕ PATRIK AI) ================= */}
      {showSbpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div
            className="w-full max-w-md rounded-3xl bg-[#0A1430] p-7 shadow-2xl text-white space-y-5 relative"
            style={{
              border: '1.5px solid rgba(2, 151, 222, 0.45)',
              boxShadow: '0 0 50px rgba(2, 151, 222, 0.2), 0 0 80px rgba(252, 115, 77, 0.15)',
            }}
          >
            <button
              disabled={checkingSbp}
              onClick={() => setShowSbpModal(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white disabled:opacity-40 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center justify-between">
              <PatrikLogo size={28} />
              <span className="px-2.5 py-1 rounded-full bg-[#0297DE]/20 border border-[#0297DE]/40 text-[11px] font-semibold text-[#7DD3FC]">
                СБП • 0% комиссия
              </span>
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-xl font-bold">Оплата подписки «{currentPlanObj?.name}»</h3>
              <p className="text-sm text-slate-400">
                Сумма к оплате:{' '}
                <span className="text-[#FC734D] font-bold text-base">
                  {priceToPay.toLocaleString('ru-RU')} ₽
                </span>
              </p>
            </div>

            {/* QR-контейнер в нашей тематике с градиентной рамкой */}
            <div
              className="mx-auto w-fit p-[2px] rounded-2xl"
              style={{ background: 'linear-gradient(135deg, #0297DE, #FC734D)' }}
            >
              <div className="bg-white rounded-[14px] p-3.5">
                <img
                  src="/qr-sbp.png"
                  alt="QR СБП"
                  className="w-52 h-52 object-contain"
                />
              </div>
            </div>

            <p className="text-xs text-slate-400 text-center leading-relaxed">
              Наведите камеру телефона или отсканируйте QR-код в приложении вашего банка, затем
              нажмите кнопку ниже.
            </p>

            <button
              type="button"
              disabled={checkingSbp}
              onClick={handleConfirmSbp}
              className="w-full py-3.5 rounded-xl bg-[#FC734D] hover:bg-[#fb6338] disabled:bg-[#132044] disabled:text-[#7DD3FC] disabled:border disabled:border-[#0297DE]/40 disabled:cursor-not-allowed text-white font-semibold text-[15px] inline-flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-[#FC734D]/25"
            >
              {checkingSbp && <Loader2 className="w-4 h-4 animate-spin" />}
              {checkingSbp ? 'Проверка оплаты...' : 'Я оплатил'}
            </button>
          </div>
        </div>
      )}

      {/* ================= MODAL 1: НОВЫЙ API-КЛЮЧ (пункт 6) ================= */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#0E1A3B] border border-slate-200 dark:border-white/15 p-6 shadow-2xl space-y-5">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Новый API-ключ</h3>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Укажите имя и при необходимости лимит расхода в рублях (₽).
                </p>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateKeySubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Название
                </label>
                <input
                  type="text"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  placeholder="Например, Production"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-[#070E24] border border-slate-300 dark:border-white/15 text-sm text-slate-900 dark:text-white outline-none placeholder:text-slate-400"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Лимит токенов, опционально
                </label>
                <input
                  type="number"
                  min={1}
                  value={newKeyLimit}
                  onChange={(e) => setNewKeyLimit(e.target.value)}
                  placeholder="Без лимита"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-[#070E24] border border-slate-300 dark:border-white/15 text-sm text-slate-900 dark:text-white outline-none placeholder:text-slate-400"
                />
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Полоса квоты использует этот лимит. Оставьте пустым для безлимита.
                </p>
              </div>

              {keyError && <div className="text-xs text-rose-400 font-medium">{keyError}</div>}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-200 dark:bg-white/10 text-slate-800 dark:text-slate-200 text-sm font-medium cursor-pointer"
                >
                  Отменить
                </button>
                <button
                  type="submit"
                  disabled={creatingKey}
                  className="px-5 py-2.5 rounded-xl bg-[#FC734D] hover:bg-[#fb6338] text-white text-sm font-semibold cursor-pointer"
                >
                  {creatingKey ? 'Создание...' : 'Создать'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL 2: СОХРАНИТЕ КЛЮЧ (Скрин 3) ================= */}
      {createdFullKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-[#141414] border border-white/15 p-6 shadow-2xl space-y-5 text-white">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-xl font-bold">Сохраните ключ</h3>
                <p className="mt-1 text-xs text-slate-400">
                  Полный ключ показывается только сейчас. Скопируйте его в безопасное место.
                </p>
              </div>
              <button
                onClick={() => setCreatedFullKey(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Желтая плашка предупреждения */}
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/35 text-xs text-amber-300 flex items-start gap-2.5 leading-relaxed">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
              <span>
                Ключ показывается один раз — сохраните сейчас. Любой, у кого есть этот ключ, сможет
                тратить ваш баланс.
              </span>
            </div>

            {/* Полный ключ */}
            <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 font-mono text-sm break-all select-all">
              {createdFullKey}
            </div>

            {/* Кнопки действий */}
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                onClick={() => copyText('full', createdFullKey)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-semibold cursor-pointer"
              >
                {copiedFlag === 'full' ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                {copiedFlag === 'full' ? 'Скопировано' : 'Копировать'}
              </button>

              <button
                onClick={() => copyText('env', `PATRIK_API_KEY="${createdFullKey}"`)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-semibold cursor-pointer"
              >
                {copiedFlag === 'env' ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                {copiedFlag === 'env' ? 'Скопировано .env' : 'Копировать .env'}
              </button>

              <button
                onClick={() => {
                  setCreatedFullKey(null);
                  onNavigate('docs');
                }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-semibold cursor-pointer"
              >
                Помочь с подключением
              </button>
            </div>

            {/* Сниппет установки */}
            <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Сниппет установки (export, не URL)
              </div>
              <div className="p-3 rounded-lg bg-black/50 font-mono text-xs text-slate-200 overflow-x-auto">
                export PATRIK_API_KEY=&quot;{createdFullKey.slice(0, 18)}...&quot;
              </div>
              <div className="text-[11px] text-slate-400">
                PowerShell-вариант <code className="text-slate-300">$env:PATRIK_API_KEY=&quot;...&quot;</code> — копируется из Документации.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

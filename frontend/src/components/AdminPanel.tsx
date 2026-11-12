import React, { useEffect, useState, useRef } from 'react';
import {
  Save,
  Users,
  Sliders,
  Package,
  CheckCircle2,
  MessageSquare,
  Send,
  RefreshCw,
  Lock,
  User,
  Clock,
} from 'lucide-react';
import { AdminUserItem, Plan, SiteConfig, SupportChat, SupportMessage } from '../types';

interface AdminPanelProps {
  token: string;
  plans: Plan[];
  siteConfig: SiteConfig;
  onPlansUpdated: (plans: Plan[]) => void;
  onConfigUpdated: (cfg: SiteConfig) => void;
}

function mergeSupportMessages(current: SupportMessage[], incoming: SupportMessage[]): SupportMessage[] {
  const map = new Map<string, SupportMessage>();
  for (const m of current) {
    if (!m) continue;
    const key = m.id ? String(m.id) : `${m.sender}_${m.text}_${m.createdAt}`;
    map.set(key, m);
  }
  for (const m of incoming) {
    if (!m) continue;
    const key = m.id ? String(m.id) : `${m.sender}_${m.text}_${m.createdAt}`;
    map.set(key, m);
  }
  return Array.from(map.values()).sort((a, b) => {
    const ta = new Date(a.createdAt || 0).getTime();
    const tb = new Date(b.createdAt || 0).getTime();
    return ta - tb;
  });
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  token,
  plans,
  siteConfig,
  onPlansUpdated,
  onConfigUpdated,
}) => {
  const [subTab, setSubTab] = useState<'plans' | 'content' | 'users' | 'support'>('plans');
  const [cfg, setCfg] = useState<SiteConfig>(siteConfig);
  const [editablePlans, setEditablePlans] = useState<Plan[]>(plans);
  const [usersList, setUsersList] = useState<AdminUserItem[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  // Поддержка: состояние чатов и активной переписки
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [chats, setChats] = useState<SupportChat[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [chatMessages, setChatMessages] = useState<SupportMessage[]>([]);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [loadingChats, setLoadingChats] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);

  useEffect(() => {
    setCfg(siteConfig);
  }, [siteConfig]);

  useEffect(() => {
    setEditablePlans(plans);
  }, [plans]);

  useEffect(() => {
    if (subTab === 'users') {
      fetch('/api/admin/users', {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => (r.ok ? r.json() : []))
        .then((data) => setUsersList(data))
        .catch(() => {});
    }
  }, [subTab, token]);

  // Загрузка списка диалогов поддержки (с защитой от моргания)
  const loadChats = async (isManual = false) => {
    if (isManual) setLoadingChats(true);
    try {
      const res = await fetch('/api/admin/support/chats', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const incoming = Array.isArray(data) ? data : [];
        setChats((prev) => {
          // Если чаты не изменились, не создаём новый массив во избежание моргания UI
          if (
            prev.length === incoming.length &&
            incoming.every(
              (c, i) =>
                c.userId === prev[i]?.userId &&
                c.unreadCount === prev[i]?.unreadCount &&
                c.lastMessageAt === prev[i]?.lastMessageAt &&
                c.lastMessage === prev[i]?.lastMessage
            )
          ) {
            return prev;
          }
          return incoming;
        });
        // Если чат не выбран, но есть чаты — выберем первый стабильно
        setSelectedUserId((curr) => {
          if (curr) return curr;
          return incoming.length > 0 ? incoming[0].userId : null;
        });
      }
    } catch (e) {
      console.warn('Failed to load support chats:', e);
    } finally {
      if (isManual) setLoadingChats(false);
    }
  };

  // Загрузка сообщений выбранного пользователя с защитой от моргания
  const loadMessages = async (userId: number, isManual = false) => {
    if (isManual) setLoadingMessages(true);
    try {
      const res = await fetch(`/api/admin/support/messages/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const incoming = Array.isArray(data) ? data : (data.messages || data.list || []);
        if (Array.isArray(incoming) && incoming.length > 0) {
          setChatMessages((prev) => {
            const merged = mergeSupportMessages(prev, incoming);
            if (
              merged.length === prev.length &&
              merged.every((m, i) => m.id === prev[i]?.id && m.text === prev[i]?.text)
            ) {
              return prev;
            }
            return merged;
          });
        }
        // Обновляем бейдж непрочитанных у этого чата только если он был > 0
        setChats((prev) => {
          const target = prev.find((c) => c.userId === userId);
          if (!target || target.unreadCount === 0) return prev;
          return prev.map((c) => (c.userId === userId ? { ...c, unreadCount: 0 } : c));
        });
      }
    } catch (e) {
      console.warn('Failed to load chat messages:', e);
    } finally {
      if (isManual) setLoadingMessages(false);
    }
  };

  useEffect(() => {
    if (subTab === 'support' && chatMessages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages.length, subTab]);

  useEffect(() => {
    if (subTab === 'support') {
      loadChats(false);
      const interval = setInterval(() => loadChats(false), 8000);
      return () => clearInterval(interval);
    }
  }, [subTab, token]);

  useEffect(() => {
    if (subTab === 'support' && selectedUserId) {
      loadMessages(selectedUserId, false);
      const interval = setInterval(() => loadMessages(selectedUserId, false), 5000);
      return () => clearInterval(interval);
    }
  }, [subTab, selectedUserId, token]);

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId || !replyText.trim() || sendingReply) return;
    setSendingReply(true);
    try {
      const res = await fetch(`/api/admin/support/messages/${selectedUserId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ text: replyText.trim() }),
      });
      if (res.ok) {
        const resData = await res.json();
        const newMsg = resData.message || resData;
        setChatMessages((prev) => mergeSupportMessages(prev, [newMsg]));
        setReplyText('');
        showNotice('Ответ отправлен пользователю и сохранён в зашифрованном виде!');
        loadChats();
      }
    } catch (e) {
      console.warn('Failed to send admin reply:', e);
    } finally {
      setSendingReply(false);
    }
  };

  const showNotice = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 2500);
  };

  const handleSavePlan = async (plan: Plan) => {
    const res = await fetch(`/api/admin/plans/${plan.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(plan),
    });
    if (res.ok) {
      const data = await res.json();
      onPlansUpdated(data.plans);
      showNotice(`Тариф «${plan.name}» сохранён и обновлён на сайте!`);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/admin/config', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(cfg),
    });
    if (res.ok) {
      const data = await res.json();
      onConfigUpdated(data.config);
      showNotice('Настройки и тексты сайта сохранены!');
    }
  };

  const totalUnreadSupport = chats.reduce((acc, c) => acc + (c.unreadCount || 0), 0);
  const selectedChat = chats.find((c) => c.userId === selectedUserId);

  return (
    <div className="space-y-6">
      {/* Sub-navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 w-full max-w-full">
        <div className="flex flex-wrap gap-1.5 p-1 rounded-xl bg-slate-200 dark:bg-[#070E24] border border-slate-300 dark:border-white/10 max-w-full overflow-x-auto no-scrollbar">
          {[
            { id: 'plans', label: 'Тарифы и Токены', icon: <Package className="w-4 h-4" /> },
            { id: 'content', label: 'Тексты и Главная', icon: <Sliders className="w-4 h-4" /> },
            { id: 'users', label: 'Пользователи', icon: <Users className="w-4 h-4" /> },
            {
              id: 'support',
              label: 'Чат поддержки',
              icon: <MessageSquare className="w-4 h-4" />,
              badge: totalUnreadSupport > 0 ? totalUnreadSupport : undefined,
            },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setSubTab(t.id as typeof subTab)}
              className={`inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-all relative ${
                subTab === t.id
                  ? 'bg-[#FC734D] text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {t.icon}
              <span>{t.label}</span>
              {typeof t.badge === 'number' && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-rose-500 text-white">
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {notice && (
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-500 text-xs font-semibold">
            <CheckCircle2 className="w-4 h-4" />
            {notice}
          </div>
        )}
      </div>

      {/* 1. EDIT PLANS */}
      {subTab === 'plans' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {editablePlans.map((plan, idx) => (
            <div
              key={plan.id}
              className="rounded-2xl bg-white/90 dark:bg-[#0E1A3B]/85 border border-slate-200 dark:border-white/10 p-5 space-y-4 backdrop-blur-md"
            >
              <div className="text-sm font-bold text-[#0297DE] uppercase">Тариф #{plan.id}</div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-500">Название</label>
                <input
                  type="text"
                  value={plan.name}
                  onChange={(e) => {
                    const copy = [...editablePlans];
                    copy[idx] = { ...plan, name: e.target.value };
                    setEditablePlans(copy);
                  }}
                  className="w-full px-3 py-2 rounded-lg bg-slate-100 dark:bg-[#070E24] border border-slate-300 dark:border-white/15 text-sm text-slate-900 dark:text-white outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-500">Цена / мес (₽)</label>
                  <input
                    type="number"
                    value={plan.price_monthly}
                    onChange={(e) => {
                      const copy = [...editablePlans];
                      copy[idx] = { ...plan, price_monthly: Number(e.target.value) };
                      setEditablePlans(copy);
                    }}
                    className="w-full px-3 py-2 rounded-lg bg-slate-100 dark:bg-[#070E24] border border-slate-300 dark:border-white/15 text-sm text-slate-900 dark:text-white outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-500">Цена / год (₽)</label>
                  <input
                    type="number"
                    value={plan.price_yearly}
                    onChange={(e) => {
                      const copy = [...editablePlans];
                      copy[idx] = { ...plan, price_yearly: Number(e.target.value) };
                      setEditablePlans(copy);
                    }}
                    className="w-full px-3 py-2 rounded-lg bg-slate-100 dark:bg-[#070E24] border border-slate-300 dark:border-white/15 text-sm text-slate-900 dark:text-white outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-500">
                  Лимит токенов (-1 = безлимит)
                </label>
                <input
                  type="number"
                  value={plan.token_limit}
                  onChange={(e) => {
                    const copy = [...editablePlans];
                    copy[idx] = { ...plan, token_limit: Number(e.target.value) };
                    setEditablePlans(copy);
                  }}
                  className="w-full px-3 py-2 rounded-lg bg-slate-100 dark:bg-[#070E24] border border-slate-300 dark:border-white/15 text-sm text-slate-900 dark:text-white outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-500">Описание</label>
                <textarea
                  rows={2}
                  value={plan.description}
                  onChange={(e) => {
                    const copy = [...editablePlans];
                    copy[idx] = { ...plan, description: e.target.value };
                    setEditablePlans(copy);
                  }}
                  className="w-full px-3 py-2 rounded-lg bg-slate-100 dark:bg-[#070E24] border border-slate-300 dark:border-white/15 text-xs text-slate-900 dark:text-white outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-500">
                  Пункты тарифа (каждый с новой строки)
                </label>
                <textarea
                  rows={4}
                  value={plan.features.join('\n')}
                  onChange={(e) => {
                    const copy = [...editablePlans];
                    copy[idx] = {
                      ...plan,
                      features: e.target.value.split('\n').filter((x) => x.trim() !== ''),
                    };
                    setEditablePlans(copy);
                  }}
                  className="w-full px-3 py-2 rounded-lg bg-slate-100 dark:bg-[#070E24] border border-slate-300 dark:border-white/15 text-xs text-slate-900 dark:text-white outline-none"
                />
              </div>

              <button
                onClick={() => handleSavePlan(plan)}
                className="w-full py-2.5 rounded-xl bg-[#0297DE] hover:bg-[#0284c4] text-white text-xs font-semibold inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                Сохранить тариф
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 2. EDIT SITE TEXTS & STATS */}
      {subTab === 'content' && (
        <form
          onSubmit={handleSaveConfig}
          className="rounded-2xl bg-white/90 dark:bg-[#0E1A3B]/85 border border-slate-200 dark:border-white/10 p-6 space-y-5 backdrop-blur-md"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500">Название сайта</label>
              <input
                type="text"
                value={cfg.brandName}
                onChange={(e) => setCfg({ ...cfg, brandName: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-[#070E24] border border-slate-300 dark:border-white/15 text-sm text-slate-900 dark:text-white outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500">Почта поддержки (в подвале)</label>
              <input
                type="text"
                value={cfg.supportEmail}
                onChange={(e) => setCfg({ ...cfg, supportEmail: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-[#070E24] border border-slate-300 dark:border-white/15 text-sm text-slate-900 dark:text-white outline-none"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-500">Бейдж над заголовком</label>
            <input
              type="text"
              value={cfg.heroBadge}
              onChange={(e) => setCfg({ ...cfg, heroBadge: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-[#070E24] border border-slate-300 dark:border-white/15 text-sm text-slate-900 dark:text-white outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-500">Главный заголовок (Hero)</label>
            <input
              type="text"
              value={cfg.heroTitle}
              onChange={(e) => setCfg({ ...cfg, heroTitle: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-[#070E24] border border-slate-300 dark:border-white/15 text-sm text-slate-900 dark:text-white outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-500">Подзаголовок</label>
            <textarea
              rows={2}
              value={cfg.heroSubtitle}
              onChange={(e) => setCfg({ ...cfg, heroSubtitle: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-[#070E24] border border-slate-300 dark:border-white/15 text-sm text-slate-900 dark:text-white outline-none"
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              ['stat1Value', 'stat1Label', 'Метрика 1'],
              ['stat2Value', 'stat2Label', 'Метрика 2'],
              ['stat3Value', 'stat3Label', 'Метрика 3'],
              ['stat4Value', 'stat4Label', 'Метрика 4'],
            ].map(([vKey, lKey, title]) => (
              <div key={title} className="p-3 rounded-xl bg-slate-100 dark:bg-[#070E24] space-y-2">
                <div className="text-[11px] font-bold text-[#0297DE]">{title}</div>
                <input
                  type="text"
                  value={cfg[vKey as keyof SiteConfig]}
                  onChange={(e) => setCfg({ ...cfg, [vKey]: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#0E1A3B] border border-slate-300 dark:border-white/10 text-sm font-bold text-slate-900 dark:text-white outline-none"
                />
                <input
                  type="text"
                  value={cfg[lKey as keyof SiteConfig]}
                  onChange={(e) => setCfg({ ...cfg, [lKey]: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#0E1A3B] border border-slate-300 dark:border-white/10 text-xs text-slate-700 dark:text-slate-300 outline-none"
                />
              </div>
            ))}
          </div>

          <button
            type="submit"
            className="px-6 py-3 rounded-xl bg-[#FC734D] hover:bg-[#fb6338] text-white text-sm font-semibold inline-flex items-center gap-2 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            Сохранить все изменения на сайте
          </button>
        </form>
      )}

      {/* 3. USERS LIST (ПОЛЬЗОВАТЕЛИ) */}
      {subTab === 'users' && (
        <div className="rounded-2xl bg-white/90 dark:bg-[#0E1A3B]/85 border border-slate-200 dark:border-white/10 p-5 sm:p-6 space-y-4 backdrop-blur-md">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-white/10">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-[#0297DE]" />
              Зарегистрированные пользователи ({usersList.length})
            </h3>
          </div>

          {usersList.length === 0 ? (
            <p className="text-sm text-slate-500 py-6 text-center">Пользователей пока нет или данные загружаются...</p>
          ) : (
            <div className="overflow-x-auto max-w-full no-scrollbar">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-white/10 text-[11px] uppercase tracking-wider text-slate-500">
                    <th className="py-3 px-3">ID</th>
                    <th className="py-3 px-3">Пользователь</th>
                    <th className="py-3 px-3">Email</th>
                    <th className="py-3 px-3">Тариф</th>
                    <th className="py-3 px-3">Роль</th>
                    <th className="py-3 px-3">Ключи</th>
                    <th className="py-3 px-3 text-right">Платежи</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:border-white/10">
                  {usersList.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-100/50 dark:hover:bg-white/5">
                      <td className="py-3 px-3 font-mono text-slate-400">#{u.id}</td>
                      <td className="py-3 px-3 font-semibold text-slate-900 dark:text-white">{u.full_name}</td>
                      <td className="py-3 px-3 text-slate-600 dark:text-slate-300 font-mono text-xs">{u.email}</td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-[#0297DE]/15 text-[#0297DE]">
                          {u.plan_name || 'Без подписки'}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${u.role === 'admin' ? 'bg-rose-500/15 text-rose-500' : 'bg-slate-200 dark:bg-white/10 text-slate-500'}`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-600 dark:text-slate-300">{u.keys_count || 0}</td>
                      <td className="py-3 px-3 text-right font-semibold text-slate-900 dark:text-white">{u.transactions_count || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 4. SUPPORT CHAT (ЧАТ ПОДДЕРЖКИ) */}
      {subTab === 'support' && (
        <div className="space-y-4">
          {/* Telegram bot status banner */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-[#0297DE]/15 to-[#FC734D]/15 border border-[#0297DE]/30 backdrop-blur-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5 text-slate-800 dark:text-slate-200">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-xs shadow-emerald-500/50"></span>
              <span>
                <strong>Telegram-бот подключён:</strong> новые обращения пользователей приходят в
                Telegram на ID <code className="font-mono text-[#0297DE]">5103486897</code>.
              </span>
            </div>
            <div className="inline-flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
              <Lock className="w-3.5 h-3.5 text-[#FC734D]" />
              <span>Шифрование AES-256-GCM в БД</span>
            </div>
          </div>

          {/* Master-detail split layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 min-h-[560px]">
            {/* List of user chats */}
            <div className="lg:col-span-5 rounded-2xl bg-white/90 dark:bg-[#0E1A3B]/85 border border-slate-200 dark:border-white/10 p-4 space-y-3 backdrop-blur-md flex flex-col">
              <div className="flex items-center justify-between px-2 pb-1 border-b border-slate-200 dark:border-white/10">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Диалоги с клиентами ({chats.length})
                </span>
                <button
                  onClick={() => loadChats(true)}
                  title="Обновить список"
                  className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-500 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingChats ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {chats.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-400 text-xs">
                  <MessageSquare className="w-8 h-8 mb-2 opacity-40" />
                  Пока нет обращений от пользователей.
                </div>
              ) : (
                <div className="space-y-1.5 overflow-y-auto max-h-[500px] pr-1">
                  {chats.map((c) => {
                    const isSelected = selectedUserId === c.userId;
                    return (
                      <button
                        key={c.userId}
                        onClick={() => setSelectedUserId(c.userId)}
                        className={`w-full text-left p-3 rounded-xl transition-all cursor-pointer flex items-start gap-3 ${
                          isSelected
                            ? 'bg-[#0297DE]/15 dark:bg-[#132044] border border-[#0297DE]/40'
                            : 'hover:bg-slate-100 dark:hover:bg-white/5 border border-transparent'
                        }`}
                      >
                        <div className="w-9 h-9 rounded-full bg-[#0297DE]/20 text-[#0297DE] font-bold text-xs flex items-center justify-center shrink-0">
                          {c.userName ? c.userName.slice(0, 2).toUpperCase() : 'U'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                              {c.userName || 'Пользователь'}
                            </span>
                            {c.unreadCount > 0 && (
                              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-[#FC734D] text-white shrink-0">
                                +{c.unreadCount}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate">{c.userEmail}</div>
                          <p className="text-xs text-slate-600 dark:text-slate-300 truncate mt-1">
                            {c.lastMessage}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Conversation view */}
            <div className="lg:col-span-7 rounded-2xl bg-white/90 dark:bg-[#0E1A3B]/85 border border-slate-200 dark:border-white/10 p-5 backdrop-blur-md flex flex-col justify-between">
              {selectedUserId && selectedChat ? (
                <>
                  {/* Chat header */}
                  <div className="pb-3 border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-slate-900 dark:text-white">
                          {selectedChat.userName}
                        </h3>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-slate-300">
                          ID: {selectedChat.userId}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500">{selectedChat.userEmail}</div>
                    </div>
                    <button
                      onClick={() => loadMessages(selectedUserId, true)}
                      title="Обновить переписку"
                      className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-500 cursor-pointer"
                    >
                      <RefreshCw className={`w-4 h-4 ${loadingMessages ? 'animate-spin' : ''}`} />
                    </button>
                  </div>

                  {/* Messages list */}
                  <div className="my-4 space-y-3 overflow-y-auto min-h-[260px] max-h-[420px] pr-2 flex-1 scroll-smooth">
                    {chatMessages.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-8">
                        В этом диалоге ещё нет сообщений.
                      </p>
                    ) : (
                      chatMessages.map((m, idx) => {
                        const isAdmin = m.sender === 'admin';
                        const itemKey = m.id ? `admin_msg_${m.id}` : `admin_idx_${idx}_${m.createdAt || ''}`;
                        return (
                          <div
                            key={itemKey}
                            className={`flex flex-col ${isAdmin ? 'items-end' : 'items-start'}`}
                          >
                            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mb-1 px-1">
                              <span>{isAdmin ? 'Вы (Поддержка)' : m.userName || 'Клиент'}</span>
                              <span>•</span>
                              <span>
                                {m.createdAt
                                  ? new Date(m.createdAt).toLocaleTimeString('ru-RU', {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })
                                  : ''}
                              </span>
                            </div>
                            <div
                              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs sm:text-sm leading-relaxed shadow-sm ${
                                isAdmin
                                  ? 'bg-[#0297DE] text-white rounded-br-none'
                                  : 'bg-slate-100 dark:bg-[#132044] text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-bl-none'
                              }`}
                            >
                              {m.text}
                            </div>
                          </div>
                        );
                      })
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Reply form */}
                  <form onSubmit={handleSendReply} className="pt-3 border-t border-slate-200 dark:border-white/10 flex items-center gap-2">
                    <input
                      type="text"
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Напишите ответ пользователю..."
                      className="flex-1 px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-[#070E24] border border-slate-300 dark:border-white/15 text-sm text-slate-900 dark:text-white outline-none placeholder:text-slate-400"
                    />
                    <button
                      type="submit"
                      disabled={sendingReply || !replyText.trim()}
                      className="px-5 py-2.5 rounded-xl bg-[#FC734D] hover:bg-[#fb6338] disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold inline-flex items-center gap-2 cursor-pointer transition-all"
                    >
                      <Send className="w-4 h-4" />
                      <span>{sendingReply ? 'Отправка...' : 'Ответить'}</span>
                    </button>
                  </form>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-slate-400 text-xs">
                  <MessageSquare className="w-12 h-12 mb-3 text-slate-500 opacity-40" />
                  <p className="font-semibold text-slate-300 text-sm">Выберите чат из списка слева</p>
                  <p className="mt-1 max-w-xs">
                    Здесь вы сможете прочитать обращение клиента и сразу ответить ему.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

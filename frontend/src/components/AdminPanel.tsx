import React, { useEffect, useState } from 'react';
import { Save, Users, Sliders, Package, CheckCircle2 } from 'lucide-react';
import { AdminUserItem, Plan, SiteConfig } from '../types';

interface AdminPanelProps {
  token: string;
  plans: Plan[];
  siteConfig: SiteConfig;
  onPlansUpdated: (plans: Plan[]) => void;
  onConfigUpdated: (cfg: SiteConfig) => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  token,
  plans,
  siteConfig,
  onPlansUpdated,
  onConfigUpdated,
}) => {
  const [subTab, setSubTab] = useState<'plans' | 'content' | 'users'>('plans');
  const [cfg, setCfg] = useState<SiteConfig>(siteConfig);
  const [editablePlans, setEditablePlans] = useState<Plan[]>(plans);
  const [usersList, setUsersList] = useState<AdminUserItem[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

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

  return (
    <div className="space-y-6">
      {/* Sub-navigation */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="inline-flex p-1 rounded-xl bg-slate-200 dark:bg-[#070E24] border border-slate-300 dark:border-white/10">
          {[
            { id: 'plans', label: 'Тарифы и Токены', icon: <Package className="w-4 h-4" /> },
            { id: 'content', label: 'Тексты и Главная', icon: <Sliders className="w-4 h-4" /> },
            { id: 'users', label: 'Пользователи', icon: <Users className="w-4 h-4" /> },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setSubTab(t.id as typeof subTab)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                subTab === t.id
                  ? 'bg-[#FC734D] text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {t.icon}
              {t.label}
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

      {/* 3. USERS LIST */}
      {subTab === 'users' && (
        <div className="rounded-2xl bg-white/90 dark:bg-[#0E1A3B]/85 border border-slate-200 dark:border-white/10 overflow-hidden backdrop-blur-md">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-white/10 text-[11px] uppercase text-slate-500">
                  <th className="py-3.5 px-5">ID</th>
                  <th className="py-3.5 px-4">Имя</th>
                  <th className="py-3.5 px-4">Email</th>
                  <th className="py-3.5 px-4">Роль</th>
                  <th className="py-3.5 px-4">Подписка</th>
                  <th className="py-3.5 px-4">Платежей / Ключей</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-white/10">
                {usersList.map((u) => (
                  <tr key={u.id}>
                    <td className="py-3.5 px-5 font-mono text-xs text-[#0297DE]">#{u.id}</td>
                    <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white">{u.full_name}</td>
                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">{u.email}</td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          u.role === 'admin'
                            ? 'bg-[#FC734D]/20 text-[#FC734D]'
                            : 'bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-medium text-emerald-500">{u.plan_name}</td>
                    <td className="py-3.5 px-4 text-slate-500">
                      {u.transactions_count} / {u.keys_count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

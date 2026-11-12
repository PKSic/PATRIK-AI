import React, { useState } from 'react';
import { Mail, Lock, User } from 'lucide-react';

interface AuthPageProps {
  onAuthSubmit: (
    mode: 'login' | 'register',
    email: string,
    password: string,
    fullName?: string
  ) => Promise<{ ok: boolean; error?: string }>;
}

export const AuthPage: React.FC<AuthPageProps> = ({ onAuthSubmit }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError('Введите email и пароль');
      return;
    }
    setLoading(true);
    const res = await onAuthSubmit(
      mode,
      email.trim(),
      password,
      mode === 'register' ? fullName.trim() : undefined
    );
    setLoading(false);
    if (!res.ok) {
      setError(res.error || 'Ошибка авторизации');
    }
  };

  return (
    <div className="relative z-10 min-h-[calc(100vh-80px)] flex items-center justify-center px-5 py-16 pb-28 md:pb-16">
      <div
        className="w-full max-w-[440px] rounded-3xl bg-white/95 dark:bg-[#0E1A3B]/90 p-8 sm:p-9 backdrop-blur-xl shadow-2xl"
        style={{
          border: '1.5px solid rgba(2, 151, 222, 0.35)',
        }}
      >
        {/* Tabs Вход / Регистрация */}
        <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-[#070E24] mb-6">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError(null);
            }}
            className={`py-2.5 rounded-[9px] text-sm font-semibold transition-all cursor-pointer ${
              mode === 'login'
                ? 'bg-[#09318D] dark:bg-[#0297DE] text-white'
                : 'text-[#09318D]/70 dark:text-slate-400 hover:text-[#09318D] dark:hover:text-white'
            }`}
          >
            Вход
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setError(null);
            }}
            className={`py-2.5 rounded-[9px] text-sm font-semibold transition-all cursor-pointer ${
              mode === 'register'
                ? 'bg-[#09318D] dark:bg-[#0297DE] text-white'
                : 'text-[#09318D]/70 dark:text-slate-400 hover:text-[#09318D] dark:hover:text-white'
            }`}
          >
            Регистрация
          </button>
        </div>

        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            {mode === 'login' ? 'С возвращением в PATRIK AI' : 'Создать аккаунт PATRIK AI'}
          </h1>
          <p className="mt-2 text-[13px] text-slate-500 dark:text-slate-400">
            {mode === 'login'
              ? 'Войдите, чтобы управлять подпиской и API-ключами.'
              : 'Зарегистрируйтесь и получите доступ к личному кабинету.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <div className="flex items-center gap-3 px-4 h-12 rounded-[10px] bg-slate-100 dark:bg-[#070E24] border border-slate-300 dark:border-white/15">
              <User className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Ваше имя"
                className="w-full bg-transparent text-sm text-slate-900 dark:text-white outline-none placeholder:text-slate-400"
              />
            </div>
          )}

          <div className="flex items-center gap-3 px-4 h-12 rounded-[10px] bg-slate-100 dark:bg-[#070E24] border border-slate-300 dark:border-white/15">
            <Mail className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email (например, user@mail.ru)"
              className="w-full bg-transparent text-sm text-slate-900 dark:text-white outline-none placeholder:text-slate-400"
            />
          </div>

          <div className="flex items-center gap-3 px-4 h-12 rounded-[10px] bg-slate-100 dark:bg-[#070E24] border border-slate-300 dark:border-white/15">
            <Lock className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Пароль"
              className="w-full bg-transparent text-sm text-slate-900 dark:text-white outline-none placeholder:text-slate-400"
            />
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-rose-500/15 border border-rose-500/30 text-xs text-rose-400 font-medium">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-[50px] rounded-xl bg-[#F59ACC] hover:bg-[#ee82bd] text-[#09318D] dark:bg-[#FC734D] dark:hover:bg-[#fb6338] dark:text-white disabled:opacity-60 font-semibold text-[15px] transition-all cursor-pointer shadow-lg shadow-[#F59ACC]/30 dark:shadow-[#FC734D]/25"
          >
            {loading
              ? 'Подождите...'
              : mode === 'login'
              ? 'Войти в аккаунт'
              : 'Зарегистрироваться'}
          </button>
        </form>

        <div className="mt-5 text-center">
          <button
            type="button"
            onClick={() => {
              setMode(mode === 'login' ? 'register' : 'login');
              setError(null);
            }}
            className="text-[13px] font-medium text-[#0297DE] hover:underline cursor-pointer"
          >
            {mode === 'login' ? 'Нет аккаунта? Создать бесплатно' : 'Уже есть аккаунт? Войти'}
          </button>
        </div>
      </div>
    </div>
  );
};

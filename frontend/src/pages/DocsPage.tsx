import React, { useState } from 'react';
import { BookOpen, Terminal, Key, Cpu, Copy, Check, AlertCircle } from 'lucide-react';

export const DocsPage: React.FC = () => {
  const [lang, setLang] = useState<'curl' | 'js' | 'python' | 'ps'>('curl');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const snippets: Record<typeof lang, string> = {
    curl: `curl https://api.patrik.ai/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $PATRIK_API_KEY" \\
  -d '{
    "model": "patrik-text-2.5",
    "messages": [
      {"role": "user", "content": "Напиши сортировку массива на Python"}
    ],
    "temperature": 0.7
  }'`,
    js: `const response = await fetch("https://api.patrik.ai/v1/chat/completions", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": \`Bearer \${process.env.PATRIK_API_KEY}\`,
  },
  body: JSON.stringify({
    model: "patrik-code-pro",
    messages: [{ role: "user", content: "Сделай SQL-запрос для PostgreSQL" }],
  }),
});
const data = await response.json();
console.log(data.choices[0].message.content);`,
    python: `import os
import requests

res = requests.post(
    "https://api.patrik.ai/v1/chat/completions",
    headers={"Authorization": f"Bearer {os.environ['PATRIK_API_KEY']}"},
    json={
        "model": "patrik-text-2.5",
        "messages": [{"role": "user", "content": "Объясни квантовую физику просто"}],
    },
)
print(res.json()["choices"][0]["message"]["content"])`,
    ps: `$env:PATRIK_API_KEY="sk-patrik-..."
Invoke-RestMethod -Uri "https://api.patrik.ai/v1/chat/completions" \`
  -Method Post \`
  -Headers @{ Authorization = "Bearer $env:PATRIK_API_KEY" } \`
  -ContentType "application/json" \`
  -Body '{"model":"patrik-text-2.5","messages":[{"role":"user","content":"Привет!"}]}'`,
  };

  const envSnippet = `PATRIK_API_KEY="sk-patrik-ваш_ключ"
PATRIK_BASE_URL="https://api.patrik.ai/v1"`;

  return (
    <div className="relative z-10 max-w-7xl mx-auto px-5 md:px-12 pt-10 pb-28">
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar */}
        <aside className="w-full lg:w-64 shrink-0">
          <div className="sticky top-24 rounded-2xl bg-white/85 dark:bg-[#0E1A3B]/85 border border-slate-200 dark:border-white/10 p-5 backdrop-blur-md space-y-2">
            <div className="text-xs font-bold uppercase tracking-wider text-[#FC734D] mb-3">
              Документация API
            </div>
            {[
              { href: '#quickstart', label: 'Быстрый старт', icon: <BookOpen className="w-4 h-4" /> },
              { href: '#auth', label: 'Авторизация и .env', icon: <Key className="w-4 h-4" /> },
              { href: '#models', label: 'Модели PATRIK AI', icon: <Cpu className="w-4 h-4" /> },
              { href: '#examples', label: 'Примеры запросов', icon: <Terminal className="w-4 h-4" /> },
              { href: '#errors', label: 'Коды ошибок', icon: <AlertCircle className="w-4 h-4" /> },
            ].map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-[#0297DE]/15 hover:text-[#0297DE] transition-colors"
              >
                {item.icon}
                {item.label}
              </a>
            ))}
          </div>
        </aside>

        {/* Main Docs Content */}
        <main className="flex-1 space-y-8">
          {/* Header */}
          <div className="rounded-2xl bg-white/85 dark:bg-[#0E1A3B]/85 border border-slate-200 dark:border-white/10 p-7 backdrop-blur-md">
            <span className="inline-block px-3 py-1 rounded-full bg-[#0297DE]/15 text-[#0297DE] text-xs font-semibold mb-3">
              REST API v1 • OpenAI-совместимый формат
            </span>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
              Документация PATRIK AI API
            </h1>
            <p className="mt-2.5 text-sm md:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
              Подключайте нейросети PATRIK AI к своим веб-приложениям, Telegram-ботам и IDE за пару минут.
              Единый базовый URL: <code className="px-2 py-0.5 rounded bg-slate-200 dark:bg-[#070E24] text-[#FC734D]">https://api.patrik.ai/v1</code>
            </p>
          </div>

          {/* 1. Quickstart & Auth */}
          <section
            id="quickstart"
            className="rounded-2xl bg-white/85 dark:bg-[#0E1A3B]/85 border border-slate-200 dark:border-white/10 p-7 backdrop-blur-md space-y-4"
          >
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">1. Быстрый старт и настройка .env</h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Создайте API-ключ в Личном кабинете (раздел «API Ключи») и сохраните его в переменную окружения.
              Никогда не публикуйте ключ в клиентском коде браузера.
            </p>

            <div id="auth" className="relative rounded-xl bg-[#070E24] border border-white/10 p-4 font-mono text-xs md:text-sm text-slate-200">
              <button
                onClick={() => copyText('env', envSnippet)}
                className="absolute top-3 right-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-xs text-white cursor-pointer"
              >
                {copiedId === 'env' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedId === 'env' ? 'Скопировано' : 'Копировать'}
              </button>
              <pre className="overflow-x-auto">{envSnippet}</pre>
            </div>
          </section>

          {/* 2. Models Table */}
          <section
            id="models"
            className="rounded-2xl bg-white/85 dark:bg-[#0E1A3B]/85 border border-slate-200 dark:border-white/10 p-7 backdrop-blur-md space-y-4"
          >
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">2. Доступные модели</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-white/10 text-xs uppercase text-slate-500 dark:text-slate-400">
                    <th className="py-3 pr-4">ID модели</th>
                    <th className="py-3 pr-4">Контекст</th>
                    <th className="py-3">Назначение</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-white/10 text-slate-700 dark:text-slate-200">
                  <tr>
                    <td className="py-3 pr-4 font-mono text-[#0297DE]">patrik-text-2.5</td>
                    <td className="py-3 pr-4">128K</td>
                    <td className="py-3">Универсальный текстовый анализ, переводы, статьи</td>
                  </tr>
                  <tr>
                    <td className="py-3 pr-4 font-mono text-[#FC734D]">patrik-code-pro</td>
                    <td className="py-3 pr-4">128K</td>
                    <td className="py-3">Генерация и рефакторинг кода (JS, TS, Python, SQL)</td>
                  </tr>
                  <tr>
                    <td className="py-3 pr-4 font-mono text-[#0297DE]">patrik-vision</td>
                    <td className="py-3 pr-4">4K Render</td>
                    <td className="py-3">Генерация изображений и распознавание схем</td>
                  </tr>
                  <tr>
                    <td className="py-3 pr-4 font-mono text-[#FC734D]">patrik-voice</td>
                    <td className="py-3 pr-4">Real-time</td>
                    <td className="py-3">Синтез и распознавание речи</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* 3. Code Examples */}
          <section
            id="examples"
            className="rounded-2xl bg-white/85 dark:bg-[#0E1A3B]/85 border border-slate-200 dark:border-white/10 p-7 backdrop-blur-md space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">3. Примеры запросов</h2>
              <div className="flex gap-1.5 p-1 rounded-xl bg-slate-200 dark:bg-[#070E24]">
                {[
                  { id: 'curl', label: 'cURL' },
                  { id: 'js', label: 'JavaScript' },
                  { id: 'python', label: 'Python' },
                  { id: 'ps', label: 'PowerShell' },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setLang(t.id as typeof lang)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                      lang === t.id
                        ? 'bg-[#0297DE] text-white'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="relative rounded-xl bg-[#070E24] border border-white/10 p-4 font-mono text-xs md:text-sm text-slate-200">
              <button
                onClick={() => copyText('code', snippets[lang])}
                className="absolute top-3 right-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-xs text-white cursor-pointer"
              >
                {copiedId === 'code' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedId === 'code' ? 'Скопировано' : 'Копировать'}
              </button>
              <pre className="overflow-x-auto pr-24">{snippets[lang]}</pre>
            </div>
          </section>

          {/* 4. Errors */}
          <section
            id="errors"
            className="rounded-2xl bg-white/85 dark:bg-[#0E1A3B]/85 border border-slate-200 dark:border-white/10 p-7 backdrop-blur-md space-y-3"
          >
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">4. Коды ответов</h2>
            <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
              <li><code className="text-emerald-400 font-bold">200 OK</code> — запрос выполнен успешно.</li>
              <li><code className="text-amber-400 font-bold">401 Unauthorized</code> — неверный или отсутствующий API-ключ.</li>
              <li><code className="text-[#FC734D] font-bold">429 Too Many Requests</code> — исчерпан лимит токенов по ключу или тарифу.</li>
            </ul>
          </section>
        </main>
      </div>
    </div>
  );
};

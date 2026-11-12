import React, { useEffect, useRef } from 'react';

interface LightBeamsProps {
  className?: string;
}

/**
 * Живые вертикальные лучи (аудио-эквалайзер) на весь фон сайта.
 * - Единый плавный градиент от Electric Blue (#0297DE) по краям к Оранжевому (#FC734D) в центре (без резких стыков).
 * - Плавное затухание вверх без резкого обрыва.
 * - Гармоничное движение волн, как под мелодию.
 */
export const LightBeams: React.FC<LightBeamsProps> = ({ className = '' }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    let width = 0;
    let height = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    window.addEventListener('resize', resize);

    const beamWidth = 4;
    const gap = 5;
    const step = beamWidth + gap;

    const render = (timeMs: number) => {
      const t = timeMs * 0.0014; // плавный темп мелодии
      ctx.clearRect(0, 0, width, height);

      const isDark = document.documentElement.classList.contains('dark');
      const count = Math.ceil(width / step);

      for (let i = 0; i < count; i++) {
        const x = i * step;
        const nx = x / Math.max(width, 1); // 0..1 по горизонтали

        // Расстояние от центра (0 в центре, 1 по краям)
        const distFromCenter = Math.abs(nx - 0.5) * 2;
        // Плавный коэффициент смешивания: 1 в центре (оранжевый), 0 по краям (electric blue)
        const orangeMix = Math.exp(-Math.pow(distFromCenter * 1.9, 2));

        // Интерполяция RGB между Electric Blue (2, 151, 222) и Оранжевым (252, 115, 77)
        const r = Math.round(2 + (252 - 2) * orangeMix);
        const g = Math.round(151 + (115 - 151) * orangeMix);
        const b = Math.round(222 + (77 - 222) * orangeMix);

        // Мелодичная волна (комбинация 3 гармоник, как эквалайзер под музыку)
        const wave1 = Math.sin(nx * 9.5 + t * 1.4);
        const wave2 = Math.sin(nx * 19.0 - t * 2.1) * 0.55;
        const wave3 = Math.cos(nx * 4.2 + t * 0.8) * 0.45;
        const melody = (wave1 + wave2 + wave3 + 2.0) / 4.0; // 0..1

        // Базовая высота лучей плавно выше в центре и у краёв, ниже в переходных зонах
        const profile = 0.48 + 0.32 * orangeMix + 0.2 * Math.pow(distFromCenter, 2);
        const beamH = height * (0.38 + 0.44 * profile * (0.55 + 0.45 * melody));
        const yTop = height - beamH;

        const baseAlpha = isDark ? 0.42 + 0.26 * melody : 0.2 + 0.14 * melody;

        const grad = ctx.createLinearGradient(x, height, x, yTop);
        grad.addColorStop(0, `rgba(255, 255, 255, ${(baseAlpha * 0.65).toFixed(3)})`);
        grad.addColorStop(0.18, `rgba(${r}, ${g}, ${b}, ${baseAlpha.toFixed(3)})`);
        grad.addColorStop(0.65, `rgba(${r}, ${g}, ${b}, ${(baseAlpha * 0.28).toFixed(3)})`);
        grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);

        ctx.fillStyle = grad;
        ctx.fillRect(x, yTop, beamWidth, beamH);
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none fixed inset-0 z-0 overflow-hidden ${className}`}
    >
      {/* Мягкое бесшовное свечение на фоне, чтобы не было резких переходов */}
      <div
        className="absolute inset-0 opacity-45 dark:opacity-55"
        style={{
          background:
            'radial-gradient(ellipse 65% 55% at 50% 105%, rgba(252,115,77,0.35), transparent 70%), radial-gradient(ellipse 50% 50% at 10% 100%, rgba(2,151,222,0.28), transparent 70%), radial-gradient(ellipse 50% 50% at 90% 100%, rgba(2,151,222,0.28), transparent 70%)',
        }}
      />
      <canvas ref={canvasRef} className="w-full h-full block blur-[10px] opacity-80" />
    </div>
  );
};

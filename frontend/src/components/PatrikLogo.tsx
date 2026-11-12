import React from 'react';

interface PatrikLogoProps {
  size?: number;
  withText?: boolean;
}

export const PatrikLogo: React.FC<PatrikLogoProps> = ({ size = 36, withText = true }) => {
  return (
    <div className="inline-flex items-center gap-3 select-none">
      <div
        style={{ width: size, height: size }}
        className="relative flex items-center justify-center rounded-[10px] bg-[#070E24] p-[4px] border border-transparent"
      >
        {/* Фирменная градиентная рамка логотипа */}
        <div
          className="absolute inset-0 rounded-[10px] p-[1.5px] pointer-events-none"
          style={{
            background: 'linear-gradient(90deg, #0297DE, #FC734D)',
            WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
            WebkitMaskComposite: 'xor',
            maskComposite: 'exclude',
          }}
        />
        <svg viewBox="0 0 64 64" fill="none" className="w-full h-full">
          <defs>
            <linearGradient id="pBlueReact" x1="8" y1="56" x2="48" y2="8" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#0297DE" />
              <stop offset="100%" stopColor="#38BDF8" />
            </linearGradient>
            <linearGradient id="pOrangeReact" x1="20" y1="10" x2="54" y2="42" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FC734D" />
              <stop offset="100%" stopColor="#FF9F7A" />
            </linearGradient>
          </defs>
          <path
            d="M18 52V16C18 13.7909 19.7909 12 22 12H36C44.8366 12 52 19.1634 52 28C52 36.8366 44.8366 44 36 44H24"
            stroke="url(#pBlueReact)"
            strokeWidth="6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M26 36H35C39.4183 36 43 32.4183 43 28C43 23.5817 39.4183 20 35 20H26"
            stroke="url(#pOrangeReact)"
            strokeWidth="5"
            strokeLinecap="round"
          />
          <circle cx="26" cy="28" r="4" fill="#FFFFFF" />
          <circle cx="18" cy="52" r="3.5" fill="#FC734D" />
        </svg>
      </div>
      {withText && (
        <span className="text-[20px] font-bold tracking-tight text-[#09318D] dark:text-white">
          PATRIK AI
        </span>
      )}
    </div>
  );
};

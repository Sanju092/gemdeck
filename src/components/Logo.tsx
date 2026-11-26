import React from 'react';

export function Logo({ className = 'w-7 h-7' }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 128 128"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="gemdeckBg" x1="0" y1="0" x2="128" y2="128" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#312E81" />
          <stop offset="55%" stopColor="#4F46E5" />
          <stop offset="100%" stopColor="#0EA5E9" />
        </linearGradient>
        <linearGradient id="gemdeckTop" x1="32" y1="24" x2="96" y2="60" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#E0F2FE" />
          <stop offset="100%" stopColor="#A5B4FC" />
        </linearGradient>
        <linearGradient id="gemdeckLeft" x1="26" y1="54" x2="64" y2="104" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#818CF8" />
          <stop offset="100%" stopColor="#4338CA" />
        </linearGradient>
        <linearGradient id="gemdeckCenter" x1="46" y1="54" x2="82" y2="104" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="100%" stopColor="#6366F1" />
        </linearGradient>
        <linearGradient id="gemdeckRight" x1="64" y1="54" x2="102" y2="104" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#60A5FA" />
          <stop offset="100%" stopColor="#3730A3" />
        </linearGradient>
      </defs>
      <rect width="128" height="128" rx="30" fill="url(#gemdeckBg)" />
      <rect x="4" y="4" width="120" height="120" rx="26" stroke="#FFFFFF" strokeOpacity="0.18" strokeWidth="2" />
      <polygon points="42,28 86,28 102,52 26,52" fill="url(#gemdeckTop)" />
      <polygon points="42,28 64,28 50,52 26,52" fill="#FFFFFF" fillOpacity="0.35" />
      <polygon points="64,28 86,28 78,52 50,52" fill="#FFFFFF" fillOpacity="0.18" />
      <polygon points="26,52 50,52 64,102" fill="url(#gemdeckLeft)" />
      <polygon points="50,52 78,52 64,102" fill="url(#gemdeckCenter)" />
      <polygon points="78,52 102,52 64,102" fill="url(#gemdeckRight)" />
      <polygon
        points="42,28 86,28 102,52 64,102 26,52"
        stroke="#FFFFFF"
        strokeOpacity="0.45"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

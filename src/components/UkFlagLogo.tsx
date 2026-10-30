import React from 'react';

interface UkFlagLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * Crisp vector UK Union Jack Flag Logo replacing the old "LC" text badge.
 */
export const UkFlagLogo: React.FC<UkFlagLogoProps> = ({
  size = 'md',
  className = '',
}) => {
  const sizeClasses =
    size === 'xs'
      ? 'h-6 w-6 rounded-lg'
      : size === 'sm'
      ? 'h-8 w-8 rounded-xl'
      : size === 'lg'
      ? 'h-14 w-14 rounded-2xl'
      : 'h-10 w-10 rounded-2xl';

  return (
    <div
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden bg-[#012169] shadow-md border-2 border-white/90 dark:border-slate-700 select-none ${sizeClasses} ${className}`}
      aria-label="UK Flag Logo"
    >
      <svg
        viewBox="0 0 60 60"
        className="h-full w-full object-cover"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <clipPath id="uk-square-clip">
            <rect width="60" height="60" rx="4" />
          </clipPath>
        </defs>
        <g clipPath="url(#uk-square-clip)">
          {/* Royal Blue Field */}
          <rect width="60" height="60" fill="#012169" />

          {/* White Diagonal Saltires (St Andrew & St Patrick background) */}
          <path
            d="M0,0 L60,60 M60,0 L0,60"
            stroke="#FFFFFF"
            strokeWidth="12"
          />

          {/* Red Diagonal Saltire (St Patrick) */}
          <path
            d="M0,0 L60,60 M60,0 L0,60"
            stroke="#C8102E"
            strokeWidth="5"
          />

          {/* White Central Cross (St George fimbriation) */}
          <path
            d="M30,0 L30,60 M0,30 L60,30"
            stroke="#FFFFFF"
            strokeWidth="18"
          />

          {/* Red Central Cross (St George) */}
          <path
            d="M30,0 L30,60 M0,30 L60,30"
            stroke="#C8102E"
            strokeWidth="10.5"
          />
        </g>
      </svg>
    </div>
  );
};

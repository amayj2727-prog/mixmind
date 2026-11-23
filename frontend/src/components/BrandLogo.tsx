import React from 'react';

interface BrandLogoProps {
  variant?: 'full' | 'header' | 'icon';
  className?: string;
  showTagline?: boolean;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  variant = 'header',
  className = '',
  showTagline = true
}) => {
  // Official MIXMIND SVG Icon — M with slider rail + soundwave pulse
  const LogoIcon = ({ size = 36 }: { size?: number }) => (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 120 100" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className="flex-shrink-0"
    >
      {/* Left Column */}
      <path d="M24 24H38V76H24V24Z" fill="#FF4D00" />
      {/* Right Column */}
      <path d="M62 24H76V76H62V24Z" fill="#FF4D00" />
      {/* Left Diagonal */}
      <path d="M38 24L50 48H38V24Z" fill="#FF4D00" />
      {/* Right Diagonal */}
      <path d="M62 24L50 48H62V24Z" fill="#FF4D00" />
      {/* Left Rail */}
      <line x1="4" y1="50" x2="46" y2="50" stroke="#FF4D00" strokeWidth="6" strokeLinecap="round" />
      {/* Slider Knob */}
      <rect x="43" y="41" width="10" height="18" rx="3" fill="#FF4D00" />
      {/* Soundwave Pulse */}
      <path 
        d="M56 50L64 50L70 34L77 66L84 38L91 60L98 44L105 54L114 50" 
        stroke="#FF4D00" 
        strokeWidth="5" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
      />
    </svg>
  );

  if (variant === 'icon') {
    return <LogoIcon size={36} />;
  }

  if (variant === 'header') {
    return (
      <div className={`flex items-center gap-2.5 select-none ${className}`}>
        <LogoIcon size={28} />
        <div className="flex flex-col">
          <span className="font-headline font-extrabold text-lg tracking-tight text-white leading-none">
            MIXMIND
          </span>
          {showTagline && (
            <span className="text-[10px] font-body text-[#808080] tracking-wide leading-tight">
              Don't just listen. Feel the mix.
            </span>
          )}
        </div>
      </div>
    );
  }

  // Full Hero Variant
  return (
    <div className={`flex flex-col items-center text-center select-none ${className}`}>
      <LogoIcon size={56} />
      <h1 className="font-headline font-extrabold text-3xl sm:text-4xl tracking-tight text-white mt-3">
        MIXMIND
      </h1>
      {showTagline && (
        <p className="font-headline font-semibold text-base text-[#808080] mt-1">
          Don't just listen. Feel the mix.
        </p>
      )}
    </div>
  );
};

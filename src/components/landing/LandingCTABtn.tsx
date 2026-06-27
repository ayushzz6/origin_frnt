'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Send } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface LandingCTABtnProps {
  label: string;
  href?: string;
  onClick?: (e?: React.MouseEvent) => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  variant?: 'default' | 'sm' | 'xs';
  className?: string;
  target?: string;
  initial?: React.ComponentProps<typeof motion.button>['initial'];
  animate?: React.ComponentProps<typeof motion.button>['animate'];
  transition?: React.ComponentProps<typeof motion.button>['transition'];
  whileInView?: React.ComponentProps<typeof motion.button>['whileInView'];
  viewport?: React.ComponentProps<typeof motion.button>['viewport'];
}

export default function LandingCTABtn({
  label,
  href,
  onClick,
  onMouseEnter,
  onMouseLeave,
  variant = 'default',
  className = '',
  target,
  initial,
  animate,
  transition,
  whileInView,
  viewport,
}: LandingCTABtnProps) {
  const [firing, setFiring] = useState(false);
  const router = useRouter();

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (firing) return;
    setFiring(true);
    setTimeout(() => {
      setFiring(false);
      if (onClick) {
        onClick(e);
      } else if (href) {
        if (target === '_blank' || href.startsWith('http')) {
          window.open(href, '_blank', 'noopener,noreferrer');
        } else {
          router.push(href);
        }
      }
    }, 480);
  };

  const sizeClass =
    variant === 'sm' ? 'landing-cta-btn--sm' : variant === 'xs' ? 'landing-cta-btn--xs' : '';

  return (
    <motion.button
      initial={initial}
      animate={animate}
      transition={transition}
      whileInView={whileInView}
      viewport={viewport}
      onClick={handleClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      data-firing={firing ? 'true' : undefined}
      className={`landing-cta-btn ${sizeClass} ${className}`.trim()}
    >
      <div className="cta-outline"><div /></div>
      <div className="cta-state">
        <div className="cta-icon">
          <Send className={variant === 'xs' ? 'w-3 h-3' : 'w-4 h-4'} />
        </div>
        <p className="flex">
          {label.split('').map((char, i) => (
            <span key={i} style={{ '--i': i } as React.CSSProperties}>
              {char === ' ' ? ' ' : char}
            </span>
          ))}
        </p>
      </div>
    </motion.button>
  );
}

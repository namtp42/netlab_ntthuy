
import React from 'react';
import { DeviceType } from '../types';

interface IconProps {
  type: DeviceType;
  className?: string;
}

export const NetworkIcon: React.FC<IconProps> = ({ type, className = "w-10 h-10" }) => {
  // DeviceType is a type alias of string literals, so we use literals in the switch cases
  switch (type) {
    case 'pc':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
      );
    case 'switch':
      return (
        <svg viewBox="0 0 48 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
          {/* Rack mount chassis */}
          <rect x="2" y="6" width="44" height="12" rx="1" fill="currentColor" fillOpacity="0.1" />
          
          {/* Port Grid: 2 rows of 12 ports */}
          {/* Top Row */}
          {[...Array(12)].map((_, i) => (
            <rect key={`p1-${i}`} x={6 + i * 3} y="9" width="1.5" height="2" rx="0.2" fill="currentColor" />
          ))}
          {/* Bottom Row */}
          {[...Array(12)].map((_, i) => (
            <rect key={`p2-${i}`} x={6 + i * 3} y="13" width="1.5" height="2" rx="0.2" fill="currentColor" />
          ))}
          
          {/* Status LEDs on the left */}
          <circle cx="4" cy="9" r="0.5" fill="#10b981" />
          <circle cx="4" cy="11" r="0.5" fill="#10b981" />
          
          {/* Right side console port or venting detail */}
          <rect x="42" y="9" width="2" height="6" rx="0.5" fill="currentColor" fillOpacity="0.5" />
        </svg>
      );
    case 'router':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
          <circle cx="12" cy="12" r="9" />
          <line x1="12" y1="3" x2="12" y2="21" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <path d="M18 9l3 3-3 3" />
          <path d="M6 9l-3 3 3 3" />
        </svg>
      );
    default:
      return null;
  }
};

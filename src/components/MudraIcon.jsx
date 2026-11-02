import React from 'react';

export const MudraIcon = ({ className = 'w-4 h-4 inline-block', alt = 'Mudra Coin' }) => (
  <img
    src="/mudra-coin.png"
    alt={alt}
    className={`${className} object-contain align-middle shrink-0 inline-block drop-shadow-sm`}
  />
);

export default MudraIcon;

import React from 'react';

interface SeparatorProps {
  orientation?: 'horizontal' | 'vertical';
  className?: string;
}

const Separator: React.FC<SeparatorProps> = ({ orientation = 'horizontal', className = '' }) => {
  return (
    <div
      role="separator"
      data-orientation={orientation}
      className={`shrink-0 bg-border ${
        orientation === 'horizontal' ? 'h-[1px] w-full' : 'h-full w-[1px]'
      } ${className}`}
    />
  );
};

export { Separator };

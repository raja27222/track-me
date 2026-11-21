import React from 'react';

interface NeumorphicCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'raised' | 'raised-sm' | 'inset';
  children: React.ReactNode;
}

export function NeumorphicCard({
  variant = 'raised',
  className = '',
  children,
  ...rest
}: NeumorphicCardProps) {
  const variantClass =
    variant === 'inset'
      ? 'neu-inset'
      : variant === 'raised-sm'
        ? 'neu-card-sm'
        : 'neu-card';

  return (
    <div className={`${variantClass} rounded-3xl ${className}`} {...rest}>
      {children}
    </div>
  );
}

import React from 'react';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function Toggle({ 
  checked, 
  onChange, 
  disabled = false, 
  size = 'md',
  className = '' 
}: ToggleProps) {
  const sizes = {
    sm: {
      container: 'w-8 h-4',
      circle: 'w-3 h-3',
      translate: 'translate-x-4'
    },
    md: {
      container: 'w-11 h-6',
      circle: 'w-5 h-5',
      translate: 'translate-x-5'
    },
    lg: {
      container: 'w-14 h-7',
      circle: 'w-6 h-6',
      translate: 'translate-x-7'
    }
  };

  const currentSize = sizes[size];

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`
        relative inline-flex items-center rounded-full transition-colors
        ${currentSize.container}
        ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}
        ${checked ? 'bg-blue-600' : 'bg-gray-200'}
        ${className}
      `}
    >
      <span
        className={`
          inline-block rounded-full bg-white shadow-sm transform transition-transform
          ${currentSize.circle}
          ${checked ? currentSize.translate : 'translate-x-0.5'}
        `}
      />
    </button>
  );
}

// Toggle with label
interface LabeledToggleProps extends ToggleProps {
  label: string;
  description?: string;
  labelPosition?: 'left' | 'right';
}

export function LabeledToggle({ 
  label, 
  description,
  labelPosition = 'left',
  ...toggleProps 
}: LabeledToggleProps) {
  const labelContent = (
    <div className="flex-1">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      {description && (
        <p className="text-xs text-gray-500 mt-0.5">{description}</p>
      )}
    </div>
  );

  return (
    <div className="flex items-center gap-3">
      {labelPosition === 'left' && labelContent}
      <Toggle {...toggleProps} />
      {labelPosition === 'right' && labelContent}
    </div>
  );
}
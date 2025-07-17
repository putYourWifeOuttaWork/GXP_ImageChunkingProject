/**
 * EditableItem - Reusable inline editing component for report builder
 * Supports text, select, and number inputs with validation
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Check, X, AlertCircle } from 'lucide-react';

interface EditableItemProps {
  id: string;
  value: string | number;
  label: string;
  type: 'text' | 'select' | 'number';
  options?: Array<{ value: string; label: string }>;
  onSave: (id: string, newValue: any) => void;
  onCancel?: () => void;
  icon?: React.ReactNode;
  metadata?: Record<string, any>;
  validation?: (value: any) => string | null;
  className?: string;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
}

export const EditableItem: React.FC<EditableItemProps> = React.memo(({
  id,
  value,
  label,
  type,
  options,
  onSave,
  onCancel,
  icon,
  validation,
  className = '',
  placeholder,
  min,
  max,
  step = 1,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      if (inputRef.current instanceof HTMLInputElement && type === 'text') {
        inputRef.current.select();
      }
    }
  }, [isEditing, type]);

  // Handle click outside to save
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isEditing && containerRef.current && !containerRef.current.contains(event.target as Node)) {
        handleSave();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isEditing, editValue]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsEditing(true);
    setEditValue(value);
    setError(null);
  }, [value]);

  const handleSave = useCallback(() => {
    // Validate if validation function provided
    if (validation) {
      const validationError = validation(editValue);
      if (validationError) {
        setError(validationError);
        return;
      }
    }

    // Only save if value changed
    if (editValue !== value) {
      onSave(id, editValue);
    }
    
    setIsEditing(false);
    setError(null);
  }, [editValue, value, id, onSave, validation]);

  const handleCancel = useCallback(() => {
    setEditValue(value);
    setIsEditing(false);
    setError(null);
    onCancel?.();
  }, [value, onCancel]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  }, [handleSave, handleCancel]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const newValue = type === 'number' ? Number(e.target.value) : e.target.value;
    setEditValue(newValue);
    
    // Clear error on change
    if (error) {
      setError(null);
    }
  }, [type, error]);

  const renderInput = () => {
    switch (type) {
      case 'select':
        return (
          <select
            ref={inputRef as React.RefObject<HTMLSelectElement>}
            value={String(editValue)}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            className="w-full px-2 py-1 text-sm border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {options?.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        );

      case 'number':
        return (
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type="number"
            value={editValue}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            min={min}
            max={max}
            step={step}
            placeholder={placeholder}
            className="w-full px-2 py-1 text-sm border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        );

      default:
        return (
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type="text"
            value={editValue}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="w-full px-2 py-1 text-sm border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        );
    }
  };

  const renderDisplay = () => {
    let displayValue = value;
    
    // Format display for select options
    if (type === 'select' && options) {
      const option = options.find(opt => opt.value === String(value));
      displayValue = option?.label || value;
    }
    
    return (
      <div
        className="flex items-center space-x-2 px-2 py-1 rounded hover:bg-gray-50 cursor-pointer"
        onDoubleClick={handleDoubleClick}
        title="Double-click to edit"
      >
        {icon && <span className="text-gray-500">{icon}</span>}
        <span className="text-sm font-medium text-gray-700">{label}:</span>
        <span className="text-sm text-gray-900">{displayValue}</span>
      </div>
    );
  };

  return (
    <div ref={containerRef} className={`editable-item ${className}`}>
      {isEditing ? (
        <div className="flex items-center space-x-2">
          <div className="flex-1">
            {renderInput()}
            {error && (
              <div className="flex items-center mt-1 text-xs text-red-600">
                <AlertCircle size={12} className="mr-1" />
                {error}
              </div>
            )}
          </div>
          <button
            onClick={handleSave}
            className="p-1 text-green-600 hover:bg-green-50 rounded"
            title="Save (Enter)"
          >
            <Check size={16} />
          </button>
          <button
            onClick={handleCancel}
            className="p-1 text-red-600 hover:bg-red-50 rounded"
            title="Cancel (Esc)"
          >
            <X size={16} />
          </button>
        </div>
      ) : (
        renderDisplay()
      )}
    </div>
  );
});

EditableItem.displayName = 'EditableItem';
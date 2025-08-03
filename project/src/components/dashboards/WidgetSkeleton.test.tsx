import React from 'react';
import { render } from '@testing-library/react';
import { WidgetSkeleton } from './WidgetSkeleton';

describe('WidgetSkeleton', () => {
  it('renders report skeleton', () => {
    const { container } = render(<WidgetSkeleton type="report" />);
    expect(container.querySelector('.animate-pulse')).toBeTruthy();
    // Should have chart elements
    expect(container.querySelectorAll('.bg-gray-300').length).toBeGreaterThan(0);
  });

  it('renders metric skeleton', () => {
    const { container } = render(<WidgetSkeleton type="metric" />);
    expect(container.querySelector('.animate-pulse')).toBeTruthy();
    // Should have metric value and label placeholders
    expect(container.querySelector('.h-12')).toBeTruthy();
    expect(container.querySelector('.h-5')).toBeTruthy();
  });

  it('renders text skeleton', () => {
    const { container } = render(<WidgetSkeleton type="text" />);
    expect(container.querySelector('.animate-pulse')).toBeTruthy();
    // Should have multiple text lines
    expect(container.querySelectorAll('.h-4').length).toBe(5);
  });

  it('renders image skeleton', () => {
    const { container } = render(<WidgetSkeleton type="image" />);
    expect(container.querySelector('.animate-pulse')).toBeTruthy();
    // Should have image placeholder with icon
    expect(container.querySelector('svg')).toBeTruthy();
  });

  it('respects showTitle prop', () => {
    const { container: withTitle } = render(<WidgetSkeleton type="report" showTitle={true} />);
    const { container: withoutTitle } = render(<WidgetSkeleton type="report" showTitle={false} />);
    
    expect(withTitle.querySelector('.border-b')).toBeTruthy();
    expect(withoutTitle.querySelector('.border-b')).toBeFalsy();
  });

  it('applies animation delays correctly', () => {
    const { container } = render(<WidgetSkeleton type="report" />);
    const delayedElements = container.querySelectorAll('[class*="delay-"]');
    expect(delayedElements.length).toBeGreaterThan(0);
  });
});
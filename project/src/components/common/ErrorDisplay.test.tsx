import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorDisplay, commonErrorActions, getErrorType } from './ErrorDisplay';

describe('ErrorDisplay', () => {
  it('renders general error by default', () => {
    render(<ErrorDisplay message="Something went wrong" />);
    expect(screen.getByText('Something Went Wrong')).toBeTruthy();
    expect(screen.getByText('Something went wrong')).toBeTruthy();
  });

  it('renders specific error types correctly', () => {
    render(<ErrorDisplay type="permission-denied" message="You do not have access" />);
    expect(screen.getByText('Access Denied')).toBeTruthy();
  });

  it('renders custom title over default', () => {
    render(<ErrorDisplay type="general" title="Custom Error" message="Test message" />);
    expect(screen.getByText('Custom Error')).toBeTruthy();
  });

  it('renders details when provided', () => {
    render(<ErrorDisplay message="Error" details="Technical details here" />);
    expect(screen.getByText('Technical details here')).toBeTruthy();
  });

  it('renders action buttons', () => {
    const onRetry = jest.fn();
    const onConfigure = jest.fn();
    
    render(
      <ErrorDisplay 
        message="Error"
        actions={[
          commonErrorActions.retry(onRetry),
          commonErrorActions.configure(onConfigure)
        ]}
      />
    );
    
    const retryButton = screen.getByText('Try Again');
    const configureButton = screen.getByText('Configure');
    
    fireEvent.click(retryButton);
    fireEvent.click(configureButton);
    
    expect(onRetry).toHaveBeenCalled();
    expect(onConfigure).toHaveBeenCalled();
  });

  describe('getErrorType', () => {
    it('detects permission errors', () => {
      expect(getErrorType({ code: '42501' })).toBe('permission-denied');
      expect(getErrorType({ message: 'Permission denied' })).toBe('permission-denied');
    });

    it('detects network errors', () => {
      expect(getErrorType({ message: 'Network error occurred' })).toBe('network-error');
      expect(getErrorType({ message: 'Failed to fetch' })).toBe('network-error');
    });

    it('detects not found errors', () => {
      expect(getErrorType({ message: 'Resource not found' })).toBe('data-not-found');
      expect(getErrorType({ code: 'PGRST116' })).toBe('data-not-found');
    });

    it('detects database errors', () => {
      expect(getErrorType({ message: 'Database connection failed' })).toBe('database-error');
      expect(getErrorType({ code: '42P01' })).toBe('database-error');
    });

    it('detects configuration errors', () => {
      expect(getErrorType({ message: 'Invalid configuration' })).toBe('configuration-error');
      expect(getErrorType({ message: 'Settings are incorrect' })).toBe('configuration-error');
    });

    it('returns general for unknown errors', () => {
      expect(getErrorType({ message: 'Random error' })).toBe('general');
      expect(getErrorType(null)).toBe('general');
    });
  });
});
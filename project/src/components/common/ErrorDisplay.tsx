import React from 'react';
import { 
  AlertCircle, 
  RefreshCw, 
  Settings, 
  HelpCircle,
  FileX,
  Database,
  Wifi,
  Lock,
  AlertTriangle
} from 'lucide-react';
import Button from './Button';

export type ErrorType = 
  | 'data-not-found'
  | 'permission-denied'
  | 'network-error'
  | 'configuration-error'
  | 'report-not-found'
  | 'database-error'
  | 'general';

interface ErrorAction {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
}

interface ErrorDisplayProps {
  type?: ErrorType;
  title?: string;
  message: string;
  details?: string;
  actions?: ErrorAction[];
  className?: string;
}

const errorTypeConfig: Record<ErrorType, {
  icon: React.ReactNode;
  defaultTitle: string;
  color: string;
}> = {
  'data-not-found': {
    icon: <FileX size={48} />,
    defaultTitle: 'No Data Found',
    color: 'text-gray-400'
  },
  'permission-denied': {
    icon: <Lock size={48} />,
    defaultTitle: 'Access Denied',
    color: 'text-red-500'
  },
  'network-error': {
    icon: <Wifi size={48} />,
    defaultTitle: 'Connection Error',
    color: 'text-orange-500'
  },
  'configuration-error': {
    icon: <Settings size={48} />,
    defaultTitle: 'Configuration Error',
    color: 'text-yellow-500'
  },
  'report-not-found': {
    icon: <FileX size={48} />,
    defaultTitle: 'Report Not Found',
    color: 'text-gray-400'
  },
  'database-error': {
    icon: <Database size={48} />,
    defaultTitle: 'Database Error',
    color: 'text-red-500'
  },
  'general': {
    icon: <AlertCircle size={48} />,
    defaultTitle: 'Something Went Wrong',
    color: 'text-red-500'
  }
};

export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
  type = 'general',
  title,
  message,
  details,
  actions = [],
  className = ''
}) => {
  const config = errorTypeConfig[type];
  const displayTitle = title || config.defaultTitle;

  return (
    <div className={`flex items-center justify-center h-full ${className}`}>
      <div className="text-center max-w-md mx-auto p-6">
        <div className={`${config.color} mb-4 flex justify-center`}>
          {config.icon}
        </div>
        
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          {displayTitle}
        </h3>
        
        <p className="text-sm text-gray-600 mb-4">
          {message}
        </p>
        
        {details && (
          <div className="bg-gray-50 rounded-lg p-3 mb-4">
            <p className="text-xs text-gray-500 font-mono">
              {details}
            </p>
          </div>
        )}
        
        {actions.length > 0 && (
          <div className="flex flex-col gap-2">
            {actions.map((action, index) => (
              <Button
                key={index}
                variant={action.variant || (index === 0 ? 'primary' : 'secondary')}
                size="sm"
                icon={action.icon}
                onClick={action.onClick}
                className="w-full"
              >
                {action.label}
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// Common error configurations for reuse
export const commonErrorActions = {
  retry: (onRetry: () => void): ErrorAction => ({
    label: 'Try Again',
    icon: <RefreshCw size={16} />,
    onClick: onRetry,
    variant: 'primary'
  }),
  
  configure: (onConfigure: () => void): ErrorAction => ({
    label: 'Configure',
    icon: <Settings size={16} />,
    onClick: onConfigure,
    variant: 'secondary'
  }),
  
  help: (helpUrl?: string): ErrorAction => ({
    label: 'Get Help',
    icon: <HelpCircle size={16} />,
    onClick: () => {
      if (helpUrl) {
        window.open(helpUrl, '_blank');
      }
    },
    variant: 'ghost'
  }),
  
  goBack: (onBack: () => void): ErrorAction => ({
    label: 'Go Back',
    onClick: onBack,
    variant: 'secondary'
  })
};

// Helper function to get appropriate error type from error object
export const getErrorType = (error: any): ErrorType => {
  if (!error) return 'general';
  
  const errorMessage = error.message?.toLowerCase() || '';
  const errorCode = error.code;
  
  // Check for specific error patterns
  if (errorCode === '42501' || errorMessage.includes('permission') || errorMessage.includes('denied')) {
    return 'permission-denied';
  }
  
  if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
    return 'network-error';
  }
  
  if (errorMessage.includes('not found') || errorCode === 'PGRST116') {
    return 'data-not-found';
  }
  
  if (errorMessage.includes('database') || errorCode?.startsWith('42')) {
    return 'database-error';
  }
  
  if (errorMessage.includes('config') || errorMessage.includes('settings')) {
    return 'configuration-error';
  }
  
  return 'general';
};
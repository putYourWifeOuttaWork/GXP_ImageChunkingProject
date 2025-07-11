import React from 'react';
import { AlertCircle, Terminal, Copy, CheckCircle } from 'lucide-react';
import Button from '../../common/Button';

interface DatabaseSetupNoticeProps {
  missingFunctions: string[];
  onDismiss?: () => void;
}

export const DatabaseSetupNotice: React.FC<DatabaseSetupNoticeProps> = ({ 
  missingFunctions, 
  onDismiss 
}) => {
  const [copiedIndex, setCopiedIndex] = React.useState<number | null>(null);
  
  const migrationCommands = [
    {
      function: 'get_table_columns',
      file: '20250710_add_get_table_columns_function.sql',
      description: 'Enables dynamic field discovery'
    },
    {
      function: 'execute_raw_sql',
      file: '20250710_add_execute_raw_sql_function.sql',
      description: 'Enables complex multi-table queries'
    }
  ];
  
  const handleCopy = (command: string, index: number) => {
    navigator.clipboard.writeText(command);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };
  
  const relevantCommands = migrationCommands.filter(cmd => 
    missingFunctions.includes(cmd.function)
  );
  
  if (relevantCommands.length === 0) return null;
  
  return (
    <div className="mb-6 border border-yellow-200 bg-yellow-50 rounded-lg p-4">
      <div className="flex items-start space-x-3">
        <AlertCircle className="text-yellow-600 mt-0.5" size={20} />
        <div className="flex-1">
          <h4 className="text-sm font-medium text-yellow-900 mb-2">
            Database Setup Required
          </h4>
          <p className="text-sm text-yellow-800 mb-3">
            To enable all reporting features, please run the following database migrations:
          </p>
          
          <div className="space-y-2">
            {relevantCommands.map((cmd, index) => {
              const command = `psql $DATABASE_URL < migrations/${cmd.file}`;
              return (
                <div key={cmd.function} className="bg-white border border-yellow-200 rounded p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-gray-600">
                      {cmd.description}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={copiedIndex === index ? <CheckCircle size={14} /> : <Copy size={14} />}
                      onClick={() => handleCopy(command, index)}
                      className="text-xs"
                    >
                      {copiedIndex === index ? 'Copied!' : 'Copy'}
                    </Button>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Terminal size={14} className="text-gray-400" />
                    <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono text-gray-800 flex-1">
                      {command}
                    </code>
                  </div>
                </div>
              );
            })}
          </div>
          
          <div className="mt-3 text-xs text-yellow-700">
            <p className="mb-1">Alternative: Run these queries in your Supabase SQL Editor</p>
            <p>The app will work with limited functionality until these are applied.</p>
          </div>
        </div>
        
        {onDismiss && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onDismiss}
            className="text-yellow-600 hover:text-yellow-700"
          >
            Dismiss
          </Button>
        )}
      </div>
    </div>
  );
};
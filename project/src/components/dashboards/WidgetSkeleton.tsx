import React from 'react';

interface WidgetSkeletonProps {
  type: 'report' | 'metric' | 'text' | 'image';
  showTitle?: boolean;
}

export const WidgetSkeleton: React.FC<WidgetSkeletonProps> = ({ 
  type, 
  showTitle = true 
}) => {
  return (
    <div className="h-full w-full">
      {showTitle && (
        <div className="px-4 py-3 border-b border-gray-200">
          <div className="h-4 bg-gray-200 rounded animate-pulse w-1/3"></div>
        </div>
      )}
      
      <div className={`${showTitle ? 'h-[calc(100%-3rem)]' : 'h-full'} p-4`}>
        {type === 'report' && (
          <div className="h-full flex flex-col gap-3">
            {/* Chart title skeleton */}
            <div className="h-5 bg-gray-200 rounded animate-pulse w-2/5"></div>
            
            {/* Chart area skeleton */}
            <div className="flex-1 bg-gray-100 rounded-lg p-4 relative overflow-hidden">
              {/* Y-axis labels */}
              <div className="absolute left-0 top-0 h-full flex flex-col justify-between py-8">
                <div className="h-3 w-8 bg-gray-200 rounded animate-pulse"></div>
                <div className="h-3 w-8 bg-gray-200 rounded animate-pulse"></div>
                <div className="h-3 w-8 bg-gray-200 rounded animate-pulse"></div>
                <div className="h-3 w-8 bg-gray-200 rounded animate-pulse"></div>
              </div>
              
              {/* Chart bars/lines skeleton */}
              <div className="ml-12 h-full flex items-end justify-around gap-2 pb-8">
                <div className="w-full max-w-[60px] h-3/4 bg-gray-300 rounded-t animate-pulse"></div>
                <div className="w-full max-w-[60px] h-1/2 bg-gray-300 rounded-t animate-pulse delay-75"></div>
                <div className="w-full max-w-[60px] h-5/6 bg-gray-300 rounded-t animate-pulse delay-150"></div>
                <div className="w-full max-w-[60px] h-2/3 bg-gray-300 rounded-t animate-pulse delay-200"></div>
                <div className="w-full max-w-[60px] h-4/5 bg-gray-300 rounded-t animate-pulse delay-300"></div>
              </div>
              
              {/* X-axis labels */}
              <div className="absolute bottom-0 left-12 right-0 flex justify-around px-2">
                <div className="h-3 w-12 bg-gray-200 rounded animate-pulse"></div>
                <div className="h-3 w-12 bg-gray-200 rounded animate-pulse delay-75"></div>
                <div className="h-3 w-12 bg-gray-200 rounded animate-pulse delay-150"></div>
                <div className="h-3 w-12 bg-gray-200 rounded animate-pulse delay-200"></div>
                <div className="h-3 w-12 bg-gray-200 rounded animate-pulse delay-300"></div>
              </div>
            </div>
          </div>
        )}
        
        {type === 'metric' && (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              {/* Large metric value */}
              <div className="h-12 w-32 bg-gray-300 rounded animate-pulse mx-auto mb-3"></div>
              {/* Metric label */}
              <div className="h-5 w-24 bg-gray-200 rounded animate-pulse mx-auto"></div>
            </div>
          </div>
        )}
        
        {type === 'text' && (
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded animate-pulse w-full"></div>
            <div className="h-4 bg-gray-200 rounded animate-pulse w-5/6 delay-75"></div>
            <div className="h-4 bg-gray-200 rounded animate-pulse w-4/6 delay-150"></div>
            <div className="h-4 bg-gray-200 rounded animate-pulse w-full delay-200"></div>
            <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4 delay-300"></div>
          </div>
        )}
        
        {type === 'image' && (
          <div className="h-full flex items-center justify-center">
            <div className="w-full max-w-md h-48 bg-gray-200 rounded animate-pulse">
              <div className="h-full flex items-center justify-center">
                <svg 
                  className="w-16 h-16 text-gray-300" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" 
                  />
                </svg>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
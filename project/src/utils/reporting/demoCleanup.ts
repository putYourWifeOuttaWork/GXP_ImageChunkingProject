/**
 * Utility to clean up console logs for demo
 * Run this before demo to suppress console output
 */

export function suppressConsoleLogs() {
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
    // Store original console methods
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;

    // Override console methods
    console.log = () => {};
    console.warn = () => {};
    
    // Keep error logging but make it less verbose
    console.error = (...args: any[]) => {
      // Only log actual errors, not warnings
      if (args[0] instanceof Error || (typeof args[0] === 'string' && args[0].toLowerCase().includes('error'))) {
        originalError.apply(console, args);
      }
    };

    // Restore after 1 hour (for safety)
    setTimeout(() => {
      console.log = originalLog;
      console.warn = originalWarn;
      console.error = originalError;
    }, 3600000);
  }
}

/**
 * Add loading state to any async function
 */
export function withLoadingState<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  setLoading: (loading: boolean) => void
): T {
  return (async (...args: Parameters<T>) => {
    setLoading(true);
    try {
      return await fn(...args);
    } finally {
      setLoading(false);
    }
  }) as T;
}
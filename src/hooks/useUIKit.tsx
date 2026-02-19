import React from 'react';

/**
 * Hook to access UI Kit components from the host
 */
export function useUIKit() {
  const uiKit = (window as any).__nekazariUIKit;

  if (!uiKit) {
    console.warn('UI Kit not available, using fallback');
    return {
      Card: ({ children, className }: any) => (
        <div className={className}>{children}</div>
      ),
      Button: ({ children, onClick, disabled, className }: any) => (
        <button
          onClick={onClick}
          disabled={disabled}
          className={className}
        >
          {children}
        </button>
      ),
    };
  }

  return uiKit;
}

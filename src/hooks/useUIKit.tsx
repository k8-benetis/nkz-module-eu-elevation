/**
 * Hook to access UI Kit components from the host
 */

export function useUIKit() {
  // UI Kit is exposed globally by the host
  const uiKit = (window as any).__nekazariUIKit;
  
  if (!uiKit) {
    console.warn('UI Kit not available, using fallback');
    // Return fallback components (very basic)
    return {
      Card: ({ children, padding, className }: any) => (
        <div className={className}>{children}</div>
      ),
      Button: ({ children, variant, size, onClick, disabled, className }: any) => (
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


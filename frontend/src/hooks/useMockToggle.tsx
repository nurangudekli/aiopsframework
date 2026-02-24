import { useState, useCallback, createContext, useContext } from 'react';

/**
 * Global mock-data context.
 * Wrap your app in <MockProvider> to enable "Use Test Data" toggles on every page.
 */
interface MockContextValue {
  /** Global flag — when true every page that supports it will use mock data */
  globalMock: boolean;
  setGlobalMock: (v: boolean) => void;
  /** Per-page overrides (pageKey → boolean) */
  overrides: Record<string, boolean>;
  toggle: (pageKey: string) => void;
  /** Resolve whether a specific page should use mocks */
  isMocked: (pageKey: string) => boolean;
}

const MockContext = createContext<MockContextValue>({
  globalMock: false,
  setGlobalMock: () => {},
  overrides: {},
  toggle: () => {},
  isMocked: () => false,
});

export function MockProvider({ children }: { children: React.ReactNode }) {
  const [globalMock, setGlobalMock] = useState(false);
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});

  const toggle = useCallback(
    (key: string) => setOverrides((prev) => ({ ...prev, [key]: !prev[key] })),
    [],
  );

  const isMocked = useCallback(
    (key: string) => overrides[key] ?? globalMock,
    [overrides, globalMock],
  );

  return (
    <MockContext.Provider value={{ globalMock, setGlobalMock, overrides, toggle, isMocked }}>
      {children}
    </MockContext.Provider>
  );
}

/** Hook for pages — returns { useMock, toggleMock } for a given page key */
export function useMockToggle(pageKey: string) {
  const ctx = useContext(MockContext);
  return {
    useMock: ctx.isMocked(pageKey),
    toggleMock: () => ctx.toggle(pageKey),
    globalMock: ctx.globalMock,
    setGlobalMock: ctx.setGlobalMock,
  };
}

export { MockContext };

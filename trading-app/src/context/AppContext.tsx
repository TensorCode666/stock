import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';
import type { AppData } from '../types';
import { appStore } from '../lib/app-store';
import { loadData, saveData } from '../lib/storage';

export { useAppSlice, useAppSymbolsKey, useWatchlistItem } from '../lib/app-store';

type AppActions = {
  update: (patch: Partial<AppData>) => void;
  setData: Dispatch<SetStateAction<AppData>>;
};

const AppActionsContext = createContext<AppActions | null>(null);

const SAVE_DEBOUNCE_MS = 400;

export function AppProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(() => loadData());
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dataRef = useRef(data);

  useEffect(() => {
    dataRef.current = data;
    appStore.syncData(data);
  }, [data]);

  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveData(data);
    }, SAVE_DEBOUNCE_MS);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [data]);

  useEffect(() => {
    const flush = () => saveData(dataRef.current);
    window.addEventListener('beforeunload', flush);
    const onHidden = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    document.addEventListener('visibilitychange', onHidden);
    return () => {
      window.removeEventListener('beforeunload', flush);
      document.removeEventListener('visibilitychange', onHidden);
    };
  }, []);

  const update = useCallback((patch: Partial<AppData>) => {
    setData((prev) => ({ ...prev, ...patch }));
  }, []);

  const actions = useMemo(() => ({ update, setData }), [update]);

  return (
    <AppActionsContext.Provider value={actions}>
      {children}
    </AppActionsContext.Provider>
  );
}

/** 仅获取 setData / update，不随 data 变化重渲染 */
export function useAppActions(): AppActions {
  const ctx = useContext(AppActionsContext);
  if (!ctx) throw new Error('useAppActions must be used within AppProvider');
  return ctx;
}

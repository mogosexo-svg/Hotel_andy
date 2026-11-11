import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { Icon } from './Icon';

interface ToastItem {
  id: number;
  texto: string;
  error?: boolean;
  saliendo?: boolean;
  deshacer?: () => void | Promise<void>;
}

interface ToastApi {
  /** Aviso corto. Con `deshacer` muestra el botón "Deshacer" 7 s. */
  avisar: (texto: string, opts?: { deshacer?: () => void | Promise<void> }) => void;
  error: (texto: string) => void;
}

const Ctx = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);

  const quitar = useCallback((id: number) => {
    setItems((l) => l.map((t) => (t.id === id ? { ...t, saliendo: true } : t)));
    window.setTimeout(() => setItems((l) => l.filter((t) => t.id !== id)), 220);
  }, []);

  const api = useMemo<ToastApi>(() => {
    const poner = (t: Omit<ToastItem, 'id'>, ms: number) => {
      const id = ++seq.current;
      setItems((l) => [...l.slice(-2), { ...t, id }]);
      window.setTimeout(() => quitar(id), ms);
    };
    return {
      avisar: (texto, opts) => poner({ texto, deshacer: opts?.deshacer }, opts?.deshacer ? 7000 : 4000),
      error: (texto) => poner({ texto, error: true }, 8000),
    };
  }, [quitar]);

  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`toast ${t.error ? 'toast--error' : ''} ${t.saliendo ? 'toast--sale' : ''}`}>
            {t.error && <Icon name="alerta" />}
            <span className="toast__texto">{t.texto}</span>
            {t.deshacer && (
              <button
                type="button"
                className="btn"
                onClick={() => {
                  quitar(t.id);
                  void t.deshacer?.();
                }}
              >
                <Icon name="deshacer" size="sm" /> Deshacer
              </button>
            )}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast(): ToastApi {
  const c = useContext(Ctx);
  if (!c) throw new Error('useToast fuera de ToastProvider');
  return c;
}

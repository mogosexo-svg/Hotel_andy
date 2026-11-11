import { useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Icon, type IconoNombre } from './Icon';
import { ESTADOS, type Estado } from '../lib/estados';
import { MARCA_MINIMO, type NivelStock } from '../lib/stock';

/* ---------- Botón ---------- */
interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: 'primary' | 'quiet' | 'ghost' | 'danger';
  block?: boolean;
  huge?: boolean;
  cargando?: boolean;
  icono?: IconoNombre;
}
export function Boton({ variante = 'primary', block, huge, cargando, icono, className = '', children, ...rest }: BtnProps) {
  return (
    <button
      type="button"
      {...rest}
      disabled={rest.disabled || cargando}
      aria-busy={cargando || undefined}
      className={`btn btn--${variante} ${block ? 'btn--block' : ''} ${huge ? 'btn--huge' : ''} ${className}`}
    >
      {(cargando || icono) && <Icon name={cargando ? 'recargar' : (icono as IconoNombre)} size="sm" />}
      {children}
    </button>
  );
}

/* ---------- Chip de estado (color + ícono + palabra) ---------- */
export function ChipEstado({ estado }: { estado: Estado }) {
  return (
    <span className={`chip e-${estado}`}>
      <Icon name={estado} />
      {ESTADOS[estado].palabra}
    </span>
  );
}

/* ---------- Hoja inferior ---------- */
export function Hoja({ titulo, onCerrar, children }: { titulo: ReactNode; onCerrar: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    const previo = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCerrar();
    };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      previo?.focus?.();
    };
  }, [onCerrar]);
  return (
    <div className="hoja-fondo" onMouseDown={(e) => e.target === e.currentTarget && onCerrar()}>
      <div className="hoja" role="dialog" aria-modal="true" aria-labelledby={id} tabIndex={-1} ref={ref}>
        <div className="hoja__asa" />
        <div className="hoja__cabeza">
          <h2 className="hoja__titulo" id={id}>
            {titulo}
          </h2>
          <button type="button" className="btn-cerrar" onClick={onCerrar} aria-label="Cerrar">
            <Icon name="cerrar" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ---------- Skeleton ---------- */
export function Skeleton({ h = '1rem', w = '100%', r }: { h?: string; w?: string; r?: string }) {
  return <div className="sk" style={{ height: h, width: w, borderRadius: r }} aria-hidden="true" />;
}

/* ---------- Vacío / error ---------- */
export function Aviso({
  icono,
  titulo,
  texto,
  accion,
  error,
}: {
  icono: IconoNombre;
  titulo: string;
  texto?: string;
  accion?: { texto: string; onClick: () => void; icono?: IconoNombre };
  error?: boolean;
}) {
  return (
    <div className={`aviso ${error ? 'aviso--error' : ''}`} role={error ? 'alert' : undefined}>
      <div className="aviso__ico">
        <Icon name={icono} size="lg" />
      </div>
      <h2 className="aviso__titulo">{titulo}</h2>
      {texto && <p className="aviso__texto">{texto}</p>}
      {accion && (
        <Boton variante={error ? 'quiet' : 'primary'} onClick={accion.onClick} icono={accion.icono}>
          {accion.texto}
        </Boton>
      )}
    </div>
  );
}

export function ErrorCarga({ onReintentar, texto }: { onReintentar: () => void; texto?: string }) {
  return (
    <Aviso
      error
      icono="alerta"
      titulo="No pudimos cargar esto"
      texto={texto ?? 'Parece que no hay buena señal. Tus datos están a salvo: intenta otra vez.'}
      accion={{ texto: 'Intentar otra vez', onClick: onReintentar, icono: 'recargar' }}
    />
  );
}

/* ---------- Contador animado ---------- */
export function Contador({ valor, formato }: { valor: number; formato?: (n: number) => string }) {
  const [v, setV] = useState(0);
  const prev = useRef(0);
  useEffect(() => {
    const quieto = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const desde = prev.current;
    prev.current = valor;
    if (quieto || desde === valor) {
      setV(valor);
      return;
    }
    const t0 = performance.now();
    let raf = 0;
    const paso = (t: number) => {
      const p = Math.min(1, (t - t0) / 700);
      const e = 1 - Math.pow(1 - p, 4);
      setV(desde + (valor - desde) * e);
      if (p < 1) raf = requestAnimationFrame(paso);
    };
    raf = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(raf);
  }, [valor]);
  const f = formato ?? ((n: number) => String(Math.round(n)));
  return (
    <span className="num" aria-label={f(valor)}>
      <span aria-hidden="true">{f(v)}</span>
    </span>
  );
}

/* ---------- Barra de nivel de stock ---------- */
export function BarraStock({ nivel, pct }: { nivel: NivelStock; pct: number }) {
  return (
    <div className={`barra n-${nivel}`} aria-hidden="true">
      <div className="barra__relleno" style={{ ['--pct' as string]: pct }} />
      {nivel !== 'sin_minimo' && nivel !== 'sin_contar' && (
        <div className="barra__minimo" style={{ left: `${MARCA_MINIMO * 100}%` }} />
      )}
    </div>
  );
}

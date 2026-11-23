import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Hoja } from '../../ui/kit';
import { Icon } from '../../ui/Icon';
import type { NivelStock } from '../../lib/stock';
import type { Prod } from '../../data/insumos';
import { cantidadATexto, coincide, parseCantidad } from './logica';
import { numero, unidadPlural } from '../../lib/format';

/** `Hoja` del kit vuelve a enfocar si cambia `onCerrar`: este envoltorio le da siempre la misma función. */
export function HojaEstable({ titulo, onCerrar, children }: { titulo: ReactNode; onCerrar: () => void; children: ReactNode }) {
  const ult = useRef(onCerrar);
  ult.current = onCerrar;
  const estable = useCallback(() => ult.current(), []);
  return (
    <Hoja titulo={titulo} onCerrar={estable}>
      {children}
    </Hoja>
  );
}

export function Campo({ etiqueta, ayuda, error, children }: { etiqueta: string; ayuda?: string; error?: string | null; children: (id: string) => ReactNode }) {
  const id = useId();
  return (
    <div className="campo">
      <label htmlFor={id}>{etiqueta}</label>
      {children(id)}
      {ayuda && !error && <p className="ins-ayuda">{ayuda}</p>}
      {error && (
        <p className="campo__error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function Interruptor({ marcado, onChange, texto }: { marcado: boolean; onChange: (v: boolean) => void; texto: string }) {
  return (
    <label className="ins-interruptor">
      <input type="checkbox" checked={marcado} onChange={(e) => onChange(e.target.checked)} />
      <span className="ins-interruptor__caja" aria-hidden="true">
        <Icon name="check" size="sm" />
      </span>
      <span>{texto}</span>
    </label>
  );
}

/** Opciones tipo "pestañas" para elegir una cosa (conté / se perdió / compré). */
export function Opciones<T extends string>({ valor, opciones, onChange, nombre }: { valor: T; opciones: { id: T; texto: string }[]; onChange: (v: T) => void; nombre: string }) {
  return (
    <div className="ins-opciones" role="radiogroup" aria-label={nombre}>
      {opciones.map((o) => (
        <button key={o.id} type="button" role="radio" aria-checked={valor === o.id} className="ins-opcion" onClick={() => onChange(o.id)}>
          {o.texto}
        </button>
      ))}
    </div>
  );
}

interface BuscadorProps {
  prods: Prod[];
  valor: string | null;
  onElegir: (p: Prod) => void;
  onLimpiar?: () => void;
  /** Productos que no se pueden elegir (ya están en la factura). */
  excluir?: ReadonlySet<string>;
  /** Solo los que se venden. */
  soloVenta?: boolean;
  /** Si no hay coincidencia, ofrece crear el producto con lo escrito. */
  onCrear?: (nombre: string) => void;
  etiqueta: string;
  autoFocus?: boolean;
}

/** Elige un producto buscando por nombre: pensado para el celular (lista debajo, sin menús flotantes). */
export function BuscadorProducto({ prods, valor, onElegir, onLimpiar, excluir, soloVenta, onCrear, etiqueta, autoFocus }: BuscadorProps) {
  const [q, setQ] = useState('');
  const [abierto, setAbierto] = useState(!!autoFocus);
  const elegido = prods.find((p) => p.id === valor) ?? null;
  const id = useId();
  // Si el producto se elige desde fuera (p. ej. recién creado), se cierra la búsqueda.
  useEffect(() => {
    if (valor) setAbierto(false);
  }, [valor]);
  if (elegido && !abierto)
    return (
      <div className="ins-elegido">
        <strong>{elegido.nombre}</strong>
        {onLimpiar && (
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => {
              setQ('');
              setAbierto(true);
              onLimpiar();
            }}
          >
            Cambiar
          </button>
        )}
      </div>
    );
  const lista = prods.filter((p) => p.activo && (!soloVenta || p.seVende) && !excluir?.has(p.id) && coincide(p.nombre, q));
  const visibles = q.trim() ? lista.slice(0, 6) : lista.slice(0, 5);
  const nuevo = q.trim();
  const existeIgual = prods.some((p) => p.nombre.trim().toLowerCase() === nuevo.toLowerCase());
  return (
    <div className="ins-buscador">
      <input
        id={id}
        className="input"
        type="search"
        enterKeyHint="search"
        autoComplete="off"
        autoFocus={autoFocus}
        placeholder="Escribe el nombre del producto"
        aria-label={etiqueta}
        value={q}
        onFocus={() => setAbierto(true)}
        onChange={(e) => {
          setQ(e.target.value);
          setAbierto(true);
        }}
      />
      {abierto && (
        <ul className="ins-resultados">
          {visibles.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                className="ins-resultado"
                onClick={() => {
                  setAbierto(false);
                  setQ('');
                  onElegir(p);
                }}
              >
                <span>{p.nombre}</span>
                <span className="ins-ayuda">{p.stock == null ? 'Sin contar' : `${numero(p.stock)} ${unidadPlural(p.unidad, p.stock)}`}</span>
              </button>
            </li>
          ))}
          {visibles.length === 0 && !onCrear && <li className="ins-ayuda ins-resultado--nada">No hay productos con ese nombre.</li>}
          {onCrear && nuevo && !existeIgual && (
            <li>
              <button type="button" className="ins-resultado ins-resultado--crear" onClick={() => onCrear(nuevo)}>
                <Icon name="mas" size="sm" /> Crear “{nuevo}” ahora
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

/** Cantidad con − y +: uno a uno, o escribiendo (acepta 0,5). Nunca baja de cero. */
export function Stepper({ valor, onChange, etiqueta, grande }: { valor: number; onChange: (n: number) => void; etiqueta: string; grande?: boolean }) {
  const [txt, setTxt] = useState(valor ? cantidadATexto(valor) : '0');
  // Si el valor cambia desde fuera (los botones), el texto lo sigue; mientras se teclea no se pisa.
  useEffect(() => {
    if ((parseCantidad(txt) ?? 0) !== valor) setTxt(cantidadATexto(valor) || '0');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor]);
  const mover = (d: number) => onChange(Math.max(0, Math.round((d > 0 ? Math.floor(valor) + 1 : Math.ceil(valor) - 1) * 1000) / 1000));
  return (
    <div className={`stepper ${grande ? 'stepper--grande' : ''}`}>
      <button type="button" className="stepper__btn" aria-label={`Uno menos de ${etiqueta}`} disabled={valor <= 0} onClick={() => mover(-1)}>
        −
      </button>
      <input
        className="input stepper__n"
        inputMode="decimal"
        autoComplete="off"
        aria-label={`Cantidad de ${etiqueta}`}
        value={txt}
        onFocus={(e) => e.target.select()}
        onChange={(e) => {
          setTxt(e.target.value);
          onChange(parseCantidad(e.target.value) ?? 0);
        }}
      />
      <button type="button" className="stepper__btn" aria-label={`Uno más de ${etiqueta}`} onClick={() => mover(1)}>
        +
      </button>
    </div>
  );
}

/** Estado de un producto con las palabras de la dueña: color + ícono + palabra. */
export function ChipStock({ nivel }: { nivel: NivelStock }) {
  const [clase, icono, palabra] =
    nivel === 'agotado'
      ? (['e-ocupado', 'alerta', 'Se acabó'] as const)
      : nivel === 'bajo'
        ? (['e-por_limpiar', 'alerta', 'Se está acabando'] as const)
        : nivel === 'sin_contar'
          ? (['e-mantenimiento', 'inventario', 'Sin contar'] as const)
          : (['e-libre', 'libre', 'Hay'] as const);
  return (
    <span className={`chip ${clase}`}>
      <Icon name={icono} />
      {palabra}
    </span>
  );
}

/** "Quedan 12 rollos" con el número grande. */
export function Quedan({ stock, unidad }: { stock: number | null; unidad: string }) {
  if (stock == null) return <span className="quedan quedan--nada">Sin contar</span>;
  return (
    <span className="quedan">
      <span className="quedan__t">Quedan</span>
      <span className="num quedan__n">{numero(stock)}</span>
      <span className="quedan__t">{unidadPlural(unidad, stock)}</span>
    </span>
  );
}

import { useCallback, useState, type SyntheticEvent, type ReactNode } from 'react';
import { Aviso, Boton, ErrorCarga, Hoja, Skeleton } from '../../ui/kit';
import { Icon, type IconoNombre } from '../../ui/Icon';
import { useToast } from '../../ui/Toast';
import { mensajeError } from '../../lib/errores';

/** Los 4 estados de cada sección: cargando, error, vacío (lo decide la sección) y con datos. */
export function Estados<T>({
  datos,
  error,
  onReintentar,
  hijos,
}: {
  datos: T | null;
  error: boolean;
  onReintentar: () => void;
  hijos: (d: T) => ReactNode;
}) {
  if (error) return <ErrorCarga onReintentar={onReintentar} />;
  if (datos === null)
    return (
      <div className="pila" aria-busy="true" aria-label="Cargando">
        <Skeleton h="4.5rem" r="14px" />
        <Skeleton h="4.5rem" r="14px" />
        <Skeleton h="4.5rem" r="14px" />
      </div>
    );
  return <>{hijos(datos)}</>;
}

/** Guarda con aviso visible y Deshacer. `hacer` devuelve cómo volver atrás. */
export function useGuardar(recargar: () => Promise<void>) {
  const toast = useToast();
  return useCallback(
    async (hacer: () => Promise<() => Promise<void>>, mensaje: string): Promise<boolean> => {
      let deshacer: () => Promise<void>;
      try {
        deshacer = await hacer();
      } catch (e) {
        toast.error(mensajeError(e as { message: string; code?: string }));
        return false;
      }
      await recargar();
      toast.avisar(mensaje, {
        deshacer: async () => {
          try {
            await deshacer();
            await recargar();
            toast.avisar('Volvió a como estaba.');
          } catch (e) {
            toast.error(mensajeError(e as { message: string; code?: string }));
          }
        },
      });
      return true;
    },
    [recargar, toast],
  );
}

/** Hoja con un solo cambio: título, campos, Guardar. Cierra solo si se guardó. */
export function HojaCambio({
  titulo,
  ayuda,
  etiqueta = 'Guardar',
  onCerrar,
  onGuardar,
  children,
}: {
  titulo: string;
  ayuda?: string;
  etiqueta?: string;
  onCerrar: () => void;
  /** Devuelve un texto de error para mostrar en la hoja, o null si se guardó. */
  onGuardar: () => Promise<string | null> | string | null;
  children: ReactNode;
}) {
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  async function enviar(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setGuardando(true);
    const msg = await onGuardar();
    setGuardando(false);
    if (msg) setError(msg);
    else onCerrar();
  }
  return (
    <Hoja titulo={titulo} onCerrar={onCerrar}>
      <form className="cfg-form" onSubmit={enviar} noValidate>
        {ayuda && <p className="cfg-ayuda">{ayuda}</p>}
        {children}
        {error && (
          <p className="campo__error" role="alert">
            {error}
          </p>
        )}
        <div className="hoja__acciones">
          <Boton type="submit" cargando={guardando} block>
            {etiqueta}
          </Boton>
          <Boton variante="quiet" onClick={onCerrar} block>
            Ahora no
          </Boton>
        </div>
      </form>
    </Hoja>
  );
}

/** Opciones grandes para elegir una (Sí/No, roles, plan…). */
export function Opciones<V extends string>({
  valor,
  onCambio,
  opciones,
  nombre,
}: {
  valor: V | '';
  onCambio: (v: V) => void;
  opciones: { valor: V; titulo: string; texto?: string }[];
  nombre: string;
}) {
  return (
    <div className="cfg-opciones" role="radiogroup" aria-label={nombre}>
      {opciones.map((o) => (
        <label key={o.valor} className="cfg-opcion">
          <input type="radio" name={nombre} checked={valor === o.valor} onChange={() => onCambio(o.valor)} />
          <span className="cfg-opcion__cuerpo">
            <strong>{o.titulo}</strong>
            {o.texto && <span>{o.texto}</span>}
          </span>
          <Icon name="check" size="sm" />
        </label>
      ))}
    </div>
  );
}

/** Un renglón: etiqueta, valor y una acción. */
export function Renglon({
  etiqueta,
  ayuda,
  valor,
  sinDefinir,
  acciones,
}: {
  etiqueta: string;
  ayuda?: string;
  valor: ReactNode;
  sinDefinir?: boolean;
  acciones: ReactNode;
}) {
  return (
    <li className="cfg-renglon">
      <div className="cfg-renglon__txt">
        <span className="cfg-renglon__et">{etiqueta}</span>
        {ayuda && <span className="cfg-renglon__ay">{ayuda}</span>}
      </div>
      <span className={`cfg-renglon__val ${sinDefinir ? 'is-vacio' : ''}`}>{valor}</span>
      <div className="cfg-renglon__acc">{acciones}</div>
    </li>
  );
}

export function Cambiar({
  onClick,
  texto = 'Cambiar',
  etiqueta,
  icono,
}: {
  onClick: () => void;
  texto?: string;
  etiqueta: string;
  icono?: IconoNombre;
}) {
  return (
    <Boton variante="quiet" onClick={onClick} icono={icono} aria-label={`${texto}: ${etiqueta}`}>
      {texto}
    </Boton>
  );
}

export function Intro({ titulo, texto, children }: { titulo: string; texto?: string; children?: ReactNode }) {
  return (
    <header className="cfg-intro">
      <h2>{titulo}</h2>
      {texto && <p>{texto}</p>}
      {children}
    </header>
  );
}

export { Aviso };

import { useEffect, useRef, useState } from 'react';
import { Icon, type IconoNombre } from './Icon';

export interface AvisoItem {
  id: string;
  n: number;
  texto: string;
  icono: IconoNombre;
  ir: () => void;
}

/** Campana con contador real: cuartos por limpiar y alertas de insumos. */
export function Avisos({ avisos }: { avisos: AvisoItem[] }) {
  const [abierto, setAbierto] = useState(false);
  const caja = useRef<HTMLDivElement>(null);
  const activos = avisos.filter((a) => a.n > 0);
  const total = activos.reduce((s, a) => s + a.n, 0);

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: PointerEvent) => !caja.current?.contains(e.target as Node) && setAbierto(false);
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && setAbierto(false);
    document.addEventListener('pointerdown', fuera);
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('pointerdown', fuera);
      document.removeEventListener('keydown', tecla);
    };
  }, [abierto]);

  return (
    <div className="avisos" ref={caja}>
      <button
        type="button"
        className="campana"
        aria-label={total ? `Avisos: ${total} pendientes` : 'Avisos: todo en orden'}
        aria-expanded={abierto}
        onClick={() => setAbierto((v) => !v)}
      >
        <Icon name="campana" />
        {total > 0 && <span className="campana__n">{total > 99 ? '99+' : total}</span>}
      </button>
      {abierto && (
        <div className="avisos__panel" role="dialog" aria-label="Avisos">
          <h2 className="avisos__titulo">Avisos</h2>
          {activos.length === 0 ? (
            <p className="avisos__vacio">
              <Icon name="libre" /> Todo en orden por ahora
            </p>
          ) : (
            <ul>
              {activos.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setAbierto(false);
                      a.ir();
                    }}
                  >
                    <span className="avisos__ico">
                      <Icon name={a.icono} />
                    </span>
                    <span className="avisos__txt">
                      <b>{a.n}</b> {a.texto}
                    </span>
                    <Icon name="siguiente" size="sm" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

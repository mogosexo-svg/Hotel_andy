import { useMemo, type CSSProperties } from 'react';
import type { Cuarto } from '../../data/cuartos';
import type { ReservaVista } from '../../data/reservas';
import { fechaCorta } from '../../lib/format';
import { Icon } from '../../ui/Icon';
import { barra, cuentaAtras, diaCorto, ESTADO_RESERVA, fuenteTexto } from './logica';
import { ICONO_RESERVA } from './piezas';

interface Props {
  dias: string[];
  hoy: string;
  cuartos: Cuarto[];
  reservas: ReservaVista[];
  pulsos: ReadonlySet<string>;
  ahora: Date;
  onVacia: (cuartoId: string, dia: string) => void;
  onAbrir: (id: string) => void;
}

/** Línea de tiempo cuartos × días (tablet y escritorio). */
export function Linea({ dias, hoy, cuartos, reservas, pulsos, ahora, onVacia, onAbrir }: Props) {
  const desde = dias[0] ?? hoy;
  const n = dias.length;

  const porCuarto = useMemo(() => {
    const m = new Map<string, ReservaVista[]>();
    reservas.forEach((r) => m.set(r.habitacionId, [...(m.get(r.habitacionId) ?? []), r]));
    return m;
  }, [reservas]);

  const pisos = useMemo(() => {
    const m = new Map<number, Cuarto[]>();
    cuartos.forEach((c) => m.set(c.piso, [...(m.get(c.piso) ?? []), c]));
    return [...m.entries()].sort((a, b) => b[0] - a[0]);
  }, [cuartos]);

  const libres = useMemo(
    () =>
      dias.map((_, i) => {
        const ocupados = new Set<string>();
        reservas.forEach((r) => {
          const b = barra(r.entrada, r.salida, desde, n);
          if (b && i + 1 >= b.col && i + 1 < b.col + b.span) ocupados.add(r.habitacionId);
        });
        return cuartos.length - ocupados.size;
      }),
    [dias, reservas, cuartos, desde, n],
  );

  return (
    <div className="rv-linea" style={{ ['--dias' as string]: n } as CSSProperties} role="grid" aria-label="Calendario de reservas por cuarto">
      <div className="rv-linea__cab" role="row">
        <div className="rv-linea__esq" role="columnheader">
          Cuarto
        </div>
        <div className="rv-linea__dias">
          {dias.map((d, i) => {
            const c = diaCorto(d);
            return (
              <div key={d} role="columnheader" className={`rv-dia ${d === hoy ? 'is-hoy' : ''} ${d < hoy ? 'is-pasado' : ''}`} aria-label={fechaCorta(d)}>
                <span className="rv-dia__nombre">{d === hoy ? 'hoy' : c.dia}</span>
                <b className="rv-dia__num">{c.num}</b>
                <span className="rv-dia__libres" title="Cuartos libres esa noche">
                  {libres[i]} libres
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {pisos.map(([piso, lista]) => (
        <div key={piso} role="rowgroup" aria-label={`Piso ${piso}`}>
          <div className="rv-linea__piso">Piso {piso}</div>
          {lista.map((c) => (
            <div key={c.id} className="rv-fila" role="row">
              <div className="rv-fila__cuarto" role="rowheader">
                <b>{c.numero}</b>
                <small>{c.tipo}</small>
              </div>
              <div className="rv-celdas">
                {dias.map((d, i) => (
                  <button
                    key={d}
                    type="button"
                    role="gridcell"
                    className={`rv-celda ${d === hoy ? 'is-hoy' : ''}`}
                    style={{ gridColumn: i + 1 }}
                    disabled={d < hoy}
                    aria-label={`Reservar el cuarto ${c.numero} desde el ${fechaCorta(d)}`}
                    onClick={() => onVacia(c.id, d)}
                  />
                ))}
                {(porCuarto.get(c.id) ?? []).map((r) => {
                  const b = barra(r.entrada, r.salida, desde, n);
                  if (!b) return null;
                  const nombre = r.huesped ?? 'Sin nombre';
                  const detalle =
                    r.estado === 'prereserva' && r.venceEn
                      ? cuentaAtras(r.venceEn, ahora)
                      : `${fuenteTexto(r.fuente)} · ${r.personas} ${r.personas === 1 ? 'persona' : 'personas'}`;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      className={`rv-b rv-e-${r.estado} ${b.recortaIzq ? 'rv-b--corta-izq' : ''} ${b.recortaDer ? 'rv-b--corta-der' : ''} ${pulsos.has(r.id) ? 'is-pulso' : ''}`}
                      style={{ gridColumn: `${b.col} / span ${b.span}` }}
                      title={`${nombre} · ${ESTADO_RESERVA[r.estado]} · ${fechaCorta(r.entrada)} a ${fechaCorta(r.salida)} · ${detalle}`}
                      aria-label={`Cuarto ${c.numero}, ${nombre}, ${ESTADO_RESERVA[r.estado]}, del ${fechaCorta(r.entrada)} al ${fechaCorta(r.salida)}, ${detalle}`}
                      onClick={() => onAbrir(r.id)}
                    >
                      <span className="rv-b__t">
                        <Icon name={ICONO_RESERVA[r.estado]} size="sm" />
                        <span className="rv-b__nombre">{nombre}</span>
                      </span>
                      {b.span >= 2 && <span className="rv-b__sub">{detalle}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

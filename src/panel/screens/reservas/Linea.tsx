import { useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import type { Cuarto } from '../../data/cuartos';
import type { ReservaVista } from '../../data/reservas';
import { fechaCorta } from '../../lib/format';
import { Icon } from '../../ui/Icon';
import type { Rango } from '../config/logica';
import { cuentaAtras, diaCorto, enRangos, esFinde, ESTADO_RESERVA, fuenteTexto, libresPorNoche, tramo } from './logica';
import { ICONO_RESERVA, MarcaCanal } from './piezas';

interface Props {
  dias: string[];
  hoy: string;
  cuartos: Cuarto[];
  reservas: ReservaVista[];
  pulsos: ReadonlySet<string>;
  ahora: Date;
  alta: Rango[];
  /** 1 si se avanzó, -1 si se retrocedió: las barras entran desde ese lado. */
  dir: 1 | -1;
  onVacia: (cuartoId: string, dia: string) => void;
  onAbrir: (id: string) => void;
}

/** Línea de tiempo cuartos × días (tablet y escritorio). Cada día son dos columnas: la mañana (sale uno) y la tarde (entra otro). */
export function Linea({ dias, hoy, cuartos, reservas, pulsos, ahora, alta, dir, onVacia, onAbrir }: Props) {
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

  const libres = useMemo(() => libresPorNoche(reservas, cuartos.length, dias), [reservas, cuartos.length, dias]);

  const marca = useMemo(
    () => dias.map((d) => ({ finde: esFinde(d), alta: enRangos(d, alta) })),
    [dias, alta],
  );
  const hayAlta = marca.some((m) => m.alta);

  // Flechas entre celdas libres: un solo Tab entra a la cuadrícula; las barras se alcanzan con Tab.
  const cuerpo = useRef<HTMLDivElement>(null);
  const [foco, setFoco] = useState<string>('');
  const filas = useMemo(() => pisos.flatMap(([, l]) => l), [pisos]);
  const clave = (f: number, c: number) => `${f}:${c}`;
  const primera = clave(0, Math.max(0, dias.indexOf(hoy)));
  const teclas = (e: KeyboardEvent<HTMLDivElement>) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-f]');
    if (!el) return;
    let f = Number(el.dataset.f);
    let c = Number(el.dataset.c);
    if (e.key === 'ArrowRight') c++;
    else if (e.key === 'ArrowLeft') c--;
    else if (e.key === 'ArrowDown') f++;
    else if (e.key === 'ArrowUp') f--;
    else return;
    e.preventDefault();
    const sig = cuerpo.current?.querySelector<HTMLElement>(`[data-f="${f}"][data-c="${c}"]:not(:disabled)`);
    if (sig) {
      setFoco(clave(f, c));
      sig.focus();
    }
  };

  return (
    <div
      className="rv-linea"
      style={{ ['--dias' as string]: n, ['--dir' as string]: dir } as CSSProperties}
      role="grid"
      aria-label="Calendario de reservas por cuarto"
      aria-rowcount={filas.length + 2}
    >
      <div className="rv-linea__cab">
        <div className="rv-linea__fila" role="row">
          <div className="rv-linea__esq" role="columnheader">
            Cuarto
          </div>
          <div className="rv-linea__dias">
            {dias.map((d, i) => {
              const c = diaCorto(d);
              return (
                <div
                  key={d}
                  role="columnheader"
                  className={`rv-dia ${d === hoy ? 'is-hoy' : ''} ${d < hoy ? 'is-pasado' : ''} ${marca[i].finde ? 'is-finde' : ''} ${marca[i].alta ? 'is-alta' : ''} ${c.num === '1' ? 'is-mes' : ''}`}
                  aria-label={fechaCorta(d) + (d === hoy ? ', hoy' : '') + (marca[i].alta ? ', temporada alta' : '')}
                >
                  <span className="rv-dia__nombre">{d === hoy ? 'hoy' : c.num === '1' ? c.mes : c.dia}</span>
                  <b className="rv-dia__num">{c.num}</b>
                </div>
              );
            })}
          </div>
        </div>
        <div className="rv-linea__fila rv-resumen" role="row">
          <div className="rv-linea__esq rv-resumen__etq" role="rowheader">
            <Icon name="libre" size="sm" /> Libres
          </div>
          <div className="rv-linea__dias">
            {dias.map((d, i) => {
              const l = libres[i];
              const lleno = l <= 0;
              return (
                <div
                  key={d}
                  role="gridcell"
                  className={`rv-res ${d === hoy ? 'is-hoy' : ''} ${lleno ? 'is-lleno' : ''}`}
                  title={lleno ? 'Lleno esa noche' : `${l} ${l === 1 ? 'cuarto libre' : 'cuartos libres'} esa noche`}
                  aria-label={lleno ? 'Lleno esa noche' : `${l} ${l === 1 ? 'cuarto libre' : 'cuartos libres'} esa noche`}
                >
                  <b>{lleno ? 'Lleno' : l}</b>
                  <i aria-hidden="true" style={{ ['--ocu' as string]: `${Math.round(((cuartos.length - l) / Math.max(1, cuartos.length)) * 100)}%` }} />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div ref={cuerpo} onKeyDown={teclas}>
        {pisos.map(([piso, lista]) => (
          <div key={piso} role="rowgroup" aria-label={`Piso ${piso}`} className="rv-piso">
            <div className="rv-piso__cab">
              <span>Piso</span>
              <b>{piso}</b>
              <small>
                {lista.length} {lista.length === 1 ? 'cuarto' : 'cuartos'}
              </small>
            </div>
            {lista.map((c) => {
              const f = filas.indexOf(c);
              return (
                <div key={c.id} className="rv-fila" role="row">
                  <div className="rv-fila__cuarto" role="rowheader">
                    <b>{c.numero}</b>
                    <small>{c.tipo}</small>
                  </div>
                  <div className="rv-celdas">
                    {dias.map((d, i) => {
                      const k = clave(f, i);
                      return (
                        <button
                          key={d}
                          type="button"
                          role="gridcell"
                          data-f={f}
                          data-c={i}
                          tabIndex={(foco || primera) === k ? 0 : -1}
                          className={`rv-celda ${d === hoy ? 'is-hoy' : ''} ${marca[i].finde ? 'is-finde' : ''} ${marca[i].alta ? 'is-alta' : ''}`}
                          style={{ gridColumn: `${2 * i + 1} / span 2` }}
                          disabled={d < hoy}
                          aria-label={`Reservar el cuarto ${c.numero} desde el ${fechaCorta(d)}`}
                          onFocus={() => setFoco(k)}
                          onClick={() => onVacia(c.id, d)}
                        />
                      );
                    })}
                    {(porCuarto.get(c.id) ?? []).map((r) => {
                      const t = tramo(r.entrada, r.salida, desde, n, r.estado);
                      if (!t) return null;
                      const nombre = r.huesped ?? 'Sin nombre';
                      const gente = `${r.personas} ${r.personas === 1 ? 'persona' : 'personas'}`;
                      const vence = r.estado === 'prereserva' && r.venceEn ? cuentaAtras(r.venceEn, ahora) : null;
                      const detalle = `${fuenteTexto(r.fuente)} · ${gente}${vence ? ' · ' + vence : ''}`;
                      return (
                        <button
                          key={r.id}
                          type="button"
                          className={`rv-b rv-e-${r.estado} ${t.recortaIzq ? 'rv-b--corta-izq' : ''} ${t.recortaDer ? 'rv-b--corta-der' : ''} ${pulsos.has(r.id) ? 'is-pulso' : ''}`}
                          style={{ gridColumn: `${t.inicio} / ${t.fin}`, ['--f' as string]: Math.min(f, 14) } as CSSProperties}
                          title={`${nombre} · ${ESTADO_RESERVA[r.estado]} · ${fechaCorta(r.entrada)} a ${fechaCorta(r.salida)} · ${detalle}`}
                          aria-label={`Cuarto ${c.numero}, ${nombre}, ${ESTADO_RESERVA[r.estado]}, del ${fechaCorta(r.entrada)} al ${fechaCorta(r.salida)}, ${detalle}`}
                          onClick={() => onAbrir(r.id)}
                        >
                          <span className="rv-b__t">
                            <span className="rv-b__nombre">{nombre}</span>
                          </span>
                          <span className="rv-b__sub">
                            <Icon name={ICONO_RESERVA[r.estado]} size="sm" className="rv-b__estado" />
                            <span className="rv-b__gente">
                              <Icon name="huespedes" size="sm" />
                              <b>{r.personas}</b>
                            </span>
                            <MarcaCanal fuente={r.fuente} />
                            <span className="rv-b__det">{vence ?? ESTADO_RESERVA[r.estado]}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      {hayAlta && <span className="sr-only">Los días con fondo celeste claro son temporada alta.</span>}
    </div>
  );
}

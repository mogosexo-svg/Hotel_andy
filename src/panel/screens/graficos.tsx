import { useEffect, useMemo, useRef, useState } from 'react';
import { dinero, fechaCorta } from '../lib/format';
import type { FilaIngreso } from './Inicio';

const H = 190;
const M = { t: 12, r: 8, b: 28, l: 34 };

/** Cuartos ocupados por día: una sola serie, sin leyenda; el título la nombra. */
export function GraficoOcupacion({ serie }: { serie: FilaIngreso[] }) {
  const dias = useMemo(() => {
    const m = new Map<string, { dia: string; ocupados: number; total: number }>();
    for (const f of serie) {
      const d = m.get(f.dia) ?? { dia: f.dia, ocupados: 0, total: f.cuartos_totales };
      d.ocupados += f.cuartos_ocupados;
      d.total = Math.max(d.total, f.cuartos_totales);
      m.set(f.dia, d);
    }
    return [...m.values()].sort((a, b) => a.dia.localeCompare(b.dia));
  }, [serie]);
  const [sel, setSel] = useState<number | null>(null);
  // El SVG usa el ancho real: así el texto de los ejes mide lo mismo en celular y en escritorio.
  const caja = useRef<HTMLElement>(null);
  const [W, setW] = useState(600);
  useEffect(() => {
    const el = caja.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const max = Math.max(1, ...dias.map((d) => d.total));
  const iw = W - M.l - M.r;
  const ih = H - M.t - M.b;
  const slot = iw / Math.max(1, dias.length);
  const px = (i: number) => M.l + i * slot + slot / 2;
  const y = (v: number) => M.t + ih - (v / max) * ih;
  const ticks = [0, Math.round(max / 2), max];
  const linea = dias.map((d, i) => `${i ? 'L' : 'M'}${px(i)},${y(d.ocupados)}`).join(' ');
  const [ultimo, setUltimo] = useState(0);
  useEffect(() => {
    if (sel != null) setUltimo(sel);
  }, [sel]);
  const s = sel != null ? dias[sel] : null;
  const b = dias[Math.min(ultimo, dias.length - 1)];
  const bx = b ? Math.min(Math.max(px(ultimo), 70), W - 70) : 0;
  const by = b ? Math.max(0, y(b.ocupados) - 18) : 0;

  return (
    <figure className="grafico" ref={caja}>
      <div className="grafico__tip" aria-live="polite">
        {s ? (
          <>
            <b>{fechaCorta(s.dia)}</b> · {s.ocupados} de {s.total} cuartos
          </>
        ) : (
          <span>Toca un día para ver el detalle</span>
        )}
      </div>
      {b && (
        <div className={`g-burbuja ${s ? 'is-on' : ''}`} style={{ ['--bx' as string]: `${bx}px`, ['--by' as string]: `${by + 40}px`, translate: '-50% -100%' }} aria-hidden="true">
          {fechaCorta(b.dia)} · {b.ocupados} de {b.total}
        </div>
      )}
      <div className="g-lienzo">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Cuartos ocupados por día en los últimos 30 días" onPointerLeave={() => setSel(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={M.l} x2={W - M.r} y1={y(t)} y2={y(t)} className={t === 0 ? 'g-eje' : 'g-grid'} />
            <text x={M.l - 8} y={y(t) + 5} textAnchor="end" className="g-txt">
              {t}
            </text>
          </g>
        ))}
        {dias.length > 1 && (
          <>
            <defs>
              <linearGradient id="g-area" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor="var(--serie-1)" stopOpacity="0.22" />
                <stop offset="1" stopColor="var(--serie-1)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={`${linea} L${px(dias.length - 1)},${M.t + ih} L${px(0)},${M.t + ih}Z`} fill="url(#g-area)" />
            <path d={linea} className="g-linea" />
          </>
        )}
        {s && sel != null && (
          <>
            <line x1={px(sel)} x2={px(sel)} y1={M.t} y2={M.t + ih} className="g-guia" />
            <circle cx={px(sel)} cy={y(s.ocupados)} r="5" className="g-punto" />
          </>
        )}
        {dias.length > 0 && <circle cx={px(dias.length - 1)} cy={y(dias[dias.length - 1].ocupados)} r="4" className="g-punto g-punto--hoy" />}
        {dias.map((d, i) => (
          <rect key={d.dia} x={M.l + i * slot} y={M.t} width={slot} height={ih} fill="transparent" onPointerEnter={() => setSel(i)} onPointerDown={() => setSel(i)} />
        ))}
        {dias.length > 0 && (
          <text x={px(dias.length - 1)} y={y(dias[dias.length - 1].ocupados) - 10} textAnchor="end" className="g-etq">
            Hoy {dias[dias.length - 1].ocupados}
          </text>
        )}
        {[0, Math.floor((dias.length - 1) / 2), dias.length - 1].map((i, k) =>
          dias[i] ? (
            <text key={k} x={M.l + i * slot + slot / 2} y={H - 6} textAnchor={k === 0 ? 'start' : k === 2 ? 'end' : 'middle'} className="g-txt">
              {fechaCorta(dias[i].dia)}
            </text>
          ) : null,
        )}
      </svg>
      </div>
      <table className="sr-only">
        <caption>Cuartos ocupados por día</caption>
        <thead>
          <tr>
            <th>Día</th>
            <th>Ocupados</th>
          </tr>
        </thead>
        <tbody>
          {dias.map((d) => (
            <tr key={d.dia}>
              <td>{fechaCorta(d.dia)}</td>
              <td>
                {d.ocupados} de {d.total}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

const CANALES: { id: FilaIngreso['canal']; nombre: string; color: string }[] = [
  { id: 'directo', nombre: 'Directo', color: 'var(--serie-1)' },
  { id: 'booking', nombre: 'Booking', color: 'var(--serie-2)' },
  { id: 'airbnb', nombre: 'Airbnb', color: 'var(--serie-3)' },
];

/** Ingresos por canal: barras horizontales con el valor al final (etiqueta directa). */
export function GraficoCanales({ serie }: { serie: FilaIngreso[] }) {
  const filas = useMemo(() => {
    const t = new Map<string, number>();
    serie.forEach((f) => t.set(f.canal, (t.get(f.canal) ?? 0) + f.ingresos_centavos));
    return CANALES.map((c) => ({ ...c, total: t.get(c.id) ?? 0 })).sort((a, b) => b.total - a.total);
  }, [serie]);
  const max = Math.max(1, ...filas.map((f) => f.total));
  const suma = filas.reduce((a, f) => a + f.total, 0);

  return (
    <figure className="canales">
      <ul>
        {filas.map((f) => (
          <li key={f.id}>
            <span className="canales__nombre">
              <i style={{ background: f.color }} aria-hidden="true" />
              {f.nombre}
            </span>
            <span className="canales__pista" aria-hidden="true">
              <span style={{ width: `${(f.total / max) * 100}%`, background: f.color }} />
            </span>
            <span className="canales__valor">{dinero(f.total)}</span>
          </li>
        ))}
      </ul>
      <figcaption className="grafico__sub">Total de los 30 días: {dinero(suma)}</figcaption>
    </figure>
  );
}

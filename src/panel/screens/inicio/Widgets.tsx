import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import type { Cuarto } from '../../data/cuartos';
import { ESTADOS, type Estado } from '../../lib/estados';
import { dinero, fechaCorta, fechaLarga } from '../../lib/format';
import type { Pagina } from '../../nav';
import { Contador } from '../../ui/kit';
import { Icon, type IconoNombre } from '../../ui/Icon';
import { fotoDePiso } from './fotos';

/* ---------- Hoy: fecha, llegadas, salidas y temporada (sin clima: no hay fuente) ---------- */
export function TarjetaHoy({ hoy, llegadas, salidas, temporada, ir }: { hoy: string; llegadas: number; salidas: number; temporada: string | null; ir: (p: Pagina) => void }) {
  return (
    <section className="card b-card b-hoy" aria-label="Hoy">
      <p className="b-etq">Hoy</p>
      <p className="b-fecha">{fechaLarga(hoy)}</p>
      <ul className="b-hoy__datos">
        <li>
          <button type="button" onClick={() => ir('reservas')}>
            <span className="b-burbuja">
              <Icon name="llega" />
            </span>
            <Contador valor={llegadas} />
            <span className="b-hoy__txt">{llegadas === 1 ? 'llega' : 'llegan'}</span>
          </button>
        </li>
        <li>
          <button type="button" onClick={() => ir('reservas')}>
            <span className="b-burbuja">
              <Icon name="sale" />
            </span>
            <Contador valor={salidas} />
            <span className="b-hoy__txt">{salidas === 1 ? 'sale' : 'salen'}</span>
          </button>
        </li>
        {temporada && (
          <li className="b-hoy__temp">
            <span className="b-burbuja">
              <Icon name="calendario" />
            </span>
            <strong>{temporada}</strong>
            <span className="b-hoy__txt">temporada</span>
          </li>
        )}
      </ul>
    </section>
  );
}

/* ---------- Medidor radial: semicírculo que se llena con la ocupación ---------- */
export function MedidorOcupacion({ pct, ocupados, total, libres, ir }: { pct: number; ocupados: number; total: number; libres: number; ir: (p: Pagina) => void }) {
  const p = Math.max(0, Math.min(100, pct));
  return (
    <section className="card b-card b-medidor" aria-label="Ocupación">
      <p className="b-etq">Ocupación de hoy</p>
      <div className="medidor" role="img" aria-label={`${Math.round(p)} % ocupado: ${ocupados} de ${total} cuartos`}>
        <span className="medidor__pista" />
        <span className="medidor__valor" style={{ ['--giro' as string]: `${p * 1.8}deg` }}>
          <i />
        </span>
        <span className="medidor__centro">
          <span className="medidor__num">
            <Contador valor={Math.round(p)} />
            <small>%</small>
          </span>
          <span className="medidor__de">
            {ocupados} de {total} cuartos
          </span>
        </span>
      </div>
      <div className="b-medidor__pie">
        <span className="chip e-libre">
          <Icon name="libre" />
          {libres} {libres === 1 ? 'libre' : 'libres'}
        </span>
        <button type="button" className="b-link" onClick={() => ir('cuartos')}>
          Ver los cuartos <Icon name="siguiente" size="sm" />
        </button>
      </div>
    </section>
  );
}

/* ---------- Protagonista: pestañas por piso, foto real y cuartos como chips de vidrio ---------- */
export function TarjetaPisos({ cuartos, abrirCuarto, ir }: { cuartos: Cuarto[]; abrirCuarto: (id: string) => void; ir: (p: Pagina) => void }) {
  const pisos = useMemo(() => {
    const m = new Map<number, Cuarto[]>();
    cuartos.forEach((c) => m.set(c.piso, [...(m.get(c.piso) ?? []), c]));
    return [...m.entries()].sort((a, b) => a[0] - b[0]);
  }, [cuartos]);
  const [sel, setSel] = useState(0);
  const i = Math.min(sel, Math.max(0, pisos.length - 1));
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  if (pisos.length === 0) return null;
  const [piso, lista] = pisos[i];
  const cuenta = (Object.keys(ESTADOS) as Estado[])
    .map((e) => ({ e, n: lista.filter((c) => c.estado === e).length }))
    .filter((x) => x.n > 0);

  const tecla = (ev: KeyboardEvent) => {
    const d = ev.key === 'ArrowRight' ? 1 : ev.key === 'ArrowLeft' ? -1 : 0;
    if (!d) return;
    ev.preventDefault();
    const n = (i + d + pisos.length) % pisos.length;
    setSel(n);
    refs.current[n]?.focus();
  };

  return (
    <section className="card b-card b-piso" aria-label="Cuartos por piso">
      <div className="b-piso__foto" key={`f${piso}`} style={{ backgroundImage: `url(${fotoDePiso(i)})` }} aria-hidden="true" />
      <div className="b-piso__velo" aria-hidden="true" />
      <header className="b-piso__cab">
        <div className="pestanas" role="tablist" aria-label="Piso" onKeyDown={tecla}>
          {pisos.map(([p], k) => (
            <button
              key={p}
              ref={(el) => {
                refs.current[k] = el;
              }}
              type="button"
              role="tab"
              id={`tab-piso-${p}`}
              aria-selected={k === i}
              aria-controls="panel-piso"
              tabIndex={k === i ? 0 : -1}
              className="pestana"
              onClick={() => setSel(k)}
            >
              Piso {p}
            </button>
          ))}
        </div>
        <button type="button" className="vidrio-btn" onClick={() => ir('cuartos')}>
          Ver el mapa <Icon name="siguiente" size="sm" />
        </button>
      </header>

      <div className="b-piso__cuartos" role="tabpanel" id="panel-piso" aria-labelledby={`tab-piso-${piso}`} key={`c${piso}`}>
        {lista.map((c, k) => (
          <button
            key={c.id}
            type="button"
            className={`cuarto-chip e-${c.estado}`}
            style={{ ['--k' as string]: k }}
            onClick={() => abrirCuarto(c.id)}
            aria-label={`Cuarto ${c.numero}, ${ESTADOS[c.estado].palabra}`}
          >
            <span className="cuarto-chip__ico">
              <Icon name={c.estado} />
            </span>
            <span className="cuarto-chip__num">{c.numero}</span>
            <span className="cuarto-chip__est">{ESTADOS[c.estado].palabra}</span>
          </button>
        ))}
      </div>

      <footer className="b-piso__pie">
        {cuenta.map(({ e, n }) => (
          <span key={e} className={`vidrio-chip e-${e}`}>
            <Icon name={e} size="sm" />
            {n} {ESTADOS[e].palabra.toLowerCase()}
          </span>
        ))}
      </footer>
    </section>
  );
}

/* ---------- Fichas rápidas ---------- */
export interface Ficha {
  id: string;
  icono: IconoNombre;
  clase: string;
  titulo: string;
  n: number;
  sub: string;
  pagina: Pagina;
}
export function Fichas({ fichas, ir }: { fichas: Ficha[]; ir: (p: Pagina) => void }) {
  return (
    <div className="b-fichas">
      {fichas.map((f) => (
        <button key={f.id} type="button" className={`ficha ${f.clase}`} onClick={() => ir(f.pagina)}>
          <span className="ficha__ico">
            <Icon name={f.icono} />
          </span>
          <span className="ficha__sig" aria-hidden="true">
            <Icon name="siguiente" size="sm" />
          </span>
          <span className="ficha__titulo">{f.titulo}</span>
          <span className="ficha__cifra">
            <Contador valor={f.n} />
          </span>
          <span className="ficha__sub">{f.sub}</span>
        </button>
      ))}
    </div>
  );
}

/* ---------- Ingresos: barras de 7 o 30 días ---------- */
export interface DiaIngreso {
  dia: string;
  centavos: number;
}
export function TarjetaIngresos({ dias, dineroMes }: { dias: DiaIngreso[]; dineroMes: number }) {
  const [rango, setRango] = useState<7 | 30>(7);
  const vista = dias.slice(-rango);
  const [selDia, setSelDia] = useState<string | null>(null);
  const sel = vista.find((d) => d.dia === selDia) ?? vista[vista.length - 1];
  useEffect(() => setSelDia(null), [rango]);

  const total = vista.reduce((s, d) => s + d.centavos, 0);
  const anterior = rango === 7 ? dias.slice(-14, -7).reduce((s, d) => s + d.centavos, 0) : 0;
  const delta = rango === 7 && anterior > 0 ? Math.round(((total - anterior) / anterior) * 100) : null;
  const max = Math.max(...vista.map((d) => d.centavos), 0);
  const tope = max > 0 ? Math.ceil(max / 100 / 10) * 10 * 100 : 1000;
  const ejes = [tope, tope / 2, 0];
  const iSel = sel ? vista.indexOf(sel) : -1;

  return (
    <section className="card b-card b-ingresos" aria-label="Ingresos">
      <header className="b-ingresos__cab">
        <div>
          <p className="b-etq">Ingresos · últimos {rango} días</p>
          <p className="b-ingresos__total">
            <Contador valor={total} formato={(n) => dinero(Math.round(n / 100) * 100)} />
            {delta !== null && (
              <span className={`b-delta ${delta >= 0 ? 'es-sube' : 'es-baja'}`}>
                <Icon name="tendencia" size="sm" />
                {delta >= 0 ? '+' : ''}
                {delta} % vs semana anterior
              </span>
            )}
          </p>
        </div>
        <div className="mini-seg" role="group" aria-label="Rango">
          {([7, 30] as const).map((r) => (
            <button key={r} type="button" aria-pressed={rango === r} onClick={() => setRango(r)}>
              {r} días
            </button>
          ))}
        </div>
      </header>

      {total === 0 ? (
        <p className="b-vacio">Todavía no hay ingresos en estos días. Aparecerán cuando se cobren estadías.</p>
      ) : (
        <div className={`barras ${rango === 30 ? 'barras--30' : ''}`} key={rango}>
          <div className="barras__ejes" aria-hidden="true">
            {ejes.map((v) => (
              <span key={v}>{dinero(v)}</span>
            ))}
          </div>
          <div className="barras__area">
            <div className="barras__rejilla" aria-hidden="true">
              <i />
              <i />
              <i />
            </div>
            <ol className="barras__cols">
              {vista.map((d, k) => {
                const activo = k === iSel;
                return (
                  <li key={d.dia}>
                    <button
                      type="button"
                      className={`barra-col ${activo ? 'is-activa' : ''} ${d.dia === dias[dias.length - 1].dia ? 'es-hoy' : ''}`}
                      style={{ ['--h' as string]: tope ? d.centavos / tope : 0, ['--k' as string]: k }}
                      onPointerEnter={() => setSelDia(d.dia)}
                      onFocus={() => setSelDia(d.dia)}
                      onClick={() => setSelDia(d.dia)}
                      aria-label={`${fechaCorta(d.dia)}: ${dinero(d.centavos)}`}
                    >
                      {activo && <span className="barra-col__tip">{dinero(d.centavos)}</span>}
                      <span className="barra-col__b" />
                    </button>
                    <span className="barras__dia" aria-hidden="true">
                      {rango === 7 ? fechaCorta(d.dia).split(' ')[0] : k % 5 === 0 || k === vista.length - 1 ? fechaCorta(d.dia).split(' ')[1] : ''}
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      )}
      <p className="b-ingresos__pie">
        {sel && total > 0 && (
          <span>
            {fechaCorta(sel.dia)}: <b>{dinero(sel.centavos)}</b>
          </span>
        )}
        <span>
          Dinero del mes: <b>{dinero(Math.round(dineroMes / 100) * 100)}</b>
        </span>
      </p>
    </section>
  );
}

import { useEffect, useMemo, useRef } from 'react';
import type { Cuarto } from '../../data/cuartos';
import type { ReservaVista } from '../../data/reservas';
import { usePerfil } from '../../data/sesion';
import { fechaCorta } from '../../lib/format';
import { Icon, type IconoNombre } from '../../ui/Icon';
import { cuentaAtras, diaCorto, fuenteTexto, movimientos } from './logica';
import { ChipReserva, MarcaCanal } from './piezas';

interface Props {
  dias: string[];
  hoy: string;
  dia: string;
  onDia: (d: string) => void;
  cuartos: Cuarto[];
  reservas: ReservaVista[];
  pulsos: ReadonlySet<string>;
  ahora: Date;
  onVacia: (cuartoId: string, dia: string) => void;
  onAbrir: (id: string) => void;
}

/** Móvil: tira de días (con llegadas y salidas) + la agenda del día elegido. Una tabla encogida no se puede usar con el pulgar. */
export function DiaLista({ dias, hoy, dia, onDia, cuartos, reservas, pulsos, ahora, onVacia, onAbrir }: Props) {
  const { hotel } = usePerfil();
  const tira = useRef<HTMLDivElement>(null);
  useEffect(() => {
    tira.current?.querySelector<HTMLElement>('[aria-pressed="true"]')?.scrollIntoView({ inline: 'center', block: 'nearest' });
  }, [dia, dias]);

  const mov = useMemo(() => new Map(dias.map((d) => [d, movimientos(reservas, d)])), [dias, reservas]);

  const g = useMemo(() => {
    const ocupada = new Set<string>();
    const llegan: ReservaVista[] = [];
    const quedan: ReservaVista[] = [];
    const salen: ReservaVista[] = [];
    for (const r of reservas) {
      if (r.entrada <= dia && dia < r.salida) {
        ocupada.add(r.habitacionId);
        (r.entrada === dia ? llegan : quedan).push(r);
      } else if (r.salida === dia) salen.push(r);
    }
    return { llegan, quedan, salen, libres: cuartos.filter((c) => !ocupada.has(c.id)) };
  }, [reservas, cuartos, dia]);

  const cuarto = (r: ReservaVista) => cuartos.find((c) => c.id === r.habitacionId);
  const numero = (r: ReservaVista) => cuarto(r)?.numero ?? '?';
  const ordenar = (l: ReservaVista[]) => [...l].sort((a, b) => numero(a).localeCompare(numero(b), 'es', { numeric: true }));
  const salida = hotel.checkOut?.slice(0, 5);

  const total = cuartos.length || 1;
  const ocupacion = Math.round(((total - g.libres.length) / total) * 100);
  const titulo = dia === hoy ? 'Hoy' : fechaCorta(dia).replace(/^./, (x) => x.toUpperCase());

  const comun = { cuarto, pulsos, ahora, onAbrir };

  return (
    <div className="rv-dialista">
      <div className="rv-tira" ref={tira} role="group" aria-label="Elige un día">
        {dias.map((d) => {
          const c = diaCorto(d);
          const m = mov.get(d) ?? { llegan: 0, salen: 0 };
          return (
            <button
              key={d}
              type="button"
              className={`rv-tira__dia ${d === hoy ? 'is-hoy' : ''} ${d < hoy ? 'is-pasado' : ''}`}
              aria-pressed={d === dia}
              aria-label={`${fechaCorta(d)}${d === hoy ? ', hoy' : ''}. Llegan ${m.llegan}, salen ${m.salen}`}
              onClick={() => onDia(d)}
            >
              <span>{d === hoy ? 'Hoy' : c.dia}</span>
              <b>{c.num}</b>
              <small className="rv-tira__mov" aria-hidden="true">
                <em className={m.llegan ? 'hay' : ''}>
                  <Icon name="llega" size="sm" />
                  {m.llegan}
                </em>
                <em className={m.salen ? 'hay' : ''}>
                  <Icon name="sale" size="sm" />
                  {m.salen}
                </em>
              </small>
            </button>
          );
        })}
      </div>

      <div className="rv-dia-res" key={dia}>
        <h2 className="rv-dia-res__titulo">{titulo}</h2>
        <p className="rv-dia-res__sub">
          <b>{g.libres.length}</b> {g.libres.length === 1 ? 'cuarto libre' : 'cuartos libres'} esta noche
        </p>
        <div className="rv-medidor" role="img" aria-label={`Ocupación del ${ocupacion} por ciento`}>
          <i style={{ ['--ocu' as string]: `${ocupacion}%` }} />
        </div>
      </div>

      <div className="rv-agenda" key={'a' + dia}>
        <Grupo titulo="Llegan" icono="llega" lista={ordenar(g.llegan)} vacio="Nadie llega este día." {...comun} />
        <Grupo titulo="Salen" icono="sale" lista={ordenar(g.salen)} vacio="Nadie sale este día." sale={salida} {...comun} />
        <Grupo titulo="Se quedan" icono="cama" lista={ordenar(g.quedan)} vacio="Nadie se queda de noches anteriores." {...comun} />

        <section className="rv-grupo" aria-label="Cuartos libres">
          <h3 className="rv-grupo__titulo">
            <span className="rv-grupo__ico rv-grupo__ico--libre">
              <Icon name="libre" size="sm" />
            </span>
            Libres esta noche <span className="filtro__n">{g.libres.length}</span>
          </h3>
          {g.libres.length === 0 ? (
            <p className="rv-vacio">No queda ningún cuarto libre. Está lleno.</p>
          ) : (
            <>
              <p className="rv-ayuda">Toca un cuarto para reservarlo desde este día.</p>
              <ul className="rv-libres">
                {g.libres.map((c) => (
                  <li key={c.id}>
                    <button type="button" className="rv-libre" disabled={dia < hoy} onClick={() => onVacia(c.id, dia)} aria-label={`Reservar el cuarto ${c.numero}, ${c.tipo}`}>
                      <b>{c.numero}</b>
                      <small>{c.tipo}</small>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function Grupo({
  titulo,
  icono,
  lista,
  vacio,
  sale,
  cuarto,
  pulsos,
  ahora,
  onAbrir,
}: {
  titulo: string;
  icono: IconoNombre;
  lista: ReservaVista[];
  vacio: string;
  sale?: string;
  cuarto: (r: ReservaVista) => Cuarto | undefined;
  pulsos: ReadonlySet<string>;
  ahora: Date;
  onAbrir: (id: string) => void;
}) {
  return (
    <section className="rv-grupo" aria-label={titulo}>
      <h3 className="rv-grupo__titulo">
        <span className="rv-grupo__ico">
          <Icon name={icono} size="sm" />
        </span>
        {titulo} <span className="filtro__n">{lista.length}</span>
      </h3>
      {lista.length === 0 ? (
        <p className="rv-vacio">{vacio}</p>
      ) : (
        <ul className="rv-items">
          {lista.map((r, i) => {
            const c = cuarto(r);
            return (
              <li key={r.id} style={{ ['--i' as string]: i }}>
                <button type="button" className={`rv-item rv-e-${r.estado} ${pulsos.has(r.id) ? 'is-pulso' : ''}`} onClick={() => onAbrir(r.id)}>
                  <span className="rv-item__num">{c?.numero ?? '?'}</span>
                  <span className="rv-item__texto">
                    <strong>{r.huesped ?? 'Sin nombre'}</strong>
                    <small>
                      {c?.tipo ? `${c.tipo} · ` : ''}
                      {r.personas} {r.personas === 1 ? 'persona' : 'personas'}
                    </small>
                    <small className="rv-item__canal">
                      <MarcaCanal fuente={r.fuente} /> {fuenteTexto(r.fuente)}
                      {sale ? ` · Sale a las ${sale}` : ''}
                      {r.estado === 'prereserva' && r.venceEn ? ` · ${cuentaAtras(r.venceEn, ahora)}` : ''}
                    </small>
                  </span>
                  <ChipReserva estado={r.estado} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

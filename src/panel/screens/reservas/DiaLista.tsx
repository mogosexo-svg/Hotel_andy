import { useEffect, useMemo, useRef } from 'react';
import type { Cuarto } from '../../data/cuartos';
import type { ReservaVista } from '../../data/reservas';
import { fechaCorta } from '../../lib/format';
import { Icon } from '../../ui/Icon';
import { cuentaAtras, diaCorto, fuenteTexto } from './logica';
import { ChipReserva } from './piezas';

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

/** Móvil: tira de días + lo que pasa ese día. Una tabla encogida no se puede usar con el pulgar. */
export function DiaLista({ dias, hoy, dia, onDia, cuartos, reservas, pulsos, ahora, onVacia, onAbrir }: Props) {
  const tira = useRef<HTMLDivElement>(null);
  useEffect(() => {
    tira.current?.querySelector<HTMLElement>('[aria-pressed="true"]')?.scrollIntoView({ inline: 'center', block: 'nearest' });
  }, [dia, dias]);

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

  const numero = (r: ReservaVista) => cuartos.find((c) => c.id === r.habitacionId)?.numero ?? '?';
  const ordenar = (l: ReservaVista[]) => [...l].sort((a, b) => numero(a).localeCompare(numero(b), 'es', { numeric: true }));

  return (
    <div className="rv-dialista">
      <div className="rv-tira" ref={tira} role="group" aria-label="Elige un día">
        {dias.map((d) => {
          const c = diaCorto(d);
          return (
            <button
              key={d}
              type="button"
              className={`rv-tira__dia ${d === hoy ? 'is-hoy' : ''} ${d < hoy ? 'is-pasado' : ''}`}
              aria-pressed={d === dia}
              aria-label={fechaCorta(d) + (d === hoy ? ', hoy' : '')}
              onClick={() => onDia(d)}
            >
              <span>{d === hoy ? 'Hoy' : c.dia}</span>
              <b>{c.num}</b>
              <small>{c.mes}</small>
            </button>
          );
        })}
      </div>

      <h2 className="rv-dialista__titulo">
        {fechaCorta(dia)}
        <span>{g.libres.length === 1 ? '1 cuarto libre' : `${g.libres.length} cuartos libres`} esta noche</span>
      </h2>

      <Grupo titulo="Llegan" icono="llega" lista={ordenar(g.llegan)} vacio="Nadie llega este día." {...{ numero, pulsos, ahora, onAbrir }} />
      <Grupo titulo="Se quedan" icono="cama" lista={ordenar(g.quedan)} vacio="Nadie se queda de noches anteriores." {...{ numero, pulsos, ahora, onAbrir }} />
      <Grupo titulo="Salen" icono="sale" lista={ordenar(g.salen)} vacio="Nadie sale este día." {...{ numero, pulsos, ahora, onAbrir }} />

      <section className="rv-grupo" aria-label="Cuartos libres">
        <h3 className="rv-grupo__titulo">
          <Icon name="libre" size="sm" /> Libres esta noche <span className="filtro__n">{g.libres.length}</span>
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
  );
}

function Grupo({
  titulo,
  icono,
  lista,
  vacio,
  numero,
  pulsos,
  ahora,
  onAbrir,
}: {
  titulo: string;
  icono: 'llega' | 'cama' | 'sale';
  lista: ReservaVista[];
  vacio: string;
  numero: (r: ReservaVista) => string;
  pulsos: ReadonlySet<string>;
  ahora: Date;
  onAbrir: (id: string) => void;
}) {
  return (
    <section className="rv-grupo" aria-label={titulo}>
      <h3 className="rv-grupo__titulo">
        <Icon name={icono} size="sm" /> {titulo} <span className="filtro__n">{lista.length}</span>
      </h3>
      {lista.length === 0 ? (
        <p className="rv-vacio">{vacio}</p>
      ) : (
        <ul className="rv-items">
          {lista.map((r) => (
            <li key={r.id}>
              <button type="button" className={`rv-item rv-e-${r.estado} ${pulsos.has(r.id) ? 'is-pulso' : ''}`} onClick={() => onAbrir(r.id)}>
                <span className="rv-item__num">{numero(r)}</span>
                <span className="rv-item__texto">
                  <strong>{r.huesped ?? 'Sin nombre'}</strong>
                  <small>
                    {r.estado === 'prereserva' && r.venceEn
                      ? cuentaAtras(r.venceEn, ahora)
                      : `${fuenteTexto(r.fuente)} · ${r.personas} ${r.personas === 1 ? 'persona' : 'personas'}`}
                  </small>
                </span>
                <ChipReserva estado={r.estado} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

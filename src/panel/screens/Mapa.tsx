import { useMemo, useState } from 'react';
import { useCuartos, type Cuarto } from '../data/cuartos';
import { usePerfil } from '../data/sesion';
import { ESTADOS, type Estado } from '../lib/estados';
import { fechaCorta, hoyEC } from '../lib/format';
import { Aviso, ChipEstado, ErrorCarga, Skeleton } from '../ui/kit';
import { Icon } from '../ui/Icon';
import { HojaCuarto } from './HojaCuarto';

const ORDEN: Estado[] = ['libre', 'ocupado', 'por_limpiar', 'limpiando', 'mantenimiento'];

export function Mapa() {
  const { cuartos, cargando, error, recargar, cuartoAbierto, abrirCuarto, pulsos, enCurso, llegaHoy } = useCuartos();
  const { hotel } = usePerfil();
  const [filtro, setFiltro] = useState<Estado | null>(null);

  const cuenta = useMemo(() => {
    const c: Record<Estado, number> = { libre: 0, ocupado: 0, por_limpiar: 0, limpiando: 0, mantenimiento: 0 };
    cuartos.forEach((x) => c[x.estado]++);
    return c;
  }, [cuartos]);

  const pisos = useMemo(() => {
    const m = new Map<number, Cuarto[]>();
    cuartos.forEach((c) => m.set(c.piso, [...(m.get(c.piso) ?? []), c]));
    return [...m.entries()].sort((a, b) => b[0] - a[0]);
  }, [cuartos]);

  const abierto = cuartos.find((c) => c.id === cuartoAbierto) ?? null;
  const hoy = hoyEC();

  return (
    <section className="pantalla">
      <header className="pantalla__cab">
        <div>
          <h1>Cuartos</h1>
          <p className="pantalla__sub">{fechaCorta(hoy)} · se actualiza solo</p>
        </div>
      </header>

      {error ? (
        <ErrorCarga onReintentar={recargar} />
      ) : cargando ? (
        <MapaSkeleton />
      ) : cuartos.length === 0 ? (
        <Aviso icono="cuartos" titulo="Todavía no hay cuartos cargados" texto="Cuando la dueña los agregue, aparecerán aquí por piso." />
      ) : (
        <>
          <div className="filtros filtros--scroll" role="group" aria-label="Filtrar por estado">
            {ORDEN.map((e) => (
              <button
                key={e}
                type="button"
                className={`filtro filtro--estado e-${e}`}
                aria-pressed={filtro === e}
                onClick={() => setFiltro(filtro === e ? null : e)}
              >
                <Icon name={e} size="sm" />
                {ESTADOS[e].palabra}
                <span className="filtro__n">{cuenta[e]}</span>
              </button>
            ))}
          </div>

          <div className="edificio" role="list" aria-label="Cuartos por piso">
            <div className="edificio__techo" aria-hidden="true" />
            {pisos.map(([piso, lista]) => (
              <section key={piso} className="piso" role="listitem" aria-label={`Piso ${piso}`}>
                <h2 className="piso__nombre">
                  <span>Piso</span>
                  <b>{piso}</b>
                </h2>
                <ul className="piso__cuartos">
                  {lista.map((c) => {
                    const r = enCurso.get(c.id);
                    const l = llegaHoy.get(c.id);
                    return (
                      <li key={c.id}>
                        <button
                          type="button"
                          className={`cuarto e-${c.estado} ${pulsos.has(c.id) ? 'is-pulso' : ''} ${filtro && filtro !== c.estado ? 'is-tenue' : ''}`}
                          onClick={() => abrirCuarto(c.id)}
                          aria-label={`Cuarto ${c.numero}, ${c.tipo}, ${ESTADOS[c.estado].palabra}`}
                        >
                          <span className="cuarto__num">{c.numero}</span>
                          <span className="cuarto__tipo">{c.tipo}</span>
                          <ChipEstado estado={c.estado} />
                          {c.estado === 'ocupado' && r && (
                            <span className="cuarto__huesped">
                              {r.huesped ?? 'Huésped'}
                              <small>
                                Sale {r.salida === hoy ? 'hoy' : fechaCorta(r.salida)} {hotel.checkOut?.slice(0, 5)}
                              </small>
                            </span>
                          )}
                          {c.estado === 'libre' && l && (
                            <span className="cuarto__huesped">
                              <small>Llega hoy · {l.huesped ?? 'Reservado'}</small>
                            </span>
                          )}
                          <span className="cuarto__pulso" aria-hidden="true" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
            <div className="edificio__base" aria-hidden="true" />
          </div>
        </>
      )}

      {abierto && <HojaCuarto cuarto={abierto} onCerrar={() => abrirCuarto(null)} />}
    </section>
  );
}

function MapaSkeleton() {
  return (
    <div aria-busy="true" aria-label="Cargando cuartos" className="edificio">
      {[5, 4, 3, 2, 1].map((p) => (
        <div key={p} className="piso">
          <Skeleton h="2.5rem" w="3rem" />
          <div className="piso__cuartos">
            {Array.from({ length: p === 1 ? 5 : 4 }).map((_, i) => (
              <Skeleton key={i} h="7.5rem" r="14px" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

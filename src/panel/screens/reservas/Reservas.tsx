import { useEffect, useMemo, useState } from 'react';
import '../../styles/reservas.css';
import { useCuartos } from '../../data/cuartos';
import { useReservas, useTemporadaAlta } from '../../data/reservas';
import { fechaCorta, hoyEC } from '../../lib/format';
import { Aviso, Boton, ErrorCarga, Skeleton } from '../../ui/kit';
import { Icon } from '../../ui/Icon';
import { DiaLista } from './DiaLista';
import { HojaNueva, type Inicio } from './HojaNueva';
import { HojaReserva } from './HojaReserva';
import { Huespedes } from './Huespedes';
import { Linea } from './Linea';
import { diaCorto, diasEntre, ESTADO_RESERVA, rangoDias, sumarDias, type EstadoReserva } from './logica';
import { ChipReserva, useAhora, useAncho } from './piezas';

type Pestana = 'calendario' | 'huespedes';
const LEYENDA: EstadoReserva[] = ['prereserva', 'confirmada', 'en_curso', 'finalizada'];
const OPCIONES = { movil: [14], media: [7], ancha: [7, 14], amplia: [7, 14, 30] } as const;

export function Reservas() {
  const hoy = hoyEC();
  const ancho = useAncho();
  const { cuartos, cargando: cargandoCuartos, error: errorCuartos, recargar: recargarCuartos } = useCuartos();
  const [pestana, setPestana] = useState<Pestana>('calendario');
  const [desde, setDesde] = useState(hoy);
  const [dia, setDia] = useState(hoy);
  const [nueva, setNueva] = useState<Inicio | null>(null);
  const [abierta, setAbierta] = useState<{ id: string; pagar?: boolean } | null>(null);
  const ahora = useAhora();

  const [vista, setVista] = useState(14);
  const [dir, setDir] = useState<1 | -1>(1);
  const opciones: readonly number[] = OPCIONES[ancho];
  const n = opciones.includes(vista) ? vista : opciones[opciones.length - 1];
  const alta = useTemporadaAlta();
  const dias = useMemo(() => rangoDias(desde, n), [desde, n]);
  const { reservas, cargando, error, pulsos, parchar, recargar, refrescar } = useReservas(desde, n);

  useEffect(() => {
    if (diasEntre(desde, dia) < 0 || diasEntre(desde, dia) >= n) setDia(desde);
  }, [desde, dia, n]);

  const mover = (delta: number) => {
    setDir(delta > 0 ? 1 : -1);
    setDesde((d) => sumarDias(d, delta));
  };
  const a = diaCorto(dias[0] ?? desde);
  const z = diaCorto(dias[n - 1] ?? desde);
  const rango = a.mes === z.mes ? `${a.num} – ${z.num} ${z.mes}` : `${a.num} ${a.mes} – ${z.num} ${z.mes}`;

  const abrirNueva = (i: Inicio) => setNueva(i);
  const alCrearVacia = (cuartoId: string, d: string) => abrirNueva({ habitacionId: cuartoId, entrada: d });

  return (
    <section className="pantalla rv">
      <header className="pantalla__cab rv-cab">
        <div>
          <h1>Reservas</h1>
          <p className="pantalla__sub">{fechaCorta(hoy)} · se actualiza solo</p>
        </div>
        <Boton icono="mas" onClick={() => abrirNueva({ entrada: pestana === 'calendario' && ancho === 'movil' ? dia : undefined })}>
          Nueva reserva
        </Boton>
      </header>

      <div className="filtros" role="group" aria-label="Qué quieres ver">
        <button type="button" className="filtro" aria-pressed={pestana === 'calendario'} onClick={() => setPestana('calendario')}>
          <Icon name="calendario" size="sm" /> Calendario
        </button>
        <button type="button" className="filtro" aria-pressed={pestana === 'huespedes'} onClick={() => setPestana('huespedes')}>
          <Icon name="huespedes" size="sm" /> Huéspedes
        </button>
      </div>

      {pestana === 'huespedes' ? (
        <Huespedes onNueva={abrirNueva} onAbrirReserva={(id) => setAbierta({ id })} />
      ) : errorCuartos || error ? (
        <ErrorCarga
          onReintentar={() => {
            recargarCuartos();
            recargar();
          }}
        />
      ) : cargandoCuartos ? (
        <CalendarioSkeleton />
      ) : cuartos.length === 0 ? (
        <Aviso icono="cuartos" titulo="Todavía no hay cuartos cargados" texto="Cuando la dueña los agregue, podrás reservarlos aquí." />
      ) : (
        <>
          <div className="rv-barra">
            <div className="rv-nav" role="group" aria-label="Moverse por las fechas">
              <button type="button" className="rv-nav__btn" onClick={() => mover(-7)} aria-label="Una semana antes">
                <Icon name="anterior" />
              </button>
              <button type="button" className="rv-nav__btn" onClick={() => mover(7)} aria-label="Una semana después">
                <Icon name="siguiente" />
              </button>
              <Boton
                variante="quiet"
                disabled={desde === hoy}
                onClick={() => {
                  setDir(desde > hoy ? -1 : 1);
                  setDesde(hoy);
                  setDia(hoy);
                }}
              >
                Hoy
              </Boton>
            </div>
            <p className="rv-rango" aria-live="polite">
              {rango}
            </p>
            {opciones.length > 1 && (
              <div className="rv-vista" role="group" aria-label="Cuántos días ver">
                {opciones.map((o) => (
                  <button key={o} type="button" className="rv-vista__op" aria-pressed={n === o} onClick={() => setVista(o)}>
                    {o} días
                  </button>
                ))}
              </div>
            )}
            <ul className="rv-leyenda" aria-label="Qué significa cada color">
              {LEYENDA.map((e) => (
                <li key={e}>
                  <ChipReserva estado={e} />
                </li>
              ))}
              <li className="rv-ley-fondo">
                <i className="rv-muestra rv-muestra--finde" aria-hidden="true" /> Fin de semana
              </li>
              {alta.length > 0 && (
                <li className="rv-ley-fondo">
                  <i className="rv-muestra rv-muestra--alta" aria-hidden="true" /> Temporada alta
                </li>
              )}
            </ul>
          </div>

          {cargando ? (
            <CalendarioSkeleton />
          ) : (
            <>
              {reservas.length === 0 && (
                <div className="rv-vacio-cal">
                  <Icon name="calendario" />
                  <p>No hay reservas del {rango}. {ancho === 'movil' ? 'Toca un cuarto libre para crear una.' : 'Toca un día libre de un cuarto para crear una.'}</p>
                </div>
              )}
              {ancho === 'movil' ? (
                <DiaLista
                  dias={dias}
                  hoy={hoy}
                  dia={dia}
                  onDia={setDia}
                  cuartos={cuartos}
                  reservas={reservas}
                  pulsos={pulsos}
                  ahora={ahora}
                  onVacia={alCrearVacia}
                  onAbrir={(id) => setAbierta({ id })}
                />
              ) : (
                <Linea dias={dias} hoy={hoy} cuartos={cuartos} reservas={reservas} pulsos={pulsos} ahora={ahora} alta={alta} dir={dir} onVacia={alCrearVacia} onAbrir={(id) => setAbierta({ id })} />
              )}
              <p className="rv-ayuda rv-pie">
                Cada barra empieza a la tarde del día que entra el huésped y termina a la mañana del día que sale, así se ve cuándo un cuarto queda libre para otro.{' '}
                {ESTADO_RESERVA.prereserva}: aparta el cuarto 2 horas; cuando llega el anticipo pasa a {ESTADO_RESERVA.confirmada.toLowerCase()}.
              </p>
            </>
          )}
        </>
      )}

      {nueva && (
        <HojaNueva
          inicio={nueva}
          cuartos={cuartos}
          reservas={reservas}
          onCerrar={() => setNueva(null)}
          onAbrir={(id, pagar) => {
            setNueva(null);
            setAbierta({ id, pagar });
          }}
        />
      )}
      {abierta && <HojaReserva id={abierta.id} pagar={abierta.pagar} cuartos={cuartos} reservas={reservas} parchar={parchar} refrescar={refrescar} onCerrar={() => setAbierta(null)} />}
    </section>
  );
}

function CalendarioSkeleton() {
  return (
    <div className="pila" aria-busy="true" aria-label="Cargando el calendario">
      <Skeleton h="3.5rem" />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <Skeleton key={i} h="3.25rem" />
      ))}
    </div>
  );
}

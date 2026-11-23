import { useEffect, useState } from 'react';
import { useOperaciones, type HuespedFila } from '../../data/reservas';
import { dinero, fechaCorta } from '../../lib/format';
import { Icon } from '../../ui/Icon';
import { Aviso, Boton, ErrorCarga, Hoja, Skeleton } from '../../ui/kit';
import type { Inicio } from './HojaNueva';
import { ChipReserva } from './piezas';
import type { EstadoReserva } from './logica';

type Estancia = { id: string; codigo: string; numero: string; entrada: string; salida: string; estado: EstadoReserva; total: number | null };

/** Búsqueda por nombre, teléfono o documento + historial de estancias (RF-34). */
export function Huespedes({ onNueva, onAbrirReserva }: { onNueva: (i: Inicio) => void; onAbrirReserva: (id: string) => void }) {
  const ops = useOperaciones();
  const [q, setQ] = useState('');
  const [lista, setLista] = useState<HuespedFila[] | null>(null);
  const [error, setError] = useState(false);
  const [intento, setIntento] = useState(0);
  const [abierto, setAbierto] = useState<HuespedFila | null>(null);

  useEffect(() => {
    let vivo = true;
    const id = window.setTimeout(
      () => {
        void ops.buscarHuespedes(q).then((r) => {
          if (!vivo) return;
          setError(!r.ok);
          if (r.ok) setLista(r.valor);
        });
      },
      q ? 250 : 0,
    );
    return () => {
      vivo = false;
      window.clearTimeout(id);
    };
  }, [q, ops, intento]);

  return (
    <div className="rv-huespedes">
      <div className="campo">
        <label htmlFor="hq">Buscar huésped</label>
        <input id="hq" type="search" className="input" autoComplete="off" placeholder="Nombre, teléfono o cédula" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {error ? (
        <ErrorCarga onReintentar={() => setIntento((n) => n + 1)} />
      ) : lista === null ? (
        <div className="pila" aria-busy="true" aria-label="Cargando huéspedes">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} h="4.5rem" />
          ))}
        </div>
      ) : lista.length === 0 ? (
        q ? (
          <Aviso icono="buscar" titulo="No encontramos a nadie con eso" texto="Revisa cómo está escrito o prueba con el teléfono." accion={{ texto: 'Borrar la búsqueda', onClick: () => setQ('') }} />
        ) : (
          <Aviso icono="huespedes" titulo="Todavía no hay huéspedes" texto="Se guardan solos cuando haces una reserva." accion={{ texto: 'Hacer una reserva', onClick: () => onNueva({}), icono: 'mas' }} />
        )
      ) : (
        <>
          {!q && <p className="rv-ayuda">Los más recientes. Escribe arriba para buscar a otro.</p>}
          <ul className="rv-lista-h">
            {lista.map((h) => (
              <li key={h.id}>
                <button type="button" className="rv-h" onClick={() => setAbierto(h)}>
                  <span className="rv-h__ini" aria-hidden="true">
                    {h.nombre.trim().charAt(0).toUpperCase()}
                  </span>
                  <span className="rv-h__t">
                    <strong>{h.nombre}</strong>
                    <small>{[h.telefono, h.procedencia].filter(Boolean).join(' · ') || 'Sin teléfono'}</small>
                  </span>
                  <Icon name="siguiente" />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {abierto && (
        <HojaHuesped
          h={abierto}
          onCerrar={() => setAbierto(null)}
          onNueva={() => {
            const h = abierto;
            setAbierto(null);
            onNueva({ huesped: h });
          }}
          onAbrirReserva={(id) => {
            setAbierto(null);
            onAbrirReserva(id);
          }}
        />
      )}
    </div>
  );
}

function HojaHuesped({ h, onCerrar, onNueva, onAbrirReserva }: { h: HuespedFila; onCerrar: () => void; onNueva: () => void; onAbrirReserva: (id: string) => void }) {
  const ops = useOperaciones();
  const [est, setEst] = useState<Estancia[] | null | 'error'>(null);
  useEffect(() => {
    let vivo = true;
    void ops.estancias(h.id).then((r) => vivo && setEst(r.ok ? r.valor : 'error'));
    return () => {
      vivo = false;
    };
  }, [ops, h.id]);

  return (
    <Hoja titulo={h.nombre} onCerrar={onCerrar}>
      <dl className="datos" style={{ marginTop: 0 }}>
        {h.telefono && (
          <div>
            <dt>Teléfono</dt>
            <dd>{h.telefono}</dd>
          </div>
        )}
        {h.documento && (
          <div>
            <dt>Cédula o pasaporte</dt>
            <dd>{h.documento}</dd>
          </div>
        )}
        {h.procedencia && (
          <div>
            <dt>Viene de</dt>
            <dd>{h.procedencia}</dd>
          </div>
        )}
      </dl>
      <h3 className="rv-sub">Estancias</h3>
      {est === null ? (
        <Skeleton h="6rem" />
      ) : est === 'error' ? (
        <p className="rv-ayuda">No pudimos traer el historial. Cierra y vuelve a abrir.</p>
      ) : est.length === 0 ? (
        <p className="rv-ayuda">Todavía no tiene estancias.</p>
      ) : (
        <ul className="rv-estancias">
          {est.map((e) => (
            <li key={e.id}>
              <button type="button" onClick={() => onAbrirReserva(e.id)}>
                <span className="rv-estancia__cuarto">{e.numero}</span>
                <span className="rv-estancia__t">
                  <strong>
                    {fechaCorta(e.entrada)} al {fechaCorta(e.salida)}
                  </strong>
                  <small>{e.total == null ? 'Total por definir' : dinero(e.total)}</small>
                </span>
                <ChipReserva estado={e.estado} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="hoja__acciones">
        <Boton huge icono="calendario" onClick={onNueva}>
          Hacer una reserva
        </Boton>
      </div>
    </Hoja>
  );
}

import { useMemo, useState } from 'react';
import { usePerfil } from '../../data/sesion';
import { cargarPrecios, guardarTarifa, useCarga, type Tarifa, type TipoCuarto } from '../../data/config';
import { dinero } from '../../lib/format';
import { Boton } from '../../ui/kit';
import { Icon } from '../../ui/Icon';
import { centavosAInput, dolaresACentavos } from './logica';
import { Estados, HojaCambio, Intro, useGuardar } from './ui';

type Canal = 'directo' | 'booking' | 'airbnb';
interface Objetivo {
  tipo: TipoCuarto;
  canal: Canal;
  temporadaId: string | null;
  cuando: string;
}

export function Precios({ irA }: { irA: (s: 'temporada') => void }) {
  const { hotelId } = usePerfil();
  const { datos, error, recargar, reintentar } = useCarga(() => cargarPrecios(hotelId), [hotelId]);
  const guardar = useGuardar(recargar);
  const [editando, setEditando] = useState<Objetivo | null>(null);
  const [valor, setValor] = useState('');

  const abrir = (o: Objetivo, previa?: Tarifa) => {
    setValor(previa ? centavosAInput(previa.centavos) : '');
    setEditando(o);
  };

  const indice = useMemo(() => {
    const m = new Map<string, Tarifa>();
    datos?.tarifas.forEach((t) => m.set(`${t.tipoId}|${t.canal}|${t.temporadaId ?? ''}`, t));
    return (tipoId: string, canal: Canal, temporadaId: string | null) => m.get(`${tipoId}|${canal}|${temporadaId ?? ''}`);
  }, [datos]);

  return (
    <div className="cfg-seccion">
      <Intro
        titulo="Precios por noche"
        texto="Es el precio de todo el cuarto, no por persona. La web y el asistente de WhatsApp solo muestran el precio directo."
      />
      <Estados
        datos={datos}
        error={error}
        onReintentar={reintentar}
        hijos={(d) => {
          const baja = d.temporadas.find((t) => t.esBase);
          const alta = d.temporadas.find((t) => !t.esBase);
          const sinFechas = !alta || alta.rangos.length === 0;
          const bloque = (canal: 'booking' | 'airbnb', nombre: string) => {
            const puestos = d.tipos.filter((t) => indice(t.id, canal, null)).length;
            return (
              <section className="card cfg-card" aria-labelledby={`p-${canal}`}>
                <h3 id={`p-${canal}`} className="cfg-card__titulo">
                  Precio fijo en {nombre}
                </h3>
                <p className="cfg-nota">
                  {canal === 'booking'
                    ? 'Booking cobra el mismo precio todo el año. Mientras no lo pongas, las reservas de Booking quedan sin total.'
                    : 'Aún no has decidido si Airbnb usa un precio fijo. Si lo pones aquí, se usa en las reservas de Airbnb; si no, quedan sin total.'}
                </p>
                {puestos === 0 && (
                  <div className="cfg-vacio" role="status">
                    <Icon name="dinero" />
                    <div>
                      <strong>Aún no has puesto el precio de {nombre}</strong>
                      <span>Empieza por el primer tipo de cuarto; luego sigues con los demás, uno a la vez.</span>
                    </div>
                    <Boton
                      onClick={() =>
                        abrir({
                          tipo: d.tipos[0],
                          canal,
                          temporadaId: null,
                          cuando: `en ${nombre}`,
                        })
                      }
                      icono="dinero"
                    >
                      Poner el precio de {nombre}
                    </Boton>
                  </div>
                )}
                {puestos > 0 && (
                  <ul className="cfg-precios">
                    {d.tipos.map((t) => {
                      const f = indice(t.id, canal, null);
                      return (
                        <li key={t.id} className="cfg-precio">
                          <span className="cfg-precio__tipo">{t.nombre}</span>
                          <BotonPrecio
                            etiqueta={`Precio fijo de ${t.nombre} en ${nombre}`}
                            centavos={f?.centavos}
                            onClick={() =>
                              abrir(
                                {
                                  tipo: t,
                                  canal,
                                  temporadaId: null,
                                  cuando: `en ${nombre}`,
                                },
                                f,
                              )
                            }
                          />
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            );
          };
          return (
            <>
              <section className="card cfg-card" aria-labelledby="p-directo">
                <h3 id="p-directo" className="cfg-card__titulo">
                  Precio directo (web, WhatsApp y recepción)
                </h3>
                {sinFechas && (
                  <p className="cfg-nota cfg-nota--aviso" role="status">
                    <Icon name="alerta" size="sm" />
                    <span>
                      Todavía no marcaste fechas de temporada alta, así que todo se cobra a precio de temporada baja.{' '}
                      <button type="button" className="cfg-enlace" onClick={() => irA('temporada')}>
                        Marcar temporada alta
                      </button>
                    </span>
                  </p>
                )}
                <ul className="cfg-precios cfg-precios--dos">
                  {d.tipos.map((t) => {
                    const fb = baja && indice(t.id, 'directo', baja.id);
                    const fa = alta && indice(t.id, 'directo', alta.id);
                    return (
                      <li key={t.id} className="cfg-precio">
                        <span className="cfg-precio__tipo">
                          {t.nombre}
                          <small>hasta {t.maxPersonas} personas</small>
                        </span>
                        <BotonPrecio
                          sub="Temporada baja"
                          etiqueta={`Precio de ${t.nombre} en temporada baja`}
                          centavos={fb?.centavos}
                          onClick={() =>
                            baja &&
                            abrir(
                              {
                                tipo: t,
                                canal: 'directo',
                                temporadaId: baja.id,
                                cuando: 'en temporada baja',
                              },
                              fb,
                            )
                          }
                        />
                        <BotonPrecio
                          sub="Temporada alta"
                          etiqueta={`Precio de ${t.nombre} en temporada alta`}
                          centavos={fa?.centavos}
                          onClick={() =>
                            alta &&
                            abrir(
                              {
                                tipo: t,
                                canal: 'directo',
                                temporadaId: alta.id,
                                cuando: 'en temporada alta',
                              },
                              fa,
                            )
                          }
                        />
                      </li>
                    );
                  })}
                </ul>
              </section>
              {bloque('booking', 'Booking')}
              {bloque('airbnb', 'Airbnb')}
            </>
          );
        }}
      />

      {editando && datos && (
        <HojaCambio
          titulo={`${editando.tipo.nombre}, ${editando.cuando}`}
          ayuda="Precio por noche de todo el cuarto, en dólares."
          onCerrar={() => setEditando(null)}
          onGuardar={async () => {
            const r = dolaresACentavos(valor);
            if (!r.ok) return r.error;
            const previa = indice(editando.tipo.id, editando.canal, editando.temporadaId);
            if (previa?.centavos === r.valor) return null;
            const ok = await guardar(
              () =>
                guardarTarifa(
                  hotelId,
                  {
                    tipoId: editando.tipo.id,
                    canal: editando.canal,
                    temporadaId: editando.temporadaId,
                    centavos: r.valor,
                  },
                  previa,
                ),
              `${editando.tipo.nombre} ahora cuesta ${dinero(r.valor)} ${editando.cuando}`,
            );
            return ok ? null : 'No se pudo guardar. Intenta otra vez.';
          }}
        >
          <div className="campo">
            <label htmlFor="cfg-precio">Precio por noche</label>
            <div className="cfg-dinero">
              <span aria-hidden="true">$</span>
              <input
                id="cfg-precio"
                className="input"
                inputMode="decimal"
                autoComplete="off"
                autoFocus
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>
        </HojaCambio>
      )}
    </div>
  );
}

function BotonPrecio({ sub, centavos, onClick, etiqueta }: { sub?: string; centavos?: number; onClick: () => void; etiqueta: string }) {
  const vacio = centavos === undefined;
  return (
    <button
      type="button"
      className={`cfg-pbtn ${vacio ? 'is-vacio' : ''}`}
      onClick={onClick}
      aria-label={`${etiqueta}: ${vacio ? 'sin precio, tocar para ponerlo' : dinero(centavos) + ', tocar para cambiarlo'}`}
    >
      {sub && <span className="cfg-pbtn__sub">{sub}</span>}
      <span className="cfg-pbtn__val">{vacio ? 'Poner precio' : dinero(centavos)}</span>
    </button>
  );
}

import { useState } from 'react';
import { usePerfil } from '../../data/sesion';
import { cargarTemporadas, guardarRangos, useCarga } from '../../data/config';
import { hoyEC } from '../../lib/format';
import { Boton } from '../../ui/kit';
import { Cambiar, Estados, HojaCambio, Intro, useGuardar, Aviso } from './ui';
import { diasRango, escribirMultirango, nochesDe, nombreRango, validarRango, type Rango } from './logica';

export function Temporadas() {
  const { hotelId } = usePerfil();
  const { datos, error, recargar, reintentar } = useCarga(() => cargarTemporadas(hotelId), [hotelId]);
  const guardar = useGuardar(recargar);
  /** `indice` = null: rango nuevo; número: el que se edita. */
  const [editando, setEditando] = useState<{ indice: number | null } | null>(null);
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');

  const abrir = (indice: number | null, r?: Rango) => {
    setDesde(r?.desde ?? '');
    setHasta(r?.hasta ?? '');
    setEditando({ indice });
  };

  return (
    <div className="cfg-seccion">
      <Intro
        titulo="Temporada alta y feriados"
        texto="Los días que marques aquí se cobran al precio de temporada alta. Todos los demás días se cobran a temporada baja."
      />
      <Estados
        datos={datos}
        error={error}
        onReintentar={reintentar}
        hijos={(d) => {
          const alta = d.find((t) => !t.esBase);
          if (!alta) return <Aviso error icono="alerta" titulo="Falta la temporada alta" texto="Avísale a Mogolicous para que la cree." />;
          const rangos = alta.rangos;
          const previo = escribirMultirango(rangos);
          const aplicar = (nuevos: Rango[], mensaje: string) =>
            guardar(() => guardarRangos(alta.id, escribirMultirango(nuevos), previo), mensaje);
          return (
            <>
              {rangos.length === 0 ? (
                <Aviso
                  icono="reloj"
                  titulo="Todavía no marcaste temporada alta"
                  texto="Mientras tanto, todas las noches se cobran a temporada baja. Añade las fechas de Carnaval, Semana Santa, fin de año y los feriados que llenan el hotel."
                  accion={{
                    texto: 'Añadir fechas',
                    onClick: () => abrir(null),
                    icono: 'cama',
                  }}
                />
              ) : (
                <section className="card cfg-card" aria-label="Fechas de temporada alta">
                  <ul className="cfg-lista">
                    {rangos.map((r, i) => (
                      <li key={r.desde} className="cfg-rango">
                        <div className="cfg-rango__txt">
                          <strong>{nombreRango(r)}</strong>
                          <span>
                            {nochesDe(r)} {nochesDe(r) === 1 ? 'noche' : 'noches'} · {diasRango(r)}
                          </span>
                        </div>
                        <div className="cfg-rango__acc">
                          <Cambiar onClick={() => abrir(i, r)} etiqueta={nombreRango(r)} texto="Editar" />
                          <Boton
                            variante="ghost"
                            aria-label={`Quitar: ${nombreRango(r)}`}
                            onClick={() =>
                              void aplicar(
                                rangos.filter((_, j) => j !== i),
                                'Quitaste esas fechas de temporada alta',
                              )
                            }
                          >
                            Quitar
                          </Boton>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <Boton variante="quiet" icono="cama" onClick={() => abrir(null)} block>
                    Añadir otras fechas
                  </Boton>
                </section>
              )}

              {editando && (
                <HojaCambio
                  titulo={editando.indice === null ? 'Añadir fechas de temporada alta' : 'Cambiar estas fechas'}
                  ayuda="Elige el primer día y el último día, los dos incluidos."
                  onCerrar={() => setEditando(null)}
                  onGuardar={async () => {
                    const r = validarRango(desde, hasta);
                    if (!r.ok) return r.error;
                    const nuevos =
                      editando.indice === null ? [...rangos, r.valor] : rangos.map((x, j) => (j === editando.indice ? r.valor : x));
                    const ok = await aplicar(nuevos, `Listo: ${nombreRango(r.valor)} es temporada alta`);
                    return ok ? null : 'No se pudo guardar. Intenta otra vez.';
                  }}
                >
                  <div className="campo">
                    <label htmlFor="cfg-desde">Primer día</label>
                    <input
                      id="cfg-desde"
                      className="input"
                      type="date"
                      min={hoyEC()}
                      value={desde}
                      onChange={(e) => setDesde(e.target.value)}
                    />
                  </div>
                  <div className="campo">
                    <label htmlFor="cfg-hasta">Último día</label>
                    <input
                      id="cfg-hasta"
                      className="input"
                      type="date"
                      min={desde || hoyEC()}
                      value={hasta}
                      onChange={(e) => setHasta(e.target.value)}
                    />
                  </div>
                  {desde && hasta && validarRango(desde, hasta).ok && <p className="cfg-vista">{nombreRango({ desde, hasta })}</p>}
                </HojaCambio>
              )}
            </>
          );
        }}
      />
    </div>
  );
}

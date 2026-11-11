import { useState } from 'react';
import { usePerfil } from '../../data/sesion';
import { cargarKit, guardarKit, quitarKit, useCarga, type LineaKit } from '../../data/config';
import { numero, unidadPlural } from '../../lib/format';
import { Boton } from '../../ui/kit';
import { Aviso, Cambiar, Estados, HojaCambio, Intro, Opciones, Renglon, useGuardar } from './ui';
import { POR_PALABRA, parsearCantidad } from './logica';

type Por = LineaKit['por'];

export function Kit() {
  const { hotelId } = usePerfil();
  const { datos, error, recargar, reintentar } = useCarga(() => cargarKit(hotelId), [hotelId]);
  const guardar = useGuardar(recargar);
  const [tipoId, setTipoId] = useState<string | null>(null);
  const [edit, setEdit] = useState<{
    productoId: string;
    nuevo: boolean;
  } | null>(null);
  const [cantidad, setCantidad] = useState('');
  const [por, setPor] = useState<Por>('limpieza');

  return (
    <div className="cfg-seccion">
      <Intro
        titulo="Kit de limpieza por tipo de cuarto"
        texto="Lo que se descuenta del inventario cuando la camarera marca «Listo». Elige un tipo de cuarto para ver y cambiar su kit."
      />
      <Estados
        datos={datos}
        error={error}
        onReintentar={reintentar}
        hijos={(d) => {
          const tipo = d.tipos.find((t) => t.id === tipoId) ?? d.tipos[0];
          if (!tipo) return <Aviso icono="cuartos" titulo="Todavía no hay tipos de cuarto" />;
          const lineas = d.kit.filter((k) => k.tipoId === tipo.id);
          const nombre = (id: string) => d.insumos.find((i) => i.id === id);
          const libres = d.insumos.filter((i) => !lineas.some((l) => l.productoId === i.id));
          const abrir = (productoId: string, previa?: LineaKit) => {
            setCantidad(previa ? numero(previa.cantidad) : '1');
            setPor(previa?.por ?? 'limpieza');
            setEdit({ productoId, nuevo: !previa });
          };
          const ins = edit && nombre(edit.productoId);
          return (
            <>
              <div className="filtros filtros--scroll" role="group" aria-label="Tipo de cuarto">
                {d.tipos.map((t) => (
                  <button key={t.id} type="button" className="filtro" aria-pressed={t.id === tipo.id} onClick={() => setTipoId(t.id)}>
                    {t.nombre}
                  </button>
                ))}
              </div>

              {lineas.length === 0 ? (
                <Aviso
                  icono="inventario"
                  titulo={`El kit de ${tipo.nombre} está vacío`}
                  texto="Al marcar «Listo» en estos cuartos no se descontará nada. Añade lo que se usa en cada limpieza."
                  accion={
                    libres.length
                      ? {
                          texto: 'Añadir un producto',
                          onClick: () => abrir(libres[0].id),
                          icono: 'caja',
                        }
                      : undefined
                  }
                />
              ) : (
                <section className="card cfg-card" aria-label={`Kit de ${tipo.nombre}`}>
                  <ul className="cfg-lista">
                    {lineas.map((l) => {
                      const p = nombre(l.productoId);
                      return (
                        <Renglon
                          key={l.productoId}
                          etiqueta={p?.nombre ?? 'Producto'}
                          valor={`${numero(l.cantidad)} ${p ? unidadPlural(p.unidad, l.cantidad) : ''} ${POR_PALABRA[l.por]}`}
                          acciones={
                            <>
                              <Cambiar onClick={() => abrir(l.productoId, l)} etiqueta={p?.nombre ?? ''} />
                              <Boton
                                variante="ghost"
                                aria-label={`Quitar ${p?.nombre ?? 'producto'} del kit de ${tipo.nombre}`}
                                onClick={() =>
                                  void guardar(
                                    async () => {
                                      await quitarKit(l);
                                      return async () => void (await guardarKit(hotelId, l, undefined));
                                    },
                                    `Quitaste ${p?.nombre.toLowerCase() ?? 'el producto'} del kit de ${tipo.nombre}`,
                                  )
                                }
                              >
                                Quitar
                              </Boton>
                            </>
                          }
                        />
                      );
                    })}
                  </ul>
                  {libres.length > 0 && (
                    <Boton variante="quiet" icono="caja" block onClick={() => abrir(libres[0].id)}>
                      Añadir un producto al kit
                    </Boton>
                  )}
                </section>
              )}

              {edit && (
                <HojaCambio
                  titulo={edit.nuevo ? `Añadir al kit de ${tipo.nombre}` : `${ins?.nombre ?? ''} en ${tipo.nombre}`}
                  ayuda="Se descuenta del inventario cada vez que se marca «Listo»."
                  onCerrar={() => setEdit(null)}
                  onGuardar={async () => {
                    const c = parsearCantidad(cantidad);
                    if (!c.ok) return c.error;
                    const previa = lineas.find((l) => l.productoId === edit.productoId);
                    const nueva: LineaKit = {
                      tipoId: tipo.id,
                      productoId: edit.productoId,
                      cantidad: c.valor,
                      por,
                    };
                    const ok = await guardar(
                      () => guardarKit(hotelId, nueva, previa),
                      `Kit de ${tipo.nombre}: ${numero(c.valor)} de ${ins?.nombre.toLowerCase() ?? 'producto'} ${POR_PALABRA[por]}`,
                    );
                    return ok ? null : 'No se pudo guardar. Intenta otra vez.';
                  }}
                >
                  {edit.nuevo && (
                    <div className="campo">
                      <label htmlFor="cfg-prod">Producto</label>
                      <select
                        id="cfg-prod"
                        className="input"
                        value={edit.productoId}
                        onChange={(e) => setEdit({ productoId: e.target.value, nuevo: true })}
                      >
                        {libres.map((i) => (
                          <option key={i.id} value={i.id}>
                            {i.nombre}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div className="campo">
                    <label htmlFor="cfg-cant">Cantidad{ins ? ` (${unidadPlural(ins.unidad, 2)})` : ''}</label>
                    <input
                      id="cfg-cant"
                      className="input"
                      inputMode="decimal"
                      autoComplete="off"
                      autoFocus
                      value={cantidad}
                      onChange={(e) => setCantidad(e.target.value)}
                    />
                  </div>
                  <div className="campo">
                    <span className="campo__etiqueta">Cuánto se usa</span>
                    <Opciones<Por>
                      nombre="Cuánto se usa"
                      valor={por}
                      onCambio={setPor}
                      opciones={[
                        {
                          valor: 'limpieza',
                          titulo: 'Por cada limpieza',
                          texto: 'Siempre la misma cantidad, sin importar cuántos se hospedaron.',
                        },
                        {
                          valor: 'persona',
                          titulo: 'Por cada persona',
                          texto: 'Se multiplica por los huéspedes de la última reserva.',
                        },
                      ]}
                    />
                  </div>
                </HojaCambio>
              )}
            </>
          );
        }}
      />
    </div>
  );
}

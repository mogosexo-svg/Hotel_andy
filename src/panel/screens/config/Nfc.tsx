import { useState } from 'react';
import { usePerfil } from '../../data/sesion';
import { cargarHotel, cargarPlacas, crearPlaca, guardarPlaca, useCarga, type Placa } from '../../data/config';
import { Boton } from '../../ui/kit';
import { Icon } from '../../ui/Icon';
import { Aviso, Cambiar, Estados, HojaCambio, Intro, useGuardar } from './ui';
import { lugarLegible, validarLugar, validarUrl } from './logica';

export function Nfc() {
  const { hotelId } = usePerfil();
  const { datos, error, recargar, reintentar } = useCarga(
    async () => ({
      placas: await cargarPlacas(hotelId),
      dominio: (await cargarHotel(hotelId)).dominio,
    }),
    [hotelId],
  );
  const guardar = useGuardar(recargar);
  /** `placa` null = placa nueva. */
  const [edit, setEdit] = useState<{ placa: Placa | null } | null>(null);
  const [lugar, setLugar] = useState('');
  const [url, setUrl] = useState('');

  const abrir = (placa: Placa | null) => {
    setLugar('');
    setUrl(placa?.url ?? '');
    setEdit({ placa });
  };

  return (
    <div className="cfg-seccion">
      <Intro
        titulo="Placas NFC"
        texto="Cuando un huésped acerca el celular a una placa, lo llevamos a la página que elijas aquí (por ejemplo, para dejar una reseña) y contamos el toque. Puedes cambiar el destino sin cambiar la placa."
      />
      <Estados
        datos={datos}
        error={error}
        onReintentar={reintentar}
        hijos={({ placas, dominio }) => (
          <>
            {placas.length === 0 ? (
              <Aviso
                icono="llave"
                titulo="Todavía no hay placas"
                texto="Añade el primer lugar, por ejemplo «piscina», y a dónde debe llevar."
                accion={{
                  texto: 'Añadir una placa',
                  onClick: () => abrir(null),
                  icono: 'llave',
                }}
              />
            ) : (
              <>
                <ul className="cfg-placas">
                  {placas.map((p) => (
                    <li key={p.id} className={`card cfg-placa ${p.activo ? '' : 'is-apagada'}`}>
                      <div className="cfg-placa__cab">
                        <h3>{lugarLegible(p.lugar)}</h3>
                        <span className={`cfg-estado ${p.activo ? 'is-activo' : 'is-inactivo'}`}>
                          <Icon name={p.activo ? 'libre' : 'mantenimiento'} size="sm" />
                          {p.activo ? 'Funcionando' : 'Apagada'}
                        </span>
                      </div>
                      <p className="cfg-placa__toques">
                        <strong>{p.toques}</strong> {p.toques === 1 ? 'toque' : 'toques'} en total
                        <span> · {p.ultimos30} en los últimos 30 días</span>
                      </p>
                      <p className="cfg-placa__url">
                        <span>Lleva a</span> {p.url}
                      </p>
                      {dominio && (
                        <p className="cfg-placa__url">
                          <span>Dirección de la placa</span> {dominio}/r/
                          {p.lugar}
                        </p>
                      )}
                      <div className="cfg-placa__acc">
                        <Cambiar texto="Cambiar destino" etiqueta={lugarLegible(p.lugar)} onClick={() => abrir(p)} />
                        <Boton
                          variante="ghost"
                          aria-label={`${p.activo ? 'Apagar' : 'Encender'} la placa ${lugarLegible(p.lugar)}`}
                          onClick={() =>
                            void guardar(
                              () => guardarPlaca(p.id, { activo: !p.activo }, { activo: p.activo }),
                              p.activo
                                ? `Apagaste la placa de ${lugarLegible(p.lugar).toLowerCase()}`
                                : `Encendiste la placa de ${lugarLegible(p.lugar).toLowerCase()}`,
                            )
                          }
                        >
                          {p.activo ? 'Apagar' : 'Encender'}
                        </Boton>
                      </div>
                    </li>
                  ))}
                </ul>
                <Boton variante="quiet" icono="llave" onClick={() => abrir(null)} block>
                  Añadir otra placa
                </Boton>
              </>
            )}

            {edit && (
              <HojaCambio
                titulo={edit.placa ? `Destino de ${lugarLegible(edit.placa.lugar)}` : 'Añadir una placa'}
                ayuda="Pega el enlace completo de la página a la que debe llevar."
                onCerrar={() => setEdit(null)}
                onGuardar={async () => {
                  const u = validarUrl(url);
                  if (!u.ok) return u.error;
                  if (edit.placa) {
                    const p = edit.placa;
                    if (u.valor === p.url) return null;
                    const ok = await guardar(
                      () => guardarPlaca(p.id, { url: u.valor }, { url: p.url }),
                      `La placa de ${lugarLegible(p.lugar).toLowerCase()} ahora lleva a otra página`,
                    );
                    return ok ? null : 'No se pudo guardar. Intenta otra vez.';
                  }
                  const l = validarLugar(lugar);
                  if (!l.ok) return l.error;
                  if (placas.some((p) => p.lugar === l.valor)) return 'Ya hay una placa con ese nombre.';
                  const ok = await guardar(
                    () => crearPlaca(hotelId, l.valor, u.valor),
                    `Añadiste la placa de ${lugarLegible(l.valor).toLowerCase()}`,
                  );
                  return ok ? null : 'No se pudo guardar. Intenta otra vez.';
                }}
              >
                {!edit.placa && (
                  <div className="campo">
                    <label htmlFor="nfc-lugar">Lugar</label>
                    <input
                      id="nfc-lugar"
                      className="input"
                      autoComplete="off"
                      autoFocus
                      placeholder="piscina, llavero, cuarto 201…"
                      value={lugar}
                      onChange={(e) => setLugar(e.target.value)}
                    />
                  </div>
                )}
                <div className="campo">
                  <label htmlFor="nfc-url">Enlace de destino</label>
                  <input
                    id="nfc-url"
                    className="input"
                    type="url"
                    inputMode="url"
                    autoComplete="off"
                    autoFocus={!!edit.placa}
                    placeholder="https://…"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                  />
                </div>
              </HojaCambio>
            )}
          </>
        )}
      />
    </div>
  );
}

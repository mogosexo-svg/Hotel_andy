import { useState } from 'react';
import { usePerfil } from '../../data/sesion';
import { cargarHotel, guardarHotel, useCarga } from '../../data/config';
import { Cambiar, Estados, HojaCambio, Intro, Opciones, Renglon, useGuardar } from './ui';
import { CAMPOS_REGLAS, cambioCampo, leerCampo, mostrarCampo, parsearCampo, centavosAInput, type CampoRegla } from './logica';

export function Reglas() {
  const { hotelId } = usePerfil();
  const { datos, error, recargar, reintentar } = useCarga(() => cargarHotel(hotelId), [hotelId]);
  const guardar = useGuardar(recargar);
  const [campo, setCampo] = useState<CampoRegla | null>(null);
  const [texto, setTexto] = useState('');

  const abrir = (c: CampoRegla) => {
    const v = datos ? leerCampo(datos, c) : null;
    setTexto(v === null ? '' : c.tipo === 'si_no' ? (v ? 'si' : 'no') : c.tipo === 'dinero' ? centavosAInput(Number(v)) : String(v));
    setCampo(c);
  };

  return (
    <div className="cfg-seccion">
      <Intro
        titulo="Reglas del hotel"
        texto="Lo que ven los huéspedes en la web y lo que usa el sistema para reservar. Lo que dice «Sin definir» aún no lo has puesto."
      />
      <Estados
        datos={datos}
        error={error}
        onReintentar={reintentar}
        hijos={(h) => (
          <>
            {CAMPOS_REGLAS.map((g) => (
              <section key={g.grupo} className="card cfg-card" aria-labelledby={`g-${g.grupo}`}>
                <h3 className="cfg-card__titulo" id={`g-${g.grupo}`}>
                  {g.grupo}
                </h3>
                <ul className="cfg-lista">
                  {g.campos.map((c) => {
                    const v = leerCampo(h, c);
                    return (
                      <Renglon
                        key={c.id}
                        etiqueta={c.etiqueta}
                        ayuda={c.ayuda}
                        valor={mostrarCampo(c, v)}
                        sinDefinir={v === null}
                        acciones={<Cambiar onClick={() => abrir(c)} etiqueta={c.etiqueta} texto={v === null ? 'Poner' : 'Cambiar'} />}
                      />
                    );
                  })}
                </ul>
              </section>
            ))}

            {campo && (
              <HojaCambio
                titulo={campo.etiqueta}
                ayuda={campo.ayuda}
                onCerrar={() => setCampo(null)}
                onGuardar={async () => {
                  const r = parsearCampo(campo, texto);
                  if (!r.ok) return r.error;
                  const previo = leerCampo(h, campo);
                  if (previo === r.valor) return null;
                  const cambio = cambioCampo(h, campo, r.valor);
                  const antes = cambioCampo(h, campo, previo);
                  const ok = await guardar(
                    () => guardarHotel(hotelId, cambio, antes),
                    `Guardado: ${campo.etiqueta.toLowerCase()} ahora es ${mostrarCampo(campo, r.valor).toLowerCase()}`,
                  );
                  return ok ? null : 'No se pudo guardar. Intenta otra vez.';
                }}
              >
                {campo.tipo === 'si_no' ? (
                  <Opciones
                    nombre={campo.etiqueta}
                    valor={texto as 'si' | 'no' | ''}
                    onCambio={setTexto}
                    opciones={[
                      { valor: 'si', titulo: 'Sí' },
                      { valor: 'no', titulo: 'No' },
                    ]}
                  />
                ) : (
                  <div className="campo">
                    <label htmlFor="cfg-valor">{campo.etiqueta}</label>
                    {campo.tipo === 'dinero' ? (
                      <div className="cfg-dinero">
                        <span aria-hidden="true">$</span>
                        <input
                          id="cfg-valor"
                          className="input"
                          inputMode="decimal"
                          autoFocus
                          value={texto}
                          onChange={(e) => setTexto(e.target.value)}
                          placeholder="0"
                        />
                      </div>
                    ) : (
                      <div className={campo.sufijo ? 'cfg-sufijo' : undefined}>
                        <input
                          id="cfg-valor"
                          className="input"
                          type={campo.tipo === 'hora' ? 'time' : campo.tipo === 'telefono' ? 'tel' : 'text'}
                          inputMode={campo.tipo === 'entero' ? 'numeric' : undefined}
                          autoFocus
                          value={texto}
                          onChange={(e) => setTexto(e.target.value)}
                        />
                        {campo.sufijo && <span aria-hidden="true">{campo.sufijo.trim()}</span>}
                      </div>
                    )}
                  </div>
                )}
              </HojaCambio>
            )}
          </>
        )}
      />
    </div>
  );
}

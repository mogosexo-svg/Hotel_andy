import { useState } from 'react';
import { usePerfil } from '../../data/sesion';
import { cargarUsuarios, guardarUsuario, useCarga, type Usuario } from '../../data/config';
import { ROL_PALABRA, type Rol } from '../../lib/estados';
import { Boton } from '../../ui/kit';
import { Icon } from '../../ui/Icon';
import { Cambiar, Estados, HojaCambio, Intro, Opciones, Renglon, useGuardar } from './ui';

const ROLES: { valor: Rol; titulo: string; texto: string }[] = [
  {
    valor: 'duena',
    titulo: 'Dueña',
    texto: 'Ve y cambia todo, incluida esta configuración.',
  },
  {
    valor: 'recepcion',
    titulo: 'Recepción',
    texto: 'Reservas, entradas y salidas, cuartos e insumos.',
  },
  {
    valor: 'limpieza',
    titulo: 'Limpieza',
    texto: 'Solo ve los cuartos que le toca limpiar.',
  },
];

export function Usuarios() {
  const { hotelId, userId } = usePerfil();
  const { datos, error, recargar, reintentar } = useCarga(() => cargarUsuarios(hotelId), [hotelId]);
  const guardar = useGuardar(recargar);
  const [u, setU] = useState<Usuario | null>(null);
  const [rol, setRol] = useState<Rol>('recepcion');

  return (
    <div className="cfg-seccion">
      <Intro titulo="Quién tiene acceso" texto="Las personas que pueden entrar al panel y lo que cada una puede hacer." />
      <Estados
        datos={datos}
        error={error}
        onReintentar={reintentar}
        hijos={(lista) => (
          <>
            <section className="card cfg-card" aria-label="Usuarios">
              <ul className="cfg-lista">
                {lista.map((x) => {
                  const yo = x.userId === userId;
                  return (
                    <Renglon
                      key={x.userId}
                      etiqueta={x.nombre}
                      ayuda={yo ? 'Eres tú' : undefined}
                      valor={
                        <span className={`cfg-estado ${x.activo ? 'is-activo' : 'is-inactivo'}`}>
                          <Icon name={x.activo ? 'libre' : 'mantenimiento'} size="sm" />
                          {ROL_PALABRA[x.rol]} · {x.activo ? 'Con acceso' : 'Sin acceso'}
                        </span>
                      }
                      acciones={
                        yo ? null : (
                          <>
                            <Cambiar
                              texto="Cambiar cargo"
                              etiqueta={x.nombre}
                              onClick={() => {
                                setRol(x.rol);
                                setU(x);
                              }}
                            />
                            <Boton
                              variante={x.activo ? 'ghost' : 'quiet'}
                              aria-label={`${x.activo ? 'Quitar el acceso a' : 'Dar acceso otra vez a'} ${x.nombre}`}
                              onClick={() =>
                                void guardar(
                                  () => guardarUsuario(hotelId, x.userId, { activo: !x.activo }, { activo: x.activo }),
                                  x.activo ? `${x.nombre} ya no puede entrar` : `${x.nombre} puede entrar otra vez`,
                                )
                              }
                            >
                              {x.activo ? 'Quitar acceso' : 'Dar acceso'}
                            </Boton>
                          </>
                        )
                      }
                    />
                  );
                })}
              </ul>
            </section>

            <section className="card cfg-card cfg-card--suave" aria-labelledby="u-nuevo">
              <h3 id="u-nuevo" className="cfg-card__titulo">
                Agregar a una persona nueva
              </h3>
              <p className="cfg-nota">
                Todavía no se puede hacer desde aquí: estamos terminando esta parte. Cuando esté lista, escribirás su nombre, su correo y su
                cargo, y a su correo le llegará un enlace para entrar. Mientras tanto, pídele a Mogolicous que la agregue.
              </p>
            </section>

            {u && (
              <HojaCambio
                titulo={`Cargo de ${u.nombre}`}
                ayuda="Cambia lo que esta persona puede ver y hacer."
                onCerrar={() => setU(null)}
                onGuardar={async () => {
                  if (rol === u.rol) return null;
                  const ok = await guardar(
                    () => guardarUsuario(hotelId, u.userId, { rol }, { rol: u.rol }),
                    `${u.nombre} ahora es ${ROL_PALABRA[rol].toLowerCase()}`,
                  );
                  return ok ? null : 'No se pudo guardar. Intenta otra vez.';
                }}
              >
                <Opciones nombre="Cargo" valor={rol} onCambio={setRol} opciones={ROLES} />
              </HojaCambio>
            )}
          </>
        )}
      />
    </div>
  );
}

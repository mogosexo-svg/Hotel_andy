import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Database } from '../../lib/database.types';
import { useCuartos } from '../data/cuartos';
import { useAcciones } from '../data/acciones';
import { usePerfil } from '../data/sesion';
import { fechaCorta, hace } from '../lib/format';
import { Aviso, Boton, ChipEstado, ErrorCarga, Hoja, Skeleton } from '../ui/kit';
import { Icon } from '../ui/Icon';
import { FormDanio } from './HojaCuarto';

type Fila = Database['public']['Functions']['cuartos_por_limpiar']['Returns'][number];

/** Lo único que ve la camarera: botones enormes, una mano. */
export function Limpieza() {
  const { hotelId, rol, nombre } = usePerfil();
  const { cuartos, tick } = useCuartos();
  const acc = useAcciones();
  const [filas, setFilas] = useState<Fila[] | null>(null);
  const [error, setError] = useState(false);
  const [danio, setDanio] = useState<Fila | null>(null);
  const [ocupados, setOcupados] = useState<Set<string>>(new Set());

  const cargar = useCallback(async () => {
    const { data, error: err } = await supabase.rpc('cuartos_por_limpiar', { p_hotel: hotelId });
    if (err) return setError(true);
    setError(false);
    setFilas(data ?? []);
  }, [hotelId]);

  useEffect(() => {
    void cargar();
  }, [cargar, tick]);

  // El estado vivo viene de Realtime/optimista; la lista solo aporta el orden y la llegada.
  const vivos = new Map(cuartos.map((c) => [c.id, c]));
  const items = (filas ?? [])
    .map((f) => ({ f, c: vivos.get(f.habitacion_id) }))
    .filter(({ c }) => c && (c.estado === 'por_limpiar' || c.estado === 'limpiando'));
  const porLimpiar = items.filter(({ c }) => c?.estado === 'por_limpiar').length;
  const limpiando = items.length - porLimpiar;

  async function correr(f: Fila, fn: () => Promise<boolean>) {
    setOcupados((s) => new Set(s).add(f.habitacion_id));
    await fn();
    setOcupados((s) => {
      const n = new Set(s);
      n.delete(f.habitacion_id);
      return n;
    });
    void cargar();
  }

  return (
    <section className="pantalla pantalla--limpieza">
      <header className="pantalla__cab">
        <div>
          <h1>{rol === 'limpieza' ? `Hola, ${nombre.split(' ')[0]}` : 'Limpieza'}</h1>
          <p className="pantalla__sub">
            {filas === null && !error
              ? 'Buscando tus cuartos…'
              : items.length === 0
                ? 'No hay cuartos por limpiar'
                : `${porLimpiar} por limpiar${limpiando ? ` · ${limpiando} limpiando` : ''}`}
          </p>
        </div>
      </header>

      {error ? (
        <ErrorCarga onReintentar={() => void cargar()} />
      ) : filas === null ? (
        <div className="pila" aria-busy="true" aria-label="Cargando">
          <Skeleton h="11rem" r="20px" />
          <Skeleton h="11rem" r="20px" />
        </div>
      ) : items.length === 0 ? (
        <Aviso icono="libre" titulo="Todo está limpio" texto="Cuando alguien haga check-out, el cuarto aparece aquí al instante." />
      ) : (
        <ul className="limpieza-lista">
          {items.map(({ f, c }, i) => {
            if (!c) return null;
            const trabajando = c.estado === 'limpiando';
            return (
              <li key={f.habitacion_id} className={`tarea e-${c.estado}`} style={{ ['--i' as string]: i }}>
                <div className="tarea__cab">
                  <span className="tarea__num">{f.numero}</span>
                  <div className="tarea__quien">
                    <span className="tarea__tipo">
                      {f.tipo} · Piso {f.piso}
                    </span>
                    <span className="tarea__desde">{hace(c.estadoDesde)}</span>
                  </div>
                  <ChipEstado estado={c.estado} />
                </div>
                {(f.llega_hoy || f.proxima_llegada) && (
                  <p className={`tarea__llega ${f.llega_hoy ? 'is-hoy' : ''}`}>
                    <Icon name="reloj" size="sm" />
                    {f.llega_hoy ? 'Llega un huésped hoy: apúrate' : `Próxima llegada ${fechaCorta(f.proxima_llegada)}`}
                  </p>
                )}
                {trabajando ? (
                  <Boton huge block icono="libre" cargando={ocupados.has(f.habitacion_id)} onClick={() => void correr(f, () => acc.listo({ id: f.habitacion_id, numero: f.numero }))}>
                    Listo
                  </Boton>
                ) : (
                  <Boton huge block icono="limpiando" cargando={ocupados.has(f.habitacion_id)} onClick={() => void correr(f, () => acc.empezar({ id: f.habitacion_id, numero: f.numero }))}>
                    Empezar
                  </Boton>
                )}
                <Boton variante="ghost" icono="mantenimiento" onClick={() => setDanio(f)}>
                  Reportar daño
                </Boton>
              </li>
            );
          })}
        </ul>
      )}

      {danio && (
        <Hoja titulo={`Daño en el ${danio.numero}`} onCerrar={() => setDanio(null)}>
          <FormDanio cuarto={{ id: danio.habitacion_id, numero: danio.numero }} onAtras={() => setDanio(null)} onHecho={() => setDanio(null)} />
        </Hoja>
      )}
    </section>
  );
}


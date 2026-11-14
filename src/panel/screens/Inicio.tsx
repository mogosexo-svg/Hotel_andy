import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Database } from '../../lib/database.types';
import { usePerfil } from '../data/sesion';
import { useCuartos } from '../data/cuartos';
import { hoyEC, saludo } from '../lib/format';
import { nivelStock } from '../lib/stock';
import type { Pagina } from '../nav';
import { Aviso, BarraStock, ErrorCarga, Skeleton } from '../ui/kit';
import { Icon } from '../ui/Icon';
import { GraficoOcupacion, GraficoCanales } from './graficos';
import { HojaCuarto } from './HojaCuarto';
import { cargarTemporadas } from '../data/config';
import { Fichas, MedidorOcupacion, TarjetaHoy, TarjetaIngresos, TarjetaPisos, type DiaIngreso, type Ficha } from './inicio/Widgets';

interface Movimiento {
  reserva_id: string;
  codigo: string;
  habitacion: string;
  huesped: string | null;
  personas?: number;
  estado: string;
}
interface Insumo {
  producto_id: string;
  nombre: string;
  stock: number | null;
  minimo: number | null;
  unidad: string;
}
export interface Resumen {
  cuartos: number;
  ocupados: number;
  ocupacion_pct: number;
  por_limpiar: number;
  limpiando: number;
  en_arreglo: number;
  llegadas_hoy: Movimiento[];
  salidas_hoy: Movimiento[];
  insumos_bajos: Insumo[];
  dinero_mes_centavos: number;
}
export type FilaIngreso = Database['public']['Functions']['ocupacion_ingresos']['Returns'][number];

export function Inicio({ ir }: { ir: (p: Pagina) => void }) {
  const { hotelId, nombre } = usePerfil();
  const { tick } = useCuartos();
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [serie, setSerie] = useState<FilaIngreso[] | null>(null);
  const [temporada, setTemporada] = useState<string | null>(null);
  const [error, setError] = useState(false);

  const cargar = useCallback(async () => {
    const [r, s] = await Promise.all([
      supabase.rpc('resumen_inicio', { p_hotel: hotelId }),
      supabase.rpc('ocupacion_ingresos', { p_hotel: hotelId, p_dias: 30 }),
    ]);
    if (r.error || s.error) return setError(true);
    setError(false);
    setResumen(r.data as unknown as Resumen);
    setSerie(s.data ?? []);
  }, [hotelId]);

  useEffect(() => {
    void cargar().catch(() => setError(true));
  }, [cargar, tick]);

  // La temporada de hoy es un dato de apoyo: si no se puede leer, la tarjeta simplemente no la muestra.
  useEffect(() => {
    const hoy = hoyEC();
    cargarTemporadas(hotelId)
      .then((ts) => {
        const t = ts.find((x) => !x.esBase && x.rangos.some((r) => r.desde <= hoy && hoy <= r.hasta)) ?? ts.find((x) => x.esBase);
        setTemporada(t?.nombre ?? null);
      })
      .catch(() => setTemporada(null));
  }, [hotelId]);

  const hoy = hoyEC();
  const primer = nombre.split(' ')[0];

  return (
    <section className="pantalla pantalla--inicio">
      <header className="pantalla__cab">
        <div>
          <h1>
            {saludo()}, {primer}
          </h1>
          <p className="pantalla__sub">Así está el hotel ahora</p>
        </div>
      </header>

      {error ? (
        <ErrorCarga onReintentar={() => void cargar()} />
      ) : !resumen || !serie ? (
        <InicioSkeleton />
      ) : (
        <InicioDatos r={resumen} serie={serie} ir={ir} hoy={hoy} temporada={temporada} />
      )}
    </section>
  );
}

function InicioDatos({ r, serie, ir, hoy, temporada }: { r: Resumen; serie: FilaIngreso[]; ir: (p: Pagina) => void; hoy: string; temporada: string | null }) {
  const { cuartos, cuartoAbierto, abrirCuarto } = useCuartos();
  const libres = Math.max(0, r.cuartos - r.ocupados - r.por_limpiar - r.limpiando - r.en_arreglo);
  const hayDatos = useMemo(() => serie.some((f) => f.cuartos_ocupados > 0 || f.ingresos_centavos > 0), [serie]);
  const dias = useMemo<DiaIngreso[]>(() => {
    const m = new Map<string, number>();
    serie.forEach((f) => m.set(f.dia, (m.get(f.dia) ?? 0) + f.ingresos_centavos));
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([dia, centavos]) => ({ dia, centavos }));
  }, [serie]);
  const fichas: Ficha[] = [
    { id: 'limpiar', icono: 'por_limpiar', clase: 'e-por_limpiar', titulo: 'Por limpiar', n: r.por_limpiar, sub: r.por_limpiar === 1 ? 'cuarto esperando' : 'cuartos esperando', pagina: 'limpieza' },
    { id: 'limpiando', icono: 'limpiando', clase: 'e-limpiando', titulo: 'Limpiando', n: r.limpiando, sub: r.limpiando === 1 ? 'cuarto ahora' : 'cuartos ahora', pagina: 'limpieza' },
    { id: 'arreglo', icono: 'mantenimiento', clase: 'e-mantenimiento', titulo: 'En arreglo', n: r.en_arreglo, sub: r.en_arreglo === 1 ? 'cuarto fuera de servicio' : 'cuartos fuera de servicio', pagina: 'cuartos' },
    { id: 'stock', icono: 'inventario', clase: 'e-stock', titulo: 'Se está acabando', n: r.insumos_bajos.length, sub: r.insumos_bajos.length === 1 ? 'insumo por reponer' : 'insumos por reponer', pagina: 'inventario' },
  ];
  const abierto = cuartos.find((c) => c.id === cuartoAbierto) ?? null;

  return (
    <>
    <div className="inicio bento">
      <TarjetaHoy hoy={hoy} llegadas={r.llegadas_hoy.length} salidas={r.salidas_hoy.length} temporada={temporada} ir={ir} />
      <TarjetaPisos cuartos={cuartos} abrirCuarto={abrirCuarto} ir={ir} />
      <MedidorOcupacion pct={r.ocupacion_pct} ocupados={r.ocupados} total={r.cuartos} libres={libres} ir={ir} />
      <Fichas fichas={fichas} ir={ir} />
      <TarjetaIngresos dias={dias} dineroMes={r.dinero_mes_centavos} />

      <div className="card b-card b-mov">
        <div className="mov">
          <Lista titulo="Llegan hoy" icono="llega" items={r.llegadas_hoy} vacio="Nadie llega hoy" />
          <Lista titulo="Salen hoy" icono="sale" items={r.salidas_hoy} vacio="Nadie sale hoy" />
        </div>
      </div>

      <button type="button" className="card b-card tarjeta tarjeta--insumos b-insumos" onClick={() => ir('inventario')}>
        <span className="card__titulo">Se está acabando</span>
        {r.insumos_bajos.length === 0 ? (
          <span className="tarjeta__ok">
            <Icon name="libre" /> Los insumos están bien
          </span>
        ) : (
          <ul className="bajos">
            {r.insumos_bajos.slice(0, 4).map((p) => {
              const n = nivelStock(p.stock, p.minimo, p.unidad);
              return (
                <li key={p.producto_id}>
                  <span className="bajos__fila">
                    <b>{p.nombre}</b>
                    <span className={`insumo__frase n-${n.nivel}`}>{n.frase}</span>
                  </span>
                  <BarraStock nivel={n.nivel} pct={n.pct} />
                </li>
              );
            })}
          </ul>
        )}
        <span className="card__pie">
          {r.insumos_bajos.length > 4 ? `Ver los ${r.insumos_bajos.length}` : 'Ver los insumos'} <Icon name="siguiente" size="sm" />
        </span>
      </button>

      <div className="card b-card tarjeta tarjeta--grafico b-ocup">
        <h2 className="card__titulo">Cuartos ocupados por día</h2>
        <p className="grafico__sub">Últimos 30 días</p>
        {hayDatos ? (
          <GraficoOcupacion serie={serie} />
        ) : (
          <Aviso icono="cuartos" titulo="Aún no hay estadías en estos días" texto="Cuando haya reservas con check-in, aquí verás cómo se fue llenando el hotel." accion={{ texto: 'Ver los cuartos', onClick: () => ir('cuartos') }} />
        )}
      </div>

      <div className="card b-card tarjeta tarjeta--grafico tarjeta--canales b-canales">
        <h2 className="card__titulo">Ingresos por canal</h2>
        <p className="grafico__sub">Últimos 30 días</p>
        {hayDatos ? <GraficoCanales serie={serie} /> : <p className="tarjeta__linea">Todavía no hay ingresos que mostrar.</p>}
      </div>
    </div>
    {abierto && <HojaCuarto cuarto={abierto} onCerrar={() => abrirCuarto(null)} />}
    </>
  );
}

function Lista({ titulo, icono, items, vacio }: { titulo: string; icono: 'llega' | 'sale'; items: Movimiento[]; vacio: string }) {
  return (
    <div className="mov__col">
      <h2 className="mov__titulo">
        <Icon name={icono} size="sm" />
        {titulo}
        <span className="mov__n">{items.length}</span>
      </h2>
      {items.length === 0 ? (
        <p className="mov__vacio">{vacio}</p>
      ) : (
        <ul>
          {items.map((m) => (
            <li key={m.reserva_id}>
              <span className="mov__cuarto">{m.habitacion}</span>
              <span className="mov__quien">{m.huesped ?? 'Sin nombre'}</span>
              {m.personas != null && <span className="mov__pers">{m.personas} pers.</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function InicioSkeleton() {
  return (
    <div className="inicio bento" aria-busy="true" aria-label="Cargando el resumen">
      <Skeleton h="13rem" r="22px" />
      <Skeleton h="28rem" r="22px" />
      <Skeleton h="15rem" r="22px" />
      <Skeleton h="15rem" r="22px" />
      <Skeleton h="15rem" r="22px" />
    </div>
  );
}

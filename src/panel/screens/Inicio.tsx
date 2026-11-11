import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Database } from '../../lib/database.types';
import { usePerfil } from '../data/sesion';
import { useCuartos } from '../data/cuartos';
import { dinero, fechaCorta, hoyEC, saludo } from '../lib/format';
import { nivelStock } from '../lib/stock';
import type { Pagina } from '../nav';
import { Aviso, BarraStock, Contador, ErrorCarga, Skeleton } from '../ui/kit';
import { Icon } from '../ui/Icon';
import { GraficoOcupacion, GraficoCanales } from './graficos';

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

  const hoy = hoyEC();
  const primer = nombre.split(' ')[0];

  return (
    <section className="pantalla pantalla--inicio">
      <header className="pantalla__cab">
        <div>
          <h1>
            {saludo()}, {primer}
          </h1>
          <p className="pantalla__sub">{fechaCorta(hoy)} · así está el hotel ahora</p>
        </div>
      </header>

      {error ? (
        <ErrorCarga onReintentar={() => void cargar()} />
      ) : !resumen || !serie ? (
        <InicioSkeleton />
      ) : (
        <InicioDatos r={resumen} serie={serie} ir={ir} />
      )}
    </section>
  );
}

function InicioDatos({ r, serie, ir }: { r: Resumen; serie: FilaIngreso[]; ir: (p: Pagina) => void }) {
  const libres = Math.max(0, r.cuartos - r.ocupados - r.por_limpiar - r.limpiando - r.en_arreglo);
  const hayDatos = useMemo(() => serie.some((f) => f.cuartos_ocupados > 0 || f.ingresos_centavos > 0), [serie]);
  return (
    <div className="inicio">
      <div className="card kpis">
        <button type="button" className="kpi" onClick={() => ir('cuartos')}>
          <span className="card__titulo">Ocupación de hoy</span>
          <span className="tarjeta__cifra">
            <Contador valor={r.ocupados} />
            <span className="tarjeta__de">de {r.cuartos} cuartos</span>
          </span>
          <span className="ocupacion__barra" aria-hidden="true">
            <i style={{ ['--pct' as string]: r.cuartos ? r.ocupados / r.cuartos : 0 }} />
          </span>
          <span className="kpi__fila">
            <span className="tarjeta__linea">
              {Math.round(r.ocupacion_pct)} % ocupado · {libres} {libres === 1 ? 'libre' : 'libres'}
            </span>
            <span className="kpi__ir">
              <span className="kpi__txt">Ver los cuartos</span> <Icon name="siguiente" size="sm" />
            </span>
          </span>
        </button>

        <button type="button" className="kpi" onClick={() => ir('limpieza')}>
          <span className="card__titulo">Por limpiar</span>
          <span className="tarjeta__cifra">
            <Contador valor={r.por_limpiar} />
            <span className="tarjeta__de">{r.limpiando ? `${r.limpiando} limpiando ahora` : r.por_limpiar ? 'esperando' : 'todo limpio'}</span>
          </span>
          <span className="kpi__fila">
            <span className="tarjeta__linea" />
            <span className="kpi__ir">
              <span className="kpi__txt">Ver limpieza</span> <Icon name="siguiente" size="sm" />
            </span>
          </span>
        </button>

        <div className="kpi">
          <span className="card__titulo">Dinero del mes</span>
          <span className="tarjeta__cifra">
            <Contador valor={r.dinero_mes_centavos} formato={(n) => dinero(Math.round(n / 100) * 100)} />
          </span>
          <span className="tarjeta__linea">Pagos y consumos cobrados</span>
        </div>
      </div>

      <div className="card tarjeta tarjeta--mov">
        <div className="mov">
          <Lista titulo="Llegan hoy" icono="llega" items={r.llegadas_hoy} vacio="Nadie llega hoy" />
          <Lista titulo="Salen hoy" icono="sale" items={r.salidas_hoy} vacio="Nadie sale hoy" />
        </div>
      </div>

      <button type="button" className="card tarjeta tarjeta--insumos" onClick={() => ir('inventario')}>
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

      <div className="card tarjeta tarjeta--grafico">
        <h2 className="card__titulo">Cuartos ocupados por día</h2>
        <p className="grafico__sub">Últimos 30 días</p>
        {hayDatos ? (
          <GraficoOcupacion serie={serie} />
        ) : (
          <Aviso icono="cuartos" titulo="Aún no hay estadías en estos días" texto="Cuando haya reservas con check-in, aquí verás cómo se fue llenando el hotel." accion={{ texto: 'Ver los cuartos', onClick: () => ir('cuartos') }} />
        )}
      </div>

      <div className="card tarjeta tarjeta--grafico tarjeta--canales">
        <h2 className="card__titulo">Ingresos por canal</h2>
        <p className="grafico__sub">Últimos 30 días</p>
        {hayDatos ? <GraficoCanales serie={serie} /> : <p className="tarjeta__linea">Todavía no hay ingresos que mostrar.</p>}
      </div>
    </div>
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
    <div className="inicio" aria-busy="true" aria-label="Cargando el resumen">
      <Skeleton h="12rem" r="20px" />
      <Skeleton h="12rem" r="20px" />
      <Skeleton h="9rem" r="20px" />
      <Skeleton h="12rem" r="20px" />
      <Skeleton h="14rem" r="20px" />
      <Skeleton h="14rem" r="20px" />
    </div>
  );
}

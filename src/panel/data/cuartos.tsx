import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { supabase } from '../../lib/supabase';
import type { Tables } from '../../lib/database.types';
import { usePerfil } from './sesion';
import { hoyEC } from '../lib/format';
import type { Estado } from '../lib/estados';

export interface Cuarto {
  id: string;
  numero: string;
  piso: number;
  estado: Estado;
  estadoDesde: string;
  tipo: string;
  maxPersonas: number;
}

export interface ReservaCuarto {
  id: string;
  codigo: string;
  habitacionId: string;
  estado: 'confirmada' | 'en_curso';
  entrada: string;
  salida: string;
  personas: number;
  huesped: string | null;
}

interface CuartosCtx {
  cuartos: Cuarto[];
  /** Reserva en curso por cuarto (solo recepción y dueña). */
  enCurso: Map<string, ReservaCuarto>;
  /** Reserva confirmada que llega hoy por cuarto. */
  llegaHoy: Map<string, ReservaCuarto>;
  pulsos: ReadonlySet<string>;
  /** Sube con cada cambio en vivo: las pantallas que piden datos aparte se refrescan con él. */
  tick: number;
  cargando: boolean;
  error: boolean;
  recargar: () => void;
  /** Vuelve a pedir las reservas sin mostrar skeleton. */
  refrescar: () => Promise<void>;
  /** Cambio optimista. Devuelve la función que lo revierte. */
  cambiarLocal: (id: string, estado: Estado) => () => void;
  cuartoAbierto: string | null;
  abrirCuarto: (id: string | null) => void;
}

const Ctx = createContext<CuartosCtx | null>(null);

export function CuartosProvider({ children }: { children: ReactNode }) {
  const { hotelId, rol } = usePerfil();
  const gestiona = rol !== 'limpieza';
  const [cuartos, setCuartos] = useState<Cuarto[]>([]);
  const [reservas, setReservas] = useState<ReservaCuarto[]>([]);
  const [pulsos, setPulsos] = useState<ReadonlySet<string>>(new Set());
  const [tick, setTick] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);
  const [cuartoAbierto, abrirCuarto] = useState<string | null>(null);
  const tipos = useRef(new Map<string, { nombre: string; max: number }>());
  const [intento, setIntento] = useState(0);

  const cargarReservas = useCallback(async () => {
    if (!gestiona) return;
    const hoy = hoyEC();
    const { data } = await supabase
      .from('reservas')
      .select('id, codigo, habitacion_id, estado, entrada, salida, personas, huesped_id')
      .eq('hotel_id', hotelId)
      .in('estado', ['en_curso', 'confirmada'])
      .gte('salida', hoy)
      .lte('entrada', hoy);
    const filas = data ?? [];
    const ids = [...new Set(filas.map((r) => r.huesped_id).filter((x): x is string => !!x))];
    const nombres = new Map<string, string>();
    if (ids.length) {
      const { data: hs } = await supabase.from('huespedes').select('id, nombre').in('id', ids);
      hs?.forEach((h) => nombres.set(h.id, h.nombre));
    }
    setReservas(
      filas
        .filter((r): r is typeof r & { estado: 'en_curso' | 'confirmada' } => r.estado === 'en_curso' || r.estado === 'confirmada')
        .map((r) => ({
          id: r.id,
          codigo: r.codigo,
          habitacionId: r.habitacion_id,
          estado: r.estado,
          entrada: r.entrada,
          salida: r.salida,
          personas: r.personas,
          huesped: r.huesped_id ? (nombres.get(r.huesped_id) ?? null) : null,
        })),
    );
  }, [gestiona, hotelId]);

  // Carga inicial
  useEffect(() => {
    let vivo = true;
    setCargando(true);
    setError(false);
    void (async () => {
      const [h, t] = await Promise.all([
        supabase.from('habitaciones').select('id, numero, piso, estado, estado_desde, tipo_id').eq('hotel_id', hotelId).eq('activa', true),
        supabase.from('tipos_habitacion').select('id, nombre, max_personas').eq('hotel_id', hotelId),
      ]);
      if (!vivo) return;
      if (h.error || t.error) {
        setError(true);
        setCargando(false);
        return;
      }
      tipos.current = new Map((t.data ?? []).map((x) => [x.id, { nombre: x.nombre, max: x.max_personas }]));
      setCuartos(
        (h.data ?? [])
          .map((x) => ({
            id: x.id,
            numero: x.numero,
            piso: x.piso,
            estado: x.estado,
            estadoDesde: x.estado_desde,
            tipo: tipos.current.get(x.tipo_id)?.nombre ?? '',
            maxPersonas: tipos.current.get(x.tipo_id)?.max ?? 0,
          }))
          .sort((a, b) => a.numero.localeCompare(b.numero, 'es', { numeric: true })),
      );
      await cargarReservas().catch(() => undefined);
      if (vivo) setCargando(false);
    })().catch(() => {
      if (vivo) {
        setError(true);
        setCargando(false);
      }
    });
    return () => {
      vivo = false;
    };
  }, [hotelId, cargarReservas, intento]);

  const pulsar = useCallback((id: string) => {
    setPulsos((s) => new Set(s).add(id));
    window.setTimeout(
      () =>
        setPulsos((s) => {
          const n = new Set(s);
          n.delete(id);
          return n;
        }),
      900,
    );
  }, []);

  // Realtime: habitaciones y reservas
  useEffect(() => {
    const canal = supabase
      .channel(`cuartos-${hotelId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'habitaciones' }, (p) => {
        const fila = p.new as Partial<Tables<'habitaciones'>>;
        if (!fila.id || !fila.estado) return;
        const { id, estado, estado_desde } = fila;
        setCuartos((l) => {
          const actual = l.find((c) => c.id === id);
          if (!actual) return l;
          if (actual.estado !== estado) pulsar(id);
          return l.map((c) => (c.id === id ? { ...c, estado: estado, estadoDesde: estado_desde ?? c.estadoDesde } : c));
        });
        setTick((n) => n + 1);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservas' }, () => {
        void cargarReservas().then(() => setTick((n) => n + 1));
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(canal);
    };
  }, [hotelId, cargarReservas, pulsar]);

  const cambiarLocal = useCallback(
    (id: string, estado: Estado) => {
      let previo: Cuarto | undefined;
      setCuartos((l) =>
        l.map((c) => {
          if (c.id !== id) return c;
          previo = c;
          return { ...c, estado, estadoDesde: new Date().toISOString() };
        }),
      );
      pulsar(id);
      return () => {
        if (previo) {
          const p = previo;
          setCuartos((l) => l.map((c) => (c.id === id ? p : c)));
        }
      };
    },
    [pulsar],
  );

  const valor = useMemo<CuartosCtx>(() => {
    const enCurso = new Map<string, ReservaCuarto>();
    const llegaHoy = new Map<string, ReservaCuarto>();
    for (const r of reservas) (r.estado === 'en_curso' ? enCurso : llegaHoy).set(r.habitacionId, r);
    return {
      cuartos,
      enCurso,
      llegaHoy,
      pulsos,
      tick,
      cargando,
      error,
      recargar: () => setIntento((n) => n + 1),
      refrescar: cargarReservas,
      cambiarLocal,
      cuartoAbierto,
      abrirCuarto,
    };
  }, [cuartos, reservas, pulsos, tick, cargando, error, cambiarLocal, cuartoAbierto, cargarReservas]);

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useCuartos(): CuartosCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useCuartos fuera de CuartosProvider');
  return c;
}

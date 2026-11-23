import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Enums } from '../../lib/database.types';
import { usePerfil } from './sesion';
import { mensajeError } from '../lib/errores';
import { canalDe, sumarDias, type EstadoReserva, type Fuente } from '../screens/reservas/logica';
import type { Rango } from '../screens/config/logica';
import { cargarTemporadas } from './config';

export interface ReservaVista {
  id: string;
  codigo: string;
  habitacionId: string;
  huespedId: string | null;
  huesped: string | null;
  entrada: string;
  salida: string;
  personas: number;
  mascota: boolean;
  estado: EstadoReserva;
  fuente: Fuente;
  canal: Enums<'canal_venta'>;
  total: number | null;
  venceEn: string | null;
  notas: string | null;
}

export interface HuespedFila {
  id: string;
  nombre: string;
  documento: string | null;
  telefono: string | null;
  procedencia: string | null;
}

const COLS =
  'id, codigo, habitacion_id, huesped_id, entrada, salida, personas, mascota, estado, fuente, canal, total_centavos, vence_en, notas';

interface FilaReserva {
  id: string;
  codigo: string;
  habitacion_id: string;
  huesped_id: string | null;
  entrada: string;
  salida: string;
  personas: number;
  mascota: boolean;
  estado: EstadoReserva;
  fuente: Fuente;
  canal: Enums<'canal_venta'>;
  total_centavos: number | null;
  vence_en: string | null;
  notas: string | null;
}

const aVista = (r: FilaReserva, nombres: Map<string, string>): ReservaVista => ({
  id: r.id,
  codigo: r.codigo,
  habitacionId: r.habitacion_id,
  huespedId: r.huesped_id,
  huesped: r.huesped_id ? (nombres.get(r.huesped_id) ?? null) : null,
  entrada: r.entrada,
  salida: r.salida,
  personas: r.personas,
  mascota: r.mascota,
  estado: r.estado,
  fuente: r.fuente,
  canal: r.canal,
  total: r.total_centavos,
  venceEn: r.vence_en,
  notas: r.notas,
});

async function nombresDe(filas: FilaReserva[]): Promise<Map<string, string>> {
  const ids = [...new Set(filas.map((r) => r.huesped_id).filter((x): x is string => !!x))];
  const m = new Map<string, string>();
  if (ids.length) {
    const { data } = await supabase.from('huespedes').select('id, nombre').in('id', ids);
    data?.forEach((h) => m.set(h.id, h.nombre));
  }
  return m;
}

/** Rangos de temporada alta (solo para pintar el fondo del calendario; si falla, no se pinta). */
export function useTemporadaAlta(): Rango[] {
  const { hotelId } = usePerfil();
  const [rangos, setRangos] = useState<Rango[]>([]);
  useEffect(() => {
    let vivo = true;
    cargarTemporadas(hotelId)
      .then((t) => vivo && setRangos(t.filter((x) => !x.esBase).flatMap((x) => x.rangos)))
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [hotelId]);
  return rangos;
}

/** Reservas que tocan la ventana [desde, desde + dias). Se actualiza solo (Realtime). */
export function useReservas(desde: string, dias: number) {
  const { hotelId } = usePerfil();
  const [reservas, setReservas] = useState<ReservaVista[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);
  const [pulsos, setPulsos] = useState<ReadonlySet<string>>(new Set());
  const [intento, setIntento] = useState(0);
  const ventana = useRef({ desde, dias });
  ventana.current = { desde, dias };

  const cargar = useCallback(async () => {
    const { desde: d, dias: n } = ventana.current;
    const { data, error: err } = await supabase
      .from('reservas')
      .select(COLS)
      .eq('hotel_id', hotelId)
      .neq('estado', 'cancelada')
      .lt('entrada', sumarDias(d, n))
      .gte('salida', d) // la que sale la mañana del primer día también se ve (media barra)
      .order('entrada');
    if (err) throw err;
    const filas = (data ?? []) as FilaReserva[];
    const nombres = await nombresDe(filas);
    setReservas(filas.map((r) => aVista(r, nombres)));
  }, [hotelId]);

  useEffect(() => {
    let vivo = true;
    setError(false); // sin skeleton al cambiar de semana: se queda lo que había hasta que llegue lo nuevo
    cargar()
      .catch(() => vivo && setError(true))
      .finally(() => vivo && setCargando(false));
    return () => {
      vivo = false;
    };
  }, [cargar, desde, dias, intento]);

  useEffect(() => {
    let espera = 0;
    const canal = supabase
      .channel(`reservas-${hotelId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservas' }, (p) => {
        const id = (p.new as { id?: string }).id;
        if (id) {
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
        }
        window.clearTimeout(espera);
        espera = window.setTimeout(() => void cargar().catch(() => undefined), 150);
      })
      .subscribe();
    return () => {
      window.clearTimeout(espera);
      void supabase.removeChannel(canal);
    };
  }, [hotelId, cargar]);

  /** Cambio optimista. Devuelve la función que lo revierte. */
  const parchar = useCallback((id: string, patch: Partial<ReservaVista>) => {
    let previo: ReservaVista | undefined;
    setReservas((l) =>
      l.map((r) => {
        if (r.id !== id) return r;
        previo = r;
        return { ...r, ...patch };
      }),
    );
    return () => {
      const p = previo;
      if (p) setReservas((l) => l.map((r) => (r.id === id ? p : r)));
    };
  }, []);

  return {
    reservas,
    cargando,
    error,
    pulsos,
    parchar,
    recargar: () => setIntento((n) => n + 1),
    refrescar: () => cargar().catch(() => undefined),
  };
}

/* ---------- Operaciones (devuelven el mensaje humano si fallan) ---------- */
export type Resultado<T = void> = { ok: true; valor: T } | { ok: false; mensaje: string };
const bien = <T,>(valor: T): Resultado<T> => ({ ok: true, valor });
const mal = (e: { message: string; code?: string } | null): Resultado<never> => ({ ok: false, mensaje: mensajeError(e) });

export interface NuevoHuesped {
  nombre: string;
  documento: string;
  telefono: string;
  procedencia: string;
}

export interface NuevaReserva {
  habitacionId: string;
  entrada: string;
  salida: string;
  personas: number;
  mascota: boolean;
  fuente: Fuente;
  /** 'prereserva' aparta 2 h; 'confirmada' ya está pagada o viene de Booking/Airbnb. */
  estado: 'prereserva' | 'confirmada';
  notas: string;
  huespedId: string | null;
  huespedNuevo: NuevoHuesped | null;
}

export function useOperaciones() {
  const { hotelId } = usePerfil();
  return useRef({
    async buscarHuespedes(q: string): Promise<Resultado<HuespedFila[]>> {
      const texto = q.trim().replace(/[,()%*]/g, ' ');
      const digitos = texto.replace(/\D/g, '');
      let consulta = supabase
        .from('huespedes')
        .select('id, nombre, documento, telefono, procedencia')
        .eq('hotel_id', hotelId)
        .order('creado_en', { ascending: false })
        .limit(12);
      if (texto) {
        // 0991234567 se guarda como +593991234567: se busca sin el cero inicial.
        const tel = digitos.length >= 4 ? digitos.replace(/^0/, '') : '';
        consulta = consulta.or(
          [`nombre.ilike.%${texto}%`, tel ? `telefono.ilike.%${tel}%` : '', `documento.ilike.%${texto}%`].filter(Boolean).join(','),
        );
      }
      const { data, error } = await consulta;
      return error ? mal(error) : bien(data ?? []);
    },

    async crear(n: NuevaReserva): Promise<Resultado<{ id: string; total: number | null; codigo: string }>> {
      let huespedId = n.huespedId;
      if (!huespedId && n.huespedNuevo) {
        const h = n.huespedNuevo;
        const { data, error } = await supabase
          .from('huespedes')
          .insert({
            hotel_id: hotelId,
            nombre: h.nombre.trim(),
            documento: h.documento.trim() || null,
            telefono: h.telefono.trim() || null,
            procedencia: h.procedencia.trim() || null,
          })
          .select('id')
          .single();
        if (error) return mal(error);
        huespedId = data.id;
      }
      const { data, error } = await supabase
        .from('reservas')
        .insert({
          hotel_id: hotelId,
          habitacion_id: n.habitacionId,
          huesped_id: huespedId,
          entrada: n.entrada,
          salida: n.salida,
          personas: n.personas,
          mascota: n.mascota,
          fuente: n.fuente,
          canal: canalDe(n.fuente),
          estado: n.estado,
          notas: n.notas.trim() || null,
        })
        .select('id, codigo, total_centavos')
        .single();
      return error ? mal(error) : bien({ id: data.id, total: data.total_centavos, codigo: data.codigo });
    },

    async mover(id: string, c: { entrada: string; salida: string; habitacionId: string }): Promise<Resultado> {
      const { error } = await supabase
        .from('reservas')
        .update({ entrada: c.entrada, salida: c.salida, habitacion_id: c.habitacionId })
        .eq('id', id);
      return error ? mal(error) : bien(undefined);
    },

    async editar(id: string, c: { personas: number; mascota: boolean; notas: string }): Promise<Resultado> {
      const { error } = await supabase
        .from('reservas')
        .update({ personas: c.personas, mascota: c.mascota, notas: c.notas.trim() || null })
        .eq('id', id);
      return error ? mal(error) : bien(undefined);
    },

    async cancelar(id: string, motivo: string): Promise<Resultado> {
      const { error } = await supabase.rpc('cancelar_reserva', { p_reserva: id, p_motivo: motivo.trim() || undefined });
      return error ? mal(error) : bien(undefined);
    },

    async pagar(id: string, centavos: number, medio: Enums<'medio_pago'>, foto: File | null): Promise<Resultado<{ fotoFallo: boolean }>> {
      let ruta: string | undefined;
      let fotoFallo = false;
      if (foto) {
        const ext = foto.type === 'image/png' ? 'png' : foto.type === 'application/pdf' ? 'pdf' : 'jpg';
        const r = `${hotelId}/comprobantes/${crypto.randomUUID()}.${ext}`;
        const { error: up } = await supabase.storage.from('hotel').upload(r, foto, { contentType: foto.type });
        if (up) fotoFallo = true;
        else ruta = r;
      }
      const { error } = await supabase.rpc('registrar_pago', {
        p_reserva: id,
        p_monto_centavos: centavos,
        p_medio: medio,
        p_comprobante_path: ruta,
      });
      return error ? mal(error) : bien({ fotoFallo });
    },

    async estancias(huespedId: string): Promise<Resultado<{ id: string; codigo: string; numero: string; entrada: string; salida: string; estado: EstadoReserva; total: number | null }[]>> {
      const { data, error } = await supabase
        .from('reservas')
        .select('id, codigo, entrada, salida, estado, total_centavos, habitaciones(numero)')
        .eq('hotel_id', hotelId)
        .eq('huesped_id', huespedId)
        .order('entrada', { ascending: false })
        .limit(30);
      if (error) return mal(error);
      return bien(
        (data ?? []).map((r) => ({
          id: r.id,
          codigo: r.codigo,
          numero: (r.habitaciones as { numero: string } | null)?.numero ?? '',
          entrada: r.entrada,
          salida: r.salida,
          estado: r.estado,
          total: r.total_centavos,
        })),
      );
    },

    async anticipoPorcentaje(): Promise<number> {
      const { data } = await supabase.from('hoteles').select('reglas').eq('id', hotelId).maybeSingle();
      const p = (data?.reglas as { anticipo?: { porcentaje?: number } } | null)?.anticipo?.porcentaje;
      return typeof p === 'number' && p > 0 && p <= 100 ? p : 50;
    },

    async reserva(id: string): Promise<Resultado<ReservaVista | null>> {
      const { data, error } = await supabase.from('reservas').select(COLS).eq('id', id).maybeSingle();
      if (error) return mal(error);
      if (!data) return bien(null);
      return bien(aVista(data as FilaReserva, await nombresDe([data as FilaReserva])));
    },
  }).current;
}

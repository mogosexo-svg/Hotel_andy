import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Database } from '../../lib/database.types';
import { usePerfil } from './sesion';
import { mensajeError } from '../lib/errores';
import { hoyEC } from '../lib/format';
import type { Candidata } from '../screens/comprobantes/logica';

export type Pendiente = Database['public']['Functions']['comprobantes_pendientes']['Returns'][number];
export type Resultado = { ok: true } | { ok: false; mensaje: string };

/** Comprobantes por revisar, los más viejos primero. Se actualiza solo (Realtime). */
export function useComprobantes(activo: boolean) {
  const { hotelId } = usePerfil();
  const [lista, setLista] = useState<Pendiente[]>([]);
  const [cargando, setCargando] = useState(activo);
  const [error, setError] = useState(false);
  const [intento, setIntento] = useState(0);

  const cargar = useCallback(async () => {
    const { data, error: err } = await supabase.rpc('comprobantes_pendientes', { p_hotel: hotelId });
    if (err) throw err;
    setLista(data ?? []);
    setError(false);
  }, [hotelId]);

  useEffect(() => {
    if (!activo) return;
    let vivo = true;
    cargar()
      .catch(() => vivo && setError(true))
      .finally(() => vivo && setCargando(false));
    return () => {
      vivo = false;
    };
  }, [activo, cargar, intento]);

  useEffect(() => {
    if (!activo) return;
    let espera = 0;
    const canal = supabase
      .channel(`comprobantes-${hotelId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comprobantes' }, () => {
        window.clearTimeout(espera);
        espera = window.setTimeout(() => void cargar().catch(() => undefined), 150);
      })
      .subscribe();
    return () => {
      window.clearTimeout(espera);
      void supabase.removeChannel(canal);
    };
  }, [activo, hotelId, cargar]);

  return useMemo(
    () => ({ lista, cargando, error, recargar: () => setIntento((n) => n + 1), refrescar: () => cargar().catch(() => undefined) }),
    [lista, cargando, error, cargar],
  );
}

const resultado = (e: { message: string; code?: string } | null): Resultado => (e ? { ok: false, mensaje: mensajeError(e) } : { ok: true });

export const aceptarComprobante = async (id: string, centavos: number) =>
  resultado((await supabase.rpc('aceptar_comprobante', { p_comprobante: id, p_monto_centavos: centavos })).error);
export const rechazarComprobante = async (id: string, motivo: string) =>
  resultado((await supabase.rpc('rechazar_comprobante', { p_comprobante: id, p_motivo: motivo })).error);
export const asociarComprobante = async (id: string, reserva: string) =>
  resultado((await supabase.rpc('asociar_comprobante', { p_comprobante: id, p_reserva: reserva })).error);

/** Pre-reservas y reservas vigentes, para asociar un comprobante. null si falla. */
export async function cargarCandidatas(hotelId: string, numeros: Map<string, string>): Promise<Candidata[] | null> {
  const { data, error } = await supabase
    .from('reservas')
    .select('id, codigo, habitacion_id, huesped_id')
    .eq('hotel_id', hotelId)
    .in('estado', ['prereserva', 'confirmada', 'en_curso'])
    .gte('salida', hoyEC())
    .order('entrada')
    .limit(300);
  if (error) return null;
  const ids = [...new Set((data ?? []).map((r) => r.huesped_id).filter((x): x is string => !!x))];
  const hs = new Map<string, { nombre: string; telefono: string | null }>();
  if (ids.length) {
    const { data: g } = await supabase.from('huespedes').select('id, nombre, telefono').in('id', ids);
    g?.forEach((h) => hs.set(h.id, h));
  }
  return (data ?? []).map((r) => {
    const h = r.huesped_id ? hs.get(r.huesped_id) : undefined;
    return { id: r.id, codigo: r.codigo, huesped: h?.nombre ?? null, telefono: h?.telefono ?? null, cuarto: numeros.get(r.habitacion_id) ?? '' };
  });
}

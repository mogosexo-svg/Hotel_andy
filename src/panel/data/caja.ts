import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Database } from '../../lib/database.types';
import { usePerfil } from './sesion';
import { mensajeError } from '../lib/errores';

export type Cierre = Database['public']['Tables']['cierres_caja']['Row'];
export interface Movimiento {
  hora: string;
  concepto: string;
  medio: string;
  monto_centavos: number;
}
export interface ResumenCaja {
  fecha: string;
  turno: 'tarde' | 'noche';
  hora: string;
  cerrado: boolean;
  desde: string;
  hasta: string;
  efectivo_centavos: number;
  transferencia_centavos: number;
  total_centavos: number;
  movimientos: Movimiento[];
  /** Usos y ventas anotados desde el último cierre. */
  salidas_registradas?: number;
}
export type AlertaCaja = { id: string; mensaje: string; caja_turno: string | null };

/** Ejecuta `fn` con un respiro: varios cambios seguidos en la base piden una sola carga. */
function useRespiro(fn: () => void, ms = 150) {
  const espera = useRef(0);
  useEffect(() => () => window.clearTimeout(espera.current), []);
  return useCallback(() => {
    window.clearTimeout(espera.current);
    espera.current = window.setTimeout(fn, ms);
  }, [fn, ms]);
}

/** Lo que va entrando a caja y los últimos cierres. Se actualiza solo con pagos, consumos y cierres. */
export function useCaja() {
  const { hotelId } = usePerfil();
  const [resumen, setResumen] = useState<ResumenCaja | null>(null);
  const [cierres, setCierres] = useState<Cierre[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);
  const [intento, setIntento] = useState(0);

  const cargar = useCallback(async () => {
    const [r, c] = await Promise.all([
      supabase.rpc('resumen_caja', { p_hotel: hotelId }),
      supabase.from('cierres_caja').select('*').eq('hotel_id', hotelId).order('cerrado_en', { ascending: false }).limit(10),
    ]);
    if (r.error || c.error) throw r.error ?? c.error;
    setResumen(r.data as unknown as ResumenCaja);
    setCierres(c.data ?? []);
    setError(false);
  }, [hotelId]);

  useEffect(() => {
    let vivo = true;
    cargar()
      .catch(() => vivo && setError(true))
      .finally(() => vivo && setCargando(false));
    return () => {
      vivo = false;
    };
  }, [cargar, intento]);

  const refrescar = useCallback(() => void cargar().catch(() => undefined), [cargar]);
  const respirar = useRespiro(refrescar);
  useEffect(() => {
    const canal = supabase.channel(`caja-${hotelId}`);
    for (const table of ['pagos', 'consumos', 'cierres_caja']) canal.on('postgres_changes', { event: '*', schema: 'public', table }, respirar);
    canal.subscribe();
    return () => {
      void supabase.removeChannel(canal);
    };
  }, [hotelId, respirar]);

  return useMemo(() => ({ resumen, cierres, cargando, error, recargar: () => setIntento((n) => n + 1), refrescar }), [resumen, cierres, cargando, error, refrescar]);
}

export type ResultadoCierre = { ok: true; cierre: Cierre } | { ok: false; mensaje: string };

export async function cerrarCaja(hotelId: string, turno: string, contado: number, nota: string): Promise<ResultadoCierre> {
  const { data, error } = await supabase.rpc('cerrar_caja', { p_hotel: hotelId, p_turno: turno, p_efectivo_contado_centavos: contado, p_nota: nota.trim() || undefined });
  return error ? { ok: false, mensaje: mensajeError(error) } : { ok: true, cierre: data as unknown as Cierre };
}

const permiso = () => (typeof Notification === 'undefined' ? 'unsupported' : Notification.permission);
export const permisoAvisos = permiso;

/** Pide permiso para las notificaciones del navegador (solo desde un toque de la persona). */
export async function pedirPermisoAvisos(): Promise<string> {
  if (typeof Notification === 'undefined') return 'unsupported';
  try {
    return await Notification.requestPermission();
  } catch {
    return 'denied';
  }
}

/** Alertas `cierre_caja` abiertas. Si llega una nueva y hay permiso, además avisa con una notificación del sistema. */
export function useAlertaCaja(activo: boolean) {
  const { hotelId } = usePerfil();
  const [lista, setLista] = useState<AlertaCaja[]>([]);

  const cargar = useCallback(async () => {
    const { data } = await supabase.from('alertas').select('id, mensaje, caja_turno').eq('hotel_id', hotelId).eq('tipo', 'cierre_caja').is('resuelta_en', null);
    setLista(data ?? []);
  }, [hotelId]);
  const refrescar = useCallback(() => void cargar().catch(() => undefined), [cargar]);
  const respirar = useRespiro(refrescar);

  useEffect(() => {
    if (!activo) return;
    refrescar();
    const canal = supabase
      .channel(`alerta-caja-${hotelId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alertas' }, (p) => {
        respirar();
        const nueva = p.new as { tipo?: string; mensaje?: string };
        if (p.eventType === 'INSERT' && nueva.tipo === 'cierre_caja' && permiso() === 'granted') {
          try {
            new Notification('Hotel Andy', { body: nueva.mensaje || 'Toca el cierre de caja', tag: 'cierre-caja' });
          } catch {
            // Algunos móviles no dejan crear notificaciones desde la página: el aviso de la campana queda igual.
          }
        }
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(canal);
    };
  }, [activo, hotelId, refrescar, respirar]);

  return lista;
}

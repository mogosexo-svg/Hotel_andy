import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Database } from '../../lib/database.types';
import { leerMultirango, type Hotel, type Rango } from '../screens/config/logica';

type Canal = Database['public']['Enums']['canal_venta'];
type Rol = Database['public']['Enums']['rol_usuario'];
type KitPor = Database['public']['Enums']['kit_por'];

/** Las llamadas de Configuración lanzan el error de la base tal cual; la pantalla lo traduce. */
function ver<T>(r: { data: T; error: { message: string; code?: string } | null }): NonNullable<T> {
  if (r.error) throw r.error;
  return r.data as NonNullable<T>;
}
const sinError = (r: { error: { message: string; code?: string } | null }) => {
  if (r.error) throw r.error;
};

/** Carga una vez, permite recargar y distingue "cargando" de "error". */
export function useCarga<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [datos, setDatos] = useState<T | null>(null);
  const [error, setError] = useState(false);
  const vivo = useRef(true);
  useEffect(() => () => void (vivo.current = false), []);
  const cargar = useCallback(async () => {
    try {
      const d = await fn();
      if (vivo.current) {
        setDatos(d);
        setError(false);
      }
    } catch {
      if (vivo.current) setError(true);
    }
  }, deps);
  useEffect(() => {
    void cargar();
  }, [cargar]);
  const reintentar = useCallback(() => {
    setError(false);
    setDatos(null);
    void cargar();
  }, [cargar]);
  return { datos, error, recargar: cargar, reintentar };
}

/* ───────────── Precios ───────────── */
export interface TipoCuarto {
  id: string;
  nombre: string;
  maxPersonas: number;
}
export interface Temporada {
  id: string;
  esBase: boolean;
  nombre: string;
  rangos: Rango[];
}
export interface Tarifa {
  id: string;
  tipoId: string;
  canal: Canal;
  temporadaId: string | null;
  centavos: number;
}

export async function cargarTipos(hotelId: string): Promise<TipoCuarto[]> {
  const d = ver(await supabase.from('tipos_habitacion').select('id, nombre, max_personas').eq('hotel_id', hotelId).order('orden'));
  return d.map((t) => ({
    id: t.id,
    nombre: t.nombre,
    maxPersonas: t.max_personas,
  }));
}

export async function cargarTemporadas(hotelId: string): Promise<Temporada[]> {
  const d = ver(await supabase.from('temporadas').select('id, nombre, es_base, fechas').eq('hotel_id', hotelId));
  return d.map((t) => ({
    id: t.id,
    esBase: t.es_base,
    nombre: t.nombre,
    rangos: leerMultirango(t.fechas),
  }));
}

export async function cargarPrecios(hotelId: string) {
  const [tipos, temporadas, tarifas] = await Promise.all([
    cargarTipos(hotelId),
    cargarTemporadas(hotelId),
    supabase.from('tarifas').select('id, tipo_id, canal, temporada_id, precio_centavos').eq('hotel_id', hotelId),
  ]);
  return {
    tipos,
    temporadas,
    tarifas: ver(tarifas).map<Tarifa>((t) => ({
      id: t.id,
      tipoId: t.tipo_id,
      canal: t.canal,
      temporadaId: t.temporada_id,
      centavos: t.precio_centavos,
    })),
  };
}

/** Crea o cambia un precio. Devuelve cómo deshacerlo. */
export async function guardarTarifa(
  hotelId: string,
  q: {
    tipoId: string;
    canal: Canal;
    temporadaId: string | null;
    centavos: number;
  },
  previa: Tarifa | undefined,
): Promise<() => Promise<void>> {
  if (previa) {
    sinError(await supabase.from('tarifas').update({ precio_centavos: q.centavos }).eq('id', previa.id));
    return async () => sinError(await supabase.from('tarifas').update({ precio_centavos: previa.centavos }).eq('id', previa.id));
  }
  const nueva = ver(
    await supabase
      .from('tarifas')
      .insert({
        hotel_id: hotelId,
        tipo_id: q.tipoId,
        canal: q.canal,
        temporada_id: q.temporadaId,
        precio_centavos: q.centavos,
      })
      .select('id')
      .single(),
  );
  return async () => sinError(await supabase.from('tarifas').delete().eq('id', nueva.id));
}

export async function guardarRangos(temporadaId: string, escrito: string, previo: string): Promise<() => Promise<void>> {
  sinError(await supabase.from('temporadas').update({ fechas: escrito }).eq('id', temporadaId));
  return async () => sinError(await supabase.from('temporadas').update({ fechas: previo }).eq('id', temporadaId));
}

/* ───────────── Hotel: reglas, plan ───────────── */
export interface HotelConfig extends Hotel {
  plan: 'E' | 'C' | 'P' | null;
  dominio: string | null;
}

export async function cargarHotel(hotelId: string): Promise<HotelConfig> {
  const h = ver(await supabase.from('hoteles').select('check_in, check_out, telefono, reglas, plan, dominio').eq('id', hotelId).single());
  const reglas = h.reglas && typeof h.reglas === 'object' && !Array.isArray(h.reglas) ? (h.reglas as Record<string, unknown>) : {};
  return {
    check_in: h.check_in,
    check_out: h.check_out,
    telefono: h.telefono,
    reglas,
    plan: h.plan as HotelConfig['plan'],
    dominio: h.dominio,
  };
}

type CambioHotel = Partial<Pick<HotelConfig, 'check_in' | 'check_out' | 'telefono' | 'reglas' | 'plan'>>;
export async function guardarHotel(hotelId: string, cambio: CambioHotel, previo: CambioHotel): Promise<() => Promise<void>> {
  const aBase = (c: CambioHotel) => c as Database['public']['Tables']['hoteles']['Update'];
  sinError(await supabase.from('hoteles').update(aBase(cambio)).eq('id', hotelId));
  return async () => sinError(await supabase.from('hoteles').update(aBase(previo)).eq('id', hotelId));
}

/* ───────────── Kit de limpieza ───────────── */
export interface Insumo {
  id: string;
  nombre: string;
  unidad: string;
}
export interface LineaKit {
  tipoId: string;
  productoId: string;
  cantidad: number;
  por: KitPor;
}

export async function cargarKit(hotelId: string) {
  const [tipos, prods, kit] = await Promise.all([
    cargarTipos(hotelId),
    supabase
      .from('productos')
      .select('id, nombre, unidad')
      .eq('hotel_id', hotelId)
      .eq('activo', true)
      .eq('se_vende', false)
      .order('nombre'),
    supabase.from('kit_por_tipo').select('tipo_id, producto_id, cantidad, por').eq('hotel_id', hotelId),
  ]);
  return {
    tipos,
    insumos: ver(prods) as Insumo[],
    kit: ver(kit).map<LineaKit>((k) => ({
      tipoId: k.tipo_id,
      productoId: k.producto_id,
      cantidad: Number(k.cantidad),
      por: k.por,
    })),
  };
}

export async function guardarKit(hotelId: string, linea: LineaKit, previa: LineaKit | undefined): Promise<() => Promise<void>> {
  sinError(
    await supabase.from('kit_por_tipo').upsert(
      {
        hotel_id: hotelId,
        tipo_id: linea.tipoId,
        producto_id: linea.productoId,
        cantidad: linea.cantidad,
        por: linea.por,
      },
      { onConflict: 'tipo_id,producto_id' },
    ),
  );
  return async () => {
    if (previa) await guardarKit(hotelId, previa, undefined);
    else await quitarKit(linea);
  };
}

export async function quitarKit(l: Pick<LineaKit, 'tipoId' | 'productoId'>) {
  sinError(await supabase.from('kit_por_tipo').delete().eq('tipo_id', l.tipoId).eq('producto_id', l.productoId));
}

/* ───────────── Usuarios ───────────── */
export interface Usuario {
  userId: string;
  nombre: string;
  rol: Rol;
  activo: boolean;
}

export async function cargarUsuarios(hotelId: string): Promise<Usuario[]> {
  const d = ver(
    await supabase.from('usuarios_hotel').select('user_id, nombre, rol, activo, creado_en').eq('hotel_id', hotelId).order('creado_en'),
  );
  return d.map((u) => ({
    userId: u.user_id,
    nombre: u.nombre,
    rol: u.rol,
    activo: u.activo,
  }));
}

export async function guardarUsuario(
  hotelId: string,
  userId: string,
  cambio: { rol?: Rol; activo?: boolean },
  previo: { rol?: Rol; activo?: boolean },
) {
  sinError(await supabase.from('usuarios_hotel').update(cambio).eq('hotel_id', hotelId).eq('user_id', userId));
  return async () => sinError(await supabase.from('usuarios_hotel').update(previo).eq('hotel_id', hotelId).eq('user_id', userId));
}

/* ───────────── Cuenta para transferencias (dato sensible: nunca se escribe en consola) ───────────── */
/** Envuelto: una cuenta aún sin cargar es `null` y no debe confundirse con "cargando". */
export async function cargarCuenta(hotelId: string): Promise<{ cuenta: unknown }> {
  const d = ver(await supabase.from('config').select('cuenta_transferencia').eq('hotel_id', hotelId).maybeSingle());
  return { cuenta: d?.cuenta_transferencia ?? null };
}

export async function guardarCuenta(hotelId: string, nueva: Record<string, unknown>, previa: unknown): Promise<() => Promise<void>> {
  const escribir = async (v: unknown) =>
    sinError(
      await supabase.from('config').upsert(
        {
          hotel_id: hotelId,
          cuenta_transferencia: v as never,
          actualizado_en: new Date().toISOString(),
        },
        { onConflict: 'hotel_id' },
      ),
    );
  await escribir(nueva);
  return () => escribir(previa);
}

/* ───────────── Placas NFC ───────────── */
export interface Placa {
  id: string;
  lugar: string;
  url: string;
  activo: boolean;
  toques: number;
  ultimos30: number;
}

export async function cargarPlacas(hotelId: string): Promise<Placa[]> {
  const d = ver(await supabase.from('nfc_destinos').select('id, lugar, url, activo').eq('hotel_id', hotelId).order('lugar'));
  const desde = new Date(Date.now() - 30 * 86400000).toISOString();
  return Promise.all(
    d.map(async (p) => {
      const [t, m] = await Promise.all([
        supabase.from('nfc_toques').select('id', { count: 'exact', head: true }).eq('destino_id', p.id),
        supabase.from('nfc_toques').select('id', { count: 'exact', head: true }).eq('destino_id', p.id).gte('creado_en', desde),
      ]);
      if (t.error) throw t.error;
      if (m.error) throw m.error;
      return { ...p, toques: t.count ?? 0, ultimos30: m.count ?? 0 };
    }),
  );
}

export async function guardarPlaca(id: string, cambio: { url?: string; activo?: boolean }, previo: { url?: string; activo?: boolean }) {
  sinError(await supabase.from('nfc_destinos').update(cambio).eq('id', id));
  return async () => sinError(await supabase.from('nfc_destinos').update(previo).eq('id', id));
}

export async function crearPlaca(hotelId: string, lugar: string, url: string): Promise<() => Promise<void>> {
  const n = ver(await supabase.from('nfc_destinos').insert({ hotel_id: hotelId, lugar, url }).select('id').single());
  return async () => sinError(await supabase.from('nfc_destinos').delete().eq('id', n.id));
}

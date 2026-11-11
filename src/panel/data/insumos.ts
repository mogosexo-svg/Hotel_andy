import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Database } from '../../lib/database.types';
import { usePerfil } from './sesion';
import { useToast } from '../ui/Toast';
import { mensajeError } from '../lib/errores';
import { nivelStock, type Nivel } from '../lib/stock';
import { numero, unidadPlural } from '../lib/format';

export type TipoAjuste = Extract<Database['public']['Enums']['tipo_movimiento'], 'conteo' | 'merma' | 'compra'>;
export type Medio = Database['public']['Enums']['medio_pago'];

export interface Cat {
  id: string;
  nombre: string;
  icono: string | null;
  orden: number;
}
export interface Prod {
  id: string;
  nombre: string;
  categoriaId: string;
  unidad: string;
  stock: number | null;
  minimo: number | null;
  seVende: boolean;
  compra: number | null;
  venta: number | null;
  activo: boolean;
  foto: string | null;
  nivel: Nivel;
}
export interface AlertaStock {
  id: string;
  productoId: string;
  mensaje: string;
}
export interface ProdDraft {
  nombre: string;
  categoriaId: string;
  unidad: string;
  minimo: number | null;
  seVende: boolean;
  venta: number | null;
  compra: number | null;
  foto: string | null;
}
export interface Movimiento {
  id: number;
  tipo: Database['public']['Enums']['tipo_movimiento'];
  cantidad: number;
  stock: number | null;
  nota: string | null;
  cuando: string;
}
export interface FilaFactura {
  id: string;
  proveedor: string;
  numero: string | null;
  fecha: string;
  total: number;
  anulada: boolean;
  motivo: string | null;
  foto: string | null;
}
export interface LineaFactura {
  productoId: string;
  cantidad: number;
  costo: number;
}
export interface Cuadre {
  fecha: string;
  total_centavos: number;
  costo_centavos: number;
  margen_centavos: number;
  sin_costo: number;
  por_producto: { producto: string; categoria: string; cantidad: number; total_centavos: number; margen_centavos: number }[];
  por_categoria: { categoria: string; total_centavos: number }[];
  por_medio: { medio: 'efectivo' | 'transferencia' | 'al_cuarto'; total_centavos: number }[];
}

type Fila = Database['public']['Tables']['productos']['Row'];
const aProd = (x: Fila): Prod => ({
  id: x.id,
  nombre: x.nombre,
  categoriaId: x.categoria_id,
  unidad: x.unidad,
  stock: x.stock,
  minimo: x.minimo,
  seVende: x.se_vende,
  compra: x.precio_compra_centavos,
  venta: x.precio_venta_centavos,
  activo: x.activo,
  foto: x.foto_path,
  nivel: nivelStock(x.stock, x.minimo, x.unidad),
});

/** Quita al producto un 23503 (categoría con productos) del resto de errores. */
export const esCategoriaConProductos = (e: { code?: string } | null) => e?.code === '23503';

/** Achica la foto del celular antes de subirla (señal irregular): máx. 1600 px, JPEG. */
export async function reducirFoto(file: File): Promise<File> {
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * k);
    c.height = Math.round(bmp.height * k);
    c.getContext('2d')?.drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise<Blob | null>((ok) => c.toBlob(ok, 'image/jpeg', 0.82));
    return blob && blob.size < file.size ? new File([blob], 'foto.jpg', { type: 'image/jpeg' }) : file;
  } catch {
    return file;
  }
}

export async function urlFirmada(path: string): Promise<string | null> {
  const { data } = await supabase.storage.from('hotel').createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

export async function listarMovimientos(productoId: string): Promise<Movimiento[] | null> {
  const { data, error } = await supabase
    .from('movimientos_insumo')
    .select('id, tipo, cantidad, stock_resultante, nota, creado_en')
    .eq('producto_id', productoId)
    .order('creado_en', { ascending: false })
    .order('id', { ascending: false })
    .limit(30);
  if (error) return null;
  return data.map((m) => ({ id: m.id, tipo: m.tipo, cantidad: m.cantidad, stock: m.stock_resultante, nota: m.nota, cuando: m.creado_en }));
}

export async function listarFacturas(hotelId: string): Promise<FilaFactura[] | null> {
  const { data, error } = await supabase
    .from('compras')
    .select('id, proveedor, numero_factura, fecha, total_centavos, anulada_en, motivo_anulacion, foto_path')
    .eq('hotel_id', hotelId)
    .order('fecha', { ascending: false })
    .order('creado_en', { ascending: false })
    .limit(60);
  if (error) return null;
  return data.map((c) => ({
    id: c.id,
    proveedor: c.proveedor,
    numero: c.numero_factura,
    fecha: c.fecha,
    total: c.total_centavos,
    anulada: !!c.anulada_en,
    motivo: c.motivo_anulacion,
    foto: c.foto_path,
  }));
}

export async function lineasDeFactura(compraId: string): Promise<LineaFactura[] | null> {
  const { data, error } = await supabase
    .from('compras_lineas')
    .select('producto_id, cantidad, costo_unit_centavos')
    .eq('compra_id', compraId);
  if (error) return null;
  return data.map((l) => ({ productoId: l.producto_id, cantidad: l.cantidad, costo: l.costo_unit_centavos }));
}

/** Datos y acciones de Insumos. Una sola carga, Realtime y cambios optimistas con Deshacer donde la base lo permite. */
export function useInsumos() {
  const { hotelId } = usePerfil();
  const toast = useToast();
  const [cats, setCats] = useState<Cat[]>([]);
  const [prods, setProds] = useState<Prod[] | null>(null);
  const [alertas, setAlertas] = useState<AlertaStock[]>([]);
  const [error, setError] = useState(false);
  const vivo = useRef(true);
  const prodsRef = useRef(prods);
  prodsRef.current = prods;
  const catsRef = useRef(cats);
  catsRef.current = cats;

  const cargar = useCallback(async () => {
    const [p, c, a] = await Promise.all([
      supabase.from('productos').select('*').eq('hotel_id', hotelId),
      supabase.from('categorias').select('id, nombre, icono, orden').eq('hotel_id', hotelId).order('orden'),
      supabase.from('alertas').select('id, producto_id, mensaje').eq('hotel_id', hotelId).eq('tipo', 'stock_bajo').is('resuelta_en', null),
    ]);
    if (!vivo.current) return;
    if (p.error || c.error) return setError(true);
    setError(false);
    setCats(c.data ?? []);
    setProds((p.data ?? []).map(aProd));
    setAlertas((a.data ?? []).flatMap((x) => (x.producto_id ? [{ id: x.id, productoId: x.producto_id, mensaje: x.mensaje }] : [])));
  }, [hotelId]);

  useEffect(() => {
    vivo.current = true;
    void cargar().catch(() => setError(true));
    const canal = supabase
      .channel(`insumos-${hotelId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'productos' }, () => void cargar())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alertas' }, () => void cargar())
      .subscribe();
    return () => {
      vivo.current = false;
      void supabase.removeChannel(canal);
    };
  }, [cargar, hotelId]);

  const api = useMemo(() => {
    const fallo = (e: { message: string; code?: string } | null) => toast.error(mensajeError(e));
    const cambiar = (id: string, f: (p: Prod) => Prod) => {
      setProds((l) => l && l.map((p) => (p.id === id ? f(p) : p)));
    };
    const campos = (d: Partial<ProdDraft>) => ({
      ...(d.nombre !== undefined && { nombre: d.nombre }),
      ...(d.categoriaId !== undefined && { categoria_id: d.categoriaId }),
      ...(d.unidad !== undefined && { unidad: d.unidad }),
      ...(d.minimo !== undefined && { minimo: d.minimo }),
      ...(d.seVende !== undefined && { se_vende: d.seVende }),
      ...(d.venta !== undefined && { precio_venta_centavos: d.venta }),
      ...(d.compra !== undefined && { precio_compra_centavos: d.compra }),
      ...(d.foto !== undefined && { foto_path: d.foto }),
    });

    async function subirFoto(carpeta: 'productos' | 'facturas', file: File): Promise<string | null> {
      const chica = await reducirFoto(file);
      const ruta = `${hotelId}/${carpeta}/${crypto.randomUUID()}.jpg`;
      const { error: e } = await supabase.storage.from('hotel').upload(ruta, chica, { contentType: chica.type || 'image/jpeg' });
      return e ? null : ruta;
    }

    /** Crea el producto; con `stockInicial` lo cuenta de una vez. Devuelve el producto o null. */
    async function crearProducto(d: ProdDraft, stockInicial: number | null): Promise<Prod | null> {
      const { data, error: e } = await supabase
        .from('productos')
        .insert({
          hotel_id: hotelId,
          categoria_id: d.categoriaId,
          nombre: d.nombre,
          unidad: d.unidad,
          minimo: d.minimo,
          se_vende: d.seVende,
          precio_venta_centavos: d.venta,
          precio_compra_centavos: d.compra,
          foto_path: d.foto,
        })
        .select('*')
        .single();
      if (e || !data) {
        fallo(e);
        return null;
      }
      if (stockInicial != null) {
        const r = await supabase.rpc('ajustar_stock', { p_producto: data.id, p_tipo: 'conteo', p_cantidad: stockInicial, p_nota: 'Stock inicial' });
        if (r.error) toast.error(`Se creó "${d.nombre}", pero no pudimos contarlo: ${mensajeError(r.error)}`);
        else data.stock = r.data;
      }
      const p = aProd(data);
      setProds((l) => [...(l ?? []), p]);
      toast.avisar(`Se creó "${p.nombre}"`);
      return p;
    }

    async function guardarProducto(id: string, d: Partial<ProdDraft>): Promise<boolean> {
      const antes = (prodsRef.current ?? []).find((p) => p.id === id);
      cambiar(id, (p) => aProd({ ...filaDe(p), ...campos(d) }));
      const { error: e } = await supabase.from('productos').update(campos(d)).eq('id', id);
      if (e) {
        if (antes) cambiar(id, () => antes);
        fallo(e);
        return false;
      }
      return true;
    }

    async function activar(p: Prod, activo: boolean) {
      cambiar(p.id, (x) => ({ ...x, activo }));
      const { error: e } = await supabase.from('productos').update({ activo }).eq('id', p.id);
      if (e) {
        cambiar(p.id, (x) => ({ ...x, activo: !activo }));
        return fallo(e);
      }
      toast.avisar(activo ? `"${p.nombre}" volvió a la lista` : `"${p.nombre}" ya no sale en la lista`, {
        deshacer: async () => {
          cambiar(p.id, (x) => ({ ...x, activo: !activo }));
          const r = await supabase.from('productos').update({ activo: !activo }).eq('id', p.id);
          if (r.error) {
            cambiar(p.id, (x) => ({ ...x, activo }));
            fallo(r.error);
          }
        },
      });
    }

    /** Conteo, merma o compra suelta. Devuelve el stock nuevo. El Deshacer lo revierte con el movimiento opuesto. */
    async function ajustar(p: Prod, tipo: TipoAjuste, cantidad: number, nota: string | null): Promise<number | null> {
      const { data, error: e } = await supabase.rpc('ajustar_stock', { p_producto: p.id, p_tipo: tipo, p_cantidad: cantidad, p_nota: nota ?? undefined });
      if (e) {
        fallo(e);
        return null;
      }
      cambiar(p.id, (x) => ({ ...x, stock: data, nivel: nivelStock(data, x.minimo, x.unidad) }));
      const cant = `${numero(cantidad)} ${unidadPlural(p.unidad, cantidad)}`;
      const frase = tipo === 'conteo' ? `Contaste ${numero(data)} de ${p.nombre}` : tipo === 'merma' ? `Se perdieron ${cant} de ${p.nombre}` : `Entraron ${cant} de ${p.nombre}`;
      const anterior = p.stock;
      toast.avisar(frase, {
        deshacer: async () => {
          const r =
            tipo === 'conteo' && anterior != null
              ? await supabase.rpc('ajustar_stock', { p_producto: p.id, p_tipo: 'conteo', p_cantidad: anterior, p_nota: 'Deshacer conteo' })
              : tipo === 'conteo'
                ? null
                : await supabase.rpc('ajustar_stock', { p_producto: p.id, p_tipo: tipo === 'merma' ? 'compra' : 'merma', p_cantidad: cantidad, p_nota: 'Deshacer' });
          if (!r) return toast.error('Un primer conteo no se puede deshacer. Cuenta otra vez.');
          if (r.error) return fallo(r.error);
          cambiar(p.id, (x) => ({ ...x, stock: r.data, nivel: nivelStock(r.data, x.minimo, x.unidad) }));
        },
      });
      return data;
    }

    async function crearCategoria(nombre: string, icono: string | null, orden: number): Promise<boolean> {
      const { data, error: e } = await supabase.from('categorias').insert({ hotel_id: hotelId, nombre, icono, orden }).select('id, nombre, icono, orden').single();
      if (e || !data) {
        fallo(e);
        return false;
      }
      setCats((l) => [...l, data].sort((a, b) => a.orden - b.orden));
      return true;
    }

    async function editarCategoria(id: string, d: { nombre?: string; icono?: string | null }): Promise<boolean> {
      const antes = catsRef.current;
      setCats((l) => l.map((c) => (c.id === id ? { ...c, ...d } : c)));
      const { error: e } = await supabase.from('categorias').update(d).eq('id', id);
      if (e) {
        setCats(antes);
        fallo(e);
        return false;
      }
      return true;
    }

    /** Sube o baja una categoría intercambiando su orden con la vecina. */
    async function ordenarCategoria(id: string, dir: -1 | 1) {
      const l = catsRef.current;
      const i = l.findIndex((c) => c.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= l.length) return;
      const a = l[i];
      const b = l[j];
      // Si dos tienen el mismo orden, el intercambio no movería nada: se renumera toda la lista.
      const nuevo = l.map((c) => c);
      nuevo[i] = b;
      nuevo[j] = a;
      const numerado = nuevo.map((c, k) => ({ ...c, orden: k + 1 }));
      setCats(numerado);
      const res = await Promise.all(numerado.filter((c, k) => c.orden !== l[k]?.orden || c.id !== l[k]?.id).map((c) => supabase.from('categorias').update({ orden: c.orden }).eq('id', c.id)));
      const e = res.find((r) => r.error)?.error;
      if (e) {
        setCats(l);
        fallo(e);
      }
    }

    /** 'ok', 'con_productos' (la base responde 23503) o 'error'. */
    async function borrarCategoria(id: string): Promise<'ok' | 'con_productos' | 'error'> {
      const { error: e } = await supabase.from('categorias').delete().eq('id', id);
      if (esCategoriaConProductos(e)) return 'con_productos';
      if (e) {
        fallo(e);
        return 'error';
      }
      setCats((l) => l.filter((c) => c.id !== id));
      return 'ok';
    }

    async function moverProductos(desde: string, hacia: string): Promise<boolean> {
      const { error: e } = await supabase.from('productos').update({ categoria_id: hacia }).eq('categoria_id', desde).eq('hotel_id', hotelId);
      if (e) {
        fallo(e);
        return false;
      }
      setProds((l) => l && l.map((p) => (p.categoriaId === desde ? { ...p, categoriaId: hacia } : p)));
      return true;
    }

    async function cargarFactura(f: { proveedor: string; numero: string; fecha: string; lineas: { producto_id: string; cantidad: number; costo_unit_centavos: number }[]; foto: File | null }): Promise<boolean> {
      let fotoPath: string | undefined;
      let fotoFallo = false;
      if (f.foto) {
        const r = await subirFoto('facturas', f.foto);
        if (r) fotoPath = r;
        else fotoFallo = true;
      }
      const { error: e } = await supabase.rpc('cargar_factura', {
        p_hotel: hotelId,
        p_proveedor: f.proveedor.trim(),
        p_numero: f.numero.trim(),
        p_fecha: f.fecha,
        p_lineas: f.lineas,
        p_foto_path: fotoPath,
      });
      if (e) {
        fallo(e);
        return false;
      }
      void cargar();
      toast.avisar(fotoFallo ? 'Factura cargada y el stock subió. La foto no se pudo subir.' : 'Factura cargada: el stock ya subió');
      return true;
    }

    async function anularFactura(id: string, motivo: string): Promise<boolean> {
      const { error: e } = await supabase.rpc('anular_factura', { p_compra: id, p_motivo: motivo.trim() || undefined });
      if (e) {
        fallo(e);
        return false;
      }
      void cargar();
      toast.avisar('Factura anulada: el stock volvió a lo de antes');
      return true;
    }

    /** Devuelve null si salió bien, o el mensaje de la base. */
    async function registrarConsumo(productoId: string, cantidad: number, destino: { reserva: string } | { medio: Medio }): Promise<string | null> {
      const { error: e } = await supabase.rpc('registrar_consumo', {
        p_producto: productoId,
        p_cantidad: cantidad,
        ...('reserva' in destino ? { p_reserva: destino.reserva } : { p_medio: destino.medio }),
      });
      if (e) return mensajeError(e);
      void cargar();
      return null;
    }

    async function cuadre(fecha: string): Promise<Cuadre | null> {
      const { data, error: e } = await supabase.rpc('cuadre_dia', { p_hotel: hotelId, p_fecha: fecha });
      return e ? (fallo(e), null) : (data as unknown as Cuadre);
    }

    return {
      subirFoto,
      crearProducto,
      guardarProducto,
      activar,
      ajustar,
      crearCategoria,
      editarCategoria,
      ordenarCategoria,
      borrarCategoria,
      moverProductos,
      cargarFactura,
      anularFactura,
      registrarConsumo,
      cuadre,
    };
  }, [hotelId, toast, cargar]);

  return { cats, prods, alertas, error, recargar: cargar, ...api };
}

/** Fila equivalente de un producto de pantalla, para volver a calcular su nivel tras un cambio local. */
function filaDe(p: Prod): Fila {
  return {
    id: p.id,
    hotel_id: '',
    categoria_id: p.categoriaId,
    clave: null,
    nombre: p.nombre,
    unidad: p.unidad,
    foto_path: p.foto,
    stock: p.stock,
    minimo: p.minimo,
    se_vende: p.seVende,
    precio_compra_centavos: p.compra,
    precio_venta_centavos: p.venta,
    consumo_diario: null,
    activo: p.activo,
    creado_en: '',
  };
}

export type InsumosApi = ReturnType<typeof useInsumos>;

/** Atajo desde la paleta (Ctrl+K) u otras pantallas: "abre Insumos y haz esto". */
export type AccionInsumos = 'venta' | 'compra' | 'producto';
let pendiente: AccionInsumos | null = null;
export function pedirAccionInsumos(a: AccionInsumos) {
  pendiente = a;
  window.dispatchEvent(new Event('insumos:accion'));
}
export function tomarAccionInsumos(): AccionInsumos | null {
  const a = pendiente;
  pendiente = null;
  return a;
}

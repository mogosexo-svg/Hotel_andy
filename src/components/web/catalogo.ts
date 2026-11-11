// Lee el catálogo público de la base una sola vez por build. Si falla, el build falla: nunca publicamos una web sin datos.
export interface Reglas {
  anticipo?: { porcentaje: number; medio: string };
  prereserva_horas?: number;
  mascotas?: { aceptadas: boolean; cargo_adicional: number | null };
  desayuno?: boolean;
  parqueadero?: boolean;
  ascensor?: boolean;
  ninos?: { politica: string; nota: string };
  piscina?: { abre: string; cierra: string };
}
export interface Tipo {
  id: string;
  clave: string;
  nombre: string;
  max_personas: number;
  descripcion: string | null;
  cuartos: number;
  desde_centavos: number | null;
}
export interface Catalogo {
  hotel: {
    nombre: string;
    ciudad: string;
    provincia: string;
    telefono: string;
    dominio: string;
    check_in: string;
    check_out: string;
    booking: { calificacion: number; resenas: number };
    reglas: Reglas;
  };
  tipos: Tipo[];
}

let cache: Promise<Catalogo> | undefined;

export function cargarCatalogo(): Promise<Catalogo> {
  cache ??= (async () => {
    const url = import.meta.env.PUBLIC_SUPABASE_URL;
    const key = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) throw new Error('Faltan PUBLIC_SUPABASE_URL y PUBLIC_SUPABASE_ANON_KEY (ver .env.example)');
    const r = await fetch(`${url}/rest/v1/rpc/catalogo_publico`, {
      method: 'POST',
      headers: { apikey: key, 'content-type': 'application/json' },
      body: '{}',
    });
    if (!r.ok) throw new Error(`catalogo_publico respondió ${r.status}: ${await r.text()}`);
    const c = (await r.json()) as Catalogo | null;
    if (!c?.hotel) throw new Error('catalogo_publico no devolvió el hotel');
    return c;
  })();
  return cache;
}

export const dinero = (centavos: number) =>
  new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD', maximumFractionDigits: centavos % 100 ? 2 : 0 }).format(centavos / 100);

export const desdeMinimo = (c: Catalogo) => {
  const v = c.tipos.map((t) => t.desde_centavos).filter((x): x is number => x != null);
  return v.length ? Math.min(...v) : null;
};

/** Solo dígitos del teléfono del catálogo, listo para wa.me. */
export const waUrl = (c: Catalogo, texto: string) =>
  `https://wa.me/${c.hotel.telefono.replace(/\D/g, '')}?text=${encodeURIComponent(texto)}`;

export const hora = (h: string) => h.slice(0, 5);

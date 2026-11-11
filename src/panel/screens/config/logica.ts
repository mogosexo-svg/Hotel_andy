/* Lógica pura de Configuración: sin pantalla ni red, para poder probarla. */
import { dinero } from '../../lib/format';

export type Resultado<T> = { ok: true; valor: T } | { ok: false; error: string };
const ok = <T>(valor: T): Resultado<T> => ({ ok: true, valor });
const mal = (error: string): Resultado<never> => ({ ok: false, error });

/* ───────────── Dinero ───────────── */

/** "35", "35,5", "$ 35.50" → centavos. Sin más de 2 decimales. */
export function dolaresACentavos(texto: string, opts: { max?: number; permitirCero?: boolean } = {}): Resultado<number> {
  const { max = 99999, permitirCero = false } = opts;
  const t = texto.replace(/[$\s]/g, '');
  const m = /^(\d{1,6})(?:[.,](\d{1,2}))?$/.exec(t);
  if (!m) return mal('Escribe el valor en dólares, por ejemplo 35 o 35,50.');
  const centavos = Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0') || 0);
  if (centavos === 0 && !permitirCero) return mal('El precio tiene que ser mayor que cero.');
  if (centavos > max * 100) return mal(`El valor no puede pasar de ${dinero(max * 100)}.`);
  return ok(centavos);
}

/** 3500 → "35" · 3550 → "35,50" (para rellenar el campo). */
export function centavosAInput(c: number): string {
  const e = Math.floor(c / 100);
  const r = c % 100;
  return r ? `${e},${String(r).padStart(2, '0')}` : String(e);
}

/* ───────────── Fechas y rangos de temporada ───────────── */

/** Rango para la dueña: `hasta` es el último día incluido. La base guarda [desde, hasta+1). */
export interface Rango {
  desde: string;
  hasta: string;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

const aFecha = (iso: string) => new Date(iso + 'T12:00:00Z');
export function sumarDias(iso: string, n: number): string {
  const d = aFecha(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
const fechaValida = (iso: string) => ISO.test(iso) && aFecha(iso).toISOString().slice(0, 10) === iso;

/** `{[2027-02-08,2027-02-13),[2027-03-01,2027-03-02)}` → rangos con día final incluido. */
export function leerMultirango(texto: unknown): Rango[] {
  if (typeof texto !== 'string') return [];
  const rangos: Rango[] = [];
  for (const m of texto.matchAll(/([[(])"?(\d{4}-\d{2}-\d{2})"?,"?(\d{4}-\d{2}-\d{2})"?([\])])/g)) {
    const desde = m[1] === '(' ? sumarDias(m[2], 1) : m[2];
    const hasta = m[4] === ')' ? sumarDias(m[3], -1) : m[3];
    if (hasta >= desde) rangos.push({ desde, hasta });
  }
  return unir(rangos);
}

/** Ordena y une los rangos que se tocan o se cruzan (igual que lo hace la base). */
export function unir(rangos: Rango[]): Rango[] {
  const orden = [...rangos].sort((a, b) => a.desde.localeCompare(b.desde));
  const out: Rango[] = [];
  for (const r of orden) {
    const ult = out[out.length - 1];
    if (ult && r.desde <= sumarDias(ult.hasta, 1)) ult.hasta = r.hasta > ult.hasta ? r.hasta : ult.hasta;
    else out.push({ ...r });
  }
  return out;
}

/** Rangos → texto de `datemultirange` para guardar. Vacío = `{}`. */
export function escribirMultirango(rangos: Rango[]): string {
  return `{${unir(rangos)
    .map((r) => `[${r.desde},${sumarDias(r.hasta, 1)})`)
    .join(',')}}`;
}

export function validarRango(desde: string, hasta: string): Resultado<Rango> {
  if (!fechaValida(desde) || !fechaValida(hasta)) return mal('Elige las dos fechas: desde cuándo y hasta cuándo.');
  if (hasta < desde) return mal('La fecha final no puede ser antes de la inicial.');
  if (aFecha(hasta).getTime() - aFecha(desde).getTime() > 120 * 86400000)
    return mal('Es un rango muy largo (más de 4 meses). Sepáralo en partes.');
  return ok({ desde, hasta });
}

export const nochesDe = (r: Rango) => Math.round((aFecha(r.hasta).getTime() - aFecha(r.desde).getTime()) / 86400000) + 1;

const partes = (iso: string) => {
  const [a, m, d] = iso.split('-').map(Number);
  return { a, m: MESES[m - 1], d };
};

/** "8 al 12 de febrero de 2027" · "28 de febrero al 3 de marzo de 2027". */
export function nombreRango(r: Rango): string {
  const a = partes(r.desde);
  const b = partes(r.hasta);
  if (r.desde === r.hasta) return `${a.d} de ${a.m} de ${a.a}`;
  if (a.a !== b.a) return `${a.d} de ${a.m} de ${a.a} al ${b.d} de ${b.m} de ${b.a}`;
  if (a.m !== b.m) return `${a.d} de ${a.m} al ${b.d} de ${b.m} de ${b.a}`;
  return `${a.d} al ${b.d} de ${b.m} de ${b.a}`;
}

/** "lunes a viernes" para el renglón de apoyo. */
export function diasRango(r: Rango): string {
  const a = DIAS[aFecha(r.desde).getUTCDay()];
  const b = DIAS[aFecha(r.hasta).getUTCDay()];
  return r.desde === r.hasta ? a : `${a} a ${b}`;
}

/* ───────────── Reglas del hotel ───────────── */

export type TipoCampo = 'hora' | 'entero' | 'dinero' | 'telefono' | 'si_no';
export type Valor = string | number | boolean | null;

export interface Hotel {
  check_in: string | null;
  check_out: string | null;
  telefono: string | null;
  reglas: Record<string, unknown>;
}

export interface CampoRegla {
  id: string;
  etiqueta: string;
  ayuda?: string;
  tipo: TipoCampo;
  donde: { col: 'check_in' | 'check_out' | 'telefono' } | { regla: string[] };
  min?: number;
  max?: number;
  sufijo?: string;
}

export const CAMPOS_REGLAS: { grupo: string; campos: CampoRegla[] }[] = [
  {
    grupo: 'Entradas y salidas',
    campos: [
      {
        id: 'check_in',
        etiqueta: 'Hora de entrada',
        ayuda: 'Desde cuándo pueden ocupar el cuarto.',
        tipo: 'hora',
        donde: { col: 'check_in' },
      },
      {
        id: 'check_out',
        etiqueta: 'Hora de salida',
        ayuda: 'Hasta cuándo deben dejar el cuarto.',
        tipo: 'hora',
        donde: { col: 'check_out' },
      },
    ],
  },
  {
    grupo: 'Piscina',
    campos: [
      {
        id: 'piscina_abre',
        etiqueta: 'La piscina abre',
        tipo: 'hora',
        donde: { regla: ['piscina', 'abre'] },
      },
      {
        id: 'piscina_cierra',
        etiqueta: 'La piscina cierra',
        ayuda: 'Si cierra pasada la medianoche, escribe la hora de la madrugada.',
        tipo: 'hora',
        donde: { regla: ['piscina', 'cierra'] },
      },
    ],
  },
  {
    grupo: 'Reservas',
    campos: [
      {
        id: 'anticipo',
        etiqueta: 'Anticipo',
        ayuda: 'Qué parte del total se paga para confirmar la reserva.',
        tipo: 'entero',
        min: 0,
        max: 100,
        sufijo: ' %',
        donde: { regla: ['anticipo', 'porcentaje'] },
      },
      {
        id: 'prereserva',
        etiqueta: 'Tiempo para pagar el anticipo',
        ayuda: 'Si no pagan a tiempo, el cuarto se libera solo.',
        tipo: 'entero',
        min: 1,
        max: 72,
        sufijo: ' horas',
        donde: { regla: ['prereserva_horas'] },
      },
    ],
  },
  {
    grupo: 'Servicios',
    campos: [
      {
        id: 'mascotas',
        etiqueta: 'Aceptan mascotas',
        tipo: 'si_no',
        donde: { regla: ['mascotas', 'aceptadas'] },
      },
      {
        id: 'mascotas_cargo',
        etiqueta: 'Cargo por mascota',
        ayuda: 'Cuánto se cobra extra por cada mascota.',
        tipo: 'dinero',
        donde: { regla: ['mascotas', 'cargo_adicional'] },
      },
      {
        id: 'parqueadero',
        etiqueta: 'Parqueadero',
        tipo: 'si_no',
        donde: { regla: ['parqueadero'] },
      },
      {
        id: 'desayuno',
        etiqueta: 'Desayuno',
        tipo: 'si_no',
        donde: { regla: ['desayuno'] },
      },
      {
        id: 'ascensor',
        etiqueta: 'Ascensor',
        tipo: 'si_no',
        donde: { regla: ['ascensor'] },
      },
    ],
  },
  {
    grupo: 'Contacto',
    campos: [
      {
        id: 'telefono',
        etiqueta: 'Teléfono o WhatsApp',
        ayuda: 'El número que ven los huéspedes en la web.',
        tipo: 'telefono',
        donde: { col: 'telefono' },
      },
    ],
  },
];

const recortarHora = (v: unknown) => (typeof v === 'string' && /^\d{2}:\d{2}/.test(v) ? v.slice(0, 5) : null);

export function leerCampo(h: Hotel, c: CampoRegla): Valor {
  if ('col' in c.donde) {
    const v = h[c.donde.col];
    return c.tipo === 'hora' ? recortarHora(v) : (v ?? null);
  }
  let v: unknown = h.reglas;
  for (const k of c.donde.regla) v = v && typeof v === 'object' ? (v as Record<string, unknown>)[k] : undefined;
  if (v === undefined || v === null) return null;
  return c.tipo === 'hora' ? recortarHora(v) : (v as Valor);
}

/** Lo que hay que escribir en `hoteles` para cambiar este campo (sin tocar el resto de las reglas). */
export function cambioCampo(h: Hotel, c: CampoRegla, valor: Valor): Partial<Pick<Hotel, 'check_in' | 'check_out' | 'telefono' | 'reglas'>> {
  if ('col' in c.donde) return { [c.donde.col]: valor } as Partial<Hotel>;
  const copia = structuredClone(h.reglas);
  let nodo = copia;
  const ruta = c.donde.regla;
  for (const k of ruta.slice(0, -1)) {
    const sig = nodo[k];
    nodo[k] = sig && typeof sig === 'object' ? sig : {};
    nodo = nodo[k] as Record<string, unknown>;
  }
  nodo[ruta[ruta.length - 1]] = valor;
  return { reglas: copia };
}

export function parsearCampo(c: CampoRegla, texto: string): Resultado<Valor> {
  const t = texto.trim();
  switch (c.tipo) {
    case 'hora':
      return /^([01]\d|2[0-3]):[0-5]\d$/.test(t) ? ok(t) : mal('Elige una hora.');
    case 'entero': {
      if (!/^\d{1,3}$/.test(t)) return mal('Escribe solo un número entero.');
      const n = Number(t);
      const { min = 0, max = 999 } = c;
      return n < min || n > max ? mal(`Tiene que estar entre ${min} y ${max}.`) : ok(n);
    }
    case 'dinero': {
      const r = dolaresACentavos(t, { max: 500, permitirCero: true });
      return r.ok ? ok(r.valor) : r;
    }
    case 'telefono': {
      const digitos = t.replace(/\D/g, '');
      return /^\+?[\d\s()-]+$/.test(t) && digitos.length >= 8 && digitos.length <= 15
        ? ok(t)
        : mal('Escribe un número de teléfono completo, con el código si es de otro país.');
    }
    case 'si_no':
      return t === 'si' ? ok(true) : t === 'no' ? ok(false) : mal('Elige Sí o No.');
  }
}

/** "13:30" → "1:30 de la tarde". */
export function horaLegible(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const franja = h < 6 ? 'de la madrugada' : h < 12 ? 'de la mañana' : h < 19 ? 'de la tarde' : 'de la noche';
  return `${h12}:${String(m).padStart(2, '0')} ${franja}`;
}

/** Texto para mostrar. Lo no definido se dice como tal, nunca como 0. */
export function mostrarCampo(c: CampoRegla, v: Valor): string {
  if (v === null || v === undefined || v === '') return 'Sin definir';
  switch (c.tipo) {
    case 'hora':
      return horaLegible(String(v));
    case 'entero':
      return `${v}${c.sufijo ?? ''}`;
    case 'dinero':
      return v === 0 ? 'Sin cargo' : dinero(Number(v));
    case 'si_no':
      return v ? 'Sí' : 'No';
    default:
      return String(v);
  }
}

/* ───────────── Kit de limpieza ───────────── */

export const POR_PALABRA = {
  limpieza: 'por cada limpieza',
  persona: 'por cada persona',
} as const;

export function parsearCantidad(texto: string): Resultado<number> {
  const m = /^(\d{1,3})(?:[.,](\d{1,2}))?$/.exec(texto.trim());
  const n = m ? Number(`${m[1]}.${m[2] ?? '0'}`) : NaN;
  return n > 0 && n <= 999 ? ok(n) : mal('Escribe una cantidad mayor que cero, por ejemplo 2 o 0,5.');
}

/* ───────────── Plan y cuenta ───────────── */

export const PLANES = {
  E: {
    nombre: 'Esencial',
    texto: 'Reservas, mapa de cuartos, limpieza e insumos.',
  },
  C: {
    nombre: 'Completo',
    texto: 'Todo lo Esencial más avisos por WhatsApp, placas NFC y calendarios de Booking y Airbnb.',
  },
  P: {
    nombre: 'Premium',
    texto: 'Todo lo Completo más lista de compras, previsión de feriados y el asistente de WhatsApp.',
  },
} as const;
export type PlanId = keyof typeof PLANES;

export interface Cuenta {
  banco: string;
  tipo: 'ahorros' | 'corriente';
  numero: string;
  titular: string;
  documento?: string;
}

export function leerCuenta(json: unknown): Cuenta | null {
  if (!json || typeof json !== 'object') return null;
  const j = json as Record<string, unknown>;
  const s = (k: string) => (typeof j[k] === 'string' ? (j[k] as string) : '');
  if (!s('numero')) return null;
  return {
    banco: s('banco'),
    tipo: s('tipo') === 'corriente' ? 'corriente' : 'ahorros',
    numero: s('numero'),
    titular: s('titular'),
    documento: s('documento') || undefined,
  };
}

export function validarCuenta(c: Cuenta): Resultado<Cuenta> {
  if (c.banco.trim().length < 2) return mal('Escribe el nombre del banco.');
  if (!/^\d{5,20}$/.test(c.numero.replace(/\s/g, ''))) return mal('El número de cuenta son solo dígitos (entre 5 y 20).');
  if (c.titular.trim().length < 3) return mal('Escribe el nombre de quien es titular de la cuenta.');
  return ok({
    ...c,
    banco: c.banco.trim(),
    numero: c.numero.replace(/\s/g, ''),
    titular: c.titular.trim(),
    documento: c.documento?.trim() || undefined,
  });
}

/** "•••• 1234": el número completo solo se ve si la dueña lo pide. */
export const enmascarar = (numero: string) => `•••• ${numero.slice(-4)}`;

/* ───────────── Placas NFC ───────────── */

export const validarLugar = (t: string): Resultado<string> => {
  const l = t
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[\s_]+/g, '-');
  return /^[a-z0-9-]{2,30}$/.test(l) ? ok(l) : mal('Usa solo letras y números, por ejemplo: piscina o cuarto-201.');
};

export function validarUrl(t: string): Resultado<string> {
  const u = t.trim();
  try {
    const url = new URL(u);
    return url.protocol === 'https:' && url.hostname.includes('.') ? ok(u) : mal('El enlace tiene que empezar con https://');
  } catch {
    return mal('Pega el enlace completo, empezando con https://');
  }
}

/** "cuarto-201" → "Cuarto 201". */
export const lugarLegible = (l: string) => {
  const t = l.replace(/-/g, ' ');
  return t.charAt(0).toUpperCase() + t.slice(1);
};

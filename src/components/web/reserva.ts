// Reserva por pasos (RF-03): JS plano con fetch a las RPC públicas. Sin supabase-js para no pasar los 50 KB.
import { crearCalendario, type Dia } from './calendario';

const root = document.querySelector<HTMLElement>('[data-reserva]');

type Fila = { tipo_id: string; nombre: string; max_personas: number; cuartos_libres: number; noches: number; total_centavos: number };
type Pre = { codigo: string; vence_en: string; total_centavos: number; entrada: string; salida: string; noches: number };
type Paso = 'fechas' | 'personas' | 'resultados' | 'datos' | 'listo' | 'caido';

class Negocio extends Error {}

const usd = (c: number) =>
  new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD', maximumFractionDigits: c % 100 ? 2 : 0 }).format(c / 100);
const dia = (iso: string) =>
  new Intl.DateTimeFormat('es-EC', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
    .format(new Date(`${iso}T00:00:00Z`)).replace(',', '').replace(/\./g, '');
const hoyGuayaquil = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guayaquil' }).format(new Date());
const plural = (n: number, a: string, b: string) => `${n} ${n === 1 ? a : b}`;
const NUM: Record<Paso, number> = { fechas: 1, personas: 2, resultados: 3, datos: 4, listo: 4, caido: 4 };

if (root) {
  const { url, key, tel, hotel } = root.dataset as Record<string, string>;
  const minis = JSON.parse(root.dataset.minis ?? '{}') as Record<string, string>;
  const pasos = [...root.querySelectorAll<HTMLElement>('[data-paso]')];
  const q = <T extends HTMLElement>(s: string) => root.querySelector<T>(s)!;
  const datos = q<HTMLFormElement>('form[data-paso=datos]');
  let personas = 2;
  let pref: { id: string; nombre: string; max: number } | null = null;
  let consulta = { entrada: '', salida: '', personas: 0 };
  let elegido: Fila | null = null;
  let reloj = 0;
  let sucio = false;

  async function rpc<T>(fn: string, body: object): Promise<T> {
    let r: Response;
    try {
      r = await fetch(`${url}/rest/v1/rpc/${fn}`, {
        method: 'POST',
        headers: { apikey: key, 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(12000),
      });
    } catch {
      throw new Error('red');
    }
    const j = await r.json().catch(() => null);
    if (r.ok) return j as T;
    if (j?.code === 'P0001' && j.message) throw new Negocio(j.message);
    throw new Error('servidor');
  }

  const ir = (n: Paso) => {
    pasos.forEach((p) => (p.hidden = p.dataset.paso !== n));
    const k = NUM[n];
    q('[data-barra]').style.transform = `scaleX(${n === 'listo' ? 1 : k / 4})`;
    root.querySelectorAll<HTMLElement>('[data-prog] li').forEach((li) => {
      const i = Number(li.dataset.i);
      li.classList.toggle('act', i === k);
      li.classList.toggle('hecho', i < k || n === 'listo');
      i === k ? li.setAttribute('aria-current', 'step') : li.removeAttribute('aria-current');
    });
    if (n !== 'listo') clearInterval(reloj);
    const p = q(`[data-paso=${n}]`);
    p.tabIndex = -1;
    p.style.outline = 'none';
    if (n !== 'fechas') p.focus({ preventScroll: true });
    q('[data-prog]').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  };
  const error = (f: HTMLElement, msg: string) => {
    const e = f.querySelector<HTMLElement>('[data-error]')!;
    e.textContent = msg;
    e.hidden = !msg;
  };
  const ocupado = (f: HTMLElement, si: boolean) => f.querySelectorAll<HTMLButtonElement>('button').forEach((b) => (b.disabled = si));

  // Paso 1: calendario. Se crea al acercarse a la sección para no pedir nada antes de tiempo.
  const fechas = q('[data-paso=fechas]');
  const sel = q('[data-sel]');
  let cal: ReturnType<typeof crearCalendario> | undefined;
  const montar = () => {
    cal ??= crearCalendario(q('[data-cal]'), {
      hoy: hoyGuayaquil(),
      maxNoches: 30,
      cargar: async (desde, hasta) => {
        try {
          const f = await rpc<{ dia: string; cuartos_libres: number; desde_centavos: number | null; temporada_alta: boolean }[]>(
            'calendario_publico', { p_desde: desde, p_hasta: hasta, p_personas: pref ? Math.min(personas, pref.max) : personas, p_tipo: pref?.id });
          return new Map<string, Dia>(f.map((x) => [x.dia, { libres: x.cuartos_libres, desde: x.desde_centavos, alta: x.temporada_alta }]));
        } catch {
          return null; // sin la RPC o con la red caída el calendario sigue sirviendo, solo sin precios
        }
      },
      lleno: () => (pref ? `Tachado: sin ${pref.nombre}` : 'Tachado: sin cuartos'),
      alCambiar: (ini, fin) => {
        error(fechas, '');
        sel.textContent = !ini ? 'Elige tu día de entrada.' : !fin ? `Entrada el ${dia(ini)}. Ahora elige tu día de salida.`
          : `Del ${dia(ini)} al ${dia(fin)}: ${plural(Math.round((Date.parse(fin) - Date.parse(ini)) / 864e5), 'noche', 'noches')}.`;
      },
    });
  };
  new IntersectionObserver((es, io) => { if (es[0].isIntersecting) { montar(); io.disconnect(); } }, { rootMargin: '700px' }).observe(root);

  q('[data-sig]').addEventListener('click', () => {
    montar();
    const { ini, fin } = cal!.valor();
    if (!ini || !fin) return error(fechas, 'Elige el día de entrada y el de salida.');
    consulta.entrada = ini;
    consulta.salida = fin;
    q('[data-personas]').textContent = String(personas);
    ir('personas');
  });

  // Paso 2: personas
  const out = q('[data-personas]');
  const poner = (n: number) => { if (n !== personas) sucio = true; personas = Math.min(20, Math.max(1, n)); out.textContent = String(personas); };
  q('[data-menos]').addEventListener('click', () => poner(personas - 1));
  q('[data-mas]').addEventListener('click', () => poner(personas + 1));
  const pers = q('[data-paso=personas]');
  q('[data-ver]').addEventListener('click', async () => {
    error(pers, '');
    consulta.personas = personas;
    ocupado(pers, true);
    try {
      const filas = await rpc<Fila[]>('consultar_disponibilidad', { p_entrada: consulta.entrada, p_salida: consulta.salida, p_personas: personas });
      pintar(filas);
      ir('resultados');
    } catch (err) {
      if (err instanceof Negocio) error(pers, err.message);
      else ir('caido');
    } finally {
      ocupado(pers, false);
    }
  });

  // Elección previa desde el visor de cuartos
  const chip = q('[data-pref]');
  const mostrarPref = () => {
    chip.hidden = !pref;
    chip.replaceChildren();
    if (!pref) return;
    const s = document.createElement('span');
    s.textContent = 'Disponibilidad de: ';
    const n = document.createElement('strong');
    n.textContent = pref.nombre;
    s.append(n);
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = 'Quitar filtro';
    b.addEventListener('click', () => { pref = null; mostrarPref(); cal?.recargar(false); });
    chip.append(s, b);
  };
  // Desde el visor: el calendario pasa a mostrar solo la disponibilidad y el precio de ese tipo.
  addEventListener('tipo-elegido', (e) => {
    pref = (e as CustomEvent<{ id: string; nombre: string; max: number }>).detail;
    mostrarPref();
    const nuevo = !cal;
    montar();
    ir('fechas');
    if (!nuevo) cal!.recargar(true); // uno nuevo ya carga con el filtro puesto
    q('.r-panel').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  });

  // Paso 3: cuartos libres
  function pintar(filas: Fila[]) {
    const lista = q('[data-lista]');
    lista.replaceChildren();
    const orden = [...filas].sort((a, b) => Number(b.tipo_id === pref?.id) - Number(a.tipo_id === pref?.id));
    const n = filas[0]?.noches ?? Math.round((Date.parse(consulta.salida) - Date.parse(consulta.entrada)) / 864e5);
    q('[data-resumen]').textContent = filas.length
      ? `Del ${dia(consulta.entrada)} al ${dia(consulta.salida)}, ${plural(n, 'noche', 'noches')}, ${plural(consulta.personas, 'persona', 'personas')}. Esto hay libre:`
      : `Del ${dia(consulta.entrada)} al ${dia(consulta.salida)} no hay cuartos libres con esa capacidad. Prueba otras fechas o escríbenos por WhatsApp.`;
    if (pref && filas.length && !filas.some((f) => f.tipo_id === pref!.id)) q('[data-resumen]').textContent += ` El cuarto ${pref.nombre} no está libre en esas fechas.`;
    orden.forEach((f, k) => {
      const li = document.createElement('li');
      li.style.setProperty('--k', String(k));
      li.classList.toggle('pref', f.tipo_id === pref?.id);
      const foto = minis[f.tipo_id] ? Object.assign(document.createElement('img'), { src: minis[f.tipo_id], alt: '', loading: 'lazy', className: 'tipo-foto' }) : Object.assign(document.createElement('div'), { className: 'tipo-foto' });
      const info = document.createElement('div');
      info.className = 'tipo-info';
      const nombre = document.createElement('strong');
      nombre.textContent = f.nombre;
      const cap = document.createElement('span');
      cap.textContent = `Hasta ${f.max_personas} personas${f.cuartos_libres <= 2 ? `, ${f.cuartos_libres === 1 ? 'queda 1' : `quedan ${f.cuartos_libres}`}` : ''}`;
      info.append(nombre, cap);
      if (f.tipo_id === pref?.id) { const tg = document.createElement('span'); tg.className = 'tag'; tg.textContent = 'Tu elección'; info.append(tg); }
      const pie = document.createElement('div');
      pie.className = 'tipo-pie';
      const precio = document.createElement('div');
      precio.className = 'precio num';
      const total = document.createElement('strong');
      total.textContent = usd(f.total_centavos);
      const sub = document.createElement('span');
      sub.textContent = `total por ${plural(f.noches, 'noche', 'noches')}`;
      precio.append(total, sub);
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn';
      b.textContent = 'Elegir';
      b.setAttribute('aria-label', `Elegir ${f.nombre}`);
      b.addEventListener('click', () => {
        elegido = f;
        q('[data-elegido]').textContent = `${f.nombre}, del ${dia(consulta.entrada)} al ${dia(consulta.salida)}, ${usd(f.total_centavos)} en total.`;
        error(datos, '');
        ir('datos');
        datos.querySelector<HTMLInputElement>('[name=nombre]')!.focus();
      });
      pie.append(precio, b);
      li.append(foto, info, pie);
      lista.append(li);
    });
  }

  root.querySelectorAll<HTMLElement>('[data-volver]').forEach((b) => b.addEventListener('click', () => {
    const a = b.dataset.volver as Paso;
    if (a === 'fechas' && sucio) { sucio = false; cal?.recargar(); }
    ir(a);
  }));
  // Volver a "fechas" desde personas conserva lo elegido; si cambiaron las personas, se repintan los precios.

  // Paso 4: datos y envío
  datos.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!elegido) return;
    const f = new FormData(datos);
    const nombre = String(f.get('nombre') ?? '').trim();
    const telefono = String(f.get('telefono') ?? '').trim();
    if (nombre.length < 2) return error(datos, 'Escribe tu nombre.');
    if (telefono.replace(/\D/g, '').length < 7) return error(datos, 'Revisa tu número de teléfono.');
    if (!f.get('consentimiento')) return error(datos, 'Necesitamos tu permiso para guardar tus datos (aviso de privacidad).');
    error(datos, '');
    ocupado(datos, true);
    const enviar = datos.querySelector<HTMLButtonElement>('[type=submit]')!;
    const rotulo = enviar.querySelector('span')!;
    const antes = rotulo.textContent;
    enviar.classList.add('cargando');
    rotulo.textContent = 'Guardando tu cuarto…';
    datos.setAttribute('aria-busy', 'true');
    try {
      const p = await rpc<Pre>('crear_prereserva', {
        p_tipo_id: elegido.tipo_id, p_entrada: consulta.entrada, p_salida: consulta.salida, p_personas: consulta.personas,
        p_nombre: nombre, p_telefono: telefono, p_consentimiento: true, p_mascota: !!f.get('mascota'),
      });
      q('[data-codigo]').textContent = p.codigo;
      q('[data-detalle]').textContent = `${elegido.nombre}, del ${dia(p.entrada)} al ${dia(p.salida)}. Total ${usd(p.total_centavos)}.`;
      const msg = `Hola, soy ${nombre}. Hice la pre-reserva ${p.codigo} en ${hotel}: ${elegido.nombre}, del ${dia(p.entrada)} al ${dia(p.salida)}, ${plural(consulta.personas, 'persona', 'personas')}, total ${usd(p.total_centavos)}.`;
      q<HTMLAnchorElement>('[data-wa]').href = `https://wa.me/${tel}?text=${encodeURIComponent(msg)}`;
      ir('listo');
      cuentaAtras(p.vence_en);
    } catch (err) {
      if (err instanceof Negocio) error(datos, err.message);
      else ir('caido');
    } finally {
      ocupado(datos, false);
      enviar.classList.remove('cargando');
      rotulo.textContent = antes;
      datos.removeAttribute('aria-busy');
    }
  });

  function cuentaAtras(vence: string) {
    const fin = Date.parse(vence);
    const el = q('[data-reloj]');
    if (Number.isNaN(fin)) { el.hidden = true; return; }
    el.hidden = false;
    q('[data-vence]').textContent = `Confírmala por WhatsApp antes de las ${new Intl.DateTimeFormat('es-EC', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Guayaquil' }).format(fin)}`;
    const tic = () => {
      const s = Math.max(0, Math.floor((fin - Date.now()) / 1000));
      el.textContent = [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60].map((n) => String(n).padStart(2, '0')).join(':');
      if (!s) clearInterval(reloj);
    };
    clearInterval(reloj);
    tic();
    reloj = window.setInterval(tic, 1000);
  }
}

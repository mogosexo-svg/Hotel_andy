// Isla de disponibilidad (RF-03): JS plano con fetch a las RPC públicas. Sin supabase-js para no pasar los 50 KB.
const root = document.querySelector<HTMLElement>('[data-reserva]');

type Fila = { tipo_id: string; nombre: string; max_personas: number; cuartos_libres: number; noches: number; total_centavos: number };
type Pre = { codigo: string; vence_en: string; total_centavos: number; entrada: string; salida: string; noches: number };

class Negocio extends Error {}

const usd = (c: number) =>
  new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD', maximumFractionDigits: c % 100 ? 2 : 0 }).format(c / 100);
const dia = (iso: string) =>
  new Intl.DateTimeFormat('es-EC', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
    .format(new Date(`${iso}T00:00:00Z`)).replace(',', '').replace(/\./g, '');
const hoyGuayaquil = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guayaquil' }).format(new Date());
const sumaDia = (iso: string) => new Date(Date.parse(`${iso}T00:00:00Z`) + 864e5).toISOString().slice(0, 10);

if (root) {
  const { url, key, tel, hotel } = root.dataset as Record<string, string>;
  const pasos = [...root.querySelectorAll<HTMLElement>('[data-paso]')];
  const q = <T extends HTMLElement>(s: string) => root.querySelector<T>(s)!;
  const buscar = q<HTMLFormElement>('form[data-paso=buscar]');
  const datos = q<HTMLFormElement>('form[data-paso=datos]');
  const entrada = buscar.elements.namedItem('entrada') as HTMLInputElement;
  const salida = buscar.elements.namedItem('salida') as HTMLInputElement;
  const personas = buscar.elements.namedItem('personas') as HTMLInputElement;
  let consulta = { entrada: '', salida: '', personas: 0 };
  let elegido: Fila | null = null;

  const ir = (n: string) => pasos.forEach((p) => (p.hidden = p.dataset.paso !== n));
  const error = (f: HTMLElement, msg: string) => {
    const e = f.querySelector<HTMLElement>('[data-error]')!;
    e.textContent = msg;
    e.hidden = !msg;
  };

  entrada.min = hoyGuayaquil();
  entrada.addEventListener('change', () => {
    salida.min = entrada.value ? sumaDia(entrada.value) : '';
    if (salida.value && salida.value <= entrada.value) salida.value = '';
  });

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

  const ocupado = (f: HTMLElement, si: boolean) =>
    f.querySelectorAll<HTMLButtonElement>('button').forEach((b) => (b.disabled = si));

  buscar.addEventListener('submit', async (e) => {
    e.preventDefault();
    error(buscar, '');
    const n = Number(personas.value);
    if (!entrada.value || !salida.value) return error(buscar, 'Elige la fecha de entrada y la de salida.');
    if (salida.value <= entrada.value) return error(buscar, 'La salida debe ser después de la entrada.');
    if (!Number.isInteger(n) || n < 1 || n > 20) return error(buscar, 'Escribe cuántas personas son, entre 1 y 20.');
    consulta = { entrada: entrada.value, salida: salida.value, personas: n };
    ocupado(buscar, true);
    try {
      const filas = await rpc<Fila[]>('consultar_disponibilidad', { p_entrada: consulta.entrada, p_salida: consulta.salida, p_personas: n });
      pintar(filas);
      ir('resultados');
    } catch (err) {
      if (err instanceof Negocio) error(buscar, err.message);
      else ir('caido');
    } finally {
      ocupado(buscar, false);
    }
  });

  function pintar(filas: Fila[]) {
    const lista = q('[data-lista]');
    lista.replaceChildren();
    const noches = filas[0]?.noches ?? Math.round((Date.parse(consulta.salida) - Date.parse(consulta.entrada)) / 864e5);
    q('[data-resumen]').textContent = filas.length
      ? `Del ${dia(consulta.entrada)} al ${dia(consulta.salida)}, ${noches} ${noches === 1 ? 'noche' : 'noches'}, ${consulta.personas} ${consulta.personas === 1 ? 'persona' : 'personas'}. Esto hay libre:`
      : `Para el ${dia(consulta.entrada)} al ${dia(consulta.salida)} no hay cuartos libres con esa capacidad. Prueba otras fechas o escríbenos por WhatsApp.`;
    for (const f of filas) {
      const li = document.createElement('li');
      const info = document.createElement('div');
      const nombre = document.createElement('strong');
      nombre.textContent = f.nombre;
      const cap = document.createElement('span');
      cap.textContent = `Hasta ${f.max_personas} personas${f.cuartos_libres <= 2 ? `, ${f.cuartos_libres === 1 ? 'queda 1' : `quedan ${f.cuartos_libres}`}` : ''}`;
      info.append(nombre, cap);
      const precio = document.createElement('div');
      precio.className = 'precio num';
      const total = document.createElement('strong');
      total.textContent = usd(f.total_centavos);
      const sub = document.createElement('span');
      sub.textContent = `total por ${f.noches} ${f.noches === 1 ? 'noche' : 'noches'}`;
      precio.append(total, sub);
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn btn-claro';
      b.textContent = 'Elegir';
      b.setAttribute('aria-label', `Elegir ${f.nombre}`);
      b.addEventListener('click', () => {
        elegido = f;
        q('[data-elegido]').textContent = `${f.nombre}, del ${dia(consulta.entrada)} al ${dia(consulta.salida)}, ${usd(f.total_centavos)} en total.`;
        error(datos, '');
        ir('datos');
        datos.querySelector<HTMLInputElement>('[name=nombre]')!.focus();
      });
      li.append(info, precio, b);
      lista.append(li);
    }
  }

  root.querySelectorAll<HTMLElement>('[data-volver]').forEach((b) => b.addEventListener('click', () => ir(b.dataset.volver!)));

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
    try {
      const p = await rpc<Pre>('crear_prereserva', {
        p_tipo_id: elegido.tipo_id, p_entrada: consulta.entrada, p_salida: consulta.salida, p_personas: consulta.personas,
        p_nombre: nombre, p_telefono: telefono, p_consentimiento: true, p_mascota: !!f.get('mascota'),
      });
      q('[data-codigo]').textContent = p.codigo;
      q('[data-detalle]').textContent = `${elegido.nombre}, del ${dia(p.entrada)} al ${dia(p.salida)}. Total ${usd(p.total_centavos)}. Confírmala por WhatsApp antes de que venza.`;
      const msg = `Hola, soy ${nombre}. Hice la pre-reserva ${p.codigo} en ${hotel}: ${elegido.nombre}, del ${dia(p.entrada)} al ${dia(p.salida)}, ${consulta.personas} ${consulta.personas === 1 ? 'persona' : 'personas'}, total ${usd(p.total_centavos)}.`;
      q<HTMLAnchorElement>('[data-wa]').href = `https://wa.me/${tel}?text=${encodeURIComponent(msg)}`;
      ir('listo');
    } catch (err) {
      if (err instanceof Negocio) error(datos, err.message);
      else ir('caido');
    } finally {
      ocupado(datos, false);
    }
  });
}

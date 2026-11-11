// Calendario propio de rango: lunes primero, español, teclado y lector de pantalla. Con `cargar` pinta "desde $" y días llenos; sin datos funciona igual.
export interface Dia { libres: number; desde: number | null; alta: boolean }
export interface Opciones {
  hoy: string;
  maxNoches: number;
  cargar: (desde: string, hasta: string) => Promise<Map<string, Dia> | null>;
  alCambiar: (ini: string, fin: string) => void;
}

const MS = 864e5;
const t = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const suma = (d: string, n: number) => iso(t(d) + n * MS);
const mesDe = (d: string) => `${d.slice(0, 7)}-01`;
const sumaMes = (m: string, n: number) => { const d = new Date(t(m)); d.setUTCMonth(d.getUTCMonth() + n); return iso(d.getTime()); };
const largo = new Intl.DateTimeFormat('es-EC', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const nombreMes = new Intl.DateTimeFormat('es-EC', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const usd = (c: number) => `$${Math.round(c / 100)}`;
const SVG = (d: string) => `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="${d}"/></svg>`;
const CAB = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

export function crearCalendario(host: HTMLElement, o: Opciones) {
  const ancho = matchMedia('(min-width: 860px)');
  const tope = sumaMes(mesDe(o.hoy), 12);
  let mes = mesDe(o.hoy);
  let ini = '';
  let fin = '';
  let hover = '';
  let foco = o.hoy;
  let datos = new Map<string, Dia>();
  let sinDatos = false;
  const celdas = new Map<string, HTMLButtonElement>();

  const nMeses = () => (ancho.matches ? 2 : 1);
  const lleno = (d: string) => datos.get(d)?.libres === 0;
  const finValido = (d: string) => {
    if (d <= ini || (t(d) - t(ini)) / MS > o.maxNoches) return false;
    for (let x = ini; x < d; x = suma(x, 1)) if (lleno(x)) return false;
    return true;
  };

  async function cargarDatos() {
    if (sinDatos) return;
    const m = await o.cargar(mes < o.hoy ? o.hoy : mes, suma(sumaMes(mes, nMeses()), -1));
    if (!m) { sinDatos = true; return; }
    m.forEach((v, k) => datos.set(k, v));
    construir();
  }

  function clases() {
    const tope2 = fin || (ini && hover > ini ? hover : '');
    celdas.forEach((b, d) => {
      const dd = datos.get(d);
      b.classList.toggle('ini', d === ini);
      b.classList.toggle('fin', d === fin);
      b.classList.toggle('rango', !!ini && !!tope2 && d >= ini && d <= tope2);
      b.classList.toggle('rango-c', !!ini && !!tope2 && (d === ini || d === tope2));
      const sel = d === ini || d === fin;
      b.setAttribute('aria-selected', String(sel || (!!ini && !!tope2 && d > ini && d < tope2)));
      const ctx = [largo.format(t(d)), dd?.desde != null && dd.libres !== 0 ? `desde ${usd(dd.desde)} por noche` : '', dd?.libres === 0 ? 'sin disponibilidad' : '', dd?.alta ? 'temporada alta' : '', d === ini ? 'entrada' : '', d === fin ? 'salida' : ''];
      b.setAttribute('aria-label', ctx.filter(Boolean).join(', '));
    });
  }

  function elegir(d: string) {
    if (d < o.hoy) return;
    if (!ini || fin || d <= ini) {
      if (lleno(d)) return;
      ini = d; fin = '';
    } else if (finValido(d)) fin = d;
    else if (!lleno(d)) { ini = d; fin = ''; } else return;
    hover = '';
    clases();
    o.alCambiar(ini, fin);
  }

  function construir() {
    celdas.clear();
    const frag = document.createElement('div');
    frag.className = `cal-meses${nMeses() === 2 ? ' dos' : ''}`;
    for (let k = 0; k < nMeses(); k++) {
      const m = sumaMes(mes, k);
      const sec = document.createElement('div');
      sec.className = 'cal-mes';
      const cab = document.createElement('div');
      cab.className = 'cal-cab';
      const prev = document.createElement('button');
      prev.type = 'button'; prev.className = 'cal-nav'; prev.innerHTML = SVG('M15 5l-7 7 7 7'); prev.setAttribute('aria-label', 'Mes anterior');
      prev.disabled = mes <= mesDe(o.hoy); prev.hidden = k > 0;
      prev.addEventListener('click', () => { mes = sumaMes(mes, -1); construir(); cargarDatos(); });
      const next = document.createElement('button');
      next.type = 'button'; next.className = 'cal-nav'; next.innerHTML = SVG('M9 5l7 7-7 7'); next.setAttribute('aria-label', 'Mes siguiente');
      next.disabled = sumaMes(mes, nMeses()) > tope; next.hidden = k < nMeses() - 1;
      next.addEventListener('click', () => { mes = sumaMes(mes, 1); construir(); cargarDatos(); });
      const h = document.createElement('h3');
      h.textContent = nombreMes.format(t(m)).replace(/^./, (x) => x.toUpperCase()).replace(' de ', ' ');
      h.setAttribute('aria-live', 'polite');
      cab.append(prev, h, next);
      const tabla = document.createElement('table');
      tabla.className = 'cal-tabla'; tabla.setAttribute('role', 'grid'); tabla.setAttribute('aria-label', nombreMes.format(t(m)));
      const thead = tabla.createTHead().insertRow();
      CAB.forEach((n, k) => { const th = document.createElement('th'); th.scope = 'col'; th.abbr = n; th.textContent = 'LMXJVSD'[k]; thead.append(th); });
      const cuerpo = tabla.createTBody();
      const primero = (new Date(t(m)).getUTCDay() + 6) % 7;
      const dias = new Date(Date.UTC(+m.slice(0, 4), +m.slice(5, 7), 0)).getUTCDate();
      let fila = cuerpo.insertRow();
      for (let c = 0; c < primero; c++) fila.insertCell();
      for (let n = 1; n <= dias; n++) {
        if (fila.cells.length === 7) fila = cuerpo.insertRow();
        const d = `${m.slice(0, 8)}${String(n).padStart(2, '0')}`;
        const dd = datos.get(d);
        const td = fila.insertCell();
        td.setAttribute('role', 'gridcell');
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'cal-dia'; b.dataset.d = d;
        b.style.setProperty('--k', String(n));
        b.tabIndex = d === foco ? 0 : -1;
        const num = document.createElement('span');
        num.textContent = String(n);
        b.append(num);
        if (dd?.desde != null && dd.libres !== 0 && d >= o.hoy) { const s = document.createElement('small'); s.textContent = usd(dd.desde); b.append(s); }
        if (d < o.hoy) { b.disabled = true; b.classList.add('pasado'); }
        if (d === o.hoy) b.classList.add('hoy');
        if (dd?.libres === 0 && d >= o.hoy) { b.classList.add('lleno'); b.setAttribute('aria-disabled', 'true'); }
        if (dd?.alta) b.classList.add('alta');
        b.addEventListener('click', () => { foco = d; elegir(d); });
        b.addEventListener('pointerenter', () => { if (ini && !fin) { hover = d; clases(); } });
        celdas.set(d, b);
        td.append(b);
      }
      sec.append(cab, tabla);
      frag.append(sec);
    }
    const leyenda = document.createElement('p');
    leyenda.className = 'cal-leyenda';
    const hayAlta = [...datos.values()].some((x) => x.alta);
    const hayPrecio = [...datos.values()].some((x) => x.desde != null);
    leyenda.innerHTML = `${hayPrecio ? '<span>El número pequeño es el precio desde, por noche</span>' : ''}${hayAlta ? '<span><i></i>Temporada alta</span>' : ''}${[...datos.values()].some((x) => x.libres === 0) ? '<span>Tachado: sin cuartos</span>' : ''}`;
    host.replaceChildren(frag, leyenda);
    clases();
  }

  host.addEventListener('keydown', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('.cal-dia');
    if (!b) return;
    const paso: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    let d = b.dataset.d!;
    if (e.key in paso) d = suma(d, paso[e.key]);
    else if (e.key === 'Home') d = suma(d, -((new Date(t(d)).getUTCDay() + 6) % 7));
    else if (e.key === 'End') d = suma(d, 6 - ((new Date(t(d)).getUTCDay() + 6) % 7));
    else if (e.key === 'PageDown' || e.key === 'PageUp') d = suma(d, e.key === 'PageDown' ? 28 : -28);
    else return;
    e.preventDefault();
    if (d < o.hoy) d = o.hoy;
    if (d > suma(tope, 30)) return;
    foco = d;
    const visible = mesDe(d) >= mes && mesDe(d) < sumaMes(mes, nMeses());
    if (!visible) { mes = mesDe(d) < mes ? mesDe(d) : sumaMes(mesDe(d), 1 - nMeses()); construir(); cargarDatos(); }
    else celdas.forEach((c, k) => (c.tabIndex = k === d ? 0 : -1));
    celdas.get(d)?.focus();
  });
  ancho.addEventListener('change', () => { construir(); cargarDatos(); });
  host.addEventListener('pointerleave', () => { if (hover) { hover = ''; clases(); } });

  construir();
  cargarDatos();
  return {
    valor: () => ({ ini, fin }),
    recargar: () => { datos = new Map(); sinDatos = false; construir(); cargarDatos(); },
  };
}

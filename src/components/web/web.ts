import './reserva';
import './visor';

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $$ = <T extends HTMLElement>(s: string) => [...document.querySelectorAll<T>(s)];

// Entradas al hacer scroll: titulares palabra por palabra, fotos que se aclaran, olas que se dibujan, contadores.
const entra = new IntersectionObserver((es) => es.forEach((e) => {
  if (!e.isIntersecting) return;
  const el = e.target as HTMLElement;
  el.classList.add('in');
  entra.unobserve(el);
  const n = el.dataset.n;
  if (n != null && !reduce) contar(el, Number(n), Number(el.dataset.dec ?? 0));
}), { rootMargin: '0px 0px -8% 0px' });
$$('.rv, .foto, .ola, [data-n], .dia').forEach((el) => entra.observe(el));

function contar(el: HTMLElement, fin: number, dec: number) {
  const f = new Intl.NumberFormat('es-EC', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  const t0 = performance.now();
  const paso = (t: number) => {
    const k = Math.min(1, (t - t0) / 1400);
    el.textContent = f.format(fin * (1 - Math.pow(1 - k, 3)));
    if (k < 1) requestAnimationFrame(paso);
  };
  requestAnimationFrame(paso);
}

// El mapa aparece cuando carga; mientras tanto (o si falla) se ve el fondo con el nombre del hotel.
document.querySelector<HTMLIFrameElement>('[data-mapa]')?.addEventListener('load', (e) => (e.target as HTMLElement).classList.add('on'));

// El WhatsApp flotante se aparta mientras se llena la reserva para no tapar los botones.
const wa = document.querySelector('.wa-flotante');
const res = document.querySelector('[data-reserva]');
if (wa && res) new IntersectionObserver(([e]) => wa.classList.toggle('oculto', e.isIntersecting && e.intersectionRatio > 0.15), { threshold: [0, 0.15, 0.3] }).observe(res);

// Onda en los botones: el brillo de agua nace donde entra el cursor.
document.addEventListener('pointermove', (e) => {
  const b = (e.target as HTMLElement).closest?.<HTMLElement>('.btn');
  if (!b) return;
  const r = b.getBoundingClientRect();
  b.style.setProperty('--x', `${e.clientX - r.left}px`);
  b.style.setProperty('--y', `${e.clientY - r.top}px`);
});

// Galería: carrusel con scroll-snap nativo (el scroll vertical de la página nunca se toca). Avanza solo y se pausa al interactuar.
const gal = document.querySelector<HTMLElement>('[data-galeria]');
if (gal) {
  const pista = gal.querySelector<HTMLElement>('[data-pista]')!;
  const items = [...pista.children] as HTMLElement[];
  const puntos = gal.querySelector<HTMLElement>('[data-g-puntos]')!;
  const dots = [...puntos.children] as HTMLElement[];
  let k = 0;
  let quieto = 0; // bits: 1 cursor, 2 foco, 4 toque reciente, 8 fuera de pantalla
  let timer = 0;
  const marcar = () => {
    items.forEach((it, n) => it.classList.toggle('act', n === k));
    dots.forEach((d, n) => { d.className = n < k ? 'hecha' : n === k && !reduce ? 'act' : n === k ? 'hecha' : ''; });
    puntos.classList.toggle('quieto', quieto !== 0);
  };
  const ir = (n: number, suave = true) => {
    k = (n + items.length) % items.length;
    const it = items[k];
    pista.scrollTo({ left: it.offsetLeft - (pista.clientWidth - it.clientWidth) / 2, behavior: suave && !reduce ? 'smooth' : 'auto' });
    marcar();
  };
  // Al arrastrar o usar el scroll horizontal, el activo es el más cercano al centro.
  let raf = 0;
  pista.addEventListener('scroll', () => {
    raf ||= requestAnimationFrame(() => {
      raf = 0;
      const c = pista.scrollLeft + pista.clientWidth / 2;
      const n = items.reduce((m, it, i) => (Math.abs(it.offsetLeft + it.clientWidth / 2 - c) < Math.abs(items[m].offsetLeft + items[m].clientWidth / 2 - c) ? i : m), 0);
      if (n !== k) { k = n; marcar(); }
    });
  }, { passive: true });
  gal.querySelector('[data-g-prev]')!.addEventListener('click', () => { toque(); ir(k - 1); });
  gal.querySelector('[data-g-next]')!.addEventListener('click', () => { toque(); ir(k + 1); });
  pista.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); toque(); ir(k + 1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); toque(); ir(k - 1); }
  });
  const bit = (b: number, on: boolean) => { quieto = on ? quieto | b : quieto & ~b; puntos.classList.toggle('quieto', quieto !== 0); };
  const toque = () => { bit(4, true); clearTimeout(timer); timer = window.setTimeout(() => bit(4, false), 6000); };
  gal.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') bit(1, true); });
  gal.addEventListener('pointerleave', () => bit(1, false));
  gal.addEventListener('pointerdown', toque);
  gal.addEventListener('focusin', () => bit(2, true));
  gal.addEventListener('focusout', () => bit(2, false));
  new IntersectionObserver(([e]) => bit(8, !e.isIntersecting), { threshold: 0.3 }).observe(gal);
  dots.forEach((d, n) => {
    d.firstElementChild!.addEventListener('animationend', () => { if (n === k) ir(k + 1); });
  });
  dots.forEach((d, n) => d.addEventListener('click', () => { toque(); ir(n); }));
  bit(8, true);
  ir(0, false);
}

// Agua: se descarga después de que la imagen del hero ya se ve, y solo si el visitante lo permite.
const nav = navigator as Navigator & { connection?: { saveData?: boolean } };
const quiereAgua = () => {
  if (reduce || nav.connection?.saveData) return false;
  try { return !!document.createElement('canvas').getContext('webgl'); } catch { return false; }
};
if (quiereAgua()) {
  const cargando = import('./agua');
  const arrancar = (cv: HTMLCanvasElement, img: HTMLImageElement | null, caus: number) => {
    if (!img) return;
    const go = () => cargando.then((m) => m.iniciar(cv, img, caus));
    img.complete ? go() : img.addEventListener('load', go, { once: true });
  };
  const idle = (f: () => void) => ('requestIdleCallback' in window ? requestIdleCallback(f, { timeout: 1500 }) : setTimeout(f, 300));
  const hero = document.querySelector<HTMLCanvasElement>('canvas[data-agua=hero]');
  const piscina = document.querySelector<HTMLCanvasElement>('canvas[data-agua=piscina]');
  const lanzar = () => {
    if (hero) arrancar(hero, document.querySelector<HTMLImageElement>('.hero-img'), 0.12);
    if (piscina) {
      new IntersectionObserver((es, io) => {
        if (!es[0].isIntersecting) return;
        io.disconnect();
        arrancar(piscina, piscina.parentElement!.querySelector('img'), 0.4);
      }, { rootMargin: '300px' }).observe(piscina);
    }
  };
  addEventListener('load', () => idle(lanzar), { once: true });
}

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

// Galería: el scroll vertical empuja la pista en horizontal.
const gal = document.querySelector<HTMLElement>('[data-galeria]');
const pista = document.querySelector<HTMLElement>('[data-pista]');
if (gal && pista && !reduce) {
  let raf = 0;
  const mover = () => {
    raf = 0;
    const r = gal.getBoundingClientRect();
    const p = Math.min(1, Math.max(0, -r.top / (r.height - innerHeight)));
    pista.style.setProperty('--max', `${Math.max(0, pista.scrollWidth - innerWidth)}px`);
    pista.style.setProperty('--p', p.toFixed(4));
  };
  addEventListener('scroll', () => { raf ||= requestAnimationFrame(mover); }, { passive: true });
  addEventListener('resize', mover);
  mover();

  // Lente de vidrio que sigue al cursor (en táctil, al tocar).
  const lente = document.querySelector<HTMLElement>('[data-lente]');
  const pegado = gal.querySelector<HTMLElement>('.g-pegado')!;
  const lugar = (e: PointerEvent) => {
    const r = pegado.getBoundingClientRect();
    lente!.style.transform = `translate3d(${e.clientX - r.left}px, ${e.clientY - r.top}px, 0)`;
  };
  if (lente) {
    pegado.addEventListener('pointermove', (e) => { lugar(e); lente.classList.add('on'); });
    pegado.addEventListener('pointerdown', (e) => { lugar(e); lente.classList.add('on'); });
    pegado.addEventListener('pointerleave', () => lente.classList.remove('on'));
    pegado.addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse') lente.classList.remove('on'); });
  }
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

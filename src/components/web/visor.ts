// Visor de cuarto: la tarjeta se expande (View Transitions, con fallback de escala) a un carrusel tipo historias.
const dlg = document.querySelector<HTMLDialogElement>('[data-dlg]');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const DUR = 6;

if (dlg) {
  const escena = dlg.querySelector<HTMLElement>('[data-escena]')!;
  const barras = dlg.querySelector<HTMLElement>('[data-barras]')!;
  const panel = dlg.querySelector<HTMLElement>('[data-panel]')!;
  const anuncio = dlg.querySelector<HTMLElement>('[data-anuncio]')!;
  let slides: HTMLElement[] = [];
  let i = 0;
  let origen: HTMLButtonElement | null = null;

  const pintar = () => {
    slides.forEach((s, k) => (k === i ? s.setAttribute('data-activa', '') : s.removeAttribute('data-activa')));
    [...barras.children].forEach((b, k) => {
      b.className = k < i ? 'hecha' : k === i ? (reduce ? 'hecha' : 'act') : '';
    });
    anuncio.textContent = slides.length > 1 ? `Foto ${i + 1} de ${slides.length}` : '';
  };
  const ir = (n: number) => { i = (n + slides.length) % slides.length; pintar(); };
  const pausa = (si: boolean) => { barras.classList.toggle('quieto', si); escena.firstElementChild?.toggleAttribute('data-quieto', si); };

  const cargar = (li: HTMLElement) => {
    const t = li.querySelector('template')!.content.cloneNode(true) as DocumentFragment;
    escena.replaceChildren(t.querySelector('.v-slides')!);
    panel.replaceChildren(t.querySelector('.v-info')!);
    slides = [...escena.querySelectorAll<HTMLElement>('.v-slide')];
    dlg.toggleAttribute('data-uno', slides.length < 2);
    barras.replaceChildren(...slides.map(() => {
      const b = document.createElement('li');
      b.style.setProperty('--dur', `${DUR}s`);
      b.append(document.createElement('i'));
      b.firstElementChild!.addEventListener('animationend', () => ir(i + 1));
      return b;
    }));
    i = 0;
    pintar();
  };

  // La foto de la tarjeta "vuela" al visor (y vuelve al cerrar): un clon que se escala y recorta desde el rectángulo de la tarjeta.
  // shortcut: se anima clip-path además de transform para no deformar la foto; si el navegador no anima, el visor aparece sin vuelo.
  const EASE = 'cubic-bezier(0.2, 0.7, 0.2, 1)';
  const imgDe = (el: Element | null) => (el?.matches('img') ? (el as HTMLImageElement) : (el?.querySelector('img') ?? null));
  const rectFoto = (img: HTMLImageElement) => {
    const r = img.getBoundingClientRect();
    if (getComputedStyle(img).objectFit !== 'contain' || !img.naturalWidth) return r;
    const k = Math.min(r.width / img.naturalWidth, r.height / img.naturalHeight);
    const w = img.naturalWidth * k, h = img.naturalHeight * k;
    return new DOMRect(r.left + (r.width - w) / 2, r.top + (r.height - h) / 2, w, h);
  };
  const vuelo = (src: string, fit: string, chico: DOMRect, grande: DOMRect, radio: number, ida: boolean) => {
    const g = document.createElement('figure');
    g.className = 'v-gh';
    const im = document.createElement('img');
    im.src = src; im.alt = ''; im.style.objectFit = fit;
    g.append(im);
    Object.assign(g.style, { left: `${grande.left}px`, top: `${grande.top}px`, width: `${grande.width}px`, height: `${grande.height}px` });
    dlg!.append(g);
    const k = Math.max(chico.width / grande.width, chico.height / grande.height);
    const px = (grande.width - chico.width / k) / 2, py = (grande.height - chico.height / k) / 2;
    const dx = chico.left + chico.width / 2 - (grande.left + grande.width / 2);
    const dy = chico.top + chico.height / 2 - (grande.top + grande.height / 2);
    const peque = { transform: `translate(${dx}px, ${dy}px) scale(${k})`, clipPath: `inset(${py}px ${px}px ${py}px ${px}px round ${radio / k}px)` };
    const lleno = { transform: 'none', clipPath: 'inset(0px round 0px)' };
    const a = g.animate(ida ? [peque, lleno] : [lleno, peque], { duration: ida ? 560 : 440, easing: EASE, fill: 'both' });
    return { g, fin: a.finished.catch(() => undefined) };
  };
  const quitar = async (g: HTMLElement) => {
    await g.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 260, delay: 260, fill: 'forwards' }).finished.catch(() => undefined);
    g.remove();
  };
  // Entrada escalonada del resto: fondo, flechas y barras, panel y sus líneas.
  const entrada = () => {
    const sube = (el: Element, delay: number, y = 18) =>
      el.animate([{ opacity: 0, transform: `translateY(${y}px)` }, { opacity: 1, transform: 'none' }], { duration: 420, delay, easing: EASE, fill: 'backwards' });
    dlg!.querySelector('.v-fondo-cap')!.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 380, easing: 'ease-out' });
    [...dlg!.querySelectorAll('.v-barras, .v-cerrar, .v-flecha')].forEach((el, n) => sube(el, 260 + n * 40, 0));
    sube(panel, 240, 34);
    [...panel.firstElementChild!.children].forEach((el, n) => sube(el, 340 + n * 55));
  };

  async function abrir(btn: HTMLButtonElement) {
    origen = btn;
    cargar(btn.closest('li')!);
    const cardImg = btn.querySelector<HTMLImageElement>('.cuarto-foto img');
    const card = btn.querySelector<HTMLElement>('.cuarto-foto');
    document.documentElement.style.overflow = 'hidden';
    const volar = !reduce && cardImg && card && !!cardImg.currentSrc;
    if (volar) dlg!.setAttribute('data-vuelo', '');
    dlg!.showModal();
    dlg!.querySelector<HTMLElement>('[data-cerrar]')!.focus({ preventScroll: true });
    const real = imgDe(escena.querySelector('.v-slide .v-foto'));
    if (!volar || !real) { dlg!.removeAttribute('data-vuelo'); return; }
    entrada();
    const radio = parseFloat(getComputedStyle(card).borderRadius) || 0;
    const { g, fin } = vuelo(cardImg.currentSrc, getComputedStyle(real).objectFit, card.getBoundingClientRect(), rectFoto(real), radio, true);
    await fin;
    dlg!.removeAttribute('data-vuelo');
    quitar(g);
  }

  async function cerrar(rapido = false) {
    if (!dlg!.open || dlg!.hasAttribute('data-cierra')) return;
    const card = origen?.querySelector<HTMLElement>('.cuarto-foto');
    const real = imgDe(escena.querySelector('.v-slide[data-activa] .v-foto'));
    const fin = () => { dlg!.close(); dlg!.removeAttribute('data-cierra'); dlg!.removeAttribute('data-vuelo'); dlg!.querySelectorAll('.v-gh').forEach((g) => g.remove()); document.documentElement.style.overflow = ''; origen?.focus({ preventScroll: true }); };
    if (rapido || reduce || !card || !real || !real.currentSrc) return fin();
    dlg!.setAttribute('data-cierra', '');
    const r = card.getBoundingClientRect();
    const dentro = r.bottom > 0 && r.top < innerHeight;
    const salida = (el: Element, y: number) => el.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: `translateY(${y}px)` }], { duration: 220, easing: 'ease-in', fill: 'forwards' });
    [...dlg!.querySelectorAll('.v-barras, .v-cerrar, .v-flecha')].forEach((el) => salida(el, 0));
    salida(panel, 24);
    const fondo = dlg!.querySelector('.v-fondo-cap')!.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 440, delay: 60, easing: 'ease-in', fill: 'forwards' });
    if (dentro) {
      dlg!.setAttribute('data-vuelo', '');
      const { fin: llego } = vuelo(real.currentSrc, getComputedStyle(real).objectFit, r, rectFoto(real), parseFloat(getComputedStyle(card).borderRadius) || 0, false);
      await llego;
    } else await fondo.finished.catch(() => undefined);
    fin();
  }

  document.querySelectorAll<HTMLButtonElement>('[data-visor]').forEach((b) => b.addEventListener('click', () => abrir(b)));
  dlg.querySelector('[data-cerrar]')!.addEventListener('click', () => cerrar());
  dlg.querySelector('[data-prev]')!.addEventListener('click', () => ir(i - 1));
  dlg.querySelector('[data-next]')!.addEventListener('click', () => ir(i + 1));
  dlg.addEventListener('cancel', (e) => { e.preventDefault(); cerrar(); });
  dlg.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') ir(i + 1);
    else if (e.key === 'ArrowLeft') ir(i - 1);
  });

  // Mantener presionado o pasar el cursor pausa; deslizar cambia de foto.
  let x0 = 0;
  escena.addEventListener('pointerenter', () => pausa(true));
  escena.addEventListener('pointerleave', () => pausa(false));
  escena.addEventListener('pointerdown', (e) => { x0 = e.clientX; pausa(true); });
  escena.addEventListener('pointerup', (e) => {
    const dx = e.clientX - x0;
    if (Math.abs(dx) > 50 && slides.length > 1) ir(dx < 0 ? i + 1 : i - 1);
    if (e.pointerType !== 'mouse') pausa(false);
  });
  escena.addEventListener('pointercancel', () => pausa(false));

  // "Reservar este cuarto": cierra y manda el tipo a la reserva, que muestra su calendario.
  panel.addEventListener('click', (e) => {
    const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('[data-reservar]');
    if (!a) return;
    e.preventDefault();
    cerrar(true);
    dispatchEvent(new CustomEvent('tipo-elegido', { detail: { id: a.dataset.reservar, nombre: a.dataset.nombre, max: Number(a.dataset.max) || 20 } }));
  });
}

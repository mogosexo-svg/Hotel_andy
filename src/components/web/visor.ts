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

  const conTransicion = async (cambio: () => void) => {
    if (reduce || !document.startViewTransition) return cambio();
    await document.startViewTransition(cambio).finished.catch(() => undefined);
  };

  async function abrir(btn: HTMLButtonElement) {
    origen = btn;
    cargar(btn.closest('li')!);
    const foto = btn.querySelector<HTMLElement>('.cuarto-foto');
    const grande = escena.querySelector<HTMLElement>('.v-slide .v-foto');
    document.documentElement.style.overflow = 'hidden';
    if (foto && grande) foto.style.viewTransitionName = 'cuarto';
    await conTransicion(() => {
      if (foto) foto.style.viewTransitionName = '';
      if (grande) grande.style.viewTransitionName = 'cuarto';
      dlg!.showModal();
      dlg!.querySelector<HTMLElement>('[data-cerrar]')!.focus();
    });
    if (grande) grande.style.viewTransitionName = '';
  }

  async function cerrar(rapido = false) {
    if (!dlg!.open) return;
    const foto = origen?.querySelector<HTMLElement>('.cuarto-foto');
    const grande = escena.querySelector<HTMLElement>('.v-slide[data-activa] .v-foto');
    const fin = () => { dlg!.close(); document.documentElement.style.overflow = ''; origen?.focus({ preventScroll: true }); };
    if (rapido || !foto || !grande || i !== 0) return fin();
    grande.style.viewTransitionName = 'cuarto';
    await conTransicion(() => { grande.style.viewTransitionName = ''; foto.style.viewTransitionName = 'cuarto'; fin(); });
    foto.style.viewTransitionName = '';
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

  // "Reservar este cuarto": cierra y lleva a la reserva con ese tipo preseleccionado.
  panel.addEventListener('click', (e) => {
    const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('[data-reservar]');
    if (!a) return;
    e.preventDefault();
    cerrar(true);
    dispatchEvent(new CustomEvent('tipo-elegido', { detail: { id: a.dataset.reservar, nombre: a.dataset.nombre } }));
    document.getElementById('reservar')?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
  });
}

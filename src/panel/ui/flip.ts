import { useLayoutEffect, useRef, type RefObject } from 'react';

/**
 * FLIP para listas: cuando un hijo (con `data-flip="clave"`) cambia de lugar, se desliza desde donde estaba;
 * cuando uno desaparece, su copia sale con un fundido hacia el lado. Solo transform y opacity.
 * Comunica causa y continuidad: al terminar una limpieza, esa tarjeta se va y las demás suben.
 */
export function useFlip(ref: RefObject<HTMLElement | null>, dep: unknown) {
  const previo = useRef(new Map<string, { top: number; left: number; nodo: HTMLElement }>());
  useLayoutEffect(() => {
    const cont = ref.current;
    if (!cont) return;
    const quieto = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const ahora = new Map<string, { top: number; left: number; nodo: HTMLElement }>();
    const base = cont.getBoundingClientRect();
    cont.querySelectorAll<HTMLElement>(':scope > [data-flip]').forEach((el) => {
      const r = el.getBoundingClientRect();
      ahora.set(el.dataset.flip as string, { top: r.top, left: r.left, nodo: el.cloneNode(true) as HTMLElement });
    });
    if (!quieto && previo.current.size) {
      cont.querySelectorAll<HTMLElement>(':scope > [data-flip]').forEach((el) => {
        const antes = previo.current.get(el.dataset.flip as string);
        const r = ahora.get(el.dataset.flip as string);
        if (!antes || !r) return;
        const dy = antes.top - r.top;
        const dx = antes.left - r.left;
        if (Math.abs(dy) < 2 && Math.abs(dx) < 2) return;
        el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: 380, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' });
      });
      // Los que se fueron: copia fantasma que se desvanece en su sitio
      previo.current.forEach((v, k) => {
        if (ahora.has(k)) return;
        const fantasma = v.nodo;
        fantasma.removeAttribute('data-flip');
        fantasma.setAttribute('aria-hidden', 'true');
        fantasma.querySelectorAll('button, a, input').forEach((x) => x.setAttribute('tabindex', '-1'));
        Object.assign(fantasma.style, { position: 'absolute', top: `${v.top - base.top}px`, left: `${v.left - base.left}px`, width: `${v.nodo.dataset.w ?? ''}`, pointerEvents: 'none', animation: 'none' });
        cont.appendChild(fantasma);
        const a = fantasma.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateX(32px)' }], { duration: 260, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' });
        a.onfinish = () => fantasma.remove();
      });
    }
    // Guardamos el ancho para el fantasma (se fija al crear la copia)
    ahora.forEach((v, k) => {
      const el = cont.querySelector<HTMLElement>(`:scope > [data-flip="${CSS.escape(k)}"]`);
      if (el) v.nodo.dataset.w = `${el.getBoundingClientRect().width}px`;
    });
    previo.current = ahora;
  }, [ref, dep]);
}

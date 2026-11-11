// Luz de agua (cáusticas) en un canvas diminuto que el CSS estira. Se pausa fuera de pantalla; con movimiento reducido, un solo cuadro.
const W = 120;
const H = 80;
const TAU = Math.PI * 2;

const token = (ctx: CanvasRenderingContext2D, name: string) => {
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  ctx.fillRect(0, 0, 1, 1);
  return ctx.getImageData(0, 0, 1, 1).data;
};

function iniciar(cv: HTMLCanvasElement) {
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  if (!ctx) return;
  cv.width = W;
  cv.height = H;
  const sombra = token(ctx, '--color-shade');
  const luz = token(ctx, '--color-light');
  const img = ctx.createImageData(W, H);
  const d = img.data;

  const cuadro = (t: number) => {
    let o = 0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const px = ((x / W) * 1.6 * TAU) % TAU - 250;
        const py = ((y / H) * TAU) % TAU - 250;
        let ix = px, iy = py, c = 1;
        for (let n = 0; n < 4; n++) {
          const tt = t * (1 - 3.5 / (n + 1));
          ix = px + Math.cos(tt - ix) + Math.sin(tt + iy);
          iy = py + Math.sin(tt - iy) + Math.cos(tt + ix);
          c += 1 / Math.hypot(px / (Math.sin(ix + tt) / 0.005), py / (Math.cos(iy + tt) / 0.005));
        }
        c = 1.17 - Math.pow(c / 4, 1.4);
        const k = Math.min(1, Math.pow(Math.abs(c), 8) * 0.9);
        d[o] = sombra[0] + (luz[0] - sombra[0]) * k;
        d[o + 1] = sombra[1] + (luz[1] - sombra[1]) * k;
        d[o + 2] = sombra[2] + (luz[2] - sombra[2]) * k;
        d[o + 3] = 255;
        o += 4;
      }
    }
    ctx.putImageData(img, 0, 0);
  };

  cuadro(2);
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  let visible = false;
  let ultimo = 0;
  const bucle = (ms: number) => {
    if (!visible) return;
    if (ms - ultimo > 80) {
      ultimo = ms;
      cuadro(2 + ms / 1900);
    }
    requestAnimationFrame(bucle);
  };
  new IntersectionObserver(([e]) => {
    const antes = visible;
    visible = e.isIntersecting;
    if (visible && !antes) requestAnimationFrame(bucle);
  }).observe(cv);
}

document.querySelectorAll<HTMLCanvasElement>('canvas[data-agua]').forEach(iniciar);

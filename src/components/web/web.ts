import './agua';
import './reserva';

// Mapa de Google: solo se carga al tocar el botón (RF-05), para no pagar su peso ni dar datos sin pedirlo.
document.querySelector<HTMLButtonElement>('[data-mapa]')?.addEventListener('click', (e) => {
  const b = e.currentTarget as HTMLButtonElement;
  const f = document.createElement('iframe');
  f.src = `https://www.google.com/maps?q=${encodeURIComponent(b.dataset.busqueda ?? '')}&output=embed`;
  f.title = 'Mapa de ubicación del hotel';
  f.loading = 'lazy';
  f.referrerPolicy = 'no-referrer-when-downgrade';
  b.replaceWith(f);
});

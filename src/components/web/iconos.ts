// Íconos de línea fina propios (trazo 1.5, sin relleno). Una sola fuente para Astro y para el JS del navegador.
const P: Record<string, string> = {
  chat: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H11l-4.5 4v-4A2.5 2.5 0 0 1 4 13.5Z"/><path d="M8.5 8.5h7M8.5 11.5h4.5"/>',
  flecha: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  izq: '<path d="M15 5l-7 7 7 7"/>',
  der: '<path d="M9 5l7 7-7 7"/>',
  cerrar: '<path d="M6 6l12 12M18 6L6 18"/>',
  pin: '<path d="M12 21s-6.5-6.2-6.5-11a6.5 6.5 0 0 1 13 0c0 4.8-6.5 11-6.5 11Z"/><circle cx="12" cy="10" r="2.3"/>',
  estrella: '<path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9 6.8 19.7l1-5.9L3.5 9.7l5.9-.8Z"/>',
  usuario: '<circle cx="12" cy="8.5" r="3.5"/><path d="M5 20c.8-3.8 3.6-5.5 7-5.5s6.2 1.7 7 5.5"/>',
  mas: '<path d="M12 5v14M5 12h14"/>',
  menos: '<path d="M5 12h14"/>',
  ok: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  calendario: '<rect x="4" y="5.5" width="16" height="14.5" rx="2.5"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>',
  escalera: '<path d="M4 19h4v-4h4v-4h4V7h4"/>',
  perro: '<path d="M5 12.5c0-3 2-5 5-5h4l2 2.5h2.5v3a4 4 0 0 1-4 4h-1V19M9 16.5V19M5 12.5l-1.5-3"/>',
  auto: '<path d="M4 16v-3.5L6.2 8h11.6L20 12.5V16M4 16h16M4 16v2.5M20 16v2.5"/><circle cx="8" cy="13.5" r=".7"/><circle cx="16" cy="13.5" r=".7"/>',
  taza: '<path d="M5 9h10v5a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4Z"/><path d="M15 10.5h1.5a2 2 0 0 1 0 4H15M8 4v2M11 4v2M3.5 20.5h13"/>',
  reloj: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  tarjeta: '<rect x="3.5" y="6" width="17" height="12" rx="2.5"/><path d="M3.5 10.5h17M7 15h3"/>',
  wifi: '<path d="M3 9.5a14 14 0 0 1 18 0M6 13a9.5 9.5 0 0 1 12 0M9 16.5a5 5 0 0 1 6 0"/><circle cx="12" cy="19.5" r=".8"/>',
  gota: '<path d="M12 3.5c3.2 4 5.5 6.9 5.5 10a5.5 5.5 0 0 1-11 0c0-3.1 2.3-6 5.5-10Z"/>',
  aire: '<path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M9.5 4.8 12 7l2.5-2.2M9.5 19.2 12 17l2.5 2.2"/>',
  sol: '<circle cx="12" cy="12" r="3.8"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4"/>',
  ola: '<path d="M3 9c2.5-2.5 4.5-2.5 7 0s4.5 2.5 7 0 2.5-2 4-1M3 15c2.5-2.5 4.5-2.5 7 0s4.5 2.5 7 0 2.5-2 4-1"/>',
};
export const ico = (n: string, tam = 22) =>
  `<svg viewBox="0 0 24 24" width="${tam}" height="${tam}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${P[n] ?? ''}</svg>`;

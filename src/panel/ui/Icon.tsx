import type { SVGProps } from 'react';

/** Íconos dibujados a mano: un solo trazo (2 px, redondeado) para todo el panel. */
const P = {
  libre: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8 12.2l2.8 2.8L16 9.5',
  ocupado: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 21a7.5 7.5 0 0 1 15 0',
  por_limpiar: 'M12 3s6.5 6.6 6.5 11a6.5 6.5 0 0 1-13 0C5.5 9.6 12 3 12 3z',
  limpiando: 'M12 3l1.9 5.3L19 10l-5.1 1.7L12 17l-1.9-5.3L5 10l5.1-1.7zM19 16v4M17 18h4',
  mantenimiento:
    'M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9z',
  inicio: 'M3 11l9-8 9 8M5.5 9.5V20h4.5v-6h4v6h4.5V9.5',
  cuartos: 'M4 21V4h10v17M14 10h6v11M2 21h20M8 8h2M8 12h2M8 16h2',
  inventario: 'M21 8l-9-5-9 5v8l9 5 9-5zM3 8l9 5 9-5M12 13v8',
  buscar: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-4.3-4.3',
  salir: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  cerrar: 'M18 6L6 18M6 6l12 12',
  siguiente: 'M9 6l6 6-6 6',
  llega: 'M12 4v14M6 12l6 6 6-6',
  sale: 'M12 20V6M6 12l6-6 6 6',
  alerta: 'M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  deshacer: 'M9 14L4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11',
  correo: 'M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM3 7l9 6 9-6',
  llave: 'M15 9a4 4 0 1 0-3.8 4H14l1.5 1.5L17 13l1.5 1.5L20 13V9zM7 9h.01',
  foto: 'M4 7h3l2-3h6l2 3h3a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  recargar: 'M20 11a8 8 0 0 0-14.5-4M4 4v4h4M4 13a8 8 0 0 0 14.5 4M20 20v-4h-4',
  dinero: 'M12 3v18M16 7.5C15.4 6.4 14 5.7 12 5.7c-2.2 0-4 1-4 2.8s1.6 2.5 4 3 4 1.2 4 3-1.8 2.8-4 2.8c-2 0-3.5-.8-4.2-2',
  cama: 'M3 19V6M3 15h18v4M21 15v-3a3 3 0 0 0-3-3h-7v6M7 12a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z',
  reloj: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  calendario: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  mas: 'M12 5v14M5 12h14',
  anterior: 'M15 6l-6 6 6 6',
  huespedes: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20a6.5 6.5 0 0 1 13 0M16 4.3a3.5 3.5 0 0 1 0 6.4M18 14a6.5 6.5 0 0 1 3.5 6',
  editar: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
  telefono: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z',
  mover: 'M5 9l-3 3 3 3M19 9l3 3-3 3M2 12h20',
  caja: 'M3 8h18v12H3zM3 8l2-4h14l2 4M10 12h4',
  comando: 'M9 6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3z',
  ajustes: 'M4 7h9M17 7h3M4 17h3M11 17h9M15 4v6M9 14v6',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  factura: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6M9 16h3',
  atras: 'M15 6l-6 6 6 6',
  // Categorías de insumos (claves guardadas en `categorias.icono`)
  bano: 'M3 12h18v3a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4zM6 12V6a2 2 0 0 1 4 0M7 19l-1 2M17 19l1 2',
  lenceria: 'M3 19V6M3 15h18v4M21 15v-3a3 3 0 0 0-3-3h-7v6M7 12a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z',
  limpieza: 'M9 21h6a1 1 0 0 0 1-1v-7l-2-3h-4l-2 3v7a1 1 0 0 0 1 1zM10 10V7h4v3M14 7l4-2M18 9.5h2.5M18 12.5h2',
  piscina: 'M9 3v10M15 3v10M9 7h6M9 11h6M3 17c2 0 2-1.5 4.5-1.5S10 17 12 17s2-1.5 4.5-1.5S19 17 21 17M3 21c2 0 2-1.5 4.5-1.5S10 21 12 21s2-1.5 4.5-1.5S19 21 21 21',
  bebidas: 'M10 3h4v3l2 3v11a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V9l2-3zM8 13h8',
  snacks: 'M6 4h12l-1 16H7zM6 4l2 3h8l2-3M9 12h6',
  amenities: 'M9 3h6v3H9zM8 6h8l1 4v10a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V10zM10 13h4',
  lavanderia: 'M4 9h16l-1.5 10a1 1 0 0 1-1 .9h-11a1 1 0 0 1-1-.9zM8 9l1.5-4h5L16 9M9 13v3M15 13v3',
  luz: 'M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z',
  cocina: 'M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M17 3c-2 0-3 2.5-3 6 0 2 1 3 3 3v9M17 3v18',
  otros: 'M21 8l-9-5-9 5v8l9 5 9-5zM3 8l9 5 9-5M12 13v8',
} as const;

/** Claves de categoría que ofrece el selector (la dueña elige por dibujo, no por texto). */
export const CLAVES_CAT = ['bano', 'lenceria', 'limpieza', 'piscina', 'bebidas', 'snacks', 'amenities', 'lavanderia', 'mantenimiento', 'luz', 'cocina', 'otros'] as const satisfies readonly IconoNombre[];
export type ClaveCat = (typeof CLAVES_CAT)[number];
export const NOMBRE_CAT: Record<ClaveCat, string> = {
  bano: 'Baño y papel',
  lenceria: 'Ropa de cama',
  limpieza: 'Limpieza',
  piscina: 'Piscina',
  bebidas: 'Bebidas',
  snacks: 'Snacks',
  amenities: 'Jabón y aseo',
  lavanderia: 'Lavandería',
  mantenimiento: 'Mantenimiento',
  luz: 'Luz y electricidad',
  cocina: 'Cocina',
  otros: 'Otros',
};
/** Clave guardada → clave dibujable. Un emoji viejo o un valor desconocido cae al ícono genérico. */
export const claveCat = (v: string | null | undefined): ClaveCat => ((CLAVES_CAT as readonly string[]).includes(v ?? '') ? (v as ClaveCat) : 'otros');

export type IconoNombre = keyof typeof P;

/** Ícono de una categoría a partir de su clave (nunca pinta emoji). */
export function IconoCat({ clave, size = 'md' }: { clave: string | null | undefined; size?: 'sm' | 'md' | 'lg' }) {
  return <Icon name={claveCat(clave)} size={size} />;
}

interface Props extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconoNombre;
  size?: 'sm' | 'md' | 'lg';
}

export function Icon({ name, size = 'md', className = '', ...rest }: Props) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={`ico ${size === 'sm' ? 'ico--sm' : size === 'lg' ? 'ico--lg' : ''} ${className}`}
      {...rest}
    >
      <path d={P[name]} />
    </svg>
  );
}

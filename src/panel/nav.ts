import type { Rol } from './lib/estados';
import type { IconoNombre } from './ui/Icon';

export type Pagina = 'inicio' | 'cuartos' | 'reservas' | 'limpieza' | 'inventario';

export const PAGINAS: { id: Pagina; texto: string; icono: IconoNombre; roles: Rol[] }[] = [
  { id: 'inicio', texto: 'Inicio', icono: 'inicio', roles: ['duena', 'recepcion'] },
  { id: 'cuartos', texto: 'Cuartos', icono: 'cuartos', roles: ['duena', 'recepcion'] },
  { id: 'reservas', texto: 'Reservas', icono: 'calendario', roles: ['duena', 'recepcion'] },
  { id: 'limpieza', texto: 'Limpieza', icono: 'limpiando', roles: ['duena', 'recepcion', 'limpieza'] },
  { id: 'inventario', texto: 'Insumos', icono: 'inventario', roles: ['duena', 'recepcion'] },
];

export const paginasDe = (rol: Rol) => PAGINAS.filter((p) => p.roles.includes(rol));

/** Pantalla inicial: lo que cada rol necesita primero. */
export const paginaInicial = (rol: Rol): Pagina => (rol === 'limpieza' ? 'limpieza' : rol === 'recepcion' ? 'cuartos' : 'inicio');

export function paginaDeHash(hash: string, rol: Rol): Pagina {
  const id = hash.replace(/^#\/?/, '') as Pagina;
  return paginasDe(rol).some((p) => p.id === id) ? id : paginaInicial(rol);
}

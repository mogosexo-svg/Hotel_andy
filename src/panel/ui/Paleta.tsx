import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon, type IconoNombre } from './Icon';
import { useCuartos } from '../data/cuartos';
import { ESTADOS } from '../lib/estados';
import { sinTildes } from '../lib/format';
import type { Pagina } from '../nav';
import { pedirAccionInsumos } from '../data/insumos';

interface Resultado {
  id: string;
  icono: IconoNombre;
  texto: string;
  detalle?: string;
  ir: () => void;
}


/** Ctrl+K: busca cuartos y salta a cualquier pantalla. */
export function Paleta({
  paginas,
  onIr,
  onCerrar,
}: {
  paginas: { id: Pagina; texto: string; icono: IconoNombre }[];
  onIr: (p: Pagina) => void;
  onCerrar: () => void;
}) {
  const { cuartos, abrirCuarto } = useCuartos();
  const [q, setQ] = useState('');
  const [activo, setActivo] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), []);

  const resultados = useMemo<Resultado[]>(() => {
    const n = sinTildes(q.trim());
    const pag: Resultado[] = paginas
      .filter((p) => !n || sinTildes(p.texto).includes(n))
      .map((p) => ({ id: `p-${p.id}`, icono: p.icono, texto: `Ir a ${p.texto}`, ir: () => onIr(p.id) }));
    const cu: Resultado[] = (n
      ? cuartos.filter((c) => sinTildes(`${c.numero} ${c.tipo} ${ESTADOS[c.estado].palabra} piso ${c.piso}`).includes(n))
      : []
    )
      .slice(0, 8)
      .map((c) => ({
        id: `c-${c.id}`,
        icono: c.estado,
        texto: `Cuarto ${c.numero}`,
        detalle: `${c.tipo} · ${ESTADOS[c.estado].palabra}`,
        ir: () => {
          onIr('cuartos');
          abrirCuarto(c.id);
        },
      }));
    const ins: Resultado[] = paginas.some((p) => p.id === 'inventario')
      ? [
          { id: 'a-venta', icono: 'dinero' as IconoNombre, texto: 'Registrar una venta', ir: () => (onIr('inventario'), pedirAccionInsumos('venta')) },
          { id: 'a-compra', icono: 'factura' as IconoNombre, texto: 'Cargar compra desde la factura', ir: () => (onIr('inventario'), pedirAccionInsumos('compra')) },
        ].filter((a) => !n || sinTildes(a.texto).includes(n))
      : [];
    return [...cu, ...ins, ...pag];
  }, [q, cuartos, paginas, onIr, abrirCuarto]);

  function elegir(r: Resultado | undefined) {
    if (!r) return;
    onCerrar();
    r.ir();
  }

  return (
    <div className="hoja-fondo paleta-fondo" onMouseDown={(e) => e.target === e.currentTarget && onCerrar()}>
      <div className="paleta" role="dialog" aria-modal="true" aria-label="Búsqueda rápida">
        <div className="paleta__campo">
          <Icon name="buscar" />
          <input
            ref={input}
            value={q}
            placeholder="Busca un cuarto (204, triple, por limpiar) o una pantalla"
            aria-label="Buscar"
            role="combobox"
            aria-expanded="true"
            aria-controls="paleta-lista"
            onChange={(e) => {
              setQ(e.target.value);
              setActivo(0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onCerrar();
              else if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActivo((a) => Math.min(a + 1, resultados.length - 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActivo((a) => Math.max(a - 1, 0));
              } else if (e.key === 'Enter') elegir(resultados[activo]);
            }}
          />
          <kbd>Esc</kbd>
        </div>
        <ul id="paleta-lista" className="paleta__lista" role="listbox">
          {resultados.map((r, i) => (
            <li key={r.id} role="option" aria-selected={i === activo}>
              <button
                type="button"
                className={`paleta__fila ${i === activo ? 'is-activo' : ''}`}
                onMouseEnter={() => setActivo(i)}
                onClick={() => elegir(r)}
              >
                <Icon name={r.icono} size="sm" />
                <span>{r.texto}</span>
                {r.detalle && <span className="paleta__detalle">{r.detalle}</span>}
              </button>
            </li>
          ))}
          {resultados.length === 0 && <li className="paleta__vacio">No encontramos nada con “{q}”.</li>}
        </ul>
      </div>
    </div>
  );
}

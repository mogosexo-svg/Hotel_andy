import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { usePerfil } from '../data/sesion';
import { nivelStock, esBajo, type Nivel } from '../lib/stock';
import { numero } from '../lib/format';
import { Aviso, BarraStock, ErrorCarga, Skeleton } from '../ui/kit';
import { Icon } from '../ui/Icon';

interface Producto {
  id: string;
  nombre: string;
  categoriaId: string;
  unidad: string;
  stock: number | null;
  minimo: number | null;
  nivel: Nivel;
}
interface Categoria {
  id: string;
  nombre: string;
}

type Filtro = 'todo' | 'bajos' | string;

export function Inventario() {
  const { hotelId } = usePerfil();
  const [prods, setProds] = useState<Producto[] | null>(null);
  const [cats, setCats] = useState<Categoria[]>([]);
  const [error, setError] = useState(false);
  const [filtro, setFiltro] = useState<Filtro>('todo');

  const cargar = useCallback(async () => {
    const [p, c] = await Promise.all([
      supabase
        .from('productos')
        .select('id, nombre, categoria_id, unidad, stock, minimo')
        .eq('hotel_id', hotelId)
        .eq('activo', true),
      supabase.from('categorias').select('id, nombre, orden').eq('hotel_id', hotelId).order('orden'),
    ]);
    if (p.error || c.error) return setError(true);
    setError(false);
    setCats((c.data ?? []).map((x) => ({ id: x.id, nombre: x.nombre })));
    setProds(
      (p.data ?? []).map((x) => ({
        id: x.id,
        nombre: x.nombre,
        categoriaId: x.categoria_id,
        unidad: x.unidad,
        stock: x.stock,
        minimo: x.minimo,
        nivel: nivelStock(x.stock, x.minimo, x.unidad),
      })),
    );
  }, [hotelId]);

  useEffect(() => {
    void cargar().catch(() => setError(true));
    const canal = supabase
      .channel(`insumos-${hotelId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'productos' }, () => void cargar())
      .subscribe();
    return () => {
      void supabase.removeChannel(canal);
    };
  }, [cargar, hotelId]);

  const bajos = useMemo(() => (prods ?? []).filter((p) => esBajo(p.nivel.nivel)), [prods]);
  const bajosPorCat = useMemo(() => {
    const m = new Map<string, number>();
    bajos.forEach((p) => m.set(p.categoriaId, (m.get(p.categoriaId) ?? 0) + 1));
    return m;
  }, [bajos]);

  const grupos = useMemo(() => {
    const lista = prods ?? [];
    const orden = (a: Producto, b: Producto) =>
      Number(esBajo(b.nivel.nivel)) - Number(esBajo(a.nivel.nivel)) || a.nombre.localeCompare(b.nombre, 'es');
    return cats
      .filter((c) => filtro === 'todo' || filtro === c.id)
      .map((c) => ({ cat: c, items: lista.filter((p) => p.categoriaId === c.id).sort(orden) }))
      .filter((g) => g.items.length > 0);
  }, [prods, cats, filtro]);

  return (
    <section className="pantalla">
      <header className="pantalla__cab">
        <div>
          <h1>Insumos</h1>
          <p className="pantalla__sub">
            {prods === null
              ? 'Contando…'
              : bajos.length
                ? `${bajos.length} ${bajos.length === 1 ? 'se está acabando' : 'se están acabando'}`
                : 'Nada se está acabando'}
          </p>
        </div>
      </header>

      {error ? (
        <ErrorCarga onReintentar={() => void cargar()} />
      ) : prods === null ? (
        <div className="pila" aria-busy="true" aria-label="Cargando insumos">
          <Skeleton h="3rem" w="70%" r="999px" />
          <Skeleton h="5.5rem" r="14px" />
          <Skeleton h="5.5rem" r="14px" />
          <Skeleton h="5.5rem" r="14px" />
        </div>
      ) : prods.length === 0 ? (
        <Aviso
          icono="inventario"
          titulo="Todavía no hay productos"
          texto="Cuando se carguen los insumos del hotel, verás aquí cuánto queda de cada uno."
        />
      ) : (
        <>
          <div className="filtros filtros--scroll" role="group" aria-label="Filtrar por categoría">
            <button type="button" className="filtro" aria-pressed={filtro === 'todo'} onClick={() => setFiltro('todo')}>
              Todo
            </button>
            {bajos.length > 0 && (
              <button type="button" className="filtro" aria-pressed={filtro === 'bajos'} onClick={() => setFiltro('bajos')}>
                <Icon name="alerta" size="sm" /> Se está acabando
                <span className="filtro__n filtro__n--alerta">{bajos.length}</span>
              </button>
            )}
            {cats.map((c) => (
              <button key={c.id} type="button" className="filtro" aria-pressed={filtro === c.id} onClick={() => setFiltro(c.id)}>
                {c.nombre}
                {!!bajosPorCat.get(c.id) && <span className="filtro__n filtro__n--alerta">{bajosPorCat.get(c.id)}</span>}
              </button>
            ))}
          </div>

          {filtro === 'bajos' ? (
            <ul className="insumos">
              {bajos.map((p) => (
                <Fila key={p.id} p={p} />
              ))}
            </ul>
          ) : (
            <>
              {filtro === 'todo' && bajos.length > 0 && (
                <div className="grupo grupo--alerta">
                  <h2 className="grupo__titulo">
                    <Icon name="alerta" /> Se está acabando
                  </h2>
                  <ul className="insumos">
                    {bajos.map((p) => (
                      <Fila key={p.id} p={p} />
                    ))}
                  </ul>
                </div>
              )}
              {grupos.map(({ cat, items }) => {
                const n = bajosPorCat.get(cat.id) ?? 0;
                return (
                  <div className="grupo" key={cat.id}>
                    <h2 className="grupo__titulo">
                      {cat.nombre}
                      <span className={`grupo__estado ${n ? 'is-alerta' : ''}`}>
                        {n ? `${n} por comprar` : 'Todo bien'}
                      </span>
                    </h2>
                    <ul className="insumos">
                      {items.map((p) => (
                        <Fila key={p.id} p={p} />
                      ))}
                    </ul>
                  </div>
                );
              })}
            </>
          )}
        </>
      )}
    </section>
  );
}

function Fila({ p }: { p: Producto }) {
  const { nivel, pct, frase } = p.nivel;
  return (
    <li className="insumo">
      <div className="insumo__cab">
        <span className="insumo__nombre">{p.nombre}</span>
        <span className={`insumo__frase n-${nivel}`}>{frase}</span>
      </div>
      <BarraStock nivel={nivel} pct={pct} />
      <div className="insumo__pie">
        {nivel === 'sin_contar' ? (
          <span>Nadie ha contado este producto todavía</span>
        ) : p.minimo != null ? (
          <span>Mínimo {numero(p.minimo)}</span>
        ) : (
          <span>Sin mínimo</span>
        )}
      </div>
    </li>
  );
}

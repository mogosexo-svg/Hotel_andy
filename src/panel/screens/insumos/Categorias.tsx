import { useState } from 'react';
import { Boton } from '../../ui/kit';
import { Icon } from '../../ui/Icon';
import { useToast } from '../../ui/Toast';
import type { Cat, InsumosApi } from '../../data/insumos';
import { Campo, HojaEstable } from './piezas';

/** Íconos para elegir: la dueña los reconoce de un vistazo. */
export const ICONOS_CAT = ['🧻', '🛏️', '🧽', '🏊', '🥤', '🍫', '🧴', '🧺', '🔧', '💡', '🍽️', '📦'];

function SelectorIcono({ valor, onChange }: { valor: string | null; onChange: (i: string) => void }) {
  return (
    <div className="ins-iconos" role="radiogroup" aria-label="Ícono">
      {ICONOS_CAT.map((i) => (
        <button key={i} type="button" role="radio" aria-checked={valor === i} aria-label={`Ícono ${i}`} className="ins-icono-op" onClick={() => onChange(i)}>
          {i}
        </button>
      ))}
    </div>
  );
}

/** RF-60: crear, renombrar, ordenar, ícono y borrar categorías. */
export function Categorias({ api, onCerrar }: { api: InsumosApi; onCerrar: () => void }) {
  const { cats, prods } = api;
  const toast = useToast();
  const [editando, setEditando] = useState<string | 'nueva' | null>(null);
  const [nombre, setNombre] = useState('');
  const [icono, setIcono] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [borrando, setBorrando] = useState<Cat | null>(null);
  const [destino, setDestino] = useState('');
  const [trabajando, setTrabajando] = useState(false);
  const cuenta = (id: string) => (prods ?? []).filter((p) => p.categoriaId === id).length;

  function abrir(c: Cat | 'nueva') {
    setEditando(c === 'nueva' ? 'nueva' : c.id);
    setNombre(c === 'nueva' ? '' : c.nombre);
    setIcono(c === 'nueva' ? ICONOS_CAT[11] : c.icono);
    setError(null);
  }

  async function guardar() {
    const n = nombre.trim();
    if (!n) return setError('Ponle un nombre a la categoría.');
    if (cats.some((c) => c.id !== editando && c.nombre.toLowerCase() === n.toLowerCase())) return setError('Ya existe una categoría con ese nombre.');
    setTrabajando(true);
    const ok = editando === 'nueva' ? await api.crearCategoria(n, icono, (cats.at(-1)?.orden ?? 0) + 1) : await api.editarCategoria(editando as string, { nombre: n, icono });
    setTrabajando(false);
    if (ok) setEditando(null);
  }

  async function borrar(c: Cat) {
    setTrabajando(true);
    const r = await api.borrarCategoria(c.id);
    setTrabajando(false);
    if (r === 'ok') {
      toast.avisar(`Se borró la categoría "${c.nombre}"`);
      setBorrando(null);
    } else if (r === 'con_productos') {
      setBorrando(c);
      setDestino(cats.find((x) => x.id !== c.id)?.id ?? '');
    }
  }

  async function moverYBorrar(c: Cat) {
    setTrabajando(true);
    const ok = await api.moverProductos(c.id, destino);
    const r = ok ? await api.borrarCategoria(c.id) : 'error';
    setTrabajando(false);
    if (r === 'ok') {
      toast.avisar(`Productos movidos y categoría "${c.nombre}" borrada`);
      setBorrando(null);
    }
  }

  if (editando)
    return (
      <HojaEstable titulo={editando === 'nueva' ? 'Categoría nueva' : 'Editar categoría'} onCerrar={() => setEditando(null)}>
        <form
          className="ins-form"
          onSubmit={(e) => {
            e.preventDefault();
            void guardar();
          }}
        >
          <Campo etiqueta="Nombre" error={error}>
            {(id) => <input id={id} className="input" value={nombre} autoFocus autoComplete="off" onChange={(e) => setNombre(e.target.value)} placeholder="Ej.: Cocina" />}
          </Campo>
          <div className="campo">
            <span className="campo__etiqueta">Ícono</span>
            <SelectorIcono valor={icono} onChange={setIcono} />
          </div>
          <div className="ins-acciones ins-acciones--fila">
            <Boton variante="quiet" onClick={() => setEditando(null)}>
              Cancelar
            </Boton>
            <Boton type="submit" cargando={trabajando}>
              Guardar
            </Boton>
          </div>
        </form>
      </HojaEstable>
    );

  return (
    <HojaEstable titulo="Categorías" onCerrar={onCerrar}>
      <div className="ins-detalle">
        {borrando && (
          <div className="ins-alerta" role="alert">
            <p>
              <strong>Mueve primero sus productos a otra categoría.</strong> “{borrando.nombre}” tiene {cuenta(borrando.id)} {cuenta(borrando.id) === 1 ? 'producto' : 'productos'}.
            </p>
            {cats.length > 1 ? (
              <>
                <Campo etiqueta="Moverlos a">
                  {(id) => (
                    <select id={id} className="input" value={destino} onChange={(e) => setDestino(e.target.value)}>
                      {cats
                        .filter((x) => x.id !== borrando.id)
                        .map((x) => (
                          <option key={x.id} value={x.id}>
                            {x.nombre}
                          </option>
                        ))}
                    </select>
                  )}
                </Campo>
                <div className="ins-acciones ins-acciones--fila">
                  <Boton variante="quiet" onClick={() => setBorrando(null)}>
                    Mejor no
                  </Boton>
                  <Boton variante="danger" cargando={trabajando} onClick={() => void moverYBorrar(borrando)}>
                    Mover y borrar
                  </Boton>
                </div>
              </>
            ) : (
              <p>Crea otra categoría para poder mover los productos.</p>
            )}
          </div>
        )}
        <ul className="ins-cats">
          {cats.map((c, i) => (
            <li key={c.id} className="ins-cat">
              <span className="ins-cat__ico" aria-hidden="true">
                {c.icono ?? '📦'}
              </span>
              <span className="ins-cat__nombre">
                {c.nombre}
                <span className="ins-ayuda">
                  {' '}
                  · {cuenta(c.id)} {cuenta(c.id) === 1 ? 'producto' : 'productos'}
                </span>
              </span>
              <span className="ins-cat__acc">
                <button type="button" className="icono-btn" aria-label={`Subir ${c.nombre}`} disabled={i === 0} onClick={() => void api.ordenarCategoria(c.id, -1)}>
                  <Icon name="sale" />
                </button>
                <button type="button" className="icono-btn" aria-label={`Bajar ${c.nombre}`} disabled={i === cats.length - 1} onClick={() => void api.ordenarCategoria(c.id, 1)}>
                  <Icon name="llega" />
                </button>
                <button type="button" className="icono-btn" aria-label={`Editar ${c.nombre}`} onClick={() => abrir(c)}>
                  <Icon name="editar" />
                </button>
                <button type="button" className="icono-btn ins-cat__borrar" aria-label={`Borrar ${c.nombre}`} onClick={() => void borrar(c)}>
                  <Icon name="cerrar" />
                </button>
              </span>
            </li>
          ))}
        </ul>
        <Boton block icono="mas" onClick={() => abrir('nueva')}>
          Categoría nueva
        </Boton>
      </div>
    </HojaEstable>
  );
}

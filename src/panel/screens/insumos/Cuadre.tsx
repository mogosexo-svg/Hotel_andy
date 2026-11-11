import { useCallback, useEffect, useState } from 'react';
import { Aviso, Boton, Contador, ErrorCarga, Skeleton } from '../../ui/kit';
import { Icon } from '../../ui/Icon';
import type { Cuadre as DatosCuadre, InsumosApi } from '../../data/insumos';
import { margenPct } from './logica';
import { dinero, fechaCorta, hoyEC, numero } from '../../lib/format';

const MEDIOS = { efectivo: { palabra: 'Efectivo', c: 'var(--serie-1)' }, transferencia: { palabra: 'Transferencia', c: 'var(--serie-2)' }, al_cuarto: { palabra: 'Cargado al cuarto', c: 'var(--serie-3)' } } as const;

function mueve(fecha: string, dias: number): string {
  const d = new Date(fecha + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** RF-63: lo que se vendió en el día, por producto, categoría y forma de pago, con el margen. */
export function CuadreDia({ api, onVender }: { api: InsumosApi; onVender: () => void }) {
  const { cuadre } = api;
  const hoy = hoyEC();
  const [fecha, setFecha] = useState(hoy);
  const [datos, setDatos] = useState<DatosCuadre | null>(null);
  const [error, setError] = useState(false);

  const cargar = useCallback(
    async (f: string) => {
      setDatos(null);
      const d = await cuadre(f);
      if (!d) return setError(true);
      setError(false);
      setDatos(d);
    },
    [cuadre],
  );
  useEffect(() => {
    void cargar(fecha);
  }, [cargar, fecha]);

  const esHoy = fecha === hoy;
  const nav = (
    <div className="ins-fecha">
      <button type="button" className="icono-btn" aria-label="Día anterior" onClick={() => setFecha(mueve(fecha, -1))}>
        <Icon name="atras" />
      </button>
      <label className="ins-fecha__centro">
        <span className="sr-only">Día del cuadre</span>
        <span className="ins-fecha__texto">{esHoy ? 'Hoy' : fechaCorta(fecha)}</span>
        <input type="date" className="ins-fecha__input" max={hoy} value={fecha} onChange={(e) => e.target.value && setFecha(e.target.value)} />
      </label>
      <button type="button" className="icono-btn" aria-label="Día siguiente" disabled={esHoy} onClick={() => setFecha(mueve(fecha, 1))}>
        <Icon name="siguiente" />
      </button>
      {!esHoy && (
        <Boton variante="ghost" onClick={() => setFecha(hoy)}>
          Ir a hoy
        </Boton>
      )}
    </div>
  );

  let cuerpo;
  if (error) cuerpo = <ErrorCarga onReintentar={() => void cargar(fecha)} />;
  else if (!datos)
    cuerpo = (
      <div className="pila" aria-busy="true" aria-label="Calculando el cuadre">
        <Skeleton h="9rem" r="20px" />
        <Skeleton h="6rem" r="14px" />
        <Skeleton h="6rem" r="14px" />
      </div>
    );
  else if (datos.por_producto.length === 0)
    cuerpo = (
      <Aviso
        icono="dinero"
        titulo={esHoy ? 'Hoy todavía no hay ventas' : 'Ese día no hubo ventas'}
        texto="Cuando se venda una bebida o un snack, aparece aquí con su margen."
        accion={esHoy ? { texto: 'Registrar una venta', onClick: onVender, icono: 'mas' } : undefined}
      />
    );
  else {
    const mp = margenPct(datos.total_centavos, datos.margen_centavos);
    const maxCat = Math.max(1, ...datos.por_categoria.map((c) => c.total_centavos));
    const totalMedios = datos.por_medio.reduce((s, m) => s + m.total_centavos, 0) || 1;
    cuerpo = (
      <>
        <div className="ins-cifras">
          <div className="ins-cifra ins-cifra--grande">
            <p className="ins-cifra__t">Se vendió</p>
            <p className="ins-cifra__n">
              <Contador valor={datos.total_centavos} formato={(n) => dinero(Math.round(n))} />
            </p>
          </div>
          <div className="ins-cifra">
            <p className="ins-cifra__t">Costó</p>
            <p className="ins-cifra__n ins-cifra__n--m">{dinero(datos.costo_centavos)}</p>
          </div>
          <div className="ins-cifra">
            <p className="ins-cifra__t">Ganancia</p>
            <p className="ins-cifra__n ins-cifra__n--m">
              {dinero(datos.margen_centavos)}
              {mp != null && <span className="ins-cifra__pct"> {mp} %</span>}
            </p>
          </div>
        </div>
        {datos.sin_costo > 0 && (
          <p className="ins-alerta" role="status">
            <Icon name="alerta" size="sm" /> {datos.sin_costo} {datos.sin_costo === 1 ? 'venta sin costo cargado' : 'ventas sin costo cargado'}: la ganancia está incompleta. Ponle el precio de compra a esos productos.
          </p>
        )}

        <section className="card ins-grafico" aria-labelledby="g-pago">
          <h2 id="g-pago" className="ins-sub">
            Cómo se pagó
          </h2>
          <div className="ins-apilada" role="img" aria-label={datos.por_medio.map((m) => `${MEDIOS[m.medio].palabra} ${dinero(m.total_centavos)}`).join(', ')}>
            {datos.por_medio.map((m) => (
              <span key={m.medio} style={{ flexGrow: m.total_centavos, background: MEDIOS[m.medio].c }} title={`${MEDIOS[m.medio].palabra}: ${dinero(m.total_centavos)}`} />
            ))}
          </div>
          <ul className="ins-leyenda">
            {datos.por_medio.map((m) => (
              <li key={m.medio}>
                <span className="ins-leyenda__color" style={{ background: MEDIOS[m.medio].c }} aria-hidden="true" />
                <span>{MEDIOS[m.medio].palabra}</span>
                <strong>{dinero(m.total_centavos)}</strong>
                <span className="ins-ayuda">{Math.round((m.total_centavos / totalMedios) * 100)} %</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="card ins-grafico" aria-labelledby="g-cat">
          <h2 id="g-cat" className="ins-sub">
            Por categoría
          </h2>
          <ul className="ins-barras">
            {datos.por_categoria.map((c) => (
              <li key={c.categoria}>
                <span className="ins-barras__nombre">{c.categoria}</span>
                <span className="ins-barras__pista" aria-hidden="true">
                  <span style={{ width: `${(c.total_centavos / maxCat) * 100}%` }} />
                </span>
                <strong>{dinero(c.total_centavos)}</strong>
              </li>
            ))}
          </ul>
        </section>

        <section className="card ins-grafico" aria-labelledby="g-prod">
          <h2 id="g-prod" className="ins-sub">
            Por producto
          </h2>
          <div className="ins-tabla-caja">
            <table className="ins-tabla">
              <thead>
                <tr>
                  <th scope="col">Producto</th>
                  <th scope="col" className="num-col">
                    Cant.
                  </th>
                  <th scope="col" className="num-col">
                    Total
                  </th>
                  <th scope="col" className="num-col">
                    Ganancia
                  </th>
                </tr>
              </thead>
              <tbody>
                {datos.por_producto.map((p) => (
                  <tr key={p.producto}>
                    <th scope="row">
                      {p.producto}
                      <span className="ins-ayuda"> · {p.categoria}</span>
                    </th>
                    <td className="num-col">{numero(p.cantidad)}</td>
                    <td className="num-col">{dinero(p.total_centavos)}</td>
                    <td className="num-col">{dinero(p.margen_centavos)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row" colSpan={2}>
                    Total
                  </th>
                  <td className="num-col">{dinero(datos.total_centavos)}</td>
                  <td className="num-col">{dinero(datos.margen_centavos)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      </>
    );
  }

  return (
    <div className="ins-cuadre">
      {nav}
      {cuerpo}
    </div>
  );
}

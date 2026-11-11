import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './styles/tokens.css';
import './styles/base.css';
import './styles/shell.css';
import './styles/screens.css';
import { SesionProvider, useSesion, usePerfil } from './data/sesion';
import { CuartosProvider, useCuartos } from './data/cuartos';
import { ToastProvider } from './ui/Toast';
import { Aviso, Boton, Hoja, Skeleton } from './ui/kit';
import { Icon } from './ui/Icon';
import { Paleta } from './ui/Paleta';
import { Login } from './screens/Login';
import { Inicio } from './screens/Inicio';
import { Mapa } from './screens/Mapa';
import { Reservas } from './screens/reservas/Reservas';
import { Limpieza } from './screens/Limpieza';
import { Inventario } from './screens/Inventario';
import { Config } from './screens/config/Config';
import { paginaDeHash, paginasDe, type Pagina } from './nav';
import { ROL_PALABRA } from './lib/estados';

export default function App() {
  return (
    <div className="panel">
      <ToastProvider>
        <SesionProvider>
          <Puerta />
        </SesionProvider>
      </ToastProvider>
    </div>
  );
}

function Puerta() {
  const { fase, reintentar, salir } = useSesion();
  if (fase === 'cargando')
    return (
      <div className="arranque" aria-busy="true" aria-label="Cargando">
        <Skeleton h="3rem" w="12rem" />
        <Skeleton h="8rem" />
        <Skeleton h="8rem" />
      </div>
    );
  if (fase === 'fuera') return <Login />;
  if (fase === 'error')
    return (
      <Aviso
        error
        icono="alerta"
        titulo="No pudimos abrir el panel"
        texto="Parece que no hay buena señal. Intenta otra vez."
        accion={{ texto: 'Intentar otra vez', onClick: reintentar, icono: 'recargar' }}
      />
    );
  if (fase === 'sin_hotel')
    return (
      <Aviso
        icono="alerta"
        titulo="Tu usuario aún no tiene un hotel"
        texto="Pídele a la dueña que te agregue al hotel y vuelve a entrar."
        accion={{ texto: 'Salir', onClick: () => void salir(), icono: 'salir' }}
      />
    );
  return (
    <CuartosProvider>
      <Shell />
    </CuartosProvider>
  );
}

function Shell() {
  const perfil = usePerfil();
  const { salir } = useSesion();
  const { cuartos, abrirCuarto } = useCuartos();
  const paginas = useMemo(() => paginasDe(perfil.rol), [perfil.rol]);
  const [pagina, setPagina] = useState<Pagina>(() => paginaDeHash(window.location.hash, perfil.rol));
  const [paleta, setPaleta] = useState(false);
  const [masAbierto, setMasAbierto] = useState(false);
  // Dirección de la transición entre pantallas: hacia adelante entra desde la derecha, hacia atrás desde la izquierda.
  const [dx, setDx] = useState(0);
  const pagActual = useRef(pagina);
  const mover = useCallback(
    (nueva: Pagina) => {
      const orden = paginas.map((p) => p.id);
      setDx(Math.sign(orden.indexOf(nueva) - orden.indexOf(pagActual.current)) * 28);
      pagActual.current = nueva;
      setPagina(nueva);
    },
    [paginas],
  );

  const ir = useCallback(
    (p: Pagina) => {
      if (window.location.hash !== `#/${p}`) window.history.pushState(null, '', `#/${p}`);
      mover(p);
      setMasAbierto(false);
      window.scrollTo({ top: 0 });
    },
    [mover],
  );

  useEffect(() => {
    const onHash = () => mover(paginaDeHash(window.location.hash, perfil.rol));
    window.addEventListener('popstate', onHash);
    return () => window.removeEventListener('popstate', onHash);
  }, [perfil.rol, mover]);

  useEffect(() => {
    if (perfil.rol === 'limpieza') return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaleta((v) => !v);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [perfil.rol]);

  const porLimpiar = cuartos.filter((c) => c.estado === 'por_limpiar').length;
  const puedeBuscar = perfil.rol !== 'limpieza';
  const solo = paginas.length === 1;
  // En móvil caben 5 pestañas con toques de 48 px: con más, 4 principales + "Más".
  const principales = paginas.length > 5 ? 4 : paginas.length;
  const extras = paginas.slice(principales);
  const extraActiva = extras.some((p) => p.id === pagina);

  return (
    <div className={`shell ${solo ? 'shell--solo' : ''}`}>
      <header className="barra-sup">
        <p className="marca">Hotel Andy</p>
        <div className="barra-sup__der">
          {puedeBuscar && (
            <button type="button" className="icono-btn" onClick={() => setPaleta(true)} aria-label="Buscar un cuarto">
              <Icon name="buscar" />
            </button>
          )}
          <button type="button" className="icono-btn icono-btn--texto" onClick={() => void salir()}>
            <Icon name="salir" size="sm" />
            <span>Salir</span>
          </button>
        </div>
      </header>

      {!solo && (
        <nav className="nav" aria-label="Secciones">
          <p className="marca nav__marca">Hotel Andy</p>
          <ul
            style={{
              ['--n' as string]: principales + (extras.length ? 1 : 0),
              ['--i-m' as string]: extraActiva ? principales : Math.max(0, paginas.findIndex((p) => p.id === pagina)),
              ['--i-d' as string]: Math.max(0, paginas.findIndex((p) => p.id === pagina)),
            }}
          >
            {paginas.map((p, i) => (
              <li key={p.id} className={i >= principales ? 'nav__extra' : undefined}>
                <a
                  href={`#/${p.id}`}
                  className="nav__item"
                  aria-current={pagina === p.id ? 'page' : undefined}
                  onClick={(e) => {
                    e.preventDefault();
                    ir(p.id);
                  }}
                >
                  <span className="nav__ico">
                    <Icon name={p.icono} />
                    {p.id === 'limpieza' && porLimpiar > 0 && (
                      <span className="nav__punto" aria-label={`${porLimpiar} por limpiar`}>
                        {porLimpiar}
                      </span>
                    )}
                  </span>
                  <span>{p.texto}</span>
                </a>
              </li>
            ))}
            {extras.length > 0 && (
              <li className="nav__mas">
                <button
                  type="button"
                  className="nav__item"
                  aria-current={extraActiva ? 'page' : undefined}
                  aria-haspopup="dialog"
                  onClick={() => setMasAbierto(true)}
                >
                  <span className="nav__ico">
                    <Icon name="mas" />
                  </span>
                  <span>Más</span>
                </button>
              </li>
            )}
          </ul>
          <div className="nav__pie">
            {puedeBuscar && (
              <button type="button" className="nav__buscar" onClick={() => setPaleta(true)}>
                <Icon name="buscar" size="sm" />
                <span>Buscar</span>
                <kbd>Ctrl K</kbd>
              </button>
            )}
            <div className="nav__yo">
              <strong>{perfil.nombre}</strong>
              <span>{ROL_PALABRA[perfil.rol]}</span>
            </div>
            <Boton variante="ghost" icono="salir" onClick={() => void salir()}>
              Salir
            </Boton>
          </div>
        </nav>
      )}

      <main className="contenido" id="contenido" style={{ ['--dx' as string]: `${dx}px` }}>
        {pagina === 'inicio' && <Inicio ir={ir} />}
        {pagina === 'cuartos' && <Mapa />}
        {pagina === 'reservas' && <Reservas />}
        {pagina === 'limpieza' && <Limpieza />}
        {pagina === 'inventario' && <Inventario />}
        {pagina === 'config' && <Config />}
      </main>

      {masAbierto && (
        <Hoja titulo="Más" onCerrar={() => setMasAbierto(false)}>
          <ul className="mas-lista">
            {extras.map((p) => (
              <li key={p.id}>
                <a
                  href={`#/${p.id}`}
                  className="mas-lista__item"
                  aria-current={pagina === p.id ? 'page' : undefined}
                  onClick={(e) => {
                    e.preventDefault();
                    ir(p.id);
                  }}
                >
                  <Icon name={p.icono} />
                  {p.texto}
                </a>
              </li>
            ))}
          </ul>
        </Hoja>
      )}

      {paleta && (
        <Paleta
          paginas={paginas}
          onIr={(p) => {
            ir(p);
            if (p !== 'cuartos') abrirCuarto(null);
          }}
          onCerrar={() => setPaleta(false)}
        />
      )}
    </div>
  );
}

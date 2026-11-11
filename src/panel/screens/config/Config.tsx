import { useState } from 'react';
import '../../styles/config.css';
import { usePerfil } from '../../data/sesion';
import { Aviso } from '../../ui/kit';
import { Precios } from './Precios';
import { Temporadas } from './Temporadas';
import { Reglas } from './Reglas';
import { Kit } from './Kit';
import { Usuarios } from './Usuarios';
import { PlanCuenta } from './PlanCuenta';
import { Nfc } from './Nfc';

const SECCIONES = [
  { id: 'precios', texto: 'Precios' },
  { id: 'temporada', texto: 'Temporada alta' },
  { id: 'reglas', texto: 'Reglas del hotel' },
  { id: 'kit', texto: 'Kit de limpieza' },
  { id: 'usuarios', texto: 'Usuarios' },
  { id: 'plan', texto: 'Plan y cuenta' },
  { id: 'nfc', texto: 'Placas NFC' },
] as const;
type Seccion = (typeof SECCIONES)[number]['id'];

/** Configuración: solo la dueña. La base también lo exige (RLS). */
export function Config() {
  const { rol } = usePerfil();
  const [sec, setSec] = useState<Seccion>('precios');
  if (rol !== 'duena') return <Aviso icono="llave" titulo="Esta parte es solo para la dueña" />;

  return (
    <section className="pantalla">
      <header className="pantalla__cab">
        <h1>Ajustes del hotel</h1>
        <p className="pantalla__sub">Cada cambio se guarda al momento y puedes deshacerlo.</p>
      </header>

      <div className="cfg">
        <nav className="cfg-menu" aria-label="Secciones de ajustes">
          <ul>
            {SECCIONES.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  className="cfg-menu__item"
                  aria-current={sec === s.id ? 'page' : undefined}
                  onClick={() => setSec(s.id)}
                >
                  {s.texto}
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <div className="cfg-cuerpo" key={sec}>
          {sec === 'precios' && <Precios irA={setSec} />}
          {sec === 'temporada' && <Temporadas />}
          {sec === 'reglas' && <Reglas />}
          {sec === 'kit' && <Kit />}
          {sec === 'usuarios' && <Usuarios />}
          {sec === 'plan' && <PlanCuenta />}
          {sec === 'nfc' && <Nfc />}
        </div>
      </div>
    </section>
  );
}

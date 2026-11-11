import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { mensajeError } from '../lib/errores';
import { Boton } from '../ui/kit';
import { Icon } from '../ui/Icon';

export function Login() {
  const [modo, setModo] = useState<'clave' | 'enlace'>('clave');
  const [correo, setCorreo] = useState('');
  const [clave, setClave] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);

  async function entrar(e: { preventDefault(): void }) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      if (modo === 'clave') {
        const { error: err } = await supabase.auth.signInWithPassword({ email: correo.trim(), password: clave });
        if (err) setError(mensajeError(err));
      } else {
        const { error: err } = await supabase.auth.signInWithOtp({
          email: correo.trim(),
          options: { shouldCreateUser: false, emailRedirectTo: `${window.location.origin}/panel/` },
        });
        if (err) setError(mensajeError(err));
        else setEnviado(true);
      }
    } catch (err) {
      setError(mensajeError(err instanceof Error ? err : null));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="login">
      <section className="login__marca">
        <p className="login__logo">Hotel Andy</p>
        <h1 className="login__lema">Todo el hotel, en una sola pantalla.</h1>
        <p className="login__sub">Cuartos, limpieza e insumos al momento, sin preguntarle a nadie.</p>
        <svg className="login__ola" viewBox="0 0 400 60" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 30c40 0 40-20 80-20s40 20 80 20 40-20 80-20 40 20 80 20 40-20 80-20v50H0z" />
        </svg>
      </section>

      <section className="login__form">
        {enviado ? (
          <div className="login__ok" role="status">
            <div className="aviso__ico">
              <Icon name="correo" size="lg" />
            </div>
            <h2 className="aviso__titulo">Revisa tu correo</h2>
            <p className="aviso__texto">
              Te mandamos un enlace a <strong>{correo}</strong>. Tócalo desde este mismo celular y entrarás sin escribir nada.
              Este celular quedará abierto por varios días.
            </p>
            <Boton variante="ghost" onClick={() => setEnviado(false)}>
              Usar otro correo
            </Boton>
          </div>
        ) : (
          <form onSubmit={entrar} noValidate={false}>
            <h2 className="login__titulo">Entrar al panel</h2>
            <div className="segmento" role="group" aria-label="Cómo quieres entrar">
              <button type="button" aria-pressed={modo === 'clave'} onClick={() => setModo('clave')}>
                <Icon name="llave" size="sm" /> Con contraseña
              </button>
              <button type="button" aria-pressed={modo === 'enlace'} onClick={() => setModo('enlace')}>
                <Icon name="correo" size="sm" /> Con enlace
              </button>
            </div>

            <div className="campo">
              <label htmlFor="correo">Correo</label>
              <input
                id="correo"
                className="input"
                type="email"
                inputMode="email"
                autoComplete="username"
                autoCapitalize="none"
                required
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
              />
            </div>
            {modo === 'clave' && (
              <div className="campo">
                <label htmlFor="clave">Contraseña</label>
                <input
                  id="clave"
                  className="input"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={clave}
                  onChange={(e) => setClave(e.target.value)}
                />
              </div>
            )}
            {modo === 'enlace' && (
              <p className="login__ayuda">
                Para limpieza: te enviamos un enlace al correo. Lo tocas una vez y el celular recuerda tu sesión.
              </p>
            )}
            {error && (
              <p className="campo__error" role="alert">
                {error}
              </p>
            )}
            <Boton type="submit" block cargando={enviando}>
              {modo === 'clave' ? 'Entrar' : 'Enviarme el enlace'}
            </Boton>
          </form>
        )}
      </section>
    </main>
  );
}

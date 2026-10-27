// Aviso inicial: qué es el simulador, cómo se hizo, con qué objetivo y de qué fuentes
// sale. Hay que aceptarlo para entrar; la aceptación se guarda en el navegador. Si el
// texto cambia de forma sustancial, se sube VERSION y se vuelve a pedir. La metodología
// se puede leer antes de aceptar: en esa sección el aviso no bloquea.
import { useEffect, useRef, useState } from 'react';

const KEY = 'aviso';
const VERSION = '2';
const EVENT = 'abrir-aviso';
const FREE = '#metodologia';

const accepted = () => { try { return localStorage.getItem(KEY) === VERSION; } catch { return false; } };
const remember = () => { try { localStorage.setItem(KEY, VERSION); } catch { /* sin almacenamiento */ } };

export const openNotice = () => window.dispatchEvent(new Event(EVENT));

export function Notice() {
  const ref = useRef(null);
  const [done, setDone] = useState(accepted);
  const [manual, setManual] = useState(false);
  const [hash, setHash] = useState(() => window.location.hash);
  const [agree, setAgree] = useState(false);
  const open = manual || (!done && hash !== FREE);

  useEffect(() => {
    const show = () => setManual(true);
    const sync = () => setHash(window.location.hash);
    window.addEventListener(EVENT, show);
    window.addEventListener('popstate', sync);
    window.addEventListener('hashchange', sync);
    return () => {
      window.removeEventListener(EVENT, show);
      window.removeEventListener('popstate', sync);
      window.removeEventListener('hashchange', sync);
    };
  }, []);

  useEffect(() => {
    const dlg = ref.current;
    if (open && !dlg.open) dlg.showModal();
    if (!open && dlg.open) dlg.close();
  }, [open]);

  const mustAccept = !done;
  const accept = () => { remember(); setDone(true); setManual(false); };
  const setOpen = (v) => setManual(v);

  return (
    <dialog
      ref={ref}
      className="notice"
      aria-labelledby="aviso-titulo"
      // Mientras no se acepte, Escape no lo cierra.
      onCancel={(e) => { if (mustAccept) e.preventDefault(); else setOpen(false); }}
    >
      <div className="notice-body">
        <p className="small muted">Simulador 29-N · elecciones generales del 29 de noviembre de 2026</p>
        <h2 id="aviso-titulo">Antes de entrar</h2>

        <h3>Qué es y para qué sirve</h3>
        <p>
          Un simulador que traduce votos en escaños del Congreso y del Senado. Su objetivo es <strong>mostrar cómo afectaría
          cada escenario y cada fuente al reparto</strong>: pactos, listas conjuntas, retiradas o el error de las encuestas.
        </p>
        <p><strong>No es una predicción ni una encuesta propia.</strong> No pregunta a nadie ni dice quién va a ganar.</p>

        <h3>Cómo se hizo</h3>
        <p>
          Parte de los votos oficiales de 2023 en cada provincia, los reasigna a los partidos que se presentan en 2026 y los
          ajusta hasta que el total nacional coincide con la encuesta elegida. Los escaños salen de la ley electoral (D'Hondt
          en el Congreso, voto limitado en el Senado) y 5.000 simulaciones miden el margen de error. Con los votos reales de
          2023, el motor reproduce exactamente el reparto oficial. Se actualiza solo cada hora.
        </p>
        <p>
          Se desarrolló con ayuda de inteligencia artificial (Claude, de Anthropic) para el código, la lectura de las fuentes
          oficiales y las comprobaciones. Todo el método está documentado y se puede reproducir paso a paso:{' '}
          <a href={FREE} onClick={() => setManual(false)}>leer la metodología completa</a>.
        </p>

        <h3>Fuentes</h3>
        <ul>
          <li><strong>Resultados y escaños:</strong> BOE y Junta Electoral Central.</li>
          <li><strong>Intención de voto:</strong> encuestas publicadas (cada una con su enlace) y la estimación oficial del CIS.</li>
          <li><strong>Escenarios:</strong> noticias de prensa, enlazadas en cada tarjeta. Puedes activarlas o desactivarlas.</li>
          <li><strong>Censo exterior:</strong> INE.</li>
          <li><strong>Provisionalmente, Wikipedia:</strong> europeas 2024, andaluzas 2026 y senadores designados.</li>
        </ul>
        <p>Lo que no tiene dato publicado aparece marcado como «Supuesto».</p>

        <h3>Al entrar, aceptas que</h3>
        <ul>
          <li>Los resultados son simulaciones con margen de error y dependen de las encuestas, que pueden fallar: en 2023 infravaloraron al PSOE en más de 5 puntos un mes antes.</li>
          <li>Si cambias fuentes o escenarios, el resultado deja de ser el de por defecto.</li>
          <li>El proyecto no tiene relación con ningún partido, medio, empresa de encuestas ni organismo oficial.</li>
          <li>No debe usarse como única fuente para ninguna decisión: consulta las fuentes originales.</li>
          <li>No se recogen datos personales. Tu navegador solo guarda que aceptaste este aviso y tus preferencias de vista.</li>
        </ul>

        {mustAccept ? (
          <div className="notice-accept">
            <label>
              <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
              <span>He leído el aviso y entiendo que es una simulación, no una predicción.</span>
            </label>
            <button className="btn primary" disabled={!agree} onClick={accept}>Aceptar y entrar</button>
          </div>
        ) : (
          <div className="notice-accept">
            <span className="small muted">Ya aceptaste este aviso.</span>
            <button className="btn" onClick={() => setOpen(false)} autoFocus>Cerrar</button>
          </div>
        )}
      </div>
    </dialog>
  );
}

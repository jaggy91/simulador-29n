// Metodología completa (METODOLOGIA.md) dentro de la web. Se carga aparte, solo al
// abrir la sección, para no engordar la carga inicial. Durante la veda se quitan los
// bloques con cifras de encuestas (en la versión de veda ya vienen quitados del código).
import { useMemo } from 'react';
import { marked } from 'marked';
import text from '../../../METODOLOGIA.md?raw';
import { stripVeda } from '../../veda.js';

export default function Methodology({ veda = false }) {
  const html = useMemo(() => marked.parse(veda ? stripVeda(text) : text, { gfm: true }), [veda]);
  return (
    <section className="card md" style={{ marginTop: 16 }}>
      <p className="small muted" style={{ marginBottom: 12 }}>
        Documento de auditoría del modelo. Las cifras corresponden a la fecha de corte que indica; las vigentes son las de la proyección.
      </p>
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </section>
  );
}

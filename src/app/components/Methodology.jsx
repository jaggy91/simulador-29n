// Metodología completa (METODOLOGIA.md) dentro de la web. Se carga aparte, solo al
// abrir la sección, para no engordar la carga inicial.
import { useMemo } from 'react';
import { marked } from 'marked';
import text from '../../../METODOLOGIA.md?raw';

export default function Methodology() {
  const html = useMemo(() => marked.parse(text, { gfm: true }), []);
  return (
    <section className="card md" style={{ marginTop: 16 }}>
      <p className="small muted" style={{ marginBottom: 12 }}>
        Documento de auditoría del modelo. Las cifras corresponden a la fecha de corte que indica; las vigentes son las de la proyección.
      </p>
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </section>
  );
}

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './app/App.jsx';
import { VedaApp, useVeda } from './app/Veda.jsx';
import { Notice } from './app/components/Notice.jsx';
import './app/styles.css';

// Durante la veda electoral, la versión sin encuestas.
function Root() {
  return useVeda() ? <VedaApp /> : <App />;
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Notice />
    <Root />
  </StrictMode>,
);

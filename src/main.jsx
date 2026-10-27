import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './app/App.jsx';
import { Notice } from './app/components/Notice.jsx';
import './app/styles.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Notice />
    <App />
  </StrictMode>,
);

import React from 'react';
import ReactDOM from 'react-dom/client';
// Static imports for the ERP path — included in bundle but NOT executed for PublicSite
import App from './App';
import { AppDataProvider } from './context/AppDataContext';
import { UnitProvider } from './context/UnitContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);

const hash = window.location.hash;
const isPublicSite = hash === '#/site' || hash.startsWith('#/site/') || hash.startsWith('#/site?');

if (isPublicSite) {
  // ============================================================
  // PUBLIC SITE PATH (iframe do StoreCustomizer ou acesso direto)
  // NÃO monta AppDataProvider — evita 35 queries + Realtime
  // ============================================================
  import('./pages/PublicSite').then(({ default: PublicSite }) => {
    root.render(
      <React.StrictMode>
        <PublicSite />
      </React.StrictMode>
    );
  });
} else {
  // ============================================================
  // ERP PATH — imports estáticos, ZERO waterfall, ZERO flash
  // ============================================================
  const queryClient = new QueryClient();
  root.render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <AppDataProvider>
          <UnitProvider>
            <App />
          </UnitProvider>
        </AppDataProvider>
      </QueryClientProvider>
    </React.StrictMode>
  );
}
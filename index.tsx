import React from 'react';
import ReactDOM from 'react-dom/client';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);

// Early slug detection: paths like /lagoa should go to PublicSite
// This runs BEFORE any module loads to prevent admin flash
const pathname = window.location.pathname;
const hash = window.location.hash;

if (!hash && pathname !== '/' && pathname !== '/index.html') {
  // This is a slug route (e.g. /lagoa) — redirect to #/site immediately
  window.location.replace(`${window.location.origin}/#/site`);
} else {

const isPublicSite = hash === '#/site' || hash.startsWith('#/site/') || hash.startsWith('#/site?');

if (isPublicSite) {
  // ============================================================
  // PUBLIC SITE PATH — 100% isolated, ZERO ERP code loaded
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
  // ERP PATH — dynamic import to keep PublicSite bundle clean
  // ============================================================
  Promise.all([
    import('./App'),
    import('./context/AppDataContext'),
    import('./context/UnitContext'),
    import('@tanstack/react-query'),
  ]).then(([
    { default: App },
    { AppDataProvider },
    { UnitProvider },
    { QueryClient, QueryClientProvider },
  ]) => {
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
  });
}
} // close slug detection else
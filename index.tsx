import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AppDataProvider } from './context/AppDataContext';
import { UnitProvider } from './context/UnitContext';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <AppDataProvider>
      <UnitProvider>
        <App />
      </UnitProvider>
    </AppDataProvider>
  </React.StrictMode>
);
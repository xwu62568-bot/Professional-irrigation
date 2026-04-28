import { useEffect } from 'react';
import { RouterProvider } from 'react-router';
import { router } from './routes';
import { AppProvider } from './context/AppContext';
import { isAmapConfigured, loadAmap } from '../lib/amap';

export default function App() {
  useEffect(() => {
    if (!isAmapConfigured()) {
      return;
    }

    void loadAmap().catch(() => {});
  }, []);

  return (
    <div className="h-full">
      <AppProvider>
        <RouterProvider router={router} />
      </AppProvider>
    </div>
  );
}

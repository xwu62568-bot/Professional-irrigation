import { createBrowserRouter, createHashRouter, Navigate } from 'react-router';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Overview } from './pages/Overview';
import { FieldMap } from './pages/FieldMap';
import { FieldDetail } from './pages/FieldDetail';
import { IrrigationPlan } from './pages/IrrigationPlan';
import { AutoStrategy } from './pages/AutoStrategy';
import { Devices } from './pages/Devices';
import { Account } from './pages/Account';

function RedirectToOverview() {
  return <Navigate to="/overview" replace />;
}

const useHashRouter = import.meta.env.VITE_USE_HASH_ROUTER === 'true';

const routes = [
  {
    path: '/login',
    Component: Login,
  },
  {
    path: '/register',
    Component: Register,
  },
  {
    path: '/',
    Component: Layout,
    children: [
      { index: true, Component: RedirectToOverview },
      { path: 'overview', Component: Overview },
      { path: 'field-map', Component: FieldMap },
      { path: 'field/:id', Component: FieldDetail },
      { path: 'irrigation-plan', Component: IrrigationPlan },
      { path: 'auto-strategy', Component: AutoStrategy },
      { path: 'devices', Component: Devices },
      { path: 'account', Component: Account },
    ],
  },
];

export const router = useHashRouter ? createHashRouter(routes) : createBrowserRouter(routes);

import { NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { useEffect, useState } from 'react';
import {
  LayoutDashboard, Map, CalendarClock, Zap, Cpu, User, Droplets, LogOut, ChevronRight, Menu, X
} from 'lucide-react';
import { useApp } from '../context/AppContext';

const navItems = [
  { to: '/overview', label: '总览', icon: LayoutDashboard },
  { to: '/field-map', label: '地块地图', icon: Map },
  { to: '/irrigation-plan', label: '轮灌计划', icon: CalendarClock },
  { to: '/auto-strategy', label: '自动策略', icon: Zap },
  { to: '/devices', label: '设备', icon: Cpu },
  { to: '/account', label: '账户', icon: User },
];

export function Layout() {
  const { isAuthenticated, isAuthReady, user, logout } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (isAuthReady && !isAuthenticated) {
      navigate('/login', { replace: true });
    }
  }, [isAuthReady, isAuthenticated, navigate]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  if (!isAuthReady || !isAuthenticated) return null;

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#f0f4f8' }}>
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          style={{ background: 'rgba(2, 6, 23, 0.45)' }}
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className="hidden md:flex flex-col shrink-0 h-full"
        style={{ width: 220, background: '#0d1f2d', borderRight: '1px solid #1a3a4a' }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5" style={{ borderBottom: '1px solid #1a3a4a' }}>
          <div className="flex items-center justify-center rounded-lg" style={{ width: 36, height: 36, background: 'linear-gradient(135deg, #16a34a, #0ea5e9)' }}>
            <Droplets size={20} color="white" />
          </div>
          <div>
            <div style={{ color: '#ffffff', fontSize: 14, fontWeight: 600, lineHeight: 1.2 }}>智慧灌溉</div>
            <div style={{ color: '#64748b', fontSize: 11 }}>平台 v2.0</div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-3 flex flex-col gap-1">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all group relative ${
                  isActive ? 'nav-active' : 'nav-inactive'
                }`
              }
              style={({ isActive }) => ({
                background: isActive ? 'rgba(22,163,74,0.15)' : 'transparent',
                color: isActive ? '#22c55e' : '#94a3b8',
              })}
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <div
                      className="absolute left-0 top-1/2 -translate-y-1/2 rounded-full"
                      style={{ width: 3, height: 20, background: '#22c55e' }}
                    />
                  )}
                  <Icon size={18} />
                  <span style={{ fontSize: 14, fontWeight: isActive ? 500 : 400 }}>{label}</span>
                  {isActive && <ChevronRight size={14} className="ml-auto opacity-50" />}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User + Logout */}
        <div className="px-3 pb-5" style={{ borderTop: '1px solid #1a3a4a', paddingTop: 16 }}>
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg mb-2" style={{ background: 'rgba(255,255,255,0.05)' }}>
            <div
              className="flex items-center justify-center rounded-full shrink-0"
              style={{ width: 32, height: 32, background: 'linear-gradient(135deg, #16a34a, #0ea5e9)', fontSize: 13, color: 'white', fontWeight: 600 }}
            >
              {user?.avatar}
            </div>
            <div className="flex-1 min-w-0">
              <div style={{ color: '#e2e8f0', fontSize: 13, fontWeight: 500, lineHeight: 1.3 }} className="truncate">{user?.displayName}</div>
              <div style={{ color: '#64748b', fontSize: 11 }} className="truncate">{user?.role}</div>
            </div>
          </div>
          <button
            onClick={async () => { await logout(); navigate('/login'); }}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-lg transition-all"
            style={{ color: '#64748b', fontSize: 13 }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.1)'; (e.currentTarget as HTMLElement).style.color = '#f87171'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#64748b'; }}
          >
            <LogOut size={16} />
            退出登录
          </button>
        </div>
      </aside>

      <aside
        className={`fixed left-0 top-0 z-50 h-full w-[220px] md:hidden transition-transform ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ background: '#0d1f2d', borderRight: '1px solid #1a3a4a' }}
      >
        <div
          className="flex items-center justify-between gap-3 px-5 py-5"
          style={{ borderBottom: '1px solid #1a3a4a' }}
        >
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center rounded-lg" style={{ width: 36, height: 36, background: 'linear-gradient(135deg, #16a34a, #0ea5e9)' }}>
              <Droplets size={20} color="white" />
            </div>
            <div>
              <div style={{ color: '#ffffff', fontSize: 14, fontWeight: 600, lineHeight: 1.2 }}>智慧灌溉</div>
              <div style={{ color: '#64748b', fontSize: 11 }}>平台 v2.0</div>
            </div>
          </div>
          <button onClick={() => setMobileMenuOpen(false)} style={{ color: '#94a3b8' }}>
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 py-4 px-3 flex flex-col gap-1">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setMobileMenuOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all group relative ${
                  isActive ? 'nav-active' : 'nav-inactive'
                }`
              }
              style={({ isActive }) => ({
                background: isActive ? 'rgba(22,163,74,0.15)' : 'transparent',
                color: isActive ? '#22c55e' : '#94a3b8',
              })}
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <div
                      className="absolute left-0 top-1/2 -translate-y-1/2 rounded-full"
                      style={{ width: 3, height: 20, background: '#22c55e' }}
                    />
                  )}
                  <Icon size={18} />
                  <span style={{ fontSize: 14, fontWeight: isActive ? 500 : 400 }}>{label}</span>
                  {isActive && <ChevronRight size={14} className="ml-auto opacity-50" />}
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div
          className="sticky top-0 z-30 flex items-center justify-between px-4 py-3 md:hidden"
          style={{ background: '#ffffff', borderBottom: '1px solid #e2e8f0' }}
        >
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="flex items-center justify-center rounded-lg"
            style={{ width: 40, height: 40, background: '#f8fafc', border: '1px solid #e2e8f0', color: '#0f172a' }}
          >
            <Menu size={18} />
          </button>
          <div style={{ color: '#0f172a', fontSize: 15, fontWeight: 600 }}>智慧灌溉</div>
          <button
            onClick={async () => { await logout(); navigate('/login'); }}
            className="flex items-center justify-center rounded-lg"
            style={{ width: 40, height: 40, background: '#f8fafc', border: '1px solid #e2e8f0', color: '#64748b' }}
          >
            <LogOut size={16} />
          </button>
        </div>
        <Outlet />
      </main>
    </div>
  );
}

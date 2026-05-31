import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { DashboardIcon } from './DashboardUi';
import { apiClient } from '../../services/apiClient';

const linkBase = 'block w-full rounded-xl px-3 py-2.5 text-left text-sm transition';

export const DashboardLayout: React.FC = () => {
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const closeMenu = () => setIsMenuOpen(false);

  const handleLogout = async () => {
    closeMenu();
    try {
      await apiClient.logout();
    } finally {
      localStorage.removeItem('user');
    }
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-[#0b0b10] text-gray-200">
      <div className="min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
        <div className="sticky top-0 z-30 flex items-center justify-between border-b border-white/10 bg-[#101116] p-4 lg:hidden">
          <div>
            <p className="text-[10px] uppercase tracking-[0.25em] text-gray-500">AquaSense</p>
            <h1 className="text-base font-bold text-white">Water Quality Console</h1>
          </div>
          <button
            type="button"
            onClick={() => setIsMenuOpen(true)}
            className="inline-flex items-center justify-center rounded-lg border border-white/10 bg-[#14151b] p-2 text-gray-200"
            aria-label="Open dashboard menu"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18M3 12h18M3 18h18" />
            </svg>
          </button>
        </div>

        {isMenuOpen && (
          <button
            type="button"
            className="fixed inset-0 z-30 bg-black/50 lg:hidden"
            aria-label="Close dashboard menu"
            onClick={closeMenu}
          />
        )}

        <aside
          className={`fixed inset-y-0 left-0 z-40 w-72 border-b border-white/10 bg-[#101116] p-5 transition-transform duration-200 lg:static lg:z-auto lg:min-h-screen lg:w-auto lg:border-b-0 lg:border-r lg:translate-x-0 ${
            isMenuOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="mb-6">
            <p className="text-xs uppercase tracking-[0.2em] text-gray-500">AquaSense</p>
            <h1 className="mt-2 text-xl font-bold text-white">Water Quality Console</h1>
            <p className="mt-1 text-xs text-gray-400">Dark operations panel</p>
          </div>

          <div className="space-y-2">
            <NavLink
              to="/dashboard/overview"
              onClick={closeMenu}
              className={({ isActive }) => `${linkBase} ${isActive ? 'border border-emerald-500/30 bg-[#1a1b22] text-white shadow-[0_0_0_1px_rgba(16,185,129,0.2)]' : 'text-gray-400 hover:bg-[#16171d]'}`}
            >
              <span className="flex items-center gap-3">
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-emerald-500/15 text-emerald-300">
                  <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth="2">
                    <path d="M3 12l9-8 9 8" />
                    <path d="M5 10v10h14V10" />
                  </svg>
                </span>
                <span>Overview</span>
              </span>
            </NavLink>
            <NavLink
              to="/dashboard/parameters"
              onClick={closeMenu}
              className={({ isActive }) => `${linkBase} ${isActive ? 'border border-cyan-500/30 bg-[#1a1b22] text-white shadow-[0_0_0_1px_rgba(6,182,212,0.2)]' : 'text-gray-400 hover:bg-[#16171d]'}`}
            >
              <span className="flex items-center gap-3">
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-cyan-500/15 text-cyan-300">
                  <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth="2">
                    <path d="M4 19h16" />
                    <path d="M7 15l3-3 2 2 5-6" />
                    <circle cx="7" cy="15" r="1" />
                    <circle cx="10" cy="12" r="1" />
                    <circle cx="12" cy="14" r="1" />
                    <circle cx="17" cy="8" r="1" />
                  </svg>
                </span>
                <span>Parameters</span>
              </span>
            </NavLink>
            <NavLink
              to="/dashboard/feeding"
              onClick={closeMenu}
              className={({ isActive }) => `${linkBase} ${isActive ? 'border border-amber-500/30 bg-[#1a1b22] text-white shadow-[0_0_0_1px_rgba(245,158,11,0.2)]' : 'text-gray-400 hover:bg-[#16171d]'}`}
            >
              <span className="flex items-center gap-3">
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-amber-500/15 text-amber-300">
                  <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth="2">
                    <path d="M12 3v18" />
                    <path d="M5 8h14" />
                    <path d="M7 13h10" />
                    <path d="M9 18h6" />
                  </svg>
                </span>
                <span>Feeding</span>
              </span>
            </NavLink>
            <NavLink
              to="/dashboard/aerator"
              onClick={closeMenu}
              className={({ isActive }) => `${linkBase} ${isActive ? 'border border-sky-500/30 bg-[#1a1b22] text-white shadow-[0_0_0_1px_rgba(14,165,233,0.2)]' : 'text-gray-400 hover:bg-[#16171d]'}`}
            >
              <span className="flex items-center gap-3">
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-sky-500/15 text-sky-300">
                  <DashboardIcon name="aerator" />
                </span>
                <span>Aerator</span>
              </span>
            </NavLink>
            <NavLink
              to="/dashboard/alerts"
              onClick={closeMenu}
              className={({ isActive }) => `${linkBase} ${isActive ? 'border border-rose-500/30 bg-[#1a1b22] text-white shadow-[0_0_0_1px_rgba(244,63,94,0.2)]' : 'text-gray-400 hover:bg-[#16171d]'}`}
            >
              <span className="flex items-center gap-3">
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-rose-500/15 text-rose-300">
                  <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth="2">
                    <path d="M12 9v4" />
                    <path d="M12 17h.01" />
                    <path d="M10.3 4.8L2.9 18a1 1 0 0 0 .9 1.5h16.4a1 1 0 0 0 .9-1.5L13.7 4.8a1 1 0 0 0-1.8 0z" />
                  </svg>
                </span>
                <span>Alerts & Logs</span>
              </span>
            </NavLink>
            <NavLink
              to="/dashboard/settings"
              onClick={closeMenu}
              className={({ isActive }) => `${linkBase} ${isActive ? 'border border-violet-500/30 bg-[#1a1b22] text-white shadow-[0_0_0_1px_rgba(139,92,246,0.2)]' : 'text-gray-400 hover:bg-[#16171d]'}`}
            >
              <span className="flex items-center gap-3">
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-violet-500/15 text-violet-300">
                  <DashboardIcon name="settings" />
                </span>
                <span>Settings</span>
              </span>
            </NavLink>
          </div>

          <button onClick={handleLogout} className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-500">
            <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth="2">
              <path d="M15 17l5-5-5-5" />
              <path d="M20 12H9" />
              <path d="M12 19H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h7" />
            </svg>
            <span>Logout</span>
          </button>
        </aside>

        <main className="p-4 md:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

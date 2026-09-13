import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { DashboardIcon } from './DashboardUi';
import { apiClient } from '../../services/apiClient';
import logo from '../../assets/images/AquaSense_Logo.png';

const linkBase = 'flex items-center gap-3 w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium transition';
const linkActive = 'bg-blue-50 text-blue-700 shadow-[0_0_0_1px_rgba(37,99,235,0.15)]';
const linkInactive = 'text-gray-500 hover:bg-gray-50 hover:text-gray-700';

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
    <div className="min-h-screen bg-[#eef2f7] text-gray-800 lg:h-screen lg:overflow-hidden">
      <div className="min-h-screen lg:grid lg:h-screen lg:grid-cols-[260px_1fr] lg:overflow-hidden">
        <div className="sticky top-0 z-30 flex items-center justify-between border-b border-gray-200 bg-white p-4 lg:hidden">
          <div className="flex items-center gap-2">
            <img src={logo} alt="AquaSense" className="h-9 w-9 rounded-full object-cover" />
            <div>
              <p className="text-[10px] uppercase tracking-[0.25em] text-blue-600 font-semibold">AquaSense</p>
              <h1 className="text-base font-bold text-gray-900">Water Quality Console</h1>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsMenuOpen(true)}
            className="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white p-2 text-gray-600"
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
          className={`fixed inset-y-0 left-0 z-40 w-72 overflow-y-auto border-b border-gray-200 bg-white p-5 transition-transform duration-200 lg:static lg:z-auto lg:flex lg:h-screen lg:w-auto lg:flex-col lg:border-b-0 lg:border-r lg:translate-x-0 ${
            isMenuOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="mb-6">
            <p className="text-xs uppercase tracking-[0.2em] text-blue-600 font-bold">AquaSense</p>
            <h1 className="mt-2 text-xl font-bold text-gray-900">Water Quality Console</h1>
            <p className="mt-1 text-xs text-gray-500">Smart operations panel</p>
          </div>

          <div className="space-y-1.5">
            <NavLink
              to="/dashboard/overview"
              onClick={closeMenu}
              className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkInactive}`}
            >
              <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0 fill-none stroke-current" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l9-8 9 8" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 10v10h14V10" />
              </svg>
              <span>Overview</span>
            </NavLink>
            <NavLink
              to="/dashboard/parameters"
              onClick={closeMenu}
              className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkInactive}`}
            >
              <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0 fill-none stroke-current" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18h18" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 15l3-4 3 2 4-6" />
              </svg>
              <span>Parameters</span>
            </NavLink>
            <NavLink
              to="/dashboard/feeding"
              onClick={closeMenu}
              className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkInactive}`}
            >
              <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0 fill-none stroke-current" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 13h10" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 18h6" />
              </svg>
              <span>Feeding</span>
            </NavLink>
            <NavLink
              to="/dashboard/water-change"
              onClick={closeMenu}
              className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkInactive}`}
            >
              <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0 fill-none stroke-current" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 4c0-1 14-1 14 0v9c0 4-14 4-14 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l3 3 3-3" />
              </svg>
              <span>Water Change</span>
            </NavLink>
            <NavLink
              to="/dashboard/aerator"
              onClick={closeMenu}
              className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkInactive}`}
            >
              <span className="[&>svg]:h-[18px] [&>svg]:w-[18px] shrink-0">
                <DashboardIcon name="aerator" />
              </span>
              <span>Aerator</span>
            </NavLink>
            <NavLink
              to="/dashboard/alerts"
              onClick={closeMenu}
              className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkInactive}`}
            >
              <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0 fill-none stroke-current" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 9a6 6 0 0 1 12 0c0 7 3 6 3 8H3c0-2 3-1 3-8" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 20h4" />
              </svg>
              <span>Alerts & Logs</span>
            </NavLink>
            <NavLink
              to="/dashboard/settings"
              onClick={closeMenu}
              className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkInactive}`}
            >
              <span className="[&>svg]:h-[18px] [&>svg]:w-[18px] shrink-0">
                <DashboardIcon name="settings" />
              </span>
              <span>Settings</span>
            </NavLink>
          </div>

          <button onClick={handleLogout} className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors">
            <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 17l5-5-5-5" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H9" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h7" />
            </svg>
            <span>Logout</span>
          </button>

          <div className="mt-auto pt-6 flex justify-center lg:flex-1 lg:items-end">
            <img src={logo} alt="AquaSense mascot" className="h-24 w-24 rounded-full object-cover shadow-md ring-4 ring-gray-50" />
          </div>
        </aside>

        <main className="p-4 md:p-6 lg:h-screen lg:overflow-y-auto lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

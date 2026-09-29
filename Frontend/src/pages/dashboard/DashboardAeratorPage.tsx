import React from 'react';
import { DashboardIcon } from '../../components/WaterQuality/DashboardUi';

const DashboardAeratorPage: React.FC = () => (
  <div className="flex flex-col gap-3 lg:h-full lg:min-h-0">
    <header className="shrink-0 flex items-center gap-3 bg-white border border-gray-200 shadow-sm rounded-2xl p-3">
      <div className="bg-gray-100 p-2 rounded-lg flex-shrink-0">
        <span className="text-gray-500"><DashboardIcon name="aerator" /></span>
      </div>
      <div>
        <h1 className="text-base lg:text-lg font-bold tracking-tight text-gray-900">Aerator</h1>
        <p className="text-xs text-gray-500 mt-0.5">Hardware control is not connected</p>
      </div>
    </header>

    <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Aerator state</h2>
        <p className="mt-2 text-lg font-bold text-gray-600">Unavailable · Not connected</p>
        <p className="mt-1 text-xs text-gray-500">This dashboard has no relay command or feedback connection.</p>
      </div>
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Dissolved oxygen</h2>
        <p className="mt-2 text-lg font-bold text-gray-600">Not measured</p>
        <p className="mt-1 text-xs text-gray-500">AquaSense has no physical DO probe. ORP is a separate redox measurement and is not converted to DO.</p>
      </div>
    </section>

    <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
      <h2 className="font-semibold">Aerator control unavailable</h2>
      <p className="mt-1 text-xs leading-relaxed">No manual or automatic controls are shown because this page is not connected to an aerator relay. No actuator commands are sent from this dashboard.</p>
    </section>
  </div>
);

export default DashboardAeratorPage;

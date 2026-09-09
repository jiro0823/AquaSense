import React, { useState } from 'react';
import { DashboardIcon } from '../../components/WaterQuality/DashboardUi';
import { DashboardProfile, getDashboardProfile, saveDashboardProfile } from '../../components/WaterQuality/dashboardProfile';

const inputClass = 'w-full rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400';

const Pill = ({ label }: { label: string }) => (
  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 whitespace-nowrap">
    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
    {label}
  </span>
);

const DashboardSettingsPage: React.FC = () => {
  const [profile, setProfile] = useState<DashboardProfile>(getDashboardProfile);
  const [saved, setSaved] = useState(false);

  const updateField = (field: keyof DashboardProfile, value: string) => {
    setProfile((current) => ({ ...current, [field]: value }));
    setSaved(false);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    saveDashboardProfile(profile);
    setSaved(true);
  };

  return (
    <div className="flex flex-col gap-2.5 lg:h-full lg:min-h-0">
      <header className="shrink-0 flex items-center gap-3 bg-white border border-gray-200 shadow-sm rounded-2xl p-3">
        <div className="bg-violet-50 p-2 rounded-lg flex-shrink-0">
          <span className="text-violet-600"><DashboardIcon name="settings" /></span>
        </div>
        <div>
          <h1 className="text-base lg:text-lg font-bold tracking-tight text-gray-900">Settings</h1>
          <p className="text-xs text-gray-500 mt-0.5">Farmer and project information shown across the dashboard</p>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="lg:flex-1 lg:min-h-0 grid grid-cols-1 gap-2.5 xl:grid-cols-[1.3fr_0.7fr]">
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-3 flex flex-col">
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />
              Farmer Profile
            </h3>
            {saved && <Pill label="Saved" />}
          </div>
          <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
            <label className="space-y-1 text-xs">
              <span className="text-gray-500">Farmer Name</span>
              <input value={profile.farmerName} onChange={(e) => updateField('farmerName', e.target.value)} className={inputClass} />
            </label>
            <label className="space-y-1 text-xs">
              <span className="text-gray-500">Contact Number</span>
              <input value={profile.contactNumber} onChange={(e) => updateField('contactNumber', e.target.value)} className={inputClass} />
            </label>
            <label className="space-y-1 text-xs">
              <span className="text-gray-500">Farm Name</span>
              <input value={profile.farmName} onChange={(e) => updateField('farmName', e.target.value)} className={inputClass} />
            </label>
            <label className="space-y-1 text-xs">
              <span className="text-gray-500">Tank Name</span>
              <input value={profile.tankName} onChange={(e) => updateField('tankName', e.target.value)} className={inputClass} />
            </label>
            <label className="space-y-1 text-xs md:col-span-2">
              <span className="text-gray-500">Location</span>
              <input value={profile.location} onChange={(e) => updateField('location', e.target.value)} className={inputClass} />
            </label>
            <label className="space-y-1 text-xs md:col-span-2">
              <span className="text-gray-500">Project Description</span>
              <textarea value={profile.projectDescription} onChange={(e) => updateField('projectDescription', e.target.value)} rows={3} className={`${inputClass} resize-none`} />
            </label>
          </div>
          <button type="submit" className="mt-3 self-start rounded-lg bg-violet-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-violet-700 transition-colors">
            Save Changes
          </button>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-3">
          <h3 className="mb-2.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Dashboard Preview
          </h3>
          <div className="space-y-2.5 text-xs">
            <div>
              <p className="text-gray-500">Greeting</p>
              <p className="text-base font-bold text-gray-900">Welcome back, {profile.farmerName}</p>
            </div>
            <div>
              <p className="text-gray-500">Farm</p>
              <p className="font-semibold text-gray-800">{profile.farmName}</p>
            </div>
            <div>
              <p className="text-gray-500">Tank</p>
              <p className="font-semibold text-gray-800">{profile.tankName}</p>
            </div>
            <div>
              <p className="text-gray-500">Project</p>
              <p className="text-gray-600 leading-relaxed">{profile.projectDescription}</p>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};

export default DashboardSettingsPage;

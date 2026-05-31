import React, { useState } from 'react';
import { DashboardIcon, PageHeader, Panel, StatusBadge } from '../../components/WaterQuality/DashboardUi';
import { DashboardProfile, getDashboardProfile, saveDashboardProfile } from '../../components/WaterQuality/dashboardProfile';

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
    <div className="space-y-6">
      <PageHeader title="Settings" subtitle="Farmer and project information shown across the dashboard" tone="violet" icon={<DashboardIcon name="settings" />} />

      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 xl:grid-cols-[1.3fr_0.7fr]">
        <Panel title="Farmer Profile" tone="violet" icon={saved ? <StatusBadge label="Saved" tone="emerald" /> : undefined}>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="text-gray-400">Farmer Name</span>
              <input value={profile.farmerName} onChange={(e) => updateField('farmerName', e.target.value)} className="w-full rounded-lg border border-white/10 bg-[#0f1015] px-3 py-2 text-gray-200" />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-gray-400">Contact Number</span>
              <input value={profile.contactNumber} onChange={(e) => updateField('contactNumber', e.target.value)} className="w-full rounded-lg border border-white/10 bg-[#0f1015] px-3 py-2 text-gray-200" />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-gray-400">Farm Name</span>
              <input value={profile.farmName} onChange={(e) => updateField('farmName', e.target.value)} className="w-full rounded-lg border border-white/10 bg-[#0f1015] px-3 py-2 text-gray-200" />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-gray-400">Tank Name</span>
              <input value={profile.tankName} onChange={(e) => updateField('tankName', e.target.value)} className="w-full rounded-lg border border-white/10 bg-[#0f1015] px-3 py-2 text-gray-200" />
            </label>
            <label className="space-y-1 text-sm md:col-span-2">
              <span className="text-gray-400">Location</span>
              <input value={profile.location} onChange={(e) => updateField('location', e.target.value)} className="w-full rounded-lg border border-white/10 bg-[#0f1015] px-3 py-2 text-gray-200" />
            </label>
            <label className="space-y-1 text-sm md:col-span-2">
              <span className="text-gray-400">Project Description</span>
              <textarea value={profile.projectDescription} onChange={(e) => updateField('projectDescription', e.target.value)} rows={4} className="w-full resize-none rounded-lg border border-white/10 bg-[#0f1015] px-3 py-2 text-gray-200" />
            </label>
          </div>
          <button type="submit" className="mt-4 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500">
            Save Changes
          </button>
        </Panel>

        <Panel title="Dashboard Preview" tone="emerald" icon={<DashboardIcon name="user" />}>
          <div className="space-y-3 text-sm">
            <div>
              <p className="text-gray-500">Greeting</p>
              <p className="text-lg font-bold text-white">Welcome back, {profile.farmerName}</p>
            </div>
            <div>
              <p className="text-gray-500">Farm</p>
              <p className="font-semibold text-gray-200">{profile.farmName}</p>
            </div>
            <div>
              <p className="text-gray-500">Tank</p>
              <p className="font-semibold text-gray-200">{profile.tankName}</p>
            </div>
            <div>
              <p className="text-gray-500">Project</p>
              <p className="text-gray-300">{profile.projectDescription}</p>
            </div>
          </div>
        </Panel>
      </form>
    </div>
  );
};

export default DashboardSettingsPage;

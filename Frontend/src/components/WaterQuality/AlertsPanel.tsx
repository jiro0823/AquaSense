/**
 * Alerts Panel Component
 * Displays recent water quality alerts and warnings
 */
import React from 'react';
import type { HealthAlert } from '../../types/water';

interface AlertsPanelProps {
  alerts: HealthAlert[];
}

export const AlertsPanel: React.FC<AlertsPanelProps> = ({ alerts }) => {
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-50 border-l-red-500 text-red-900';
      case 'warning':
        return 'bg-yellow-50 border-l-yellow-500 text-yellow-900';
      case 'info':
        return 'bg-blue-50 border-l-blue-500 text-blue-900';
      default:
        return 'bg-gray-50 border-l-gray-500 text-gray-900';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return '⚠️';
      case 'warning':
        return '⚡';
      case 'info':
        return 'ℹ️';
      default:
        return '•';
    }
  };

  const formatTime = (date: Date) => {
    const d = new Date(date);
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Recent Alerts</h3>

      {alerts.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p className="text-sm">No alerts at this time</p>
          <p className="text-xs mt-2">Water quality is stable</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-64 overflow-y-auto">
          {alerts.map((alert) => (
            <div key={alert.id} className={`border-l-4 rounded p-3 ${getSeverityColor(alert.severity)}`}>
              <div className="flex items-start gap-2">
                <span className="text-lg flex-shrink-0">{getSeverityIcon(alert.severity)}</span>
                <div className="flex-grow min-w-0">
                  <p className="font-semibold text-sm capitalize">{alert.parameter}</p>
                  <p className="text-xs opacity-90 line-clamp-2">{alert.message}</p>
                  <div className="flex justify-between items-center mt-1 text-xs opacity-75">
                    <span>Value: {alert.value.toFixed(2)}</span>
                    <span>{formatTime(alert.timestamp)}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

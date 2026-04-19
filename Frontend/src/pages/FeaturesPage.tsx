import React from 'react';
import Navigation from '../components/Navigation';
import Footer from '../components/Footer';
import bigImage01 from '../assets/images/feature/big_image01.jpg';
import smallImage01 from '../assets/images/feature/small_image01.jpg';
import smallImage03 from '../assets/images/feature/small_image03.jpg';
import temperatureImage from '../assets/images/feature/temeprature.1.png';
import phImage from '../assets/images/feature/ph.png';
import dissolvedOxygenImage from '../assets/images/feature/DO.webp';
import turbidityImage from '../assets/images/feature/turbidity.1.png';
import iotDevicesImage from '../assets/images/feature/iotdevices.jpg';

const FeaturesPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <Navigation />

      {/* Hero Section */}
      <div className="px-4 py-16 bg-gradient-to-br from-cyan-50 via-cyan-100 to-sky-100 sm:px-6 lg:py-28">
        <div className="grid items-center mx-auto gap-14 max-w-7xl lg:grid-cols-2">
          <div className="max-w-2xl text-left"> 
            <h1 className="mb-6 text-4xl font-bold leading-tight sm:text-5xl md:text-6xl text-primary">
              Powerful
              <span className="text-accent"> Features</span>
            </h1>
            <p className="pl-4 text-base leading-relaxed text-gray-700 border-l-4 sm:text-lg border-cyan-200">
              Comprehensive water quality monitoring and intelligent automation designed to optimize aquaculture performance. By leveraging real-time data insights, advanced sensor technology, and smart control systems, AquaSense ensures healthier aquatic environments, maximized yield, and more efficient, sustainable farming operations.
            </p>
          </div>

          <div className="grid h-full grid-cols-1 gap-5 sm:grid-cols-2 min-h-[420px] sm:min-h-[500px] lg:min-h-[620px]">
            <div className="row-span-2 overflow-hidden shadow-sm bg-white/70 rounded-2xl">
              <img
                src={bigImage01}
                alt="Feature overview"
                className="object-cover w-full h-full"
              />
            </div>
            <div className="overflow-hidden shadow-sm bg-white/70 rounded-2xl">
              <img
                src={smallImage01}
                alt="Feature detail"
                className="object-cover w-full h-full"
              />
            </div>
            <div className="overflow-hidden shadow-sm bg-white/70 rounded-2xl">
              <img
                src={smallImage03}
                alt="Feature preview"
                className="object-cover w-full h-full"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Core Monitoring Section */}
      <div className="px-4 py-16 bg-stone-100 sm:px-6 lg:py-24">
        <div className="mx-auto max-w-[104rem]">
          <div className="mb-10 text-center">
            <h2 className="mb-3 text-4xl font-bold md:text-5xl text-primary">Core Monitoring</h2>
            <p className="max-w-2xl mx-auto text-lg text-gray-700">Real-time sensor data collection and analysis with visual sensor cards ready for your custom photos.</p>
          </div>
          <div className="grid items-stretch grid-cols-1 gap-8 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {/* Temperature */}
            <div className="flex flex-col h-full card">
              <div className="w-full mb-5 overflow-hidden h-44 bg-slate-100 rounded-xl">
                <img
                  src={temperatureImage}
                  alt="Temperature monitoring"
                  className="object-cover w-full h-full"
                />
              </div>
              <div className="flex-1">
                <h3 className="mb-4 text-2xl font-bold leading-tight text-slate-800">Temperature Monitoring</h3>
                <ul className="space-y-2 text-sm text-slate-700">
                  <li className="flex items-start gap-2"><span className="font-bold text-orange-500">✓</span><span>Real-time readings</span></li>
                  <li className="flex items-start gap-2"><span className="font-bold text-orange-500">✓</span><span>Historical tracking</span></li>
                  <li className="flex items-start gap-2"><span className="font-bold text-orange-500">✓</span><span>Min/Max/Average stats</span></li>
                  <li className="flex items-start gap-2"><span className="font-bold text-orange-500">✓</span><span>Trend analysis</span></li>
                </ul>
              </div>
            </div>

            {/* pH Level */}
            <div className="flex flex-col h-full card">
              <div className="w-full mb-5 overflow-hidden h-44 bg-slate-100 rounded-xl">
                <img
                  src={phImage}
                  alt="pH level detection"
                  className="object-cover w-full h-full"
                />
              </div>
              <div className="flex-1">
                <h3 className="mb-4 text-2xl font-bold leading-tight text-slate-800">pH Level Detection</h3>
                <ul className="space-y-2 text-sm text-slate-700">
                  <li className="flex items-start gap-2"><span className="font-bold text-purple-500">✓</span><span>Continuous monitoring</span></li>
                  <li className="flex items-start gap-2"><span className="font-bold text-purple-500">✓</span><span>Optimal range alerts</span></li>
                  <li className="flex items-start gap-2"><span className="font-bold text-purple-500">✓</span><span>Acid/Alkalinity balance</span></li>
                  <li className="flex items-start gap-2"><span className="font-bold text-purple-500">✓</span><span>Quality indicators</span></li>
                </ul>
              </div>
            </div>

            {/* Dissolved Oxygen */}
            <div className="flex flex-col h-full card">
              <div className="w-full mb-5 overflow-hidden h-44 bg-slate-100 rounded-xl">
                <img
                  src={dissolvedOxygenImage}
                  alt="Dissolved oxygen monitoring"
                  className="object-cover w-full h-full"
                />
              </div>
              <div className="flex-1">
                <h3 className="mb-4 text-2xl font-bold leading-tight text-slate-800">Dissolved Oxygen</h3>
                <ul className="space-y-2 text-sm text-slate-700">
                  <li className="flex items-start gap-2"><span className="font-bold text-green-600">✓</span><span>Critical for aquatic life</span></li>
                  <li className="flex items-start gap-2"><span className="font-bold text-green-600">✓</span><span>Aerator automation</span></li>
                  <li className="flex items-start gap-2"><span className="font-bold text-green-600">✓</span><span>Level tracking</span></li>
                  <li className="flex items-start gap-2"><span className="font-bold text-green-600">✓</span><span>Emergency alerts</span></li>
                </ul>
              </div>
            </div>

            {/* Turbidity */}
            <div className="flex flex-col h-full card">
              <div className="w-full mb-5 overflow-hidden h-44 bg-slate-100 rounded-xl">
                <img
                  src={turbidityImage}
                  alt="Water clarity and turbidity"
                  className="object-cover w-full h-full"
                />
              </div>
              <div className="flex-1">
                <h3 className="mb-4 text-2xl font-bold leading-tight text-slate-800">Water Clarity</h3>
                <ul className="space-y-2 text-sm text-slate-700">
                  <li className="flex items-start gap-2"><span className="font-bold text-amber-500">✓</span><span>Turbidity measurement</span></li>
                  <li className="flex items-start gap-2"><span className="font-bold text-amber-500">✓</span><span>Particle detection</span></li>
                  <li className="flex items-start gap-2"><span className="font-bold text-amber-500">✓</span><span>Water clarity index</span></li>
                  <li className="flex items-start gap-2"><span className="font-bold text-amber-500">✓</span><span>Quality assessment</span></li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-4 py-16 bg-[#faf9f6] sm:px-6 lg:py-20">
        <div className="mx-auto max-w-7xl">
          {/* Integrated Automation + Alerts Section */}
          <section className="mb-20">
            <div className="grid items-center gap-12 lg:grid-cols-[1.2fr_1fr] lg:gap-16">
              <div className="min-h-[440px] lg:min-h-[520px] overflow-hidden bg-slate-100 rounded-2xl shadow-sm">
                <img
                  src={iotDevicesImage}
                  alt="IoT devices used for smart aquaculture automation"
                  className="object-cover w-full h-full"
                />
              </div>

              <div className="pr-2">
                <h3 className="mb-6 text-4xl font-bold text-cyan-500">Smart Operations Panel</h3>

                <div className="mb-7">
                  <h4 className="mb-2 text-lg font-semibold text-cyan-700">Automated Aerator Control</h4>
                  <ul className="space-y-2 text-base text-slate-700">
                    <li>Maintains dissolved oxygen in the ideal 5-8 mg/L range.</li>
                    <li>Uses schedule-based aeration during peak activity periods.</li>
                    <li>Triggers emergency operation on oxygen drop events.</li>
                    <li>Supports energy-efficient and solar-assisted operation.</li>
                  </ul>
                </div>

                <div className="mb-7">
                  <h4 className="mb-2 text-lg font-semibold text-green-700">Automated Feeding System</h4>
                  <ul className="space-y-2 text-base text-slate-700">
                    <li>Feeds based on crayfish behavior and schedule patterns.</li>
                    <li>Offers adjustable portions and feeding frequency.</li>
                    <li>Reduces overfeeding and protects water quality stability.</li>
                    <li>Allows remote monitoring and quick feeding adjustments.</li>
                  </ul>
                </div>

                <div>
                  <h4 className="mb-2 text-lg font-semibold text-red-700">Real-Time Notifications</h4>
                  <p className="mb-2 text-base leading-relaxed text-slate-700">Critical events such as low oxygen, unsafe pH, sudden temperature changes, and device faults are sent instantly through mobile app, email, dashboard, and SMS for urgent scenarios.</p>
                </div>
              </div>
            </div>
          </section>

          {/* Analytics Section */}
          <section>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <div className="p-6 border border-cyan-200 bg-gradient-to-br from-cyan-50 to-white rounded-2xl">
                <h4 className="mb-2 text-lg font-bold text-blue-800">Real-Time Dashboard</h4>
                <p className="mb-2 text-sm text-slate-700">Live visualization of current sensor values, health status, and active automation states.</p>
                <p className="text-xs text-slate-600">Monitor critical parameters, customize widgets, and review live trends.</p>
              </div>
              <div className="p-6 border border-blue-200 bg-gradient-to-br from-blue-50 to-white rounded-2xl">
                <h4 className="mb-2 text-lg font-bold text-blue-800">Historical Analysis</h4>
                <p className="mb-2 text-sm text-slate-700">Track past records to identify long-term behavior patterns and optimize farm decisions.</p>
                <p className="text-xs text-slate-600">Includes retention, export options, and prediction-oriented insights.</p>
              </div>
              <div className="p-6 border border-indigo-200 bg-gradient-to-br from-indigo-50 to-white rounded-2xl">
                <h4 className="mb-2 text-lg font-bold text-blue-800">Performance Reports</h4>
                <p className="mb-2 text-sm text-slate-700">Generate summary reports to evaluate quality, efficiency, and production impact.</p>
                <p className="text-xs text-slate-600">Review KPIs, weekly or monthly trends, and yield-focused metrics.</p>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Data Security Section */}
      <div className="px-4 py-12 bg-gradient-to-br from-blue-50 via-white to-cyan-50 sm:px-6">
        <div className="mx-auto max-w-7xl">
          {/* Data Security */}
          <section>
            <h2 className="mb-8 text-3xl font-bold text-primary">Security & Accessibility</h2>
          <div className="grid grid-cols-1 gap-6 mb-8 md:grid-cols-2">
            <div className="flex gap-4">
              <div className="flex-shrink-0 text-3xl">🔒</div>
              <div>
                <h4 className="mb-2 text-lg font-bold text-cyan-300">Enterprise Security</h4>
                <p className="text-slate-700">JWT authentication, encrypted communication, role-based access control, and secure data storage</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-shrink-0 text-3xl">📱</div>
              <div>
                <h4 className="mb-2 text-lg font-bold text-cyan-300">Multi-Platform Access</h4>
                <p className="text-slate-700">Desktop, tablet, and mobile-responsive interface for monitoring from anywhere</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-shrink-0 text-3xl">☀️</div>
              <div>
                <h4 className="mb-2 text-lg font-bold text-cyan-300">Renewable Energy</h4>
                <p className="text-slate-700">Solar-powered operation with battery backup for 24/7 monitoring capability</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-shrink-0 text-3xl">🌐</div>
              <div>
                <h4 className="mb-2 text-lg font-bold text-cyan-300">Cloud Integration</h4>
                <p className="text-slate-700">Reliable data sync and remote management from anywhere with internet connection</p>
              </div>
            </div>
          </div>

          {/* Essential Monitoring Parameters */}
          <div className="p-6 border border-blue-400 bg-slate-800 rounded-xl border-opacity-30">
            <h3 className="mb-4 text-2xl font-bold text-cyan-300">Essential Monitoring Parameters</h3>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div>
                <h4 className="mb-2 font-bold text-green-300">Water Quality Metrics</h4>
                <div className="space-y-2 text-white">
                  <p className="text-blue-200"><span className="font-bold text-blue-300">Temperature:</span> 20-30°C optimal range for crayfish</p>
                  <p className="text-blue-200"><span className="font-bold text-blue-300">pH Level:</span> 7.0-8.5 for healthy aquatic environment</p>
                  <p className="text-blue-200"><span className="font-bold text-blue-300">Dissolved Oxygen:</span> 5-8 mg/L for crayfish survival</p>
                  <p className="text-blue-200"><span className="font-bold text-blue-300">Turbidity:</span> &lt;25 NTU for water clarity</p>
                </div>
              </div>
              <div>
                <h4 className="mb-2 font-bold text-green-300">Automation Triggers</h4>
                <div className="space-y-2 text-white">
                  <p className="text-blue-200"><span className="font-bold text-blue-300">Low Oxygen:</span> Aerator activates automatically</p>
                  <p className="text-blue-200"><span className="font-bold text-blue-300">Feeding Time:</span> Automatic dispenser releases food</p>
                  <p className="text-blue-200"><span className="font-bold text-blue-300">Critical Events:</span> Instant mobile notifications</p>
                  <p className="text-blue-200"><span className="font-bold text-blue-300">Health Trends:</span> Predictive alerts for interventions</p>
                </div>
              </div>
            </div>
          </div>
        </section>
        </div>
      </div>

      {/* Footer */}
      <Footer />
    </div>
  );
};

export default FeaturesPage;

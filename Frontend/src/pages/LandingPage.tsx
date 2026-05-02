import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Navigation from '../components/Navigation';
import Footer from '../components/Footer';
import ContactSection from '../components/ContactSection';
import FaqSection from '../components/FaqSection';
import NewsBlogsSection from '../components/NewsBlogsSection';
import TestimonySection from '../components/TestimonySection';

interface HealthResponse {
  success: boolean;
  statusCode: number;
  message: string;
  data?: {
    uptime: number;
  };
}

const LandingPage: React.FC = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const apiBase = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env
      ?.VITE_API_URL || 'http://localhost:5000/api/v1';
    const normalizedBase = apiBase.replace(/\/+$/, '');
    const healthUrl = `${normalizedBase}/health`;

    const checkBackend = async () => {
      try {
        const response = await fetch(healthUrl, {
          signal: AbortSignal.timeout(3000),
          cache: 'no-store',
          headers: {
            Accept: 'application/json',
          },
        });

        if (!response.ok) {
          setIsConnected(false);
          return;
        }

        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
          setIsConnected(false);
          return;
        }

        const data: HealthResponse = await response.json();
        const hasUptime = typeof data.data?.uptime === 'number';
        setIsConnected(data.success === true && data.statusCode === 200 && hasUptime);
      } catch (_err) {
        setIsConnected(false);
      } finally {
        setLoading(false);
      }
    };

    checkBackend();
    const healthCheckInterval = setInterval(checkBackend, 5000);
    return () => clearInterval(healthCheckInterval);
  }, []);


  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <Navigation />

      {/* Hero Section */}
      <section className="relative px-4 py-16 overflow-hidden bg-gradient-to-br from-cyan-50 via-cyan-100 to-sky-100 sm:px-6 sm:py-20">
        <div className="relative mx-auto text-center max-w-7xl">
          <h1 className="mb-6 text-4xl font-bold leading-tight text-cyan-500 sm:text-5xl md:text-6xl">
            Smart Water Quality Monitoring
            <span className="block mt-2 text-primary">for Crayfish Farming</span>
          </h1>
          <p className="max-w-3xl mx-auto mb-10 text-base leading-relaxed text-slate-700 sm:text-lg md:text-xl">
            Real-time IoT dashboard with advanced sensors for temperature, pH, dissolved oxygen, and turbidity. Get instant alerts, automated controls, and comprehensive analytics to optimize your aquaculture operations.
          </p>

          <div className="flex flex-wrap justify-center gap-4 mb-12">
            <Link
              to="/dashboard"
              className="btn btn-primary btn-lg"
            >
              View Dashboard →
            </Link>
            <Link
              to="/features"
              className="btn btn-outline btn-lg"
            >
              Learn More
            </Link>
          </div>

          {/* Status */}
          <div className="flex justify-center">
            {loading ? (
              <div className="flex items-center gap-2 text-blue-200 bg-slate-800/50 badge">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
                <span>Checking system status...</span>
              </div>
            ) : isConnected ? (
              <div className="flex items-center gap-2 text-green-200 bg-green-900/50 badge">
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                <span className="font-semibold">System Ready</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-red-200 bg-red-900/50 badge">
                <span className="w-2 h-2 bg-red-400 rounded-full animate-pulse"></span>
                <span className="font-semibold">System Offline</span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Problems Section - The Farmer's Pain Points */}
      <section className="px-4 py-16 bg-gray-100 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-7xl">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-2xl font-bold text-blue-900 md:text-4xl">Farming Shouldn't be a Guessing Game</h2>
            <p className="text-lg text-gray-600">Most farmers face the same challenges. We solve them all.</p>
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {/* Problem 1 */}
            <div className="p-8 transition bg-white rounded-lg shadow-md hover:shadow-lg">
              <div className="mb-4 text-5xl">⚠️</div>
              <h3 className="mb-3 text-xl font-bold text-gray-900">Low Oxygen Levels</h3>
              <p className="font-semibold text-gray-700">↓ sudden losses</p>
              <p className="mt-3 text-sm text-gray-600">
                Without real-time monitoring, you might not notice oxygen drops until it's too late, costing you your entire stock.
              </p>
            </div>

            {/* Problem 2 */}
            <div className="p-8 transition bg-white rounded-lg shadow-md hover:shadow-lg">
              <div className="mb-4 text-5xl">👤</div>
              <h3 className="mb-3 text-xl font-bold text-gray-900">Manual Monitoring</h3>
              <p className="font-semibold text-gray-700">↓ time-consuming</p>
              <p className="mt-3 text-sm text-gray-600">
                Checking water conditions manually takes hours away from other critical farm tasks. It's exhausting and unreliable.
              </p>
            </div>

            {/* Problem 3 */}
            <div className="p-8 transition bg-white rounded-lg shadow-md hover:shadow-lg">
              <div className="mb-4 text-5xl">⚡</div>
              <h3 className="mb-3 text-xl font-bold text-gray-900">Unpredictable Conditions</h3>
              <p className="font-semibold text-gray-700">↓ risky</p>
              <p className="mt-3 text-sm text-gray-600">
                Without historical data and trends, you're flying blind. One bad day can destroy months of work and profit.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Solution Section */}
      <section className="px-4 py-16 bg-white sm:px-6 sm:py-20">
        <div className="mx-auto max-w-7xl">
          <div className="grid items-center grid-cols-1 gap-12 md:grid-cols-2">
            
            {/* Left Side - Dashboard Illustration */}
            <div className="relative items-center justify-center hidden md:flex">
              <div className="relative w-full overflow-hidden shadow-2xl h-96 bg-gradient-to-br from-primary to-blue-700 rounded-2xl">
                <div className="absolute inset-0 bg-opacity-10 bg-pattern"></div>
                
                {/* Mockup Dashboard */}
                <div className="absolute inset-0 flex flex-col p-6">
                  <div className="flex gap-2 mb-4">
                    <div className="w-3 h-3 bg-green-400 rounded-full"></div>
                    <div className="w-3 h-3 rounded-full bg-accent"></div>
                    <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
                  </div>
                  
                  <div className="flex-1 space-y-3 text-white text-opacity-80">
                    <div className="flex items-center h-12 px-3 bg-white rounded-lg bg-opacity-20">
                      <span className="text-2xl">🌡️</span>
                      <div className="flex-1 ml-3">
                        <div className="text-xs text-opacity-60">Temperature</div>
                        <div className="text-lg font-bold">28.5°C</div>
                      </div>
                    </div>
                    
                    <div className="flex items-center h-12 px-3 bg-white rounded-lg bg-opacity-20">
                      <span className="text-2xl">🔍</span>
                      <div className="flex-1 ml-3">
                        <div className="text-xs text-opacity-60">pH Level</div>
                        <div className="text-lg font-bold">7.2</div>
                      </div>
                    </div>
                    
                    <div className="flex items-center h-12 px-3 bg-white rounded-lg bg-opacity-20">
                      <span className="text-2xl">💨</span>
                      <div className="flex-1 ml-3">
                        <div className="text-xs text-opacity-60">Dissolved O₂</div>
                        <div className="text-lg font-bold">7.1 mg/L</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Side - Text Content */}
            <div>
              <h2 className="mb-5 text-3xl font-bold text-cyan-500 md:text-5xl">A Smarter Way to  <br /> Manage Your Pond</h2>
              <p className="mb-8 text-lg leading-relaxed text-gray-600">
                AquaSense transforms how you care for your crayfish. Stop guessing. Start knowing. Our intelligent system handles everything automatically while you focus on growing your farm.
              </p>

              <ul className="space-y-4">
                <li className="flex items-start gap-4">
                  <div className="flex items-center justify-center flex-shrink-0 w-8 h-8 mt-1 rounded-full bg-accent bg-opacity-20">
                    <span className="font-bold text-accent">✓</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900">Real-time Monitoring</h4>
                    <p className="mt-1 text-sm text-gray-600">24/7 sensor data streaming to your dashboard. Never miss a critical change.</p>
                  </div>
                </li>

                <li className="flex items-start gap-4">
                  <div className="flex items-center justify-center flex-shrink-0 w-8 h-8 mt-1 rounded-full bg-accent bg-opacity-20">
                    <span className="font-bold text-accent">✓</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900">Automated Aeration</h4>
                    <p className="mt-1 text-sm text-gray-600">Smart controls adjust oxygen levels automatically based on real-time data.</p>
                  </div>
                </li>

                <li className="flex items-start gap-4">
                  <div className="flex items-center justify-center flex-shrink-0 w-8 h-8 mt-1 rounded-full bg-accent bg-opacity-20">
                    <span className="font-bold text-accent">✓</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900">Smart Feeding System</h4>
                    <p className="mt-1 text-sm text-gray-600">Optimize feeding schedules based on water quality and conditions.</p>
                  </div>
                </li>

                <li className="flex items-start gap-4">
                  <div className="flex items-center justify-center flex-shrink-0 w-8 h-8 mt-1 rounded-full bg-accent bg-opacity-20">
                    <span className="font-bold text-accent">✓</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900">Instant Alerts</h4>
                    <p className="mt-1 text-sm text-gray-600">Get notified immediately if anything goes wrong. Respond before it becomes a crisis.</p>
                  </div>
                </li>
              </ul>

              <Link
                to="/dashboard"
                className="inline-block mt-8 btn btn-primary"
              >
                See It in Action →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section - High Impact */}
      <section className="px-4 py-16 bg-gray-100 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-7xl">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-3xl font-bold text-cyan-500 md:text-4xl">Why Farmers Choose <span className="text-blue-800">AquaSense</span></h2>
            <p className="text-lg text-gray-600">Real benefits that make a real difference</p>
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            {/* Reduce Losses */}
            <div className="bg-white card">
              <div className="mb-4 text-5xl">🛡️</div>
              <h3 className="mb-3 text-lg font-bold text-gray-900">Reduce Losses</h3>
              <p className="text-sm text-gray-600">
                Catch problems before they become catastrophes. Prevent oxygen crashes and disease outbreaks.
              </p>
            </div>

            {/* Save Time */}
            <div className="bg-white card">
              <div className="mb-4 text-5xl">⏱️</div>
              <h3 className="mb-3 text-lg font-bold text-gray-900">Save Time</h3>
              <p className="text-sm text-gray-600">
                Eliminate manual monitoring. Let automation handle the work while you focus on growth.
              </p>
            </div>

            {/* Improve Growth */}
            <div className="bg-white card">
              <div className="mb-4 text-5xl">📈</div>
              <h3 className="mb-3 text-lg font-bold text-gray-900">Improve Growth</h3>
              <p className="text-sm text-gray-600">
                Optimize conditions 24/7. Healthier conditions mean faster, stronger crayfish.
              </p>
            </div>

            {/* Sustainable */}
            <div className="bg-white card">
              <div className="mb-4 text-5xl">♻️</div>
              <h3 className="mb-3 text-lg font-bold text-gray-900">Sustainable</h3>
              <p className="text-sm text-gray-600">
                Solar-powered sensors and smart controls reduce your carbon footprint and operating costs.
              </p>
            </div>

            {/* Easy to Use */}
            <div className="bg-white card">
              <div className="mb-4 text-5xl">👨‍🌾</div>
              <h3 className="mb-3 text-lg font-bold text-gray-900">Easy to Use</h3>
              <p className="text-sm text-gray-600">
                No tech background needed. Simple dashboard designed specifically for farmers.
              </p>
            </div>

            {/* Reliable */}
            <div className="bg-white card">
              <div className="mb-4 text-5xl">✅</div>
              <h3 className="mb-3 text-lg font-bold text-gray-900">Reliable System</h3>
              <p className="text-sm text-gray-600">
                Enterprise-grade infrastructure with 99.9% uptime. Your farm never stops working.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Dashboard Preview Section */}
      <section className="px-4 py-16 bg-surface sm:px-6 sm:py-20">
        <div className="mx-auto max-w-7xl">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-3xl font-bold text-blue-800 md:text-5xl">Everything You Need in One Dashboard</h2>
            <p className="text-gray-600 text-medium">Monitor, control, and track your farm in real-time with a simple and intuitive interface.</p>
          </div>

          {/* Large Dashboard Mockup */}
          <div className="relative">
            <div className="overflow-hidden shadow-2xl bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl">
              {/* Dashboard Background Glow */}
              <div className="absolute inset-0 opacity-30 bg-gradient-to-br from-blue-500 via-transparent to-cyan-500 blur-3xl"></div>
              
              {/* Dashboard Content */}
              <div className="relative p-8 md:p-12">
                {/* Dashboard Header */}
                <div className="pb-6 mb-8 border-b border-slate-700">
                  <h3 className="text-2xl font-bold text-white">Farm Monitor Dashboard</h3>
                  <p className="mt-2 text-sm text-slate-400">Real-time water quality analysis for Pond 01</p>
                </div>

                {/* Main Content Grid - Sensor Cards */}
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
                  {/* Sensor Card 1 - Temperature */}
                  <div className="p-6 transition-all duration-300 border shadow-lg bg-gradient-to-br from-orange-500/10 to-orange-600/10 border-orange-500/20 rounded-xl hover:border-orange-500/50 hover:shadow-orange-500/20">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-3xl">🌡️</span>
                      <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                    </div>
                    <p className="text-sm text-slate-400">Temperature</p>
                    <div className="mt-2 text-3xl font-bold text-white">28.5°C</div>
                    <p className="mt-2 text-xs text-slate-500">↑ +0.5°C from last hour</p>
                  </div>

                  {/* Sensor Card 2 - pH Level */}
                  <div className="p-6 transition-all duration-300 border shadow-lg bg-gradient-to-br from-blue-500/10 to-blue-600/10 border-blue-500/20 rounded-xl hover:border-blue-500/50 hover:shadow-blue-500/20">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-3xl">🔍</span>
                      <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                    </div>
                    <p className="text-sm text-slate-400">pH Level</p>
                    <div className="mt-2 text-3xl font-bold text-white">7.2</div>
                    <p className="mt-2 text-xs text-slate-500">Optimal range</p>
                  </div>

                  {/* Sensor Card 3 - Dissolved Oxygen */}
                  <div className="p-6 transition-all duration-300 border shadow-lg bg-gradient-to-br from-green-500/10 to-green-600/10 border-green-500/20 rounded-xl hover:border-green-500/50 hover:shadow-green-500/20">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-3xl">💨</span>
                      <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                    </div>
                    <p className="text-sm text-slate-400">Dissolved O₂</p>
                    <div className="mt-2 text-3xl font-bold text-white">7.1 mg/L</div>
                    <p className="mt-2 text-xs text-slate-500">Healthy levels</p>
                  </div>

                  {/* Sensor Card 4 - Turbidity */}
                  <div className="p-6 transition-all duration-300 border shadow-lg bg-gradient-to-br from-cyan-500/10 to-cyan-600/10 border-cyan-500/20 rounded-xl hover:border-cyan-500/50 hover:shadow-cyan-500/20">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-3xl">🌊</span>
                      <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                    </div>
                    <p className="text-sm text-slate-400">Turbidity</p>
                    <div className="mt-2 text-3xl font-bold text-white">2.3 NTU</div>
                    <p className="mt-2 text-xs text-slate-500">Clear water</p>
                  </div>
                </div>

                {/* Alerts and Automation Section */}
                <div className="grid grid-cols-1 gap-6 mt-8 md:grid-cols-2">
                  {/* Alerts */}
                  <div className="p-6 border bg-slate-800/50 border-slate-700 rounded-xl">
                    <h4 className="flex items-center gap-2 font-bold text-white">
                      <span className="text-xl">🚨</span>
                      Alerts & Notifications
                    </h4>
                    <div className="mt-4 space-y-3">
                      <div className="flex items-start gap-3 p-3 border rounded-lg bg-green-500/10 border-green-500/30">
                        <span className="text-green-400 mt-0.5">✓</span>
                        <div>
                          <p className="text-sm font-medium text-green-200">All systems optimal</p>
                          <p className="text-xs text-slate-400">Last checked 2 minutes ago</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 p-3 border rounded-lg bg-yellow-500/10 border-yellow-500/30">
                        <span className="text-yellow-400 mt-0.5">⚠</span>
                        <div>
                          <p className="text-sm font-medium text-yellow-200">pH trending low</p>
                          <p className="text-xs text-slate-400">Monitor in next hour</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Automation Status */}
                  <div className="p-6 border bg-slate-800/50 border-slate-700 rounded-xl">
                    <h4 className="flex items-center gap-2 font-bold text-white">
                      <span className="text-xl">⚙️</span>
                      Automation Status
                    </h4>
                    <div className="mt-4 space-y-3">
                      <div className="flex items-center justify-between p-3 rounded-lg bg-slate-700/50">
                        <span className="text-sm text-white">Aeration System</span>
                        <div className="w-10 h-6 bg-green-500 rounded-full"></div>
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-lg bg-slate-700/50">
                        <span className="text-sm text-white">Feeding Timer</span>
                        <div className="w-10 h-6 bg-green-500 rounded-full"></div>
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-lg bg-slate-700/50">
                        <span className="text-sm text-white">Alert System</span>
                        <div className="w-10 h-6 bg-green-500 rounded-full"></div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Dashboard Image Placeholder */}
                <div className="mt-8">
                  <div className="flex items-center justify-center w-full h-64 border-2 border-dashed shadow-xl bg-gradient-to-br from-slate-700 to-slate-900 border-slate-600 rounded-xl">
                    <div className="text-center">
                      <p className="text-lg font-semibold text-slate-300">📊 Dashboard Preview</p>
                      <p className="mt-2 text-sm text-slate-500">(Actual dashboard screenshot will be added here)</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="px-4 py-16 bg-white sm:px-6 sm:py-20">
        <div className="mx-auto max-w-7xl">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-3xl font-bold text-cyan-500 md:text-4xl">How It Works</h2>
            <p className="text-lg text-gray-600">Three simple steps to protect your farm</p>
          </div>

          {/* Steps Container */}
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {/* Step 1 */}
            <div className="relative">
              <div className="flex flex-col items-center text-center">
                <div className="flex items-center justify-center w-20 h-20 mb-6 text-5xl duration-300 transform bg-blue-100 rounded-full hover:scale-110 hover:shadow-lg">
                  📡
                </div>
                <h3 className="mb-3 text-2xl font-bold text-gray-900">Sensors Collect Data</h3>
                <p className="text-gray-600">
                  Smart sensors in your pond continuously measure temperature, oxygen levels, pH, and water clarity - 24/7.
                </p>
              </div>
              {/* Arrow for larger screens */}
              <div className="absolute hidden md:block top-1/3 -right-8">
                <svg className="w-8 h-8 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>

            {/* Step 2 */}
            <div className="relative">
              <div className="flex flex-col items-center text-center">
                <div className="flex items-center justify-center w-20 h-20 mb-6 text-5xl duration-300 transform rounded-full bg-cyan-100 hover:scale-110 hover:shadow-lg">
                  🧠
                </div>
                <h3 className="mb-3 text-2xl font-bold text-gray-900">System Analyzes</h3>
                <p className="text-gray-600">
                  Our intelligent system instantly analyzes the data and compares it against healthy fish farming conditions.
                </p>
              </div>
              {/* Arrow for larger screens */}
              <div className="absolute hidden md:block top-1/3 -right-8">
                <svg className="w-8 h-8 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>

            {/* Step 3 */}
            <div>
              <div className="flex flex-col items-center text-center">
                <div className="flex items-center justify-center w-20 h-20 mb-6 text-5xl duration-300 transform bg-green-100 rounded-full hover:scale-110 hover:shadow-lg">
                  ⚡
                </div>
                <h3 className="mb-3 text-2xl font-bold text-gray-900">Action & Alerts</h3>
                <p className="text-gray-600">
                  If anything needs attention, your systems automatically respond and you get an instant alert on your phone.
                </p>
              </div>
            </div>
          </div>

          {/* Bottom CTA */}
          <div className="mt-16 text-center">
            <p className="mb-6 text-gray-600">
              It's that simple. Your farm takes care of itself while you focus on growth.
            </p>
            <Link
              to="/dashboard"
              className="btn btn-primary btn-lg"
            >
              See It in Action →
            </Link>
          </div>
        </div>
      </section>

      {/* Trust & Reliability Section */}
      <section className="relative px-4 py-16 overflow-hidden bg-gradient-to-br from-cyan-50 via-cyan-100 to-sky-100 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-7xl">
          <div className="grid items-center grid-cols-1 gap-12 md:grid-cols-2">
            {/* Left Side - Text */}
            <div>
              <h2 className="mb-6 text-3xl font-bold text-blue-900 md:text-4xl">Built for Real Farming</h2>
              <p className="mb-6 text-lg leading-relaxed text-gray-700">
                Built for real farming environments with reliable hardware and consistent performance. Stay informed and in control at all times.
              </p>
              <p className="text-gray-600">
                We understand the harsh realities of farm life. Our system is designed to withstand tough conditions, deliver accurate data when you need it most, and keep you connected no matter what.
              </p>
            </div>

            {/* Right Side - Trust Indicators */}
            <div className="space-y-4">
              {/* Reliability */}
              <div className="flex items-center gap-4 p-4 transition bg-white rounded-lg shadow-sm hover:shadow-md">
                <div className="flex items-center justify-center flex-shrink-0 w-12 h-12 text-2xl bg-green-100 rounded-full">
                  ✅
                </div>
                <div>
                  <h4 className="font-bold text-gray-900">99.9% Uptime</h4>
                  <p className="text-sm text-gray-600">Enterprise-grade reliability you can trust</p>
                </div>
              </div>

              {/* Durability */}
              <div className="flex items-center gap-4 p-4 transition bg-white rounded-lg shadow-sm hover:shadow-md">
                <div className="flex items-center justify-center flex-shrink-0 w-12 h-12 text-2xl bg-blue-100 rounded-full">
                  🛡️
                </div>
                <div>
                  <h4 className="font-bold text-gray-900">Built to Last</h4>
                  <p className="text-sm text-gray-600">Waterproof sensors designed for harsh pond environments</p>
                </div>
              </div>

              {/* Always Connected */}
              <div className="flex items-center gap-4 p-4 transition bg-white rounded-lg shadow-sm hover:shadow-md">
                <div className="flex items-center justify-center flex-shrink-0 w-12 h-12 text-2xl rounded-full bg-cyan-100">
                  📱
                </div>
                <div>
                  <h4 className="font-bold text-gray-900">Always Connected</h4>
                  <p className="text-sm text-gray-600">Real-time alerts on your phone, anytime, anywhere</p>
                </div>
              </div>

              {/* Accurate Data */}
              <div className="flex items-center gap-4 p-4 transition bg-white rounded-lg shadow-sm hover:shadow-md">
                <div className="flex items-center justify-center flex-shrink-0 w-12 h-12 text-2xl rounded-full bg-amber-100">
                  🎯
                </div>
                <div>
                  <h4 className="font-bold text-gray-900">Precision Tracking</h4>
                  <p className="text-sm text-gray-600">Lab-grade sensor accuracy for critical decisions</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <ContactSection />

      <TestimonySection />

      <NewsBlogsSection />

      <FaqSection />

      {/* Contact CTA Section (Moved from Contact Page) */}
      <section
        className="px-4 py-12 bg-center bg-cover sm:px-6"
        style={{
          backgroundImage: `linear-gradient(135deg, rgba(15, 23, 42, 0.74) 0%, rgba(5, 5, 5, 0.72) 100%), url('/src/assets/images/Hero_image.jpg')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}
      >
        <div className="mx-auto max-w-7xl">
          <div className="p-12 mt-24 text-center">
            <h2 className="mb-4 text-3xl font-bold text-white">Ready to Transform Your <span className="text-cyan-400">Aquaculture?</span></h2>
            <p className="max-w-2xl mx-auto mb-8 text-blue-200">
              Join other aquaculture operators using AquaSense for better yields, lower costs, and sustainable operations.
             </p>
           <Link
         to="/signup"
         className="inline-block px-8 py-4 text-lg font-bold transition border rounded-lg border-cyan-500 text-cyan-500 hover:bg-cyan-500 hover:text-white"
         >
       Get Started Today
    </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <Footer />
    </div>
  );
};

export default LandingPage;

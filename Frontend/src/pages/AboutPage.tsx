import React from 'react';
import Navigation from '../components/Navigation';
import Footer from '../components/Footer';
import aboutPeopleImage from '../assets/images/about/about_people.jpg';
import aboutIotImage from '../assets/images/about/about_iot.jpg';
import aboutSolarImage from '../assets/images/about/about_solar.jpg';
import aboutCrayImage from '../assets/images/about/about_cray.jpg';

const AboutPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <Navigation />

      {/* Hero Section */}
       <section className="relative px-4 py-16 overflow-hidden bg-gradient-to-br from-cyan-50 via-cyan-100 to-sky-100 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-7xl">
          <div className="grid items-center grid-cols-1 gap-12 md:grid-cols-2">
            {/* Left Side - Text */}
            <div>
              <h1 className="mb-6 text-3xl font-bold text-primary sm:text-5xl md:text-6xl">
                About <span className="text-accent">AquaSense</span>
              </h1>
              <p className="text-base text-gray-700 sm:text-lg">
                Revolutionizing Water Quality Monitoring with IoT, Smart Automation, and Sustainable Aquaculture for crayfish farmers worldwide.
              </p>
            </div>

            {/* Right Side - Image */}
            <div className="flex items-center justify-center">
              <div className="w-full overflow-hidden shadow-lg h-96 rounded-2xl">
                <img 
                  src={aboutPeopleImage} 
                  alt="AquaSense Team" 
                  className="object-cover w-full h-full"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <div className="px-4 py-12 mx-auto max-w-7xl sm:px-6">
        {/* System Overview */}
        <section className="mb-20">
          <h2 className="mb-8 text-3xl font-bold text-primary sm:text-4xl">Our Integrated System</h2>
          <p className="mb-6 text-lg leading-relaxed text-gray-700">
           AquaSense is a comprehensive IoT-powered water quality monitoring and management solution designed to support sustainable crayfish farming. It integrates real-time sensor monitoring, intelligent automation, automated feeding, water exchange, aeration, and alert notifications to maintain safe and stable water conditions. The system also uses mortality risk assessment and predictive analytics to identify potential threats early, helping farmers take preventive action, reduce crayfish losses, improve productivity, and make better data-driven farm management decisions.
          </p>
        </section>

        {/* Three Pillars */}
        <section className="grid grid-cols-1 gap-8 mb-20 md:grid-cols-3">
          {/* IoT Component */}
          <div className="h-full card">
            <div className="w-full mb-5 overflow-hidden rounded-xl aspect-[4/3]">
              <img 
                src={aboutIotImage} 
                alt="IoT Monitoring" 
                className="object-cover w-full h-full"
              />
            </div>
            <h3 className="mb-4 text-2xl font-bold text-primary">IoT Monitoring</h3>
            <p className="mb-4 text-gray-700">Real-time sensor data collection and analysis:</p>
            <ul className="space-y-2 text-gray-700">
              <li className="flex items-start gap-2">
                <span className="font-bold text-accent">✓</span>
                <span>Water Temperature Tracking</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-accent">✓</span>
                <span>pH Level Monitoring</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-accent">✓</span>
                <span>Dissolved Oxygen Management</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-accent">✓</span>
                <span>Turbidity & Water Clarity</span>
              </li>
            </ul>
          </div>

          {/* Smart Alerts & Automation Component */}
          <div className="h-full card">
            <div className="w-full mb-5 overflow-hidden rounded-xl aspect-[4/3]">
              <img
                src={aboutSolarImage}
                alt="Smart Alerts and Automation"
                className="object-cover w-full h-full"
              />
            </div>
            <h3 className="mb-4 text-2xl font-bold text-primary">Smart Alerts & Automation</h3>
            <p className="mb-4 text-gray-700">Real-time notifications and intelligent farm control:</p>
            <ul className="space-y-2 text-gray-700">
              <li className="flex items-start gap-2">
                <span className="font-bold text-warning">✓</span>
                <span>Instant SMS & Mobile Alerts</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-warning">✓</span>
                <span>24/7 Automated Monitoring</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-warning">✓</span>
                <span>Automated Feeding & Aeration</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-warning">✓</span>
                <span>Automated Water Exchange</span>
              </li>
            </ul>
          </div>

          {/* Crayfish Aquaculture Component */}
          <div className="h-full card">
            <div className="w-full mb-5 overflow-hidden rounded-xl aspect-[4/3]">
              <img 
                src={aboutCrayImage} 
                alt="Crayfish Optimization" 
                className="object-cover w-full h-full"
              />
            </div>
            <h3 className="mb-4 text-2xl font-bold text-primary">Crayfish Optimization</h3>
            <p className="mb-4 text-gray-700">Specialized for sustainable aquaculture:</p>
            <ul className="space-y-2 text-gray-700">
              <li className="flex items-start gap-2">
                <span className="font-bold text-success">✓</span>
                <span>Optimal Growth Conditions</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-300">✓</span>
                <span>Automated Feeding Systems</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-300">✓</span>
                <span>Disease Prevention</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-300">✓</span>
                <span>Yield Optimization</span>
              </li>
            </ul>
          </div>
        </section>

        {/* Vision & Mission */}
        <section className="grid grid-cols-1 gap-8 mb-16 md:grid-cols-2">
          <div className="p-8 border border-blue-400 bg-primary rounded-xl border-opacity-30">
            <h3 className="mb-4 text-2xl font-bold text-white">Our Vision</h3>
            <p className="text-blue-200">
             To become a trusted smart aquaculture platform that empowers farmers through real-time water-quality monitoring, intelligent automation, and predictive insights to reduce mortality risks, improve productivity, and support sustainable farm operations.
            </p>
          </div>
          <div className="p-8 border border-blue-400 bg-primary rounded-xl border-opacity-30">
            <h3 className="mb-4 text-2xl font-bold text-white">Our Mission</h3>
            <p className="text-blue-200">
              To provide accessible, intelligent water quality monitoring solutions that empower aquaculture operators to maximize yields, reduce costs, and operate sustainably through real-time IoT insights and automated optimization.
            </p>
          </div>
        </section>

        {/* Key Benefits */}
        <section>
          <h2 className="mb-8 text-2xl font-bold text-primary sm:text-3xl">Why AquaSense?</h2>
          <div className="grid grid-cols-1 gap-10 mb-12 md:grid-cols-2">
            <div className="flex gap-4">
              <div className="flex-shrink-0 text-3xl">💰</div>
              <div>
                <h4 className="mb-2 text-lg font-bold text-primary">Cost Effective</h4>
                <p className="text-slate-900">Automated feeding, aeration, and water exchange reduce manual labor and operational expenses significantly.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-shrink-0 text-3xl">📈</div>
              <div>
                <h4 className="mb-2 text-lg font-bold text-primary">Increased Yields</h4>
                <p className="text-slate-900">Optimize water conditions for maximum crayfish growth and health through continuous monitoring.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-shrink-0 text-3xl">🌱</div>
              <div>
                <h4 className="mb-2 text-lg font-bold text-primary">Sustainable</h4>
                <p className="text-slate-900">Automated water management and predictive analytics minimize waste and support environmentally responsible aquaculture.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-shrink-0 text-3xl">⚡</div>
              <div>
                <h4 className="mb-2 text-lg font-bold text-primary">Automated Management</h4>
                <p className="text-slate-900">Reduce manual labor with intelligent automation for feeding and alerts.</p>
              </div>
            </div>
          </div>

          {/* Project Impact */}
          <div className="p-8 border bg-gradient-to-r from-slate-800 to-blue-900 rounded-xl border-cyan-400 border-opacity-30">
            <h3 className="mb-6 text-2xl font-bold text-cyan-300">Project Impact</h3>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div>
                <h4 className="mb-3 font-bold text-green-300">For Aquaculture Farmers</h4>
                <ul className="space-y-2 text-blue-200">
                  <li>✓ 24/7 monitoring without manual labor</li>
                  <li>✓ Immediate alerts for critical issues</li>
                  <li>✓ Historical data for yield optimization</li>
                  <li>✓ Remote management from mobile devices</li>
                  <li>✓ Reduced operating costs</li>
                </ul>
              </div>
              <div>
                <h4 className="mb-3 font-bold text-green-300">For Sustainability</h4>
                <ul className="space-y-2 text-blue-200">
                  <li>✓ Reduced water waste through automated exchange</li>
                  <li>✓ Predictive risk detection for early intervention</li>
                  <li>✓ Water quality preservation</li>
                  <li>✓ Ecosystem-friendly automation</li>
                  <li>✓ Scalable sustainable solution</li>
                </ul>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Footer */}
      <Footer />
    </div>
  );
};

export default AboutPage;

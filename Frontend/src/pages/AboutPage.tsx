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
              <h1 className="mb-6 text-4xl font-bold sm:text-5xl md:text-6xl text-primary">
                About <span className="text-accent">AquaSense</span>
              </h1>
              <p className="text-base text-gray-700 sm:text-lg">
                Revolutionizing Water Quality Monitoring with IoT, Solar Power, and Sustainable Aquaculture for crayfish farmers worldwide.
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
          <h2 className="mb-8 text-4xl font-bold text-primary">Our Integrated System</h2>
          <p className="mb-6 text-lg leading-relaxed text-gray-700">
           AquaSense is a comprehensive IoT-powered water quality monitoring solution designed to enhance sustainable aquaculture operations. Our system integrates advanced sensor technology, renewable energy, and intelligent automation to create a smart ecosystem that is both environmentally responsible and highly efficient. By enabling real-time monitoring and data-driven insights, AquaSense empowers users to optimize water conditions, improve productivity, and ensure healthier aquatic environments.
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

          {/* Solar Power Component */}
          <div className="h-full card">
            <div className="w-full mb-5 overflow-hidden rounded-xl aspect-[4/3]">
              <img 
                src={aboutSolarImage} 
                alt="Solar Powered" 
                className="object-cover w-full h-full"
              />
            </div>
            <h3 className="mb-4 text-2xl font-bold text-primary">Solar Powered</h3>
            <p className="mb-4 text-gray-700">Sustainable renewable energy integration:</p>
            <ul className="space-y-2 text-gray-700">
              <li className="flex items-start gap-2">
                <span className="font-bold text-warning">✓</span>
                <span>Zero Operating Costs</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-warning">✓</span>
                <span>24/7 Operation Capability</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-warning">✓</span>
                <span>Battery Backup System</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-warning">✓</span>
                <span>Environmentally Friendly</span>
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
              To revolutionize aquaculture through intelligent IoT systems powered by renewable energy, enabling sustainable food production while preserving water quality and environmental integrity for future generations.
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
          <h2 className="mb-8 text-3xl font-bold text-primary">Why AquaSense?</h2>
          <div className="grid grid-cols-1 gap-10 mb-12 md:grid-cols-2">
            <div className="flex gap-4">
              <div className="flex-shrink-0 text-3xl">💰</div>
              <div>
                <h4 className="mb-2 text-lg font-bold text-primary">Cost Effective</h4>
                <p className="text-slate-900">Solar-powered operation eliminates energy costs and reduces operational expenses significantly.</p>
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
                <p className="text-slate-900">Renewable energy and eco-friendly operations ensure environmental responsibility.</p>
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
                  <li>✓ Zero carbon footprint operations</li>
                  <li>✓ Solar energy independence</li>
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

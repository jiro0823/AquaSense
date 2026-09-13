import React from 'react';
import Navigation from '../components/Navigation';
import Footer from '../components/Footer';

const HowItWorksPage: React.FC = () => {
  const coreSteps = [
    {
      icon: '📡',
      title: 'Sensors Check Your Pond',
      text: 'Temperature, pH, dissolved oxygen, and turbidity are tracked continuously in the water.',
    },
    {
      icon: '🧠',
      title: 'AquaSense Analyzes Conditions',
      text: 'The system compares your readings with healthy ranges and detects issues early.',
    },
    {
      icon: '⚙️',
      title: 'Automation Responds Fast',
      text: 'Aeration and feeding can trigger automatically based on actual pond conditions.',
    },
    {
      icon: '📊',
      title: 'You Monitor from Dashboard',
      text: 'Get real-time status, trend charts, and alerts on desktop or mobile any time.',
    },
  ];

  const dailyFlow = [
    {
      time: 'Morning',
      detail: 'Check dashboard health status and overnight trends in under a minute.',
    },
    {
      time: 'Midday',
      detail: 'System manages feeding schedules and keeps water parameters within target levels.',
    },
    {
      time: 'Afternoon',
      detail: 'Alerts notify you if any metric starts drifting so you can act before risk grows.',
    },
    {
      time: 'Night',
      detail: 'Solar + battery setup keeps monitoring active while automation protects the pond.',
    },
  ];

  const highlights = [
    {
      title: 'Less Manual Work',
      text: 'Spend less time on repetitive checks and more time on farm decisions.',
      icon: '⏱️',
    },
    {
      title: 'Faster Response',
      text: 'Catch oxygen and pH issues early with real-time alerts and auto-actions.',
      icon: '⚡',
    },
    {
      title: 'Clear Decisions',
      text: 'Use historical data and live trends to improve consistency and yield.',
      icon: '📈',
    },
  ];

  return (
    <div className="min-h-screen bg-white">
      <Navigation />

      <section className="relative px-4 py-16 overflow-hidden bg-gradient-to-br from-cyan-50 via-cyan-100 to-sky-100 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-7xl">
          <h1 className="max-w-4xl mb-6 text-3xl font-bold text-cyan-500 sm:text-5xl md:text-6xl">
            <span className="block mt-2 text-primary">Smart Monitoring</span> Made Simple for Everyday Farm Use
          </h1>
          <p className="max-w-3xl text-base text-slate-600 sm:text-lg">
            AquaSense combines sensors, automation, and live dashboards into one clear workflow so you can protect water quality without guesswork.
          </p>
        </div>
      </section>

      <div className="px-4 py-20 mx-auto max-w-7xl sm:px-6">
        <section className="mb-20">
          <div className="flex flex-col gap-2 mb-8 sm:flex-row sm:items-end sm:justify-between">
            <h2 className="text-3xl font-bold text-primary sm:text-4xl">Aqua Sense in 4 Easy Steps</h2>
            <span className="text-sm font-medium text-primary sm:block">Simple workflow</span>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
            {coreSteps.map((step, index) => (
              <article key={step.title} className="p-6 transition bg-white border border-slate-200 rounded-2xl hover:border-primary hover:shadow-lg">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-3xl">{step.icon}</span>
                  <span className="text-sm font-semibold text-primary">Step {index + 1}</span>
                </div>
                <h3 className="mb-2 text-xl font-bold text-primary">{step.title}</h3>
                <p className="text-slate-600">{step.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="grid grid-cols-1 gap-8 mb-20 md:grid-cols-2">
          <div className="p-8 border rounded-2xl bg-cyan-200 border-slate-200">
            <h3 className="mb-4 text-2xl font-bold text-primary">What You See in Daily Use</h3>
            <ul className="space-y-4 text-primary">
              <li className="flex gap-3"><span className="font-bold text-primary">•</span> Live parameter values with easy-to-read status colors.</li>
              <li className="flex gap-3"><span className="font-bold text-primary">•</span> Alerts when water conditions move outside healthy limits.</li>
              <li className="flex gap-3"><span className="font-bold text-primary">•</span> Quick access to trends so you can plan confidently.</li>
              <li className="flex gap-3"><span className="font-bold text-primary">•</span> Automatic actions for better consistency even when you are away.</li>
            </ul>
          </div>
          <div className="p-8 text-white border rounded-2xl bg-primary border-primary/30">
            <h3 className="mb-4 text-2xl font-bold text-white">Why It Feels Easier</h3>
            <p className="mb-5 text-cyan-100">
              AquaSense removes the complexity of technical monitoring and turns it into clear decisions you can make fast.
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="p-4 rounded-xl bg-white/10">Real-time visibility</div>
              <div className="p-4 rounded-xl bg-white/10">Automated support</div>
              <div className="p-4 rounded-xl bg-white/10">Mobile-ready access</div>
              <div className="p-4 rounded-xl bg-white/10">Data-backed decisions</div>
            </div>
          </div>
        </section>

        <section className="mb-20">
          <h2 className="mb-8 text-3xl font-bold text-center text-cyan-500 sm:text-4xl md:text-5xl">A Day With <span className="text-primary">AquaSense</span></h2>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
            {dailyFlow.map((item) => (
              <article key={item.time} className="p-6 border rounded-2xl bg-slate-50 border-slate-200">
                <p className="mb-2 text-sm font-semibold text-primary">{item.time}</p>
                <p className="text-slate-700">{item.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-8 text-3xl font-bold text-primary sm:text-4xl md:text-5xl">Why Farmers Prefer This Setup</h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {highlights.map((item) => (
              <article key={item.title} className="transition border bg-slate-50 p-7 rounded-2xl border-slate-200 hover:border-primary hover:shadow-md"
>
                <div className="mb-3 text-3xl">{item.icon}</div>
                <h3 className="mb-2 text-xl font-bold text-cyan-500">{item.title}</h3>
                <p className="text-slate-600">{item.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="p-8 mt-16 text-center border rounded-2xl bg-gradient-to-r from-slate-100 to-cyan-100 border-slate-200">
          <h3 className="mb-3 text-2xl font-bold text-primary">Ready to See It in Action?</h3>
          <p className="max-w-2xl mx-auto mb-6 text-slate-600">
            Explore the dashboard experience and see how real-time monitoring can make your farm safer, more stable, and easier to manage.
          </p>
          <a
  href="/dashboard"
  className="inline-flex items-center justify-center w-full px-6 py-3 font-bold transition border rounded-lg border-primary text-primary hover:bg-primary hover:text-white sm:w-auto"
>
  Open Dashboard
</a>
        </section>
      </div>

      <Footer />
    </div>
  );
};

export default HowItWorksPage;

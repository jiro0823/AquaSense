import React, { useState } from 'react';

interface FAQItem {
  q: string;
  a: string;
}

const faqs: FAQItem[] = [
  {
    q: 'How do I get started with AquaSense?',
    a: 'Simply sign up for an account, and follow our setup guide to connect your IoT hardware. Our support team is available 24/7 to assist.'
  },
  {
    q: 'Is technical support included?',
    a: 'Yes! All plans include email and chat support. Premium plans include phone support and priority response times.'
  },
  {
    q: 'Can I customize the monitoring parameters?',
    a: 'Absolutely. You can set custom thresholds for temperature, pH, oxygen levels, and turbidity based on your needs.'
  },
  {
    q: 'How reliable is the solar power system?',
    a: 'Our system includes battery backup for 24/7 operation even on cloudy days. The battery capacity is designed for continuous monitoring.'
  },
  {
    q: 'What is your data privacy policy?',
    a: 'We take data security seriously. All data is encrypted, and we comply with international data protection regulations.'
  },
  {
    q: 'Do you offer training for new users?',
    a: 'Yes, we provide comprehensive onboarding, tutorial videos, and documentation. Contact our support team for personalized training.'
  }
];

const FaqSection: React.FC = () => {
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  return (
    <section id="faq" className="py-16 bg-slate-50 sm:py-24">
      <div className="px-6 mx-auto max-w-7xl">
         <p className="text-sm font-medium text-primary">FAQ <span className="text-cyan-300">&rarr;</span></p>  
        <h2 className="mb-12 text-3xl font-bold text-primary">Frequently Asked Questions</h2>
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2 lg:max-w-3xl">
            {faqs.map((faq, idx) => {
              const isOpen = openFaqIndex === idx;

              return (
                <div
                  key={idx}
                  className={`border rounded-lg transition-colors duration-300 ${isOpen ? 'bg-primary border-primary' : 'bg-white border-slate-200'}`}
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                    className="flex items-center justify-between w-full gap-4 px-6 py-5 text-left"
                  >
                    <span className={`font-bold transition-colors duration-300 ${isOpen ? 'text-white' : 'text-primary'}`}>
                      {faq.q}
                    </span>
                    <span className={`transition-transform duration-300 ${isOpen ? 'rotate-180 text-cyan-300' : 'text-primary'}`}>
                      &darr;
                    </span>
                  </button>

                  <div
                    className={`overflow-hidden transition-all duration-300 ${isOpen ? 'max-h-48 opacity-100' : 'max-h-0 opacity-0'}`}
                  >
                    <p className={`px-6 pb-5 transition-colors duration-300 ${isOpen ? 'text-white/90' : 'text-slate-600'}`}>
                      {faq.a}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="space-y-4 lg:col-span-1">
            <div className="p-6 rounded-2xl bg-primary">
              <div className="flex items-center justify-center w-10 h-10 mb-4 rounded-full bg-white/15">
                <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white" aria-hidden="true">
                  <path d="M20 4H4a2 2 0 0 0-2 2v14l4-3h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" />
                </svg>
              </div>
              <h3 className="mb-2 text-lg font-bold text-white">You have different questions?</h3>
              <p className="mb-4 text-sm text-cyan-100">
                Our support team can guide you with setup, account concerns, and feature questions.
              </p>
              <button
                type="button"
                className="px-4 py-2 text-xs font-semibold transition bg-white rounded-full text-primary hover:bg-cyan-100"
              >
                Contact us
              </button>
            </div>

            <div className="p-5 bg-white border rounded-2xl border-slate-200">
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center flex-shrink-0 w-10 h-10 rounded-full bg-cyan-100">
                  <svg viewBox="0 0 24 24" className="w-5 h-5 fill-cyan-500" aria-hidden="true">
                    <path d="M6.6 10.8a15.5 15.5 0 0 0 6.6 6.6l2.2-2.2c.3-.3.7-.4 1.1-.3 1.2.4 2.5.6 3.8.6.6 0 1 .4 1 1V21c0 .6-.4 1-1 1C10.5 22 2 13.5 2 3c0-.6.4-1 1-1h4.5c.6 0 1 .4 1 1 0 1.3.2 2.6.6 3.8.1.4 0 .8-.3 1.1l-2.2 2.2z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-bold text-primary">+1 (555) 123-4567</p>
                  <p className="mt-1 text-xs text-slate-600">Mon-Fri support for urgent and technical concerns.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default FaqSection;

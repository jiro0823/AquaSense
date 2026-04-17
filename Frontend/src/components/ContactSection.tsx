import React, { useState } from 'react';

interface ContactFormData {
  name: string;
  email: string;
  subject: string;
  message: string;
}

const ContactSection: React.FC = () => {
  const [formData, setFormData] = useState<ContactFormData>({
    name: '',
    email: '',
    subject: '',
    message: ''
  });
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitStatus('loading');

    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      setSubmitStatus('success');
      setFormData({ name: '', email: '', subject: '', message: '' });
      setTimeout(() => setSubmitStatus('idle'), 5000);
    } catch (_error) {
      setSubmitStatus('error');
      setTimeout(() => setSubmitStatus('idle'), 5000);
    }
  };

  return (
    <section id="contact" className="px-6 py-20 bg-gradient-to-b from-slate-50 via-sky-50 to-slate-100">
      <div className="mx-auto max-w-7xl">
        <p className="mb-2 text-sm font-medium text-center text-primary">
          Contact Us <span className="text-cyan-300">&rarr;</span>
        </p>
        <h2 className="mb-10 text-3xl font-bold text-center text-primary md:text-4xl">
          Ready to Transform Your Aquaculture?
          <span className="block text-cyan-300">Let's Go!</span>
        </h2>

        <div className="grid grid-cols-1 gap-12 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div>
                  <label htmlFor="name" className="block mb-2 text-sm font-medium text-primary">Full Name</label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    placeholder="Your name"
                    className="w-full px-4 py-3 transition bg-white border rounded-lg text-slate-900 placeholder-slate-400 border-slate-300 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label htmlFor="email" className="block mb-2 text-sm font-medium text-primary">Email Address</label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    placeholder="your@email.com"
                    className="w-full px-4 py-3 transition bg-white border rounded-lg text-slate-900 placeholder-slate-400 border-slate-300 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="subject" className="block mb-2 text-sm font-medium text-primary">Subject</label>
                <select
                  id="subject"
                  name="subject"
                  value={formData.subject}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 transition bg-white border rounded-lg text-slate-900 border-slate-300 focus:outline-none focus:border-blue-500"
                >
                  <option value="">Select a subject...</option>
                  <option value="general">General Inquiry</option>
                  <option value="support">Technical Support</option>
                  <option value="sales">Sales & Pricing</option>
                  <option value="partnership">Partnership Opportunities</option>
                  <option value="feedback">Feedback & Suggestions</option>
                </select>
              </div>

              <div>
                <label htmlFor="message" className="block mb-2 text-sm font-medium text-primary">Message</label>
                <textarea
                  id="message"
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  required
                  rows={6}
                  placeholder="Tell us how we can help..."
                  className="w-full px-4 py-3 transition bg-white border rounded-lg resize-none text-slate-900 placeholder-slate-400 border-slate-300 focus:outline-none focus:border-blue-500"
                />
              </div>

              {submitStatus === 'success' && (
                <div className="p-4 bg-green-500 border border-green-400 rounded-lg bg-opacity-20">
                  <p className="font-semibold text-green-300">✓ Message sent successfully!</p>
                  <p className="text-sm text-green-200">We'll get back to you soon.</p>
                </div>
              )}

              {submitStatus === 'error' && (
                <div className="p-4 bg-red-500 border border-red-400 rounded-lg bg-opacity-20">
                  <p className="font-semibold text-red-300">✗ Error sending message</p>
                  <p className="text-sm text-red-200">Please try again or contact us directly.</p>
                </div>
              )}

              <button
                type="submit"
                disabled={submitStatus === 'loading'}
                className="w-full px-6 py-3 font-bold text-white transition rounded-lg bg-primary hover:brightness-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitStatus === 'loading' ? 'Sending...' : 'Send Message'}
              </button>
            </form>
          </div>

          <div className="space-y-8">
            <div className="p-8 rounded-2xl bg-primary">
              <div className="space-y-6">
                <div>
                  <h3 className="mb-1 font-bold text-white">Email</h3>
                  <p className="text-blue-200">support@aquasense.io</p>
                  <p className="text-sm text-blue-300">We'll respond within 24 hours</p>
                </div>
                <div>
                  <h3 className="mb-1 font-bold text-white">Contact</h3>
                  <p className="text-blue-200">+1 (555) 123-4567</p>
                  <p className="text-sm text-blue-300">Mon-Fri, 9:00 AM - 5:00 PM</p>
                </div>
                <div>
                  <h3 className="mb-1 font-bold text-white">Address</h3>
                  <p className="text-blue-200">Tech Innovation Hub</p>
                  <p className="text-sm text-blue-300">Aquaculture District, City</p>
                </div>
                <div>
                  <h3 className="mb-1 font-bold text-white">Response Time</h3>
                  <p className="text-blue-200">Priority Support</p>
                  <p className="text-sm text-blue-300">Critical issues: 1 hour</p>
                </div>
              </div>

              <div className="p-6 mt-8 border border-blue-400 rounded-xl border-opacity-30 bg-slate-800 bg-opacity-40">
                <h3 className="mb-4 font-bold text-cyan-300">Social Links</h3>
                <div className="flex flex-wrap items-center gap-3">
                  <a href="https://facebook.com" target="_blank" rel="noreferrer" aria-label="Facebook" className="flex items-center justify-center w-10 h-10 transition rounded-full bg-cyan-300 hover:bg-cyan-200">
                    <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white" aria-hidden="true"><path d="M13.5 21v-7h2.4l.4-3h-2.8V9.1c0-.9.3-1.6 1.6-1.6H16V4.8c-.2 0-.9-.1-1.8-.1-1.8 0-3 .9-3 3.3V11H9v3h2.4v7h2.1z" /></svg>
                  </a>
                  <a href="https://instagram.com" target="_blank" rel="noreferrer" aria-label="Instagram" className="flex items-center justify-center w-10 h-10 transition rounded-full bg-cyan-300 hover:bg-cyan-200">
                    <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white" aria-hidden="true"><path d="M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0 8.2A3.2 3.2 0 1 1 12 8.8a3.2 3.2 0 0 1 0 6.4zM18 6.8a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4z" /><path d="M12 2.8c2.9 0 3.2 0 4.3.1 1 .1 1.6.2 2 .4.5.2.9.4 1.3.9.4.4.7.8.9 1.3.2.4.3 1 .4 2 .1 1.1.1 1.4.1 4.3s0 3.2-.1 4.3c-.1 1-.2 1.6-.4 2-.2.5-.4.9-.9 1.3-.4.4-.8.7-1.3.9-.4.2-1 .3-2 .4-1.1.1-1.4.1-4.3.1s-3.2 0-4.3-.1c-1-.1-1.6-.2-2-.4a3.7 3.7 0 0 1-2.2-2.2c-.2-.4-.3-1-.4-2-.1-1.1-.1-1.4-.1-4.3s0-3.2.1-4.3c.1-1 .2-1.6.4-2 .2-.5.4-.9.9-1.3.4-.4.8-.7 1.3-.9.4-.2 1-.3 2-.4 1.1-.1 1.4-.1 4.3-.1zm0-1.8c-3 0-3.4 0-4.5.1-1.1.1-1.9.2-2.6.5-.8.3-1.4.7-2 1.3-.6.6-1 1.2-1.3 2-.3.7-.4 1.5-.5 2.6C1 8.6 1 9 1 12s0 3.4.1 4.5c.1 1.1.2 1.9.5 2.6.3.8.7 1.4 1.3 2 .6.6 1.2 1 2 1.3.7.3 1.5.4 2.6.5 1.1.1 1.5.1 4.5.1s3.4 0 4.5-.1c1.1-.1 1.9-.2 2.6-.5.8-.3 1.4-.7 2-1.3.6-.6 1-1.2 1.3-2 .3-.7.4-1.5.5-2.6.1-1.1.1-1.5.1-4.5s0-3.4-.1-4.5c-.1-1.1-.2-1.9-.5-2.6a5.5 5.5 0 0 0-3.3-3.3c-.7-.3-1.5-.4-2.6-.5C15.4 1 15 1 12 1z" /></svg>
                  </a>
                  <a href="https://x.com" target="_blank" rel="noreferrer" aria-label="X" className="flex items-center justify-center w-10 h-10 transition rounded-full bg-cyan-300 hover:bg-cyan-200">
                    <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white" aria-hidden="true"><path d="M18.9 3H22l-6.8 7.7L23 21h-6.2l-4.9-6.4L6.3 21H3.2l7.2-8.2L1 3h6.3l4.4 5.8L18.9 3zm-1.1 16h1.7L6.4 4.9H4.6L17.8 19z" /></svg>
                  </a>
                  <a href="https://linkedin.com" target="_blank" rel="noreferrer" aria-label="LinkedIn" className="flex items-center justify-center w-10 h-10 transition rounded-full bg-cyan-300 hover:bg-cyan-200">
                    <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white" aria-hidden="true"><path d="M6.9 8.5a1.9 1.9 0 1 1 0-3.8 1.9 1.9 0 0 1 0 3.8zM5.2 9.8h3.4V20H5.2V9.8zm5.4 0h3.2v1.4h.1c.5-.9 1.6-1.8 3.4-1.8 3.6 0 4.3 2.2 4.3 5.1V20h-3.4v-4.8c0-1.1 0-2.6-1.7-2.6s-2 1.2-2 2.5V20h-3.4V9.8z" /></svg>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ContactSection;

import React from 'react';
import { Link } from 'react-router-dom';

const Footer: React.FC = () => {
  return (
    <footer className="text-gray-400 bg-slate-900">
      <div className="px-6 py-12 mx-auto max-w-7xl">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
          {/* Logo Section */}
          <div className="md:col-span-1">
            <h3 className="mb-3 text-lg font-bold text-white">🌊 AquaSense</h3>
            <p className="text-sm text-gray-500">
              Intelligent Crayfish Farm Management
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="mb-4 font-bold text-white">Product</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/dashboard" className="transition hover:text-cyan-400">
                  Dashboard
                </Link>
              </li>
              <li>
                <Link to="/features" className="transition hover:text-cyan-400">
                  Features
                </Link>
              </li>
              <li>
                <Link to="/how-it-works" className="transition hover:text-cyan-400">
                  How It Works
                </Link>
              </li>
            </ul>
          </div>

          {/* Company Links */}
          <div>
            <h4 className="mb-4 font-bold text-white">Company</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/about" className="transition hover:text-cyan-400">
                  About
                </Link>
              </li>
              <li>
                <Link to="/contact" className="transition hover:text-cyan-400">
                  Contact
                </Link>
              </li>
              <li>
                <Link to="/" className="transition hover:text-cyan-400">
                  Blog
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h4 className="mb-4 font-bold text-white">Contact</h4>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <span>📧</span>
                <a href="mailto:support@aquasense.com" className="transition hover:text-cyan-400">
                  support@aquasense.com
                </a>
              </li>
              <li className="flex items-center gap-2">
                <span>📱</span>
                <a href="tel:+1234567890" className="transition hover:text-cyan-400">
                  +1 (234) 567-890
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 mt-12 text-sm text-center text-gray-600 border-t border-slate-800">
          <p>
            © 2026 AquaSense. All rights reserved. • Built for sustainable aquaculture
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

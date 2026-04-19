import React from 'react';
import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import aquaSenseLogo from '../assets/images/AquaSense_logo.png';

const Navigation: React.FC = () => {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const isActive = (path: string) => location.pathname === path;
  
  const linkClasses = (path: string) => 
    `nav-link ${isActive(path) ? 'active' : ''}`;

  const closeMenu = () => setIsMobileMenuOpen(false);

  return (
    <nav className="sticky top-0 z-40 border-b shadow-sm border-slate-200/70 bg-white/95 backdrop-blur header">
      <div className="px-4 mx-auto max-w-7xl sm:px-6">
        <div className="flex items-center justify-between h-16 lg:h-20">
          {/* Logo Section */}
          <Link to="/" className="flex items-center flex-shrink-0 gap-2 transition sm:gap-3 hover:opacity-80" onClick={closeMenu}>
            <img 
              src={aquaSenseLogo} 
              alt="AquaSense Logo" 
              className="rounded-lg shadow-sm w-11 h-11 sm:w-14 sm:h-14 lg:w-16 lg:h-16" 
            />
            <div>
              <h1 className="text-lg font-bold sm:text-xl lg:text-2xl text-primary">
                AquaSense
              </h1>
              <p className="hidden text-xs text-gray-600 sm:block">Water Quality Monitoring</p>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <div className="items-center hidden gap-6 ml-10 lg:flex xl:gap-8">
            <Link to="/" className={linkClasses('/')}>
              Home
            </Link>
            <Link to="/about" className={linkClasses('/about')}>
              About
            </Link>
            <Link to="/features" className={linkClasses('/features')}>
              Features
            </Link>
            <Link to="/how-it-works" className={linkClasses('/how-it-works')}>
              How It Works
            </Link>
          </div>

          {/* Desktop Auth Buttons */}
          <div className="items-center flex-shrink-0 hidden gap-4 ml-auto lg:flex">
            <Link
              to="/login"
              className="px-4 py-2 font-medium transition text-primary hover:text-accent"
            >
              Sign In
            </Link>
            <Link
              to="/signup"
              className="btn btn-primary"
            >
              Get Started
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            type="button"
            aria-label="Toggle navigation menu"
            aria-expanded={isMobileMenuOpen}
            onClick={() => setIsMobileMenuOpen((prev) => !prev)}
            className="inline-flex items-center justify-center p-2 transition rounded-lg lg:hidden text-primary hover:bg-blue-50"
          >
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              {isMobileMenuOpen ? (
                <path d="M18 6 6 18M6 6l12 12" />
              ) : (
                <path d="M3 6h18M3 12h18M3 18h18" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile Menu Panel */}
        {isMobileMenuOpen && (
          <div className="pb-4 space-y-2 border-t lg:hidden border-slate-200">
            <Link to="/" onClick={closeMenu} className="block px-3 py-2 mt-3 rounded-lg text-primary hover:bg-blue-50">Home</Link>
            <Link to="/about" onClick={closeMenu} className="block px-3 py-2 rounded-lg text-primary hover:bg-blue-50">About</Link>
            <Link to="/features" onClick={closeMenu} className="block px-3 py-2 rounded-lg text-primary hover:bg-blue-50">Features</Link>
            <Link to="/how-it-works" onClick={closeMenu} className="block px-3 py-2 rounded-lg text-primary hover:bg-blue-50">How It Works</Link>
            <div className="grid grid-cols-2 gap-2 pt-2">
              <Link to="/login" onClick={closeMenu} className="text-center btn btn-secondary">Sign In</Link>
              <Link to="/signup" onClick={closeMenu} className="text-center btn btn-primary">Get Started</Link>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navigation;

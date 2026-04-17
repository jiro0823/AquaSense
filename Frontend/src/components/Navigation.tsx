import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import aquaSenseLogo from '../assets/images/AquaSense_logo.png';

const Navigation: React.FC = () => {
  const location = useLocation();
  
  const isActive = (path: string) => location.pathname === path;
  
  const linkClasses = (path: string) => 
    `nav-link ${isActive(path) ? 'active' : ''}`;

  return (
    <nav className="shadow-sm header">
      <div className="px-6 mx-auto max-w-7xl">
        <div className="flex items-center justify-between h-20">
          {/* Logo Section */}
          <Link to="/" className="flex items-center flex-shrink-0 gap-3 transition hover:opacity-80">
            <img 
              src={aquaSenseLogo} 
              alt="AquaSense Logo" 
              className="w-16 h-16 rounded-lg shadow-sm" 
            />
            <div>
              <h1 className="text-2xl font-bold text-primary">
                AquaSense
              </h1>
              <p className="text-xs text-gray-600">Water Quality Monitoring</p>
            </div>
          </Link>

          {/* Navigation Links */}
          <div className="flex items-center gap-8 ml-12">
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

          {/* Auth Buttons */}
          <div className="flex items-center flex-shrink-0 gap-4 ml-auto">
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
        </div>
      </div>
    </nav>
  );
};

export default Navigation;

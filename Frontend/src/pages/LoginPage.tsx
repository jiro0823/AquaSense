import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import loginBackgroundImage from '../assets/images/login/login_bg01.jpg';

const LoginPage: React.FC<{ setIsAuthenticated?: (value: boolean) => void }> = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const apiBase = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env
    ?.VITE_API_URL || 'http://localhost:5000/api/v1';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${apiBase.replace(/\/+$/, '')}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        const token = data.data.token;
        const user = data.data.user;
        
        localStorage.setItem('authToken', token);
        localStorage.setItem('user', JSON.stringify(user));
        
        console.log('[LoginPage] Token stored:', token.substring(0, 20) + '...');
        console.log('[LoginPage] User stored:', user);
        
        setTimeout(() => {
          console.log('[LoginPage] Navigating to dashboard');
          navigate('/dashboard', { replace: true });
        }, 100);
      } else {
        setError(data.message || 'Login failed');
      }
    } catch (err) {
      setError(`Failed to connect to backend. Make sure it is running at ${apiBase}.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="flex items-center justify-center min-h-screen p-4 py-16 bg-center bg-cover sm:py-10"
      style={{
        backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.35), rgba(0, 0, 0, 0.35)), url(${loginBackgroundImage})`,
        backgroundPosition: 'center',
        backgroundSize: 'cover',
        backgroundRepeat: 'no-repeat',
      }}
    >
      {/* Home Button */}
      <button
        onClick={() => navigate('/')}
        className="absolute flex items-center gap-2 text-white transition left-4 top-4 sm:top-6 sm:left-6 hover:text-accent hover:translate-x-1"
        aria-label="Go to home"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        <span className="text-sm font-medium">Home</span>
      </button>

      <div className="flex w-full max-w-5xl overflow-hidden bg-white border border-gray-200 shadow-lg rounded-xl">
        
        {/* Left Side - Branding */}
        <div className="relative flex-col justify-between hidden p-8 overflow-hidden text-white lg:flex lg:w-5/12 xl:p-10 bg-gradient-to-br from-primary via-blue-700 to-blue-800">
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-40 h-40 -mt-20 -mr-20 rounded-full bg-accent opacity-20"></div>
          <div className="absolute bottom-0 left-0 w-32 h-32 -ml-16 rounded-full bg-accent opacity-10 -mb-14"></div>
          
          <div className="relative z-10 space-y-6">
            <div>
              <h2 className="mb-4 text-4xl font-bold leading-tight xl:text-5xl text-cyan-300">
                Monitor Your Crayfish Farm
              </h2>
              <p className="text-lg leading-relaxed text-blue-100">
                Real-time water quality monitoring with automated alerts and control systems. Optimize your aquaculture operations with intelligent insights.
              </p>
            </div>

            <div className="pt-6 space-y-4 border-t border-white border-opacity-20">
              <div className="flex items-start gap-3">
                <span className="text-2xl">📊</span>
                <div>
                  <p className="font-semibold">Real-Time Monitoring</p>
                  <p className="text-sm text-blue-100">Track temperature, pH, oxygen, and turbidity instantly</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-2xl">🚨</span>
                <div>
                  <p className="font-semibold">Smart Alerts</p>
                  <p className="text-sm text-blue-100">Get notified of critical changes before they affect your farm</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-2xl">⚙️</span>
                <div>
                  <p className="font-semibold">Automated Control</p>
                  <p className="text-sm text-blue-100">Integrated feeding and water management systems</p>
                </div>
              </div>
            </div>
          </div>

          <p className="relative z-10 text-sm text-blue-100">🌊 AquaSense • Intelligent Farm Management</p>
        </div>

        {/* Right Side - Form */}
        <div className="flex flex-col justify-center w-full p-6 sm:p-8 lg:w-7/12 lg:p-10">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 mb-8">
            <div className="text-3xl">🌊</div>
            <div>
              <h1 className="text-2xl font-bold text-primary">AquaSense</h1>
              <p className="text-xs text-gray-600">Water Quality System</p>
            </div>
          </Link>

          {/* Header */}
          <h2 className="mb-2 text-3xl font-bold text-gray-900">Welcome Back</h2>
          <p className="mb-6 text-gray-600">Sign in to your account to access your farm dashboard</p>

          {/* Error Alert */}
          {error && (
            <div className="mb-6 alert alert-danger">
              <span>⚠️</span>
              <div>
                <p className="font-semibold">Login Error</p>
                <p className="text-sm">{error}</p>
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block mb-2 text-sm font-semibold text-gray-900">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="input-field"
                placeholder="your@email.com"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block mb-2 text-sm font-semibold text-gray-900">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="pr-10 input-field"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute text-gray-600 transition -translate-y-1/2 right-3 top-1/2 hover:text-primary"
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-4.803m5.596-3.856a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Forgot Password */}
            <Link to="#" className="block mt-1 text-sm font-medium text-accent hover:text-primary">
              Forgot Password?
            </Link>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-6 btn btn-primary"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-gray-200"></div>
            <span className="text-sm text-gray-600">New to AquaSense?</span>
            <div className="flex-1 h-px bg-gray-200"></div>
          </div>

          {/* Sign Up Link */}
          <Link
            to="/signup"
            className="w-full btn btn-secondary"
          >
            Create Account
          </Link>

          {/* Terms */}
          <p className="mt-6 text-xs text-center text-gray-600">
            By signing in, you agree to our <Link to="#" className="font-medium text-accent hover:text-primary">Terms of Service</Link> and <Link to="#" className="font-medium text-accent hover:text-primary">Privacy Policy</Link>
          </p>
        </div>

      </div>
    </div>
  );
};

export default LoginPage;

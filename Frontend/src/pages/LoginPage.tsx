import React, { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { apiClient, getApiErrorMessage } from '../services/apiClient';

const LoginPage: React.FC<{ setIsAuthenticated?: (value: boolean) => void }> = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const transition = (location.state as { transition?: string } | null)?.transition;
  const isFromSignup = transition === 'to-login';
  const panelAnimation = isFromSignup ? 'auth-panel-in-from-right' : 'auth-panel-in-from-left';
  const formAnimation = isFromSignup ? 'auth-form-in-from-left' : 'auth-form-in-from-right';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.post<{ user: unknown }>('/auth/login', { email, password });
      if (response.success) {
        const user = response.data.user;
        localStorage.setItem('user', JSON.stringify(user));

        setTimeout(() => {
          navigate('/dashboard', { replace: true });
        }, 100);
      } else {
        setError(response.message || 'Login failed');
      }
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to sign in. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="relative flex items-center justify-center min-h-screen px-4 py-12 bg-gradient-to-br from-slate-50 via-cyan-50 to-blue-100 sm:py-16"
    >
      {/* Home Button */}
      <button
        onClick={() => navigate('/')}
        className="absolute flex items-center gap-2 transition text-primary left-4 top-4 sm:top-6 sm:left-6 hover:text-accent hover:translate-x-1"
        aria-label="Go to home"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        <span className="text-sm font-medium">Home</span>
      </button>

      <div className="relative w-full max-w-5xl overflow-hidden bg-white/95 border border-white/60 shadow-2xl rounded-[32px]">
        <div className="relative flex flex-col lg:flex-row">
          {/* Left Side - Branding */}
          <div
            className={`relative flex flex-col justify-between overflow-hidden text-white bg-gradient-to-br from-blue-900 via-blue-800 to-cyan-700 px-6 py-10 sm:px-8 lg:w-5/12 lg:order-1 ${panelAnimation}`}
          >
            <div className="absolute inset-0">
              <div className="absolute top-0 right-0 w-40 h-40 -mt-20 -mr-20 rounded-full bg-cyan-300 opacity-20"></div>
              <div className="absolute bottom-0 left-0 w-32 h-32 -ml-16 rounded-full bg-cyan-200 opacity-10 -mb-14"></div>
            </div>

            <div className="relative z-10 space-y-6">
              <div className="space-y-3">
                <p className="text-sm font-semibold tracking-[0.3em] text-cyan-200 uppercase">Greetings</p>
                <h2 className="text-2xl font-bold leading-tight text-white sm:text-3xl">AquaSense Control Center</h2>
                <p className="text-sm text-blue-100">
                  Instant water quality insight with automated alerts for crayfish farms.
                </p>
              </div>

              <div className="pt-5 space-y-3 border-t border-white/20">
                <div className="flex items-start gap-3">
                  <span className="text-xl">✔</span>
                  <p className="text-sm text-blue-100">Live pH, oxygen, and turbidity tracking</p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-xl">✔</span>
                  <p className="text-sm text-blue-100">Alerts before conditions turn critical</p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-xl">✔</span>
                  <p className="text-sm text-blue-100">Automated feeding and control support</p>
                </div>
              </div>
            </div>

            <div className="relative z-10 pt-6">
              <Link
                to="/signup"
                state={{ transition: 'to-signup' }}
                className="inline-flex items-center justify-center w-full px-4 py-2 text-sm font-semibold text-white border rounded-full border-white/40 backdrop-blur hover:bg-white/10"
              >
                Create Account
              </Link>
              <p className="mt-3 text-xs text-blue-100">New here? Start in under a minute.</p>
            </div>
          </div>

          {/* Right Side - Form */}
          <div
            className={`flex flex-col justify-center w-full p-6 sm:p-8 lg:w-7/12 lg:order-2 ${formAnimation}`}
          >
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 mb-8">
            <div className="text-3xl">🌊</div>
            <div>
              <h1 className="text-2xl font-bold text-primary">AquaSense</h1>
              <p className="text-xs text-gray-600">Water Quality System</p>
            </div>
          </Link>

          {/* Header */}
          <h2 className="mb-2 text-2xl font-bold text-gray-900 sm:text-3xl">Welcome Back</h2>
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

          {/* Terms */}
          <p className="mt-6 text-xs text-center text-gray-600">
            By signing in, you agree to our <Link to="#" className="font-medium text-accent hover:text-primary">Terms of Service</Link> and <Link to="#" className="font-medium text-accent hover:text-primary">Privacy Policy</Link>
          </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;

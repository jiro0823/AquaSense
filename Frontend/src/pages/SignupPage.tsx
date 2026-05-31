import React, { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { apiClient } from '../services/apiClient';

interface PasswordStrength {
  score: number;
  label: string;
  color: string;
}

const SignupPage: React.FC = () => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const transition = (location.state as { transition?: string } | null)?.transition;
  const isFromLogin = transition === 'to-signup';
  const panelAnimation = isFromLogin ? 'auth-panel-in-from-left' : 'auth-panel-in-from-right';
  const formAnimation = isFromLogin ? 'auth-form-in-from-right' : 'auth-form-in-from-left';

  // Calculate password strength
  const calculatePasswordStrength = (pwd: string): PasswordStrength => {
    const minLength = pwd.length >= 12;
    const hasUpperCase = /[A-Z]/.test(pwd);
    const hasLowerCase = /[a-z]/.test(pwd);
    const hasNumbers = /\d/.test(pwd);
    const hasSpecialChars = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pwd);

    let score = 0;
    if (pwd.length > 0) score += 1;
    if (minLength) score += 1;
    if (hasUpperCase) score += 1;
    if (hasLowerCase) score += 1;
    if (hasNumbers) score += 1;
    if (hasSpecialChars) score += 1;

    if (score <= 1) return { score: 0, label: 'Very Weak', color: '#ef4444' };
    if (score <= 2) return { score: 1, label: 'Weak', color: '#f97316' };
    if (score <= 3) return { score: 2, label: 'Fair', color: '#eab308' };
    if (score <= 4) return { score: 3, label: 'Good', color: '#84cc16' };
    return { score: 4, label: 'Strong', color: '#22c55e' };
  };

  const passwordStrength = calculatePasswordStrength(password);
  const passwordHint = password
    ? passwordStrength.score >= 3
      ? 'Looks good.'
      : 'Use 12+ chars with upper, lower, number, symbol.'
    : '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!fullName || !email || !password || !confirmPassword) {
      setError('All fields are required');
      return;
    }

    if (
      password.length < 12 ||
      !/[A-Z]/.test(password) ||
      !/[a-z]/.test(password) ||
      !/\d/.test(password) ||
      !/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)
    ) {
      setError('Password must be at least 12 characters and include uppercase, lowercase, number, and special character');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      const response = await apiClient.post<{ user: unknown }>('/auth/signup', {
        fullName,
        email,
        password,
      });

      if (response.success) {
        const user = response.data.user;
        localStorage.setItem('user', JSON.stringify(user));

        setTimeout(() => {
          navigate('/dashboard', { replace: true });
        }, 100);
      } else {
        setError(response.message || 'Signup failed');
      }
    } catch (err) {
      setError('Failed to create account. Check your details and backend connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex items-center justify-center min-h-screen px-4 py-12 bg-gradient-to-br from-slate-50 via-cyan-50 to-blue-100 sm:py-16">
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
            className={`relative flex flex-col justify-between overflow-hidden text-white bg-gradient-to-br from-blue-900 via-blue-800 to-cyan-700 px-6 py-10 sm:px-8 lg:w-5/12 lg:order-2 ${panelAnimation}`}
          >
            <div className="absolute inset-0">
              <div className="absolute top-0 right-0 w-40 h-40 -mt-20 -mr-20 rounded-full bg-cyan-300 opacity-20"></div>
              <div className="absolute bottom-0 left-0 w-32 h-32 -ml-16 rounded-full bg-cyan-200 opacity-10 -mb-14"></div>
            </div>

            <div className="relative z-10 space-y-6">
              <div className="space-y-3">
                <p className="text-sm font-semibold tracking-[0.3em] text-cyan-200 uppercase">Welcome</p>
                <h2 className="text-2xl font-bold leading-tight text-white sm:text-3xl">Start Monitoring Today</h2>
                <p className="text-sm text-blue-100">
                  Build your dashboard in minutes and receive instant water quality alerts.
                </p>
              </div>

              <div className="pt-5 space-y-3 border-t border-white/20">
                <div className="flex items-start gap-3">
                  <span className="text-xl">✔</span>
                  <p className="text-sm text-blue-100">Real-time data with smart analytics</p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-xl">✔</span>
                  <p className="text-sm text-blue-100">Automated control and alert rules</p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-xl">✔</span>
                  <p className="text-sm text-blue-100">Secure access from any device</p>
                </div>
              </div>
            </div>

            <div className="relative z-10 pt-6">
              <Link
                to="/login"
                state={{ transition: 'to-login' }}
                className="inline-flex items-center justify-center w-full px-4 py-2 text-sm font-semibold text-white border rounded-full border-white/40 backdrop-blur hover:bg-white/10"
              >
                Sign In
              </Link>
              <p className="mt-3 text-xs text-blue-100">Already have an account? Hop back in.</p>
            </div>
          </div>

          {/* Right Side - Form */}
          <div
            className={`flex flex-col justify-center w-full p-6 sm:p-8 lg:w-7/12 lg:order-1 ${formAnimation}`}
          >
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 mb-4">
            <div className="text-3xl">🌊</div>
            <div>
              <h1 className="text-2xl font-bold text-primary">AquaSense</h1>
              <p className="text-xs text-gray-600">Water Quality System</p>
            </div>
          </Link>

          {/* Header */}
          <h2 className="mb-1 text-2xl font-bold text-gray-900 sm:text-3xl">Create Account</h2>
          <p className="mb-4 text-gray-600">Get started in minutes.</p>

          {/* Error Alert */}
          {error && (
            <div className="mb-6 alert alert-danger">
              <span>⚠️</span>
              <div>
                <p className="font-semibold">Signup Error</p>
                <p className="text-sm">{error}</p>
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Full Name */}
            <div>
              <label className="block mb-2 text-sm font-semibold text-gray-900">Full name</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="input-field"
                placeholder="John Farmer"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block mb-2 text-sm font-semibold text-gray-900">Email</label>
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

              {/* Password Strength Meter */}
              {password && (
                <div className="p-3 mt-3 rounded-lg bg-gray-50">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="text-xs font-medium text-gray-600">Strength:</div>
                    <div className="flex-1 h-2 overflow-hidden bg-gray-200 rounded-full">
                      <div
                        className="h-full transition-all duration-300"
                        style={{
                          width: `${(passwordStrength.score + 1) * 20}%`,
                          backgroundColor: passwordStrength.color,
                        }}
                      />
                    </div>
                    <span className="text-xs font-semibold" style={{ color: passwordStrength.color }}>
                      {passwordStrength.label}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600">{passwordHint}</p>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block mb-2 text-sm font-semibold text-gray-900">Confirm password</label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className={`input-field pr-10 ${
                    confirmPassword && password !== confirmPassword ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''
                  }`}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute text-gray-600 transition -translate-y-1/2 right-3 top-1/2 hover:text-primary"
                  aria-label="Toggle password visibility"
                >
                  {showConfirmPassword ? (
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
              {confirmPassword && password !== confirmPassword && (
                <p className="mt-1 text-xs text-red-600">Passwords do not match</p>
              )}
            </div>

            {/* Terms Checkbox */}
            <div className="flex items-start gap-2 pt-2">
              <input
                type="checkbox"
                id="terms"
                required
                className="w-4 h-4 mt-1 rounded text-accent focus:ring-accent"
              />
              <label htmlFor="terms" className="text-sm text-gray-700">
                I agree to the <Link to="#" className="font-medium text-accent hover:text-primary">Terms</Link> and <Link to="#" className="font-medium text-accent hover:text-primary">Privacy Policy</Link>
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-6 btn btn-primary"
            >
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>

          </div>
        </div>
      </div>
    </div>
  );
};

export default SignupPage;

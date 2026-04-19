import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';

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

  // Calculate password strength
  const calculatePasswordStrength = (pwd: string): PasswordStrength => {
    const minLength = pwd.length >= 8;
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!fullName || !email || !password || !confirmPassword) {
      setError('All fields are required');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('http://localhost:5000/api/v1/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fullName,
          email,
          password,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        const token = data.data.token;
        const user = data.data.user;
        
        localStorage.setItem('authToken', token);
        localStorage.setItem('user', JSON.stringify(user));
        
        console.log('[SignupPage] Token stored:', token.substring(0, 20) + '...');
        console.log('[SignupPage] User stored:', user);
        
        setTimeout(() => {
          console.log('[SignupPage] Navigating to dashboard');
          navigate('/dashboard', { replace: true });
        }, 100);
      } else {
        setError(data.message || 'Signup failed');
      }
    } catch (err) {
      setError('Failed to connect to backend. Make sure it is running on port 5000.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen p-4 py-16 bg-white sm:py-10">
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

      <div className="flex w-full max-w-5xl overflow-hidden bg-white rounded-xl shadow-lg border border-gray-200">

        {/* Left Side - Branding */}
        <div className="relative flex-col justify-between hidden p-8 overflow-hidden text-white lg:flex lg:w-5/12 xl:p-10 bg-gradient-to-br from-primary via-blue-700 to-blue-800">
          <div className="absolute top-0 right-0 w-40 h-40 bg-accent opacity-20 rounded-full -mr-20 -mt-20"></div>
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-accent opacity-10 rounded-full -ml-16 -mb-14"></div>
          
          <div className="relative z-10 space-y-6">
            <div>
              <h2 className="mb-4 text-3xl font-bold leading-tight xl:text-4xl">Join AquaSense</h2>
              <p className="text-lg text-blue-100 leading-relaxed">
                Start monitoring and controlling your aquaculture systems with real-time data, instant alerts, and automated solutions.
              </p>
            </div>

            <div className="space-y-4 pt-6 border-t border-white border-opacity-20">
              <div className="flex items-start gap-3">
                <span className="text-2xl">✓</span>
                <p className="text-blue-100">Real-time water quality monitoring</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-2xl">✓</span>
                <p className="text-blue-100">Instant alerts for critical changes</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-2xl">✓</span>
                <p className="text-blue-100">Automated control systems</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-2xl">✓</span>
                <p className="text-blue-100">Advanced analytics & reporting</p>
              </div>
            </div>
          </div>

          <p className="text-sm text-blue-100 relative z-10">Join thousands of successful farmers</p>
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
          <h2 className="mb-2 text-3xl font-bold text-gray-900">Create Account</h2>
          <p className="mb-6 text-gray-600">Join AquaSense to start monitoring your farm</p>

          {/* Error Alert */}
          {error && (
            <div className="alert alert-danger mb-6">
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
              <label className="block mb-2 text-sm font-semibold text-gray-900">Full Name</label>
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
                  className="input-field pr-10"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute transition right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-primary"
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
                <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="text-xs font-medium text-gray-600">Strength:</div>
                    <div className="flex-1 h-2 overflow-hidden rounded-full bg-gray-200">
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
                  <p className="text-xs text-gray-600">
                    {password.length < 8 && 'Password must be at least 8 characters'}
                    {password.length >= 8 && !/[A-Z]/.test(password) && 'Add uppercase letter'}
                    {password.length >= 8 && /[A-Z]/.test(password) && !/\d/.test(password) && 'Add a number'}
                    {password.length >= 8 && /[A-Z]/.test(password) && /\d/.test(password) && 'Password is strong!'}
                  </p>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block mb-2 text-sm font-semibold text-gray-900">Confirm Password</label>
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
                  className="absolute transition right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-primary"
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
                <p className="text-xs text-red-600 mt-1">Passwords do not match</p>
              )}
            </div>

            {/* Terms Checkbox */}
            <div className="flex items-start gap-2 pt-2">
              <input
                type="checkbox"
                id="terms"
                required
                className="mt-1 w-4 h-4 text-accent rounded focus:ring-accent"
              />
              <label htmlFor="terms" className="text-sm text-gray-700">
                I agree to the <Link to="#" className="text-accent hover:text-primary font-medium">Terms of Service</Link> and <Link to="#" className="text-accent hover:text-primary font-medium">Privacy Policy</Link>
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full mt-6"
            >
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-gray-200"></div>
            <span className="text-sm text-gray-600">Already have an account?</span>
            <div className="flex-1 h-px bg-gray-200"></div>
          </div>

          {/* Sign In Link */}
          <Link
            to="/login"
            className="btn btn-secondary w-full"
          >
            Sign In
          </Link>
        </div>

      </div>
    </div>
  );
};

export default SignupPage;

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import AboutPage from './pages/AboutPage';
import FeaturesPage from './pages/FeaturesPage';
import HowItWorksPage from './pages/HowItWorksPage';
import ScrollManager from './components/ScrollManager';
import { WaterQualityDashboard } from './components/WaterQuality/Dashboard';
import './App.css';

// Protected Route Component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const token = localStorage.getItem('authToken');
  
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
};

function App(): JSX.Element {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Initial check
    setLoading(false);

    // Listen for storage changes (for when other tabs/windows auth changes)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'authToken') {
        // Auth state will be checked by ProtectedRoute component
        console.log('[App] Storage change detected:', e.key);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="text-6xl animate-bounce mb-4">🌊</div>
          <p className="text-gray-900 text-xl font-semibold">Loading...</p>
          <p className="text-gray-600 text-sm mt-2">Initializing AquaSense</p>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <ScrollManager />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/features" element={<FeaturesPage />} />
        <Route path="/how-it-works" element={<HowItWorksPage />} />
        <Route path="/contact" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <WaterQualityDashboard />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

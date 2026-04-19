import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

const ScrollManager: React.FC = () => {
  const { pathname } = useLocation();
  const [showBackToTop, setShowBackToTop] = useState(false);

  useEffect(() => {
    // Reset viewport on every route change so each page opens at hero/top.
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [pathname]);

  useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 280);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="Scroll back to top"
      className={`fixed bottom-6 left-1/2 z-50 inline-flex h-12 w-12 -translate-x-1/2 items-center justify-center rounded-full bg-primary text-white shadow-lg transition-all duration-300 hover:bg-blue-800 ${
        showBackToTop
          ? 'translate-y-0 opacity-100 pointer-events-auto'
          : 'translate-y-3 opacity-0 pointer-events-none'
      }`}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-5 w-5"
        aria-hidden="true"
      >
        <path d="m18 15-6-6-6 6" />
      </svg>
    </button>
  );
};

export default ScrollManager;

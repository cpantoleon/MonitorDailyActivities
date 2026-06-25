import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import './ScrollToTopButton.css';

const ScrollToTopButton = () => {
  const [isVisible, setIsVisible] = useState(false);
  const location = useLocation();

  // Show only on SprintBoard (Requirements) and Defects pages
  const allowedPaths = ['/sprint-board', '/defects'];
  const isAllowedPage = allowedPaths.includes(location.pathname);

  useEffect(() => {
    const toggleVisibility = () => {
      // Display the arrow when moving 500px down
      if (window.scrollY > 500) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    if (isAllowedPage) {
      window.addEventListener('scroll', toggleVisibility);
      // Initial check in case the user loads the page already scrolled
      toggleVisibility();
    }

    return () => {
      window.removeEventListener('scroll', toggleVisibility);
    };
  }, [isAllowedPage]);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  if (!isAllowedPage || !isVisible) {
    return null;
  }

  return (
    <button className="scroll-to-top-btn" onClick={scrollToTop} title="Go to top">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="19" x2="12" y2="5"></line>
        <polyline points="5 12 12 5 19 12"></polyline>
      </svg>
    </button>
  );
};

export default ScrollToTopButton;

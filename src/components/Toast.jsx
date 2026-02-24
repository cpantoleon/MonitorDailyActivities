import React, { useState, useEffect } from 'react';
import './Toast.css';

const Toast = ({ message, type = 'success', duration = 3000, onDismiss }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (message) {
      setIsVisible(true);
      const timer = setTimeout(() => {
        setIsVisible(false);
      }, duration);

      const dismissTimer = setTimeout(() => {
        onDismiss();
      }, duration + 400); // Wait for CSS animation to finish before removing from DOM

      return () => {
        clearTimeout(timer);
        clearTimeout(dismissTimer);
      };
    } else {
      setIsVisible(false);
    }
  }, [message, type, duration, onDismiss]);

  if (!message) {
    return null;
  }

  // Determine which icon to show based on the type
  const getIcon = () => {
    switch (type) {
      case 'error': return '❌';
      case 'warning': return '⚠️';
      case 'info': return 'ℹ️';
      case 'success': 
      default: return '✅';
    }
  };

  return (
    <div id="toast-container-id" className={`toast toast-${type} ${isVisible ? 'show' : ''}`}>
      <span className="toast-icon">{getIcon()}</span>
      <span className="toast-message">{message}</span>
    </div>
  );
};

export default Toast;
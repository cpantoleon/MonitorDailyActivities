import React, { useState, useEffect } from 'react';
import './Toast.css';

const Toast = ({ message, type, duration = 3000, onDismiss }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (message) {
      setIsVisible(true);
      const timer = setTimeout(() => {
        setIsVisible(false);
      }, duration);

      const dismissTimer = setTimeout(() => {
        onDismiss();
      }, duration + 400);

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

  return (
    <div id="toast-container-id" className={`toast ${type === 'error' ? 'toast-error' : 'toast-success'} ${isVisible ? 'show' : ''}`}>
      {message}
    </div>
  );
};

export default Toast;
import React, { useState, useRef, useLayoutEffect } from 'react';
import ReactDOM from 'react-dom';

const Tooltip = ({ content, className = '', position = 'right' }) => {
  const [isHovered, setIsHovered] = useState(false);
  // Store full layout properties to prevent screen overflow
  const [layout, setLayout] = useState({ top: 0, left: 0, right: 'auto', transform: 'none' });
  const iconRef = useRef(null);

  const updatePosition = () => {
    if (!iconRef.current) return;
    const rect = iconRef.current.getBoundingClientRect();
    
    // Check if the icon is too close to the right edge of the screen (e.g., within 250px)
    const isNearRightEdge = window.innerWidth - rect.right < 250;

    if (position === 'bottom') {
      setLayout({
        top: rect.bottom + 8,
        // If near right edge, remove 'left' positioning and anchor to the 'right'
        left: isNearRightEdge ? 'auto' : rect.left + (rect.width / 2),
        right: isNearRightEdge ? Math.max(10, window.innerWidth - rect.right - 10) : 'auto',
        transform: isNearRightEdge ? 'none' : 'translateX(-50%)'
      });
    } else { // right
      setLayout({
        top: rect.top + (rect.height / 2),
        left: rect.right + 8,
        right: 'auto',
        transform: 'translateY(-50%)'
      });
    }
  };

  useLayoutEffect(() => {
    if (isHovered) {
      updatePosition();
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);
    }
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [isHovered, position]);

  const tooltipContent = (
    <div
      className={`tooltip-text-portal ${className}`}
      style={{ 
        position: 'fixed', 
        top: `${layout.top}px`, 
        left: layout.left !== 'auto' ? `${layout.left}px` : 'auto',
        right: layout.right !== 'auto' ? `${layout.right}px` : 'auto',
        transform: layout.transform,
        zIndex: 99999, 
        backgroundColor: 'var(--bg-secondary)',
        color: 'var(--text-primary)',
        border: '1px solid var(--border-color)',
        padding: '15px 20px', // More padding
        borderRadius: '8px',
        fontSize: '0.95rem', // Bigger, more readable font
        maxWidth: '380px', // Caps the width so it doesn't get ridiculously wide
        width: 'max-content',
        boxShadow: 'var(--card-shadow)',
        pointerEvents: 'none',
        lineHeight: '1.5'
      }}
    >
      {content}
    </div>
  );

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center' }} onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}>
      <span
        ref={iconRef}
        className={`tooltip-icon ${className}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '18px',
          height: '18px',
          borderRadius: '50%',
          border: '1px solid var(--text-secondary)',
          color: 'var(--text-secondary)',
          fontSize: '12px',
          fontWeight: 'bold',
          cursor: 'help',
          transition: 'all 0.2s ease'
        }}
        onMouseOver={(e) => { e.currentTarget.style.color = 'var(--accent-color)'; e.currentTarget.style.borderColor = 'var(--accent-color)'; }}
        onMouseOut={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'var(--text-secondary)'; }}
      >
        ?
      </span>
      {isHovered && ReactDOM.createPortal(tooltipContent, document.body)}
    </div>
  );
};

export default Tooltip;
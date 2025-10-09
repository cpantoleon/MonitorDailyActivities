import React, { useState, useRef } from 'react';
import ReactDOM from 'react-dom';

const Tooltip = ({ content, className = '', position = 'right' }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const iconRef = useRef(null);

  const handleMouseEnter = () => {
    if (!iconRef.current) return;
    const rect = iconRef.current.getBoundingClientRect();
    
    let newCoords = {};
    switch (position) {
      case 'bottom':
        newCoords = {
          top: rect.bottom + 8,
          left: rect.left + rect.width / 2,
        };
        break;
      case 'right':
      default:
        newCoords = {
          top: rect.top + rect.height / 2,
          left: rect.right + 8,
        };
        break;
    }
    setCoords(newCoords);
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
  };

  const tooltipContent = (
    <div
      id="tooltip-text-portal-id"
      className={`tooltip-text-portal ${className} tooltip-${position}`}
      style={{ top: `${coords.top}px`, left: `${coords.left}px` }}
    >
      {content}
    </div>
  );

  return (
    <div id="tooltip-wrapper-id">
      <span
        ref={iconRef}
        id="tooltip-icon-id"
        className={`tooltip-icon ${className}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        ?
      </span>
      {isHovered && ReactDOM.createPortal(tooltipContent, document.body)}
    </div>
  );
};

export default Tooltip;
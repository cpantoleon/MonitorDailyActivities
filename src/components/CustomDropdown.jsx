import React, { useState, useRef, useLayoutEffect } from 'react';
import ReactDOM from 'react-dom';
import useClickOutside from '../hooks/useClickOutside';
import './CustomDropdown.css';

const CustomDropdown = ({ options, value, onChange, id, name, placeholder, disabled = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState({});
  const buttonRef = useRef(null);

  // We use a separate ref for the click-outside logic to avoid conflicts
  const dropdownContainerRef = useClickOutside(() => setIsOpen(false));

  useLayoutEffect(() => {
    const updatePosition = () => {
      if (isOpen && buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        setCoords({
          top: rect.bottom,
          left: rect.left,
          width: rect.width,
        });
      }
    };

    if (isOpen) {
      updatePosition();
      // Add event listeners to handle scrolling and resizing
      window.addEventListener('scroll', updatePosition, true); // Use capture phase
      window.addEventListener('resize', updatePosition);
    }

    // Cleanup function
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [isOpen]);

  const handleSelect = (optionValue) => {
    const event = {
      target: {
        name: name,
        value: optionValue,
      },
    };
    onChange(event);
    setIsOpen(false);
  };

  const selectedOption = options.find(opt => String(opt.value) === String(value));
  const displayLabel = selectedOption ? selectedOption.label : placeholder;
  const labelId = `${id}-label`;

  return (
    <div className="custom-dropdown" ref={dropdownContainerRef}>
      <button
        ref={buttonRef}
        type="button"
        id={`${id}-button`}
        className={`custom-dropdown-button ${isOpen ? 'open' : ''}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-labelledby={labelId}
      >
        {displayLabel}
      </button>
      {isOpen && ReactDOM.createPortal(
        <ul
          className="custom-dropdown-options"
          style={{
            top: `${coords.top}px`,
            left: `${coords.left}px`,
            width: `${coords.width}px`,
          }}
          role="listbox"
          id={`${id}-options`}
          aria-labelledby={labelId}
        >
          {options.map(option => (
            <li
              key={option.value}
              className={`custom-dropdown-option ${String(option.value) === String(value) ? 'selected' : ''}`}
              onClick={() => handleSelect(option.value)}
              data-value={option.value}
              role="option"
              aria-selected={String(option.value) === String(value)}
            >
              {option.label}
            </li>
          ))}
        </ul>,
        document.body // Render the dropdown options at the end of the body
      )}
    </div>
  );
};

export default CustomDropdown;
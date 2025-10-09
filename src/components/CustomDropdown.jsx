import React, { useState, useRef, useLayoutEffect, useEffect } from 'react';
import ReactDOM from 'react-dom';
import useClickOutside from '../hooks/useClickOutside';
import './CustomDropdown.css';

const CustomDropdown = ({
  options,
  value,
  onChange,
  id,
  name,
  placeholder,
  disabled = false,
  isComboBox = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState({});
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef(null);

  const dropdownContainerRef = useClickOutside(() => setIsOpen(false));

  useEffect(() => {
    const selectedOption = options.find(opt => String(opt.value) === String(value));
    setInputValue(selectedOption ? selectedOption.label : '');
  }, [value, options]);

  useLayoutEffect(() => {
    const updatePosition = () => {
      if (isOpen && inputRef.current) {
        const rect = inputRef.current.getBoundingClientRect();
        setCoords({
          top: rect.bottom,
          left: rect.left,
          width: rect.width,
        });
      }
    };

    if (isOpen) {
      updatePosition();
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);
    }

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
    const selectedOption = options.find(opt => String(opt.value) === String(optionValue));
    setInputValue(selectedOption ? selectedOption.label : '');
    setIsOpen(false);
  };

  const handleInputChange = (e) => {
    setInputValue(e.target.value);
    if (!isOpen) {
      setIsOpen(true);
    }
  };

  const handleInputBlur = () => {
    if (inputValue === '') {
        handleSelect('');
        return;
    }
    const match = options.find(opt => opt.label.toLowerCase() === inputValue.toLowerCase());
    if (match) {
        handleSelect(match.value);
    } else {
        const selectedOption = options.find(opt => String(opt.value) === String(value));
        setInputValue(selectedOption ? selectedOption.label : '');
    }
  };

  const filteredOptions = isComboBox
    ? options.filter(option =>
        option.label.toLowerCase().includes(inputValue.toLowerCase())
      )
    : options;

  const labelId = `${id}-label`;

  return (
    <div id={`${id}-container`} className="custom-dropdown" ref={dropdownContainerRef}>
      {isComboBox ? (
        <input
          ref={inputRef}
          type="text"
          id={id}
          name={name}
          className="custom-dropdown-input"
          value={inputValue}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          onClick={() => setIsOpen(true)}
          placeholder={placeholder}
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          autoComplete="off"
        />
      ) : (
        <button
          ref={inputRef}
          type="button"
          id={`${id}-button`}
          className={`custom-dropdown-button ${isOpen ? 'open' : ''}`}
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-labelledby={labelId}
        >
          {options.find(opt => String(opt.value) === String(value))?.label || placeholder}
        </button>
      )}
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
          {filteredOptions.map(option => (
            <li
              id={`${id}-option-${String(option.value).replace(/\s+/g, '-')}`}
              key={option.value}
              className={`custom-dropdown-option ${String(option.value) === String(value) ? 'selected' : ''}`}
              onClick={() => handleSelect(option.value)}
              onMouseDown={(e) => e.preventDefault()}
              data-value={option.value}
              role="option"
              aria-selected={String(option.value) === String(value)}
              title={option.description}
            >
              {option.label}
            </li>
          ))}
        </ul>,
        document.body
      )}
    </div>
  );
};

export default CustomDropdown;
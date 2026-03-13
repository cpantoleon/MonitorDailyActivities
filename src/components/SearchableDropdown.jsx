import React, { useState, useRef, useEffect, useMemo } from 'react';

const SearchableDropdown = ({ name, value, onChange, options, placeholder }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const wrapperRef = useRef(null);

  // Κλείνει το dropdown αν κάνεις κλικ έξω από αυτό
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = useMemo(() => {
    return options.filter(option =>
      option.label.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [options, searchTerm]);

  const selectedOption = options.find(opt => opt.value === value);

  return (
    <div ref={wrapperRef} style={{ position: 'relative', width: '100%' }}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        style={{
          padding: '8px 12px',
          border: '1px solid var(--border-color, #444)',
          borderRadius: '4px',
          backgroundColor: 'var(--bg-secondary, #222)',
          color: 'var(--text-primary, #fff)',
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <span style={{ fontSize: '0.8em', marginLeft: '10px' }}>{isOpen ? '▲' : '▼'}</span>
      </div>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            bottom: '100%', // <-- ΕΔΩ είναι το μυστικό που το κάνει να ανοίγει προς τα πάνω
            left: 0,
            right: 0,
            marginBottom: '4px',
            backgroundColor: 'var(--bg-secondary, #222)',
            border: '1px solid var(--border-color, #555)',
            borderRadius: '4px',
            boxShadow: '0 -4px 10px rgba(0,0,0,0.5)',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search parent..."
            style={{
              padding: '10px',
              border: 'none',
              borderBottom: '1px solid var(--border-color, #555)',
              backgroundColor: 'var(--bg-primary, #111)',
              color: 'var(--text-primary, #fff)',
              outline: 'none',
              width: '100%',
              boxSizing: 'border-box',
              borderRadius: '4px 4px 0 0'
            }}
            autoFocus
          />
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, maxHeight: '200px', overflowY: 'auto' }}>
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => (
                <li
                  key={option.value}
                  onClick={() => {
                    onChange({ target: { name, value: option.value, type: 'select' } });
                    setIsOpen(false);
                    setSearchTerm('');
                  }}
                  style={{
                    padding: '10px',
                    cursor: 'pointer',
                    borderBottom: '1px solid var(--border-color, #333)'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-primary, #111)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  {option.label}
                </li>
              ))
            ) : (
              <li style={{ padding: '10px', color: '#888', textAlign: 'center' }}>No parents found</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
};

export default SearchableDropdown;
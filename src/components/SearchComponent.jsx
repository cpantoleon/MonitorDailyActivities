import React, { useState } from 'react';
import useClickOutside from '../hooks/useClickOutside';
import './SearchComponent.css';

const SearchComponent = ({ query, onQueryChange, onSearch, onClear, onSuggestionSelect, suggestions, placeholder }) => {
  const [showSuggestions, setShowSuggestions] = useState(false);

  const handleInputChange = (e) => {
    onQueryChange(e.target.value);
    setShowSuggestions(true);
  };

  const handleSearchClick = () => {
    onSearch(query);
    setShowSuggestions(false);
  };

  const handleClearClick = () => {
    onClear();
    setShowSuggestions(false);
  };

  const handleSuggestionClick = (suggestion) => {
    onSuggestionSelect(suggestion);
    setShowSuggestions(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (query && query.trim() !== '') {
        handleSearchClick();
      }
    }
  };

  const searchRef = useClickOutside(() => {
    setShowSuggestions(false);
  });

  return (
    <div id="search-container-id" className="search-container" ref={searchRef}>
      <div id="search-input-group-id" className="search-input-group">
        <input
          type="text"
          id="main-search-input"
          name="main-search-no-autofill"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowSuggestions(true)}
          placeholder={placeholder || "Search..."}
          className="search-input"
          autoComplete="off"
          autoCorrect="off"
          spellCheck="false"
          data-1p-ignore="true" 
          data-lpignore="true" 
        />
        <button 
          type="button" 
          id="search-button-id"
          onClick={handleSearchClick} 
          className="search-button icon-button" 
          disabled={!query || query.trim() === ''}
          title="Search"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
        </button>
        <button id="search-clear-button-id" type="button" onClick={handleClearClick} className="search-clear-button icon-button" title="Clear">
          <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      {showSuggestions && suggestions && suggestions.length > 0 && (
        <ul id="suggestions-list-id" className="suggestions-list">
          {suggestions.map((suggestion, index) => (
            <li
              key={suggestion.id || index}
              id={`suggestion-item-${suggestion.id || index}`}
              onClick={() => handleSuggestionClick(suggestion)}
              className="suggestion-item"
            >
              {suggestion.name} <span id={`suggestion-context-${suggestion.id || index}`} className="suggestion-context">({suggestion.context})</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default SearchComponent;
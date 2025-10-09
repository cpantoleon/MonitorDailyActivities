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
          name="main-search"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowSuggestions(true)}
          placeholder={placeholder || "Search..."}
          className="search-input"
          autoComplete="off"
        />
        <button 
          type="button" 
          id="search-button-id"
          onClick={handleSearchClick} 
          className="search-button" 
          disabled={!query || query.trim() === ''}
        >
          Search
        </button>
        <button id="search-clear-button-id" type="button" onClick={handleClearClick} className="search-clear-button">Clear</button>
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
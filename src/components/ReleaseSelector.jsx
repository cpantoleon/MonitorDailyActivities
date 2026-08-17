import React from 'react';
import CustomDropdown from './CustomDropdown';

const ReleaseSelector = ({ releases, selectedRelease, onSelectRelease, disabled }) => {
  return (
    <div id="release-selector-selection-group-id" className="selection-group">
      <label id="release-selector-label" htmlFor="release-selector-button" className="dropdown-label">Release Selection</label>
      <CustomDropdown
        id="release-selector"
        name="release-selector"
        value={selectedRelease}
        onChange={(e) => onSelectRelease(e.target.value)}
        options={releases}
        placeholder="-- Select Release --"
        disabled={disabled || releases.length === 0}
      />
    </div>
  );
};

export default ReleaseSelector;

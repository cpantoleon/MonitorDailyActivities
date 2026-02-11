import React from 'react';
import CustomDropdown from './CustomDropdown';

const SprintSelector = ({ sprints, selectedSprint, onSelectSprint, disabled }) => {
  const sprintOptions = sprints.map(s => ({ value: s, label: s }));

  const handleChange = (e) => {
    onSelectSprint(e.target.value);
  };

  return (
    <div id="sprint-selector-selection-group-id" className="selection-group">
      <label id="sprint-selector-label" htmlFor="sprint-selector-button" className="dropdown-label">Sprint Selection</label>
      <CustomDropdown
        id="sprint-selector"
        name="sprint-selector"
        value={selectedSprint}
        onChange={handleChange}
        options={sprintOptions}
        placeholder="-- Select Sprint --"
        disabled={disabled || sprints.length === 0}
      />
    </div>
  );
};

export default SprintSelector;
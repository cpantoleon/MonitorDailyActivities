import React from 'react';
import CustomDropdown from './CustomDropdown'; // Use the new component

const SprintSelector = ({ sprints, selectedSprint, onSelectSprint, disabled }) => {
  // Convert the simple array of strings into the format our dropdown needs
  const sprintOptions = sprints.map(s => ({ value: s, label: s }));

  const handleChange = (e) => {
    onSelectSprint(e.target.value);
  };

  return (
    <div className="selection-group">
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
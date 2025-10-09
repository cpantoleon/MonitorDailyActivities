import React from 'react';

const SelectionControls = () => {
  return (
    <div id="selection-controls-id" className="selection-controls">
      <div id="selection-group-project-id" className="selection-group">
        <span id="dropdown-label-project-id" className="dropdown-label">drop down selection</span>
        <span id="main-label-project-id" className="main-label">Project Selection</span>
      </div>
      <div id="selection-group-sprint-id" className="selection-group">
        <span id="dropdown-label-sprint-id" className="dropdown-label">drop down selection</span>
        <span id="main-label-sprint-id" className="main-label">Sprint</span>
      </div>
    </div>
  );
};

export default SelectionControls;
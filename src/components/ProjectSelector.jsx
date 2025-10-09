import React from 'react';
import CustomDropdown from './CustomDropdown';

const ProjectSelector = ({ projects, selectedProject, onSelectProject }) => {
  const projectOptions = projects.map(p => ({ value: p, label: p }));

  const handleChange = (e) => {
    onSelectProject(e.target.value);
  };

  return (
    <div id="project-selector-selection-group-id" className="selection-group">
      <label id="project-selector-label" htmlFor="project-selector-button" className="dropdown-label">Project Selection</label>
      <CustomDropdown
        id="project-selector"
        name="project-selector"
        value={selectedProject}
        onChange={handleChange}
        options={projectOptions}
        placeholder="-- Select Project --"
        disabled={projects.length === 0}
      />
    </div>
  );
};

export default ProjectSelector;
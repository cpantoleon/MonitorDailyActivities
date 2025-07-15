import React from 'react';
import CustomDropdown from './CustomDropdown'; // Use the new component

const ProjectSelector = ({ projects, selectedProject, onSelectProject }) => {
  // Convert the simple array of strings into the format our dropdown needs
  const projectOptions = projects.map(p => ({ value: p, label: p }));

  const handleChange = (e) => {
    onSelectProject(e.target.value);
  };

  return (
    <div className="selection-group">
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
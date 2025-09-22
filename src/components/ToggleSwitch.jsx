import React from 'react';
import './ToggleSwitch.css';

const ToggleSwitch = ({ name, checked, onChange, label }) => {
  return (
    <div className="form-group new-project-toggle">
      <label className="checkbox-label optional-label"><strong>{label}</strong></label>
      <label className="toggle-switch">
        <input type="checkbox" name={name} checked={checked} onChange={onChange} />
        <span className="slider"></span>
      </label>
    </div>
  );
};

export default ToggleSwitch;

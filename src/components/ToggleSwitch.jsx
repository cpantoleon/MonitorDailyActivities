import React from 'react';
import './ToggleSwitch.css';

const ToggleSwitch = ({ id, checked, onChange, option1, option2, title }) => {
  return (
    <div className="toggle-switch">
      <input
        id={id}
        type="checkbox"
        className="toggle-switch-checkbox"
        checked={checked}
        onChange={onChange}
        title={title}
      />
      <label className="toggle-switch-label" htmlFor={id}>
        <span className="toggle-switch-inner" data-option1={option1} data-option2={option2} />
        <span className="toggle-switch-switch" />
      </label>
    </div>
  );
};

export default ToggleSwitch;
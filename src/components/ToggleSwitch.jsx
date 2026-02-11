import React from 'react';
import './ToggleSwitch.css';

const ToggleSwitch = ({ id, name, checked, onChange, option1, option2, title, variant = 'default' }) => {
  if (variant === 'simple') {
    return (
      <div id={`${id}-simple-toggle-switch-container`} className="simple-toggle-switch">
        <input
          id={id}
          name={name}
          type="checkbox"
          className="simple-toggle-switch-checkbox"
          checked={checked}
          onChange={onChange}
          title={title}
        />
        <label id={`${id}-simple-toggle-switch-label`} className="simple-toggle-switch-label" htmlFor={id}>
          <span id={`${id}-simple-toggle-switch-span`} className="simple-toggle-switch-switch" />
        </label>
      </div>
    );
  }

  return (
    <div id={`${id}-default-toggle-switch-container`} className="toggle-switch">
      <input
        id={id}
        name={name}
        type="checkbox"
        className="toggle-switch-checkbox"
        checked={checked}
        onChange={onChange}
        title={title}
      />
      <label id={`${id}-default-toggle-switch-label`} className="toggle-switch-label" htmlFor={id}>
        <span id={`${id}-toggle-switch-inner-span`} className="toggle-switch-inner" data-option1={option1} data-option2={option2} />
        <span id={`${id}-toggle-switch-switch-span`} className="toggle-switch-switch" />
      </label>
    </div>
  );
};

export default ToggleSwitch;
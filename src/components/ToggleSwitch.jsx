import React from 'react';
import './ToggleSwitch.css';

const ToggleSwitch = ({ id, name, checked, onChange, option1, option2, title, variant = 'default' }) => {
  // The 'variant' prop defaults to 'default' to not break existing toggles.
  // We will pass variant="simple" for the new style.

  if (variant === 'simple') {
    return (
      <div className="simple-toggle-switch">
        <input
          id={id}
          name={name}
          type="checkbox"
          className="simple-toggle-switch-checkbox"
          checked={checked}
          onChange={onChange}
          title={title}
        />
        <label className="simple-toggle-switch-label" htmlFor={id}>
          <span className="simple-toggle-switch-switch" />
        </label>
      </div>
    );
  }

  // Original toggle switch code for the 'default' variant
  return (
    <div className="toggle-switch">
      <input
        id={id}
        name={name}
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
import React from 'react';

const TimeInputGroup = ({ value, unit, onValueChange, onUnitChange, style, inputStyle, selectStyle }) => {
  const handleDaysChange = (e) => {
    const d = e.target.value === '' ? '' : parseFloat(e.target.value);
    const h = value !== '' ? ((value || 0) % 1) * 8 : 0;
    if (d === '' && h === 0) onValueChange('');
    else onValueChange((d || 0) + (h / 8));
  };

  const handleHoursChange = (e) => {
    const h = e.target.value === '' ? '' : parseFloat(e.target.value);
    const d = value !== '' ? Math.floor(value || 0) : 0;
    if (h === '' && d === 0) onValueChange('');
    else onValueChange(d + ((h || 0) / 8));
  };

  const daysValue = value !== '' ? Math.floor(value || 0) : '';
  const hoursValue = value !== '' && ((value || 0) % 1) * 8 > 0 ? parseFloat((((value || 0) % 1) * 8).toFixed(2)) : '';

  return (
    <div style={{ display: 'flex', gap: '5px', ...style }}>
      {unit === 'd' ? (
        <>
          <input
            type="number"
            placeholder="Days"
            value={daysValue}
            onChange={handleDaysChange}
            min="0"
            step="0.5"
            style={{ width: '60px', padding: '6px', ...inputStyle }}
          />
          <input
            type="number"
            placeholder="Hours"
            value={hoursValue}
            onChange={handleHoursChange}
            min="0"
            step="0.5"
            style={{ width: '60px', padding: '6px', ...inputStyle }}
          />
        </>
      ) : (
        <input
          type="number"
          placeholder="Hours"
          value={value}
          onChange={(e) => onValueChange(e.target.value === '' ? '' : parseFloat(e.target.value))}
          min="0"
          step="0.5"
          style={{ width: '60px', padding: '6px', ...inputStyle }}
        />
      )}
      <select
        value={unit}
        onChange={(e) => onUnitChange(e.target.value)}
        style={{ padding: '6px', flexGrow: 1, ...selectStyle }}
      >
        <option value="h">hours</option>
        <option value="d">days</option>
      </select>
    </div>
  );
};

export default TimeInputGroup;

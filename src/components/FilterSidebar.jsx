import React from 'react';
import useClickOutside from '../hooks/useClickOutside';

const FilterSidebar = ({
  isOpen,
  onClose,
  types,
  selectedTypes,
  onTypeChange,
  enabledTypes,
  linkedDefectsFilter,
  onLinkedDefectsChange,
  isLinkedDefectsYesEnabled,
  isLinkedDefectsNoEnabled,
  releases,
  selectedReleases,
  onReleaseChange,
  enabledReleases,
}) => {
  const sidebarRef = useClickOutside(onClose);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="filter-sidebar" ref={sidebarRef}>
      <h3>Filter by Type</h3>
      <div className="filter-options">
        {types.map((type) => (
          <div key={type} className="filter-option">
            <input
              type="checkbox"
              id={`type-${type}`}
              value={type}
              checked={selectedTypes.includes(type)}
              onChange={() => onTypeChange(type)}
              disabled={!enabledTypes.includes(type) && !selectedTypes.includes(type)}
            />
            <label htmlFor={`type-${type}`}>{type}</label>
          </div>
        ))}
      </div>

      <h3>Linked Defects</h3>
      <div className="filter-options">
        <div className="filter-option">
          <input
            type="checkbox"
            id="defects-yes"
            checked={linkedDefectsFilter === 'yes'}
            onChange={() => onLinkedDefectsChange('yes')}
            disabled={!isLinkedDefectsYesEnabled || linkedDefectsFilter === 'no'}
          />
          <label htmlFor="defects-yes">Yes</label>
        </div>
        <div className="filter-option">
          <input
            type="checkbox"
            id="defects-no"
            checked={linkedDefectsFilter === 'no'}
            onChange={() => onLinkedDefectsChange('no')}
            disabled={!isLinkedDefectsNoEnabled || linkedDefectsFilter === 'yes'}
          />
          <label htmlFor="defects-no">No</label>
        </div>
      </div>

      {releases && releases.length > 0 && (
        <>
          <h3>Releases</h3>
          <div className="filter-options">
            {releases.map((release) => (
              <div key={release.id} className="filter-option">
                <input
                  type="checkbox"
                  id={`release-${release.id}`}
                  value={release.id}
                  checked={selectedReleases.includes(release.id)}
                  onChange={() => onReleaseChange(release.id)}
                  disabled={
                    releases.length === 1 ||
                    (!enabledReleases.includes(release.id) && !selectedReleases.includes(release.id))
                  }
                />
                <label htmlFor={`release-${release.id}`}>
                  {release.name} {release.is_current ? '(current)' : ''}
                </label>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default FilterSidebar;
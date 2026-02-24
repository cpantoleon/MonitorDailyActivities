import React from 'react';
import useClickOutside from '../hooks/useClickOutside';
import './FilterSidebar.css';

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
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  onClearFilters,
  fatDefectFilter,
  onFatDefectChange,
  isFatDefectYesEnabled,
  isFatDefectNoEnabled,
}) => {
  const sidebarRef = useClickOutside(onClose);

  return (
    <>
      {isOpen && (
        <div 
          className="filter-sidebar-overlay"
          onClick={onClose}
        />
      )}
      <div id="filter-sidebar-id" className={`filter-sidebar ${!isOpen ? 'closed' : ''}`} ref={sidebarRef} style={{ zIndex: 999 }}>
      {types && onTypeChange && (
        <>
          <h3 id="filter-by-type-heading-id">Filter by Type</h3>
          <div id="filter-options-type-id" className="filter-options">
            {types.map((type) => (
              <div key={type} id={`filter-option-type-${type.replace(/\s+/g, '-')}-id`} className="filter-option">
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
        </>
      )}

      {onLinkedDefectsChange && (
        <>
          <h3 id="linked-defects-heading-id">Linked Defects</h3>
          <div id="filter-options-defects-id" className="filter-options">
            <div id="filter-option-defects-yes-id" className="filter-option">
              <input
                type="checkbox"
                id="defects-yes"
                checked={linkedDefectsFilter === 'yes'}
                onChange={() => onLinkedDefectsChange('yes')}
                disabled={!isLinkedDefectsYesEnabled || linkedDefectsFilter === 'no'}
              />
              <label htmlFor="defects-yes">Yes</label>
            </div>
            <div id="filter-option-defects-no-id" className="filter-option">
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
        </>
      )}

      {releases && onReleaseChange && releases.length > 0 && (
        <div id="releases-filter-section-id">
          <h3 id="releases-heading-id">Releases</h3>
          <div id="filter-options-releases-id" className="filter-options">
            {releases.map((release) => (
              <div key={release.id} id={`filter-option-release-${release.id}-id`} className="filter-option">
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
        </div>
      )}

      {onFatDefectChange && (
        <>
          <h3 id="fat-defect-heading-id">FAT Defect</h3>
          <div id="filter-options-fat-defect-id" className="filter-options">
            <div id="filter-option-fat-defect-yes-id" className="filter-option">
              <input
                type="checkbox"
                id="fat-defect-yes"
                checked={fatDefectFilter === 'yes'}
                onChange={() => onFatDefectChange('yes')}
                disabled={!isFatDefectYesEnabled || fatDefectFilter === 'no'}
              />
              <label htmlFor="fat-defect-yes">Yes</label>
            </div>
            <div id="filter-option-fat-defect-no-id" className="filter-option">
              <input
                type="checkbox"
                id="fat-defect-no"
                checked={fatDefectFilter === 'no'}
                onChange={() => onFatDefectChange('no')}
                disabled={!isFatDefectNoEnabled || fatDefectFilter === 'yes'}
              />
              <label htmlFor="fat-defect-no">No</label>
            </div>
          </div>
        </>
      )}

      {(onDateFromChange || onDateToChange) && (
        <>
          <h3 id="filter-by-date-heading-id">Filter by Last Updated Date</h3>
          <div id="filter-options-date-id" className="filter-options">
            <div id="filter-option-date-from-id" className="filter-option">
              <label htmlFor="date-from">From</label>
              <input
                type="date"
                id="date-from"
                value={dateFrom}
                onChange={(e) => onDateFromChange(e.target.value)}
              />
            </div>
            <div id="filter-option-date-to-id" className="filter-option">
              <label htmlFor="date-to">To</label>
              <input
                type="date"
                id="date-to"
                value={dateTo}
                onChange={(e) => onDateToChange(e.target.value)}
              />
            </div>
          </div>
        </>
      )}

      <button id="clear-filters-button-id" onClick={onClearFilters} className="clear-filters-button">
        Clear Filters
      </button>
      <div id="filter-sidebar-spacer-id" style={{ height: '40px' }}></div>
    </div>
    </>
  );
};

export default FilterSidebar;
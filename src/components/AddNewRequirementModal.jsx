import React, { useState, useEffect, useMemo } from 'react';
import CustomDropdown from './CustomDropdown';
import Tooltip from './Tooltip';
import useClickOutside from '../hooks/useClickOutside';
import ConfirmationModal from './ConfirmationModal';
import SearchableDropdown from './SearchableDropdown';
import { useGlobal } from '../context/GlobalContext';

const AddNewRequirementModal = ({ isOpen, onClose, formData, onFormChange, onSubmit, projects, releases, allRequirements = [], selectedSprint }) => {
  const { isMultiReleaseMode } = useGlobal();
  const [initialFormData, setInitialFormData] = useState(null);
  const [isCloseConfirmOpen, setIsCloseConfirmOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('core');

  // Helper to display equivalent days and hours
  const formatTimeHelper = (val, unit) => {
    if (!val || isNaN(val) || val <= 0) return '';
    const totalHours = unit === 'd' ? parseFloat(val) * 8 : parseFloat(val);
    const d = Math.floor(totalHours / 8);
    const h = parseFloat((totalHours % 8).toFixed(2));

    if (d > 0 && h > 0) return `(${d}d ${h}h)`;
    if (d > 0) return `(${d}d)`;
    return `(${h}h)`;
  };

  useEffect(() => {
    if (isOpen) {
      setInitialFormData(formData);
      setActiveTab('core');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    if (initialFormData && formData.project !== initialFormData.project) {
      onFormChange({ target: { name: 'release_ids', value: [], type: 'multiselect' } });
    }
  }, [formData.project, initialFormData, onFormChange]);

  const hasUnsavedChanges = useMemo(() => {
    if (!initialFormData) return false;
    return JSON.stringify(formData) !== JSON.stringify(initialFormData);
  }, [formData, initialFormData]);

  const handleCloseRequest = () => {
    if (hasUnsavedChanges) {
      setIsCloseConfirmOpen(true);
    } else {
      onClose();
    }
  };

  const modalRef = useClickOutside(handleCloseRequest);

  const releaseOptions = useMemo(() => {
    if (!formData.project) return [];
    return releases
      .filter(r => r.project === formData.project)
      .map(r => ({
        value: r.id,
        label: `${r.name} ${r.is_current ? '(Current)' : ''}`
      }));
  }, [formData.project, releases]);

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!formData.project || !formData.project.trim()) {
      alert("Project is required.");
      setActiveTab('core');
      return;
    }
    if (!formData.requirementName || !formData.requirementName.trim()) {
      alert(formData.type === 'Sub-task' ? "Sub-task Name is required." : "Requirement Name is required.");
      setActiveTab('core');
      return;
    }
    if (!formData.type || !formData.type.trim()) {
      alert("Type is required.");
      setActiveTab('core');
      return;
    }
    if (formData.type === 'Sub-task' && !formData.parent_id) {
      alert("Parent Requirement is required for Sub-tasks.");
      setActiveTab('core');
      return;
    }

    if (activeTab === 'core') {
      setActiveTab('tracking');
      return;
    }

    onSubmit();
  };

  const parentOptions = useMemo(() => {
    if (!formData.project || !allRequirements) return [];

    const targetSprint = selectedSprint || 'Sprint 1';

    return allRequirements
      .filter(r => r.project === formData.project && r.currentStatusDetails?.sprint === targetSprint && !r.parentId)
      .map(r => ({ value: r.id, label: r.requirementUserIdentifier }));
  }, [formData.project, selectedSprint, allRequirements]);

  const handleReleaseTimeChange = (releaseId, field, value) => {
    const currentTracking = formData.release_time_tracking || {};
    const updatedTracking = {
      ...currentTracking,
      [releaseId]: {
        ...(currentTracking[releaseId] || { tc: '', test: '', tc_unit: 'h', test_unit: 'h' }),
        [field]: value
      }
    };
    onFormChange({ target: { name: 'release_time_tracking', value: updatedTracking, type: 'object' } });
  };

  if (!isOpen) return null;

  const projectOptions = projects.map(p => ({ value: p, label: p }));
  const statusOptions = ['To Do', 'Scenarios created', 'Under testing', 'Done'].map(s => ({ value: s, label: s }));
  const typeOptions = ['Change Request', 'Task', 'Bug', 'Story', 'Incident', 'Sub-task'].map(t => ({ value: t, label: t }));
  const sprintNumberOptions = Array.from({ length: 20 }, (_, i) => ({
    value: `${i + 1}`,
    label: `${i + 1}`
  }));

  const releaseTooltipContent = (
    <div id="release-tooltip-content-id">
      <strong>Assign to a Release</strong>
      <p>Associate this requirement with a release. The release marked '(Current)' is the one actively designated for the project.</p>
    </div>
  );

  const isOpenedFromCard = initialFormData ? !!initialFormData.parent_id : false;

  return (
    <div id="add-new-requirement-modal-wrapper-id">
      <div id="add-new-modal-overlay-id" className="add-new-modal-overlay">
        <div ref={modalRef} id="add-new-modal-content-id" className="add-new-modal-content">
          <h2>{isOpenedFromCard || formData.type === 'Sub-task' ? 'Add New Sub-task' : 'Add New Requirement'}</h2>

          <div className="modal-tabs">
            <button
              type="button"
              className={`modal-tab-button ${activeTab === 'core' ? 'active' : ''}`}
              onClick={() => setActiveTab('core')}
            >
              Core Details
            </button>
            <button
              type="button"
              className={`modal-tab-button ${activeTab === 'tracking' ? 'active' : ''}`}
              onClick={() => setActiveTab('tracking')}
            >
              Tracking & Links
            </button>
          </div>

          <form id="add-new-requirement-form-id" onSubmit={handleSubmit}>

            {/* TAB 1: CORE DETAILS */}
            <div style={{ display: activeTab === 'core' ? 'block' : 'none' }}>
              <div id="form-group-project-id" className="form-group">
                <label id="newReqProject-label" htmlFor="newReqProjectSelect-button">Project:</label>
                <CustomDropdown
                  id="newReqProjectSelect"
                  name="project"
                  value={formData.project}
                  onChange={onFormChange}
                  options={projectOptions}
                  disabled={projects.length === 0 || isOpenedFromCard}
                  placeholder={projects.length === 0 ? "-- No projects available --" : "-- Select a Project --"}
                />
              </div>
              <div id="form-group-requirement-name-id" className="form-group">
                <label htmlFor="newReqName">{isOpenedFromCard || formData.type === 'Sub-task' ? 'Sub-task Name:' : 'Requirement Name:'}</label>
                <input type="text" id="newReqName" name="requirementName" value={formData.requirementName} onChange={onFormChange} placeholder={isOpenedFromCard || formData.type === 'Sub-task' ? "e.g., Update database schema" : "e.g., User Login Feature TEST-INT-01"} />
              </div>

              {!isOpenedFromCard && (
                <div id="form-group-type-id" className="form-group">
                  <label id="newReqType-label" htmlFor="newReqType-button">Type:</label>
                  <CustomDropdown
                    id="newReqType"
                    name="type"
                    value={formData.type}
                    onChange={onFormChange}
                    options={typeOptions}
                    placeholder="-- Select Type --"
                  />
                </div>
              )}

              {!isOpenedFromCard && formData.type === 'Sub-task' && (
                <div id="form-group-parent-id" className="form-group">
                  <label id="newReqParent-label" htmlFor="newReqParentSelect-button">Parent Requirement:</label>
                  <SearchableDropdown
                    name="parent_id"
                    value={formData.parent_id || ''}
                    onChange={onFormChange}
                    options={parentOptions}
                    placeholder={parentOptions.length === 0 ? "-- No available parents in this sprint --" : "-- Select a Parent --"}
                  />
                </div>
              )}

              <div id="form-group-comment-id" className="form-group">
                <label htmlFor="newReqComment" className="optional-label">Comment:</label>
                <textarea id="newReqComment" name="comment" value={formData.comment} onChange={onFormChange} rows="3" placeholder="Initial comment (optional)" />
              </div>
            </div>

            {/* TAB 2: TRACKING & LINKS */}
            <div style={{ display: activeTab === 'tracking' ? 'block' : 'none' }}>
              <div id="form-group-status-id" className="form-group">
                <label id="newReqStatus-label" htmlFor="newReqStatus-button">Status:</label>
                <CustomDropdown
                  id="newReqStatus"
                  name="status"
                  value={formData.status}
                  onChange={onFormChange}
                  options={statusOptions}
                />
              </div>

              {!isOpenedFromCard && (
                <>
                  <div id="form-group-sprint-id" className="form-group">
                    <label id="newReqSprint-label" htmlFor="newReqSprint-button">Sprint:</label>
                    <CustomDropdown
                      id="newReqSprint"
                      name="sprint"
                      value={formData.sprint}
                      onChange={onFormChange}
                      options={sprintNumberOptions}
                      disabled={formData.isBacklog}
                    />
                  </div>
                  <div id="form-group-backlog-toggle-id" className="form-group new-project-toggle">
                    <input type="checkbox" id="isBacklogCheckbox" name="isBacklog" checked={formData.isBacklog} onChange={onFormChange} />
                    <label htmlFor="isBacklogCheckbox" className="checkbox-label optional-label">Assign to Backlog</label>
                  </div>
                </>
              )}

              {!isOpenedFromCard && formData.type !== 'Sub-task' && (
                <div id="form-group-release-id" className="form-group">
                  <div id="release-label-tooltip-container-id" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <label id="newReqRelease-label" htmlFor="newReqRelease" className="optional-label" style={{ marginBottom: 0 }}>Release(s):</label>
                    <Tooltip content={releaseTooltipContent} className="release" />
                  </div>

                  {isMultiReleaseMode ? (
                    <>
                      <select
                        multiple
                        id="newReqRelease"
                        name="release_ids"
                        value={formData.release_ids || []}
                        onChange={(e) => {
                          const values = Array.from(e.target.selectedOptions, option => parseInt(option.value, 10));
                          onFormChange({ target: { name: 'release_ids', value: values, type: 'multiselect' } });
                        }}
                        disabled={!formData.project || releaseOptions.length === 0}
                        style={{
                          width: '100%', height: '90px', padding: '6px', borderRadius: '6px',
                          border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)',
                          color: 'var(--text-primary)', fontFamily: 'inherit'
                        }}
                      >
                        {releaseOptions.map(opt => <option key={opt.value} value={opt.value} style={{ padding: '5px' }}>{opt.label}</option>)}
                      </select>
                      <small style={{ display: 'block', marginTop: '5px', color: 'var(--text-secondary)', fontSize: '0.85em' }}>Hold Ctrl/Cmd to select multiple releases.</small>
                    </>
                  ) : (
                    <CustomDropdown
                      id="newReqReleaseSingle"
                      name="release_ids"
                      value={formData.release_ids?.[0] || ''}
                      onChange={(e) => {
                        const val = e.target.value ? [parseInt(e.target.value, 10)] : [];
                        onFormChange({ target: { name: 'release_ids', value: val, type: 'multiselect' } });
                      }}
                      options={[{ value: '', label: '-- None --' }, ...releaseOptions]}
                      placeholder="-- Select a Release --"
                      disabled={!formData.project || releaseOptions.length === 0}
                    />
                  )}
                </div>
              )}

              <div id="form-group-tags-id" className="form-group">
                <label htmlFor="newReqTags" className="optional-label">Tags:</label>
                <input type="text" id="newReqTags" name="tags" value={formData.tags} onChange={onFormChange} placeholder="e.g., Sprint 4, Project Tools" />
              </div>

              <div id="form-group-link-id" className="form-group">
                <label htmlFor="newReqLink" className="optional-label">Link (e.g., JIRA):</label>
                <input type="url" id="newReqLink" name="link" value={formData.link} onChange={onFormChange} placeholder="https://example.com/issue/123" />
              </div>

              <fieldset style={{ border: '1px solid var(--border-color)', borderRadius: '6px', padding: '15px', marginTop: '10px' }}>
                <legend className="optional-label" style={{ padding: '0 5px', fontSize: '0.9em', color: 'var(--text-secondary)' }}>Time Tracking (Optional)</legend>

                <div style={{ marginBottom: '15px' }}>
                  <label style={{ fontSize: '0.85em' }}>
                    Total Expected Time
                    <span style={{ color: 'var(--accent-color)', fontWeight: 'bold', marginLeft: '6px' }}>
                      {formatTimeHelper(formData.expected_time, formData.expected_time_unit)}
                    </span>
                  </label>
                  <div style={{ display: 'flex', gap: '5px', maxWidth: '200px' }}>
                    <input type="number" name="expected_time" value={formData.expected_time} onChange={onFormChange} min="0" step="0.5" style={{ width: '60px', padding: '6px' }} />
                    <select name="expected_time_unit" value={formData.expected_time_unit} onChange={onFormChange} style={{ padding: '6px', flexGrow: 1 }}>
                      <option value="h">hours</option>
                      <option value="d">days</option>
                    </select>
                  </div>
                </div>

                {isMultiReleaseMode && formData.release_ids && formData.release_ids.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <label style={{ fontSize: '0.85em', fontWeight: 'bold', borderBottom: '1px solid var(--border-color)', paddingBottom: '5px' }}>Real Time Logged Per Release:</label>
                    {formData.release_ids.map(relId => {
                      const relName = releases.find(r => r.id === relId)?.name || `Release ${relId}`;
                      const relData = formData.release_time_tracking?.[relId] || { tc: '', test: '', tc_unit: 'h', test_unit: 'h' };

                      const tcDisplayVal = relData.tc_unit === 'd' && relData.tc !== '' ? relData.tc / 8 : relData.tc;
                      const testDisplayVal = relData.test_unit === 'd' && relData.test !== '' ? relData.test / 8 : relData.test;

                      return (
                        <div key={relId} style={{ backgroundColor: 'var(--bg-primary)', padding: '10px', borderRadius: '4px' }}>
                          <span style={{ fontSize: '0.85em', fontWeight: '600', display: 'block', marginBottom: '8px' }}>{relName}</span>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                            <div>
                              <label style={{ fontSize: '0.8em', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                                TC Creation
                                <span style={{ color: 'var(--accent-color)', fontWeight: 'bold', marginLeft: '5px' }}>
                                  {formatTimeHelper(tcDisplayVal, relData.tc_unit)}
                                </span>
                              </label>
                              <div style={{ display: 'flex', gap: '5px' }}>
                                <input
                                  type="number"
                                  value={tcDisplayVal}
                                  onChange={(e) => {
                                    const raw = e.target.value;
                                    const inHours = raw !== '' ? parseFloat(raw) * (relData.tc_unit === 'd' ? 8 : 1) : '';
                                    handleReleaseTimeChange(relId, 'tc', inHours);
                                  }}
                                  min="0" step="0.5"
                                  style={{ width: '60px', padding: '4px' }}
                                />
                                <select
                                  value={relData.tc_unit || 'h'}
                                  onChange={(e) => handleReleaseTimeChange(relId, 'tc_unit', e.target.value)}
                                  style={{ padding: '4px', flexGrow: 1 }}
                                >
                                  <option value="h">hours</option>
                                  <option value="d">days</option>
                                </select>
                              </div>
                            </div>
                            <div>
                              <label style={{ fontSize: '0.8em', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                                Testing
                                <span style={{ color: 'var(--accent-color)', fontWeight: 'bold', marginLeft: '5px' }}>
                                  {formatTimeHelper(testDisplayVal, relData.test_unit)}
                                </span>
                              </label>
                              <div style={{ display: 'flex', gap: '5px' }}>
                                <input
                                  type="number"
                                  value={testDisplayVal}
                                  onChange={(e) => {
                                    const raw = e.target.value;
                                    const inHours = raw !== '' ? parseFloat(raw) * (relData.test_unit === 'd' ? 8 : 1) : '';
                                    handleReleaseTimeChange(relId, 'test', inHours);
                                  }}
                                  min="0" step="0.5"
                                  style={{ width: '60px', padding: '4px' }}
                                />
                                <select
                                  value={relData.test_unit || 'h'}
                                  onChange={(e) => handleReleaseTimeChange(relId, 'test_unit', e.target.value)}
                                  style={{ padding: '4px', flexGrow: 1 }}
                                >
                                  <option value="h">hours</option>
                                  <option value="d">days</option>
                                </select>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                    <div>
                      <label style={{ fontSize: '0.85em' }}>
                        Real (Test Cases)
                        <span style={{ color: 'var(--accent-color)', fontWeight: 'bold', marginLeft: '5px' }}>
                          {formatTimeHelper(formData.real_time_tc_creation, formData.real_time_tc_creation_unit)}
                        </span>
                      </label>
                      <div style={{ display: 'flex', gap: '5px' }}>
                        <input type="number" name="real_time_tc_creation" value={formData.real_time_tc_creation} onChange={onFormChange} min="0" step="0.5" style={{ width: '60px', padding: '6px' }} />
                        <select name="real_time_tc_creation_unit" value={formData.real_time_tc_creation_unit} onChange={onFormChange} style={{ padding: '6px', flexGrow: 1 }}>
                          <option value="h">hours</option>
                          <option value="d">days</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label style={{ fontSize: '0.85em' }}>
                        Real (Testing)
                        <span style={{ color: 'var(--accent-color)', fontWeight: 'bold', marginLeft: '5px' }}>
                          {formatTimeHelper(formData.real_time_testing, formData.real_time_testing_unit)}
                        </span>
                      </label>
                      <div style={{ display: 'flex', gap: '5px' }}>
                        <input type="number" name="real_time_testing" value={formData.real_time_testing} onChange={onFormChange} min="0" step="0.5" style={{ width: '60px', padding: '6px' }} />
                        <select name="real_time_testing_unit" value={formData.real_time_testing_unit} onChange={onFormChange} style={{ padding: '6px', flexGrow: 1 }}>
                          <option value="h">hours</option>
                          <option value="d">days</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}
              </fieldset>
            </div>

            <div id="modal-actions-id" className="modal-actions">
              {activeTab === 'tracking' && (
                <button
                  type="button"
                  onClick={() => setActiveTab('core')}
                  className="modal-button-cancel"
                  style={{ marginRight: 'auto' }}
                >
                  Back
                </button>
              )}
              <button type="button" onClick={onClose} className="modal-button-cancel">Cancel</button>

              <button type="submit" className="modal-button-save">
                {activeTab === 'core' ? 'Next: Tracking & Links' : (isOpenedFromCard || formData.type === 'Sub-task' ? 'Add Sub-task' : 'Add Requirement')}
              </button>
            </div>
          </form>
        </div>
      </div>
      <ConfirmationModal
        isOpen={isCloseConfirmOpen}
        onClose={() => setIsCloseConfirmOpen(false)}
        onConfirm={() => {
          setIsCloseConfirmOpen(false);
          onClose();
        }}
        title="Unsaved Changes"
        message="You have unsaved changes. Are you sure you want to close?"
      />
    </div>
  );
};

export default AddNewRequirementModal;
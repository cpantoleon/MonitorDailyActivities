import React, { useState, useEffect, useMemo } from 'react';
import CustomDropdown from './CustomDropdown';
import Tooltip from './Tooltip';
import useClickOutside from '../hooks/useClickOutside';
import ConfirmationModal from './ConfirmationModal';
import SearchableDropdown from './SearchableDropdown';
import { useGlobal } from '../context/GlobalContext';

const EditRequirementModal = ({ isOpen, onClose, onSave, requirement, releases, onLogChange, showMessage, allRequirements = [], selectedSprint }) => {
  const { isMultiReleaseMode } = useGlobal();
  const [formData, setFormData] = useState({});
  const [initialFormData, setInitialFormData] = useState(null);
  const [isCloseConfirmOpen, setIsCloseConfirmOpen] = useState(false);
  const [changeReason, setChangeReason] = useState('');
  const [isLogChangeVisible, setIsLogChangeVisible] = useState(false);
  const [acknowledgeDefects, setAcknowledgeDefects] = useState(false);
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

  const openDefects = useMemo(() => {
    if (!requirement || formData.status !== 'Done') return [];
    return requirement.linkedDefects?.filter(
      (defect) => defect.status === 'Assigned to Developer' || defect.status === 'Assigned to Tester'
    ) || [];
  }, [requirement, formData.status]);

  const parseTimeToObj = (hours) => {
    if (hours === null || hours === undefined || hours === '') return { val: '', unit: 'h' };
    const h = parseFloat(hours);
    if (h > 0 && h % 8 === 0) return { val: h / 8, unit: 'd' };
    return { val: h, unit: 'h' };
  };

  useEffect(() => {
    if (requirement && isOpen) {
      const currentSprint = requirement.currentStatusDetails?.sprint || '';
      const isBacklog = currentSprint === 'Backlog';
      let sprintNumber = '1';

      if (!isBacklog && currentSprint.startsWith('Sprint ')) {
        sprintNumber = currentSprint.split(' ')[1] || '1';
      }

      const exp = parseTimeToObj(requirement.currentStatusDetails?.expected_time);
      const rTc = parseTimeToObj(requirement.currentStatusDetails?.real_time_tc_creation);
      const rTest = parseTimeToObj(requirement.currentStatusDetails?.real_time_testing);

      const initialData = {
        name: requirement.requirementUserIdentifier || '',
        comment: requirement.currentStatusDetails?.comment || '',
        sprint: sprintNumber,
        status: requirement.currentStatusDetails?.status || '',
        link: requirement.currentStatusDetails?.link || '',
        isBacklog: isBacklog,
        type: requirement.currentStatusDetails?.type || '',
        tags: requirement.currentStatusDetails?.tags || '',
        release_ids: requirement.currentStatusDetails?.releaseIds || [],
        parent_id: requirement.parentId || '',
        expected_time: exp.val, expected_time_unit: exp.unit,
        real_time_tc_creation: rTc.val, real_time_tc_creation_unit: rTc.unit,
        real_time_testing: rTest.val, real_time_testing_unit: rTest.unit,
        release_time_tracking: requirement.currentStatusDetails?.release_time_tracking || {}
      };
      setFormData(initialData);
      setInitialFormData(initialData);
      setChangeReason('');
      setIsLogChangeVisible(false);
      setAcknowledgeDefects(false);
      setActiveTab('core');
    }
  }, [requirement, isOpen]);

  const hasUnsavedChanges = useMemo(() => {
    if (!initialFormData) return false;
    return JSON.stringify(formData) !== JSON.stringify(initialFormData) || changeReason.trim() !== '';
  }, [formData, initialFormData, changeReason]);

  const handleCloseRequest = () => {
    if (hasUnsavedChanges) {
      setIsCloseConfirmOpen(true);
    } else {
      onClose();
    }
  };

  const modalRef = useClickOutside(handleCloseRequest);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const val = type === 'checkbox' ? checked : value;
    setFormData(prev => ({ ...prev, [name]: val }));
  };

  const handleReleaseTimeChange = (releaseId, field, value) => {
    setFormData(prev => ({
      ...prev,
      release_time_tracking: {
        ...prev.release_time_tracking,
        [releaseId]: {
          ...(prev.release_time_tracking?.[releaseId] || { tc: '', test: '' }),
          [field]: value
        }
      }
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (activeTab === 'core') {
      setActiveTab('tracking');
      return;
    }

    if (formData.type === 'Sub-task' && !formData.parent_id) {
      alert("Parent Requirement is required for Sub-tasks.");
      setActiveTab('core');
      return;
    }

    if (openDefects.length > 0 && !acknowledgeDefects) {
      showMessage('Please acknowledge the open defects before proceeding.', 'error');
      return;
    }

    const calcH = (v, u) => (v !== '' && v !== null && !isNaN(v) ? parseFloat(v) * (u === 'd' ? 8 : 1) : null);

    const finalPayload = {
      ...formData,
      expected_time: calcH(formData.expected_time, formData.expected_time_unit),
      real_time_tc_creation: calcH(formData.real_time_tc_creation, formData.real_time_tc_creation_unit),
      real_time_testing: calcH(formData.real_time_testing, formData.real_time_testing_unit),
      release_time_tracking: formData.release_time_tracking || {}
    };

    onSave(finalPayload);
  };

  const handleLogChangeClick = async () => {
    if (!changeReason.trim()) {
      alert("Please provide a reason for the scope change.");
      return;
    }
    const success = await onLogChange(requirement.id, changeReason);
    if (success) {
      onClose();
    }
  };

  const handleResetLegacyTime = () => {
    setFormData(prev => ({
      ...prev,
      real_time_tc_creation: '',
      real_time_testing: ''
    }));
  };

  const parentOptions = useMemo(() => {
    if (!requirement || !requirement.project || !allRequirements) return [];
    const targetSprint = selectedSprint || 'Sprint 1';
    return allRequirements
      .filter(r => r.project === requirement.project && r.currentStatusDetails?.sprint === targetSprint && !r.parentId && r.id !== requirement.id)
      .map(r => ({ value: r.id, label: r.requirementUserIdentifier }));
  }, [requirement?.project, requirement?.id, selectedSprint, allRequirements]);

  if (!isOpen || !requirement) return null;

  const sprintNumberOptions = Array.from({ length: 20 }, (_, i) => ({ value: `${i + 1}`, label: `${i + 1}` }));
  const statusOptions = ['To Do', 'Scenarios created', 'Under testing', 'Done'].map(s => ({ value: s, label: s }));
  const typeOptions = ['Change Request', 'Task', 'Bug', 'Story', 'Incident', 'Sub-task'].map(t => ({ value: t, label: t }));
  const releaseOptions = [
    { value: '', label: '-- None (Clear Release) --' },
    ...releases.map(r => ({ value: r.id, label: `${r.name} ${r.is_current ? '(Current)' : ''}` }))
  ];

  const releaseTooltipContent = (
    <div>
      <strong>Assign to a Release</strong>
      <p>Associate this requirement with a release. The release marked '(Current)' is the one actively designated for the project.</p>
    </div>
  );

  const isOriginallySubtask = !!requirement.parentId;

  return (
    <div className="add-new-modal-overlay">
      <div ref={modalRef} className="add-new-modal-content">
        <h2>Edit Requirement</h2>

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

        <form onSubmit={handleSubmit}>

          {/* TAB 1: CORE DETAILS */}
          <div style={{ display: activeTab === 'core' ? 'block' : 'none' }}>
            <div className="form-group">
              <label htmlFor="editReqName">Requirement Name:</label>
              <input type="text" id="editReqName" name="name" value={formData.name || ''} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label className="optional-label">Type:</label>
              <CustomDropdown name="type" value={formData.type} onChange={handleChange} options={typeOptions} placeholder="-- Select Type --" />
            </div>

            {formData.type === 'Sub-task' && (
              <div className="form-group">
                <label>Parent Requirement:</label>
                <SearchableDropdown
                  name="parent_id"
                  value={formData.parent_id || ''}
                  onChange={handleChange}
                  options={parentOptions}
                  placeholder={parentOptions.length === 0 ? "-- No available parents in this sprint --" : "-- Select a Parent --"}
                />
              </div>
            )}

            <div className="form-group">
              <label htmlFor="editReqComment" className="optional-label">Current Comment:</label>
              <textarea id="editReqComment" name="comment" value={formData.comment || ''} onChange={handleChange} rows="3" placeholder="Enter a comment for the current status" />
            </div>
          </div>

          {/* TAB 2: TRACKING & LINKS */}
          <div style={{ display: activeTab === 'tracking' ? 'block' : 'none' }}>
            <div className="form-group">
              <label>Status:</label>
              <CustomDropdown name="status" value={formData.status} onChange={handleChange} options={statusOptions} />
            </div>

            {openDefects.length > 0 && (
              <div className="warning-box" style={{ marginBottom: '15px' }}>
                <p className="warning-text">
                  <strong>Warning:</strong> This item has {openDefects.length} open defect(s).
                </p>
                <div className="new-project-toggle" style={{ marginBottom: 0 }}>
                  <input
                    type="checkbox"
                    id="editAcknowledgeDefectsCheckbox"
                    checked={acknowledgeDefects}
                    onChange={(e) => setAcknowledgeDefects(e.target.checked)}
                  />
                  <label htmlFor="editAcknowledgeDefectsCheckbox" className="checkbox-label" style={{ fontSize: '0.9em' }}>
                    I acknowledge the open defect(s) and want to proceed.
                  </label>
                </div>
              </div>
            )}

            {!isOriginallySubtask && (
              <>
                <div className="form-group">
                  <label>Sprint:</label>
                  <CustomDropdown name="sprint" value={formData.sprint} onChange={handleChange} options={sprintNumberOptions} disabled={formData.isBacklog} />
                </div>
                <div className="form-group new-project-toggle">
                  <input type="checkbox" id="isBacklogCheckboxEdit" name="isBacklog" checked={formData.isBacklog || false} onChange={handleChange} />
                  <label htmlFor="isBacklogCheckboxEdit" className="checkbox-label optional-label">Assign to Backlog</label>
                </div>
              </>
            )}

            {!isOriginallySubtask && formData.type !== 'Sub-task' && (
              <div className="form-group">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <label className="optional-label" style={{ marginBottom: 0 }}>Release(s):</label>
                  <Tooltip content={releaseTooltipContent} className="release" />
                </div>

                {isMultiReleaseMode ? (
                  <>
                    <select
                      multiple
                      name="release_ids"
                      value={formData.release_ids || []}
                      onChange={(e) => {
                        const values = Array.from(e.target.selectedOptions, option => parseInt(option.value, 10));
                        handleChange({ target: { name: 'release_ids', value: values, type: 'multiselect' } });
                      }}
                      disabled={releases.length === 0}
                      style={{
                        width: '100%',
                        height: '90px',
                        padding: '6px',
                        borderRadius: '6px',
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'var(--bg-secondary)',
                        color: 'var(--text-primary)',
                        fontFamily: 'inherit'
                      }}
                    >
                      {releases.map(opt => <option key={opt.id} value={opt.id} style={{ padding: '5px' }}>{opt.name} {opt.is_current ? '(Current)' : ''}</option>)}
                    </select>
                    <small style={{ display: 'block', marginTop: '5px', color: 'var(--text-secondary)', fontSize: '0.85em' }}>Hold Ctrl/Cmd to select multiple releases.</small>
                  </>
                ) : (
                  <CustomDropdown
                    id="editReqReleaseSingle"
                    name="release_ids"
                    value={formData.release_ids?.[0] || ''}
                    onChange={(e) => {
                      const val = e.target.value ? [parseInt(e.target.value, 10)] : [];
                      handleChange({ target: { name: 'release_ids', value: val, type: 'multiselect' } });
                    }}
                    options={releaseOptions}
                    placeholder="-- Select a Release --"
                    disabled={releases.length === 0}
                  />
                )}
              </div>
            )}

            <div className="form-group">
              <label htmlFor="editReqTags" className="optional-label">Tags:</label>
              <input type="text" id="editReqTags" name="tags" value={formData.tags || ''} onChange={handleChange} placeholder="e.g., Sprint 4, PreA Tools" />
            </div>

            <div className="form-group">
              <label htmlFor="editReqLink" className="optional-label">Link (e.g., JIRA):</label>
              <input type="url" id="editReqLink" name="link" value={formData.link || ''} onChange={handleChange} placeholder="https://example.com/issue/123" />
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
                  <input type="number" name="expected_time" value={formData.expected_time || ''} onChange={handleChange} min="0" step="0.5" style={{ width: '60px', padding: '6px' }} />
                  <select name="expected_time_unit" value={formData.expected_time_unit || 'h'} onChange={handleChange} style={{ padding: '6px', flexGrow: 1 }}>
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

                  {(formData.real_time_tc_creation || formData.real_time_testing) && (
                    <div style={{
                      marginTop: '8px', padding: '12px',
                      backgroundColor: 'var(--warning-bg)',
                      borderRadius: '6px',
                      border: '1px solid var(--warning-border)'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <span style={{ fontSize: '0.85em', fontWeight: '600', color: 'var(--warning-text)' }}>
                          ⚠️ Legacy time data (before multi-release mode)
                        </span>
                        <button
                          type="button"
                          onClick={handleResetLegacyTime}
                          style={{
                            fontSize: '0.75em', padding: '3px 8px',
                            backgroundColor: 'transparent',
                            border: '1px solid var(--warning-text)',
                            color: 'var(--warning-text)',
                            borderRadius: '4px', cursor: 'pointer'
                          }}
                        >
                          Reset Legacy
                        </button>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <div>
                          <label style={{ fontSize: '0.8em', color: 'var(--warning-text)' }}>TC Creation (h)</label>
                          <div style={{ display: 'flex', gap: '5px' }}>
                            <input
                              type="number"
                              name="real_time_tc_creation"
                              value={formData.real_time_tc_creation || ''}
                              onChange={handleChange}
                              min="0" step="0.5"
                              style={{ width: '60px', padding: '4px', backgroundColor: 'var(--bg-secondary)' }}
                            />
                            <select name="real_time_tc_creation_unit" value={formData.real_time_tc_creation_unit || 'h'} onChange={handleChange} style={{ padding: '4px', flexGrow: 1, backgroundColor: 'var(--bg-secondary)' }}>
                              <option value="h">hours</option>
                              <option value="d">days</option>
                            </select>
                          </div>
                        </div>
                        <div>
                          <label style={{ fontSize: '0.8em', color: 'var(--warning-text)' }}>Testing (h)</label>
                          <div style={{ display: 'flex', gap: '5px' }}>
                            <input
                              type="number"
                              name="real_time_testing"
                              value={formData.real_time_testing || ''}
                              onChange={handleChange}
                              min="0" step="0.5"
                              style={{ width: '60px', padding: '4px', backgroundColor: 'var(--bg-secondary)' }}
                            />
                            <select name="real_time_testing_unit" value={formData.real_time_testing_unit || 'h'} onChange={handleChange} style={{ padding: '4px', flexGrow: 1, backgroundColor: 'var(--bg-secondary)' }}>
                              <option value="h">hours</option>
                              <option value="d">days</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
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
                      <input type="number" name="real_time_tc_creation" value={formData.real_time_tc_creation || ''} onChange={handleChange} min="0" step="0.5" style={{ width: '60px', padding: '6px' }} />
                      <select name="real_time_tc_creation_unit" value={formData.real_time_tc_creation_unit || 'h'} onChange={handleChange} style={{ padding: '6px', flexGrow: 1 }}>
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
                      <input type="number" name="real_time_testing" value={formData.real_time_testing || ''} onChange={handleChange} min="0" step="0.5" style={{ width: '60px', padding: '6px' }} />
                      <select name="real_time_testing_unit" value={formData.real_time_testing_unit || 'h'} onChange={handleChange} style={{ padding: '6px', flexGrow: 1 }}>
                        <option value="h">hours</option>
                        <option value="d">days</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </fieldset>
          </div>

          <div className="modal-actions">
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
              {activeTab === 'core' ? 'Next: Tracking & Links' : 'Save Changes'}
            </button>
          </div>
        </form>

        {!isOriginallySubtask && formData.type !== 'Sub-task' && (
          <div style={{ marginTop: '30px', borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 className="modal-section-title" style={{ borderBottom: 'none', margin: 0, paddingBottom: 0 }}>Log Scope Change</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Tooltip content="Click to show/hide the section for logging a scope change. This is for tracking significant changes made during a sprint." />
                <button type="button" onClick={() => setIsLogChangeVisible(p => !p)} className="modal-button-cancel" style={{ padding: '5px 15px', fontSize: '0.85em' }}>
                  {isLogChangeVisible ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>
            {isLogChangeVisible && (
              <div style={{ marginTop: '15px' }}>
                <p className="modal-section-desc">
                  Use this section to record a significant change in the requirement's scope. This log is separate from saving the form above.
                </p>
                <div className="form-group">
                  <label htmlFor="changeReason" className="optional-label">Reason for Change:</label>
                  <textarea
                    id="changeReason"
                    name="changeReason"
                    value={changeReason}
                    onChange={(e) => setChangeReason(e.target.value)}
                    rows="3"
                    placeholder="e.g., Added new validation rule for user input."
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={handleLogChangeClick}
                    className="modal-button-save"
                    disabled={!changeReason.trim()}
                  >
                    Log Change
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
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

export default EditRequirementModal;
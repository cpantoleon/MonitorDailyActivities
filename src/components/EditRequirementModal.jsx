import React, { useState, useEffect, useMemo } from 'react';
import CustomDropdown from './CustomDropdown';
import Tooltip from './Tooltip';
import useClickOutside from '../hooks/useClickOutside';
import ConfirmationModal from './ConfirmationModal';

const EditRequirementModal = ({ isOpen, onClose, onSave, requirement, releases, onLogChange, showMessage }) => {
  const [formData, setFormData] = useState({});
  const [initialFormData, setInitialFormData] = useState(null);
  const [isCloseConfirmOpen, setIsCloseConfirmOpen] = useState(false);
  const [changeReason, setChangeReason] = useState('');
  const [isLogChangeVisible, setIsLogChangeVisible] = useState(false);
  const [acknowledgeDefects, setAcknowledgeDefects] = useState(false);

  const openDefects = useMemo(() => {
    if (!requirement || formData.status !== 'Done') return [];
    return requirement.linkedDefects?.filter(
      (defect) => defect.status === 'Assigned to Developer' || defect.status === 'Assigned to Tester'
    ) || [];
  }, [requirement, formData.status]);


  useEffect(() => {
    if (requirement && isOpen) {
      const currentSprint = requirement.currentStatusDetails?.sprint || '';
      const isBacklog = currentSprint === 'Backlog';
      let sprintNumber = '1';

      if (!isBacklog && currentSprint.startsWith('Sprint ')) {
        sprintNumber = currentSprint.split(' ')[1] || '1';
      }

      const initialData = {
        name: requirement.requirementUserIdentifier || '',
        comment: requirement.currentStatusDetails?.comment || '',
        sprint: sprintNumber,
        status: requirement.currentStatusDetails?.status || '',
        link: requirement.currentStatusDetails?.link || '',
        isBacklog: isBacklog,
        type: requirement.currentStatusDetails?.type || '',
        tags: requirement.currentStatusDetails?.tags || '',
        release_id: requirement.currentStatusDetails?.releaseId || '',
      };
      setFormData(initialData);
      setInitialFormData(initialData);
      setChangeReason('');
      setIsLogChangeVisible(false);
      setAcknowledgeDefects(false); 
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

  const handleSubmit = (e) => {
    e.preventDefault();
    if (openDefects.length > 0 && !acknowledgeDefects) {
      showMessage('Please acknowledge the open defects before proceeding.', 'error');
      return;
    }
    onSave(formData);
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

  if (!isOpen || !requirement) return null;

  const sprintNumberOptions = Array.from({ length: 20 }, (_, i) => ({ value: `${i + 1}`, label: `${i + 1}` }));
  const statusOptions = ['To Do', 'Scenarios created', 'Under testing', 'Done'].map(s => ({ value: s, label: s }));
  const typeOptions = ['Change Request', 'Task', 'Bug', 'Story', 'Incident'].map(t => ({ value: t, label: t }));
  const releaseOptions = releases.map(r => ({ value: r.id, label: `${r.name} ${r.is_current ? '(Current)' : ''}` }));

  const releaseTooltipContent = (
    <div id="release-tooltip-content-edit-req-id">
      <strong>Assign to a Release</strong>
      <p>Associate this requirement with a release. The release marked '(Current)' is the one actively designated for the project.</p>
    </div>
  );

  return (
    <div id="edit-requirement-modal-wrapper-id">
      <div id="edit-req-modal-overlay-id" className="add-new-modal-overlay">
        <div ref={modalRef} id="edit-req-modal-content-id" className="add-new-modal-content" style={{maxWidth: '600px'}}>
          <h2>Edit Requirement</h2>
          <form id="edit-req-form-id" onSubmit={handleSubmit}>
            <div id="form-group-name-id" className="form-group">
              <label htmlFor="editReqName">Requirement Name:</label>
              <input type="text" id="editReqName" name="name" value={formData.name || ''} onChange={handleChange} required />
            </div>
            <div id="form-group-type-id" className="form-group">
              <label id="editReqType-label" htmlFor="editReqType-button" className="optional-label">Type:</label>
              <CustomDropdown
                id="editReqType"
                name="type"
                value={formData.type}
                onChange={handleChange}
                options={typeOptions}
                placeholder="-- Select Type --"
              />
            </div>
            <div id="form-group-comment-id" className="form-group">
              <label htmlFor="editReqComment" className="optional-label">Current Comment:</label>
              <textarea id="editReqComment" name="comment" value={formData.comment || ''} onChange={handleChange} rows="4" placeholder="Enter a comment for the current status" />
            </div>
            <div id="form-group-sprint-id" className="form-group">
              <label id="editReqSprint-label" htmlFor="editReqSprint-button">Sprint:</label>
              <CustomDropdown
                id="editReqSprint"
                name="sprint"
                value={formData.sprint}
                onChange={handleChange}
                options={sprintNumberOptions}
                disabled={formData.isBacklog}
              />
            </div>
            <div id="form-group-backlog-toggle-id" className="form-group new-project-toggle">
              <input type="checkbox" id="isBacklogCheckboxEdit" name="isBacklog" checked={formData.isBacklog || false} onChange={handleChange} />
              <label htmlFor="isBacklogCheckboxEdit" className="checkbox-label optional-label">Assign to Backlog</label>
            </div>
            <div id="form-group-status-id" className="form-group">
              <label id="editReqStatus-label" htmlFor="editReqStatus-button">Status:</label>
              <CustomDropdown
                id="editReqStatus"
                name="status"
                value={formData.status}
                onChange={handleChange}
                options={statusOptions}
              />
            </div>

            {openDefects.length > 0 && (
              <div id="open-defects-warning-container-id" className="form-group" style={{ marginTop: '15px', backgroundColor: '#FFF8DC', padding: '10px', borderRadius: '4px' }}>
                <p id="open-defects-warning-text-id" style={{ marginTop: 0, color: '#8B4513', fontSize: '0.9em' }}>
                  <strong>Warning:</strong> This item has {openDefects.length} open defect(s).
                </p>
                <div id="acknowledge-defects-toggle-id" className="new-project-toggle">
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

            <div id="form-group-release-id" className="form-group">
              <div id="release-label-tooltip-container-id" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <label id="editReqRelease-label" htmlFor="editReqRelease-button" className="optional-label" style={{marginBottom: 0}}>Release:</label>
                <Tooltip content={releaseTooltipContent} className="release" />
              </div>
              <CustomDropdown
                id="editReqRelease"
                name="release_id"
                value={formData.release_id}
                onChange={handleChange}
                options={releaseOptions}
                disabled={releases.length === 0}
                placeholder={releases.length === 0 ? "-- No releases for this project --" : "-- Select a Release --"}
              />
            </div>
            <div id="form-group-tags-id" className="form-group">
              <label htmlFor="editReqTags" className="optional-label">Tags:</label>
              <input type="text" id="editReqTags" name="tags" value={formData.tags || ''} onChange={handleChange} placeholder="e.g., Sprint 4, PreA Tools" />
            </div>
            <div id="form-group-link-id" className="form-group">
              <label htmlFor="editReqLink" className="optional-label">Link (e.g., JIRA):</label>
              <input type="url" id="editReqLink" name="link" value={formData.link || ''} onChange={handleChange} placeholder="https://example.com/issue/123" />
            </div>
            <div id="edit-req-modal-actions-id" className="modal-actions">
              <button 
                type="submit" 
                className="modal-button-save"
              >
                Save Changes
              </button>
              <button type="button" onClick={onClose} className="modal-button-cancel">Cancel</button>
            </div>
          </form>

          <div id="log-scope-change-section-id" style={{ borderTop: '2px solid #D2B48C', marginTop: '25px', paddingTop: '20px' }}>
            <div id="log-scope-change-header-id" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h3 id="log-scope-change-title-id" style={{ margin: 0, color: '#5C4033', fontSize: '1.2em' }}>Log Scope Change</h3>
                <div id="log-scope-change-controls-id" style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                     <Tooltip content="Click to show/hide the section for logging a scope change. This is for tracking significant changes made during a sprint." />
                     <button id="toggle-log-scope-change-button-id" type="button" onClick={() => setIsLogChangeVisible(p => !p)} className="modal-button-cancel" style={{padding: '5px 15px'}}>
                         {isLogChangeVisible ? 'Hide' : 'Show'}
                     </button>
                </div>
            </div>
            {isLogChangeVisible && (
              <div id="log-scope-change-content-id">
                <p id="log-scope-change-description-id" style={{fontSize: '0.9em', color: '#704214', marginTop: 0, marginBottom: '15px'}}>
                  Use this section to record a significant change in the requirement's scope during the sprint. This action is logged separately from saving other edits.
                </p>
                <div id="form-group-change-reason-id" className="form-group">
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
                <div id="log-change-button-container-id" style={{display: 'flex', justifyContent: 'flex-end'}}>
                    <button 
                        id="log-change-button-id"
                        type="button" 
                        onClick={handleLogChangeClick} 
                        className="modal-button-save"
                        style={{backgroundColor: '#A0522D'}}
                        disabled={!changeReason.trim()}
                    >
                        Log Change
                    </button>
                </div>
              </div>
            )}
          </div>

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

export default EditRequirementModal;
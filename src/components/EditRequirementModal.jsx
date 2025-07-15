import React, { useState, useEffect, useMemo } from 'react';
import CustomDropdown from './CustomDropdown'; // Use the new component
import Tooltip from './Tooltip';
import useClickOutside from '../hooks/useClickOutside';
import ConfirmationModal from './ConfirmationModal';

const EditRequirementModal = ({ isOpen, onClose, onSave, requirement, releases, onLogChange }) => {
  const [formData, setFormData] = useState({});
  const [initialFormData, setInitialFormData] = useState(null);
  const [isCloseConfirmOpen, setIsCloseConfirmOpen] = useState(false);
  const [changeReason, setChangeReason] = useState('');
  const [isLogChangeVisible, setIsLogChangeVisible] = useState(false);

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
  const typeOptions = ['Change Request', 'Task', 'Bug', 'Story'].map(t => ({ value: t, label: t }));
  const releaseOptions = releases.map(r => ({ value: r.id, label: `${r.name} ${r.is_current ? '(Current)' : ''}` }));

  const releaseTooltipContent = (
    <>
      <strong>Assign to a Release</strong>
      <p>Associate this requirement with a release. The release marked '(Current)' is the one actively designated for the project.</p>
    </>
  );

  return (
    <>
      <div className="add-new-modal-overlay">
        <div ref={modalRef} className="add-new-modal-content" style={{maxWidth: '600px'}}>
          <h2>Edit Requirement</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="editReqName">Requirement Name:</label>
              <input type="text" id="editReqName" name="name" value={formData.name || ''} onChange={handleChange} required />
            </div>
            <div className="form-group">
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
            <div className="form-group">
              <label htmlFor="editReqComment" className="optional-label">Current Comment:</label>
              <textarea id="editReqComment" name="comment" value={formData.comment || ''} onChange={handleChange} rows="4" placeholder="Enter a comment for the current status" />
            </div>
            <div className="form-group">
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
            <div className="form-group new-project-toggle">
              <input type="checkbox" id="isBacklogCheckboxEdit" name="isBacklog" checked={formData.isBacklog || false} onChange={handleChange} />
              <label htmlFor="isBacklogCheckboxEdit" className="checkbox-label optional-label">Assign to Backlog</label>
            </div>
            <div className="form-group">
              <label id="editReqStatus-label" htmlFor="editReqStatus-button">Status:</label>
              <CustomDropdown
                id="editReqStatus"
                name="status"
                value={formData.status}
                onChange={handleChange}
                options={statusOptions}
              />
            </div>
            <div className="form-group">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
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
            <div className="form-group">
              <label htmlFor="editReqTags" className="optional-label">Tags:</label>
              <input type="text" id="editReqTags" name="tags" value={formData.tags || ''} onChange={handleChange} placeholder="e.g., Sprint 4, PreA Tools" />
            </div>
            <div className="form-group">
              <label htmlFor="editReqLink" className="optional-label">Link (e.g., JIRA):</label>
              <input type="url" id="editReqLink" name="link" value={formData.link || ''} onChange={handleChange} placeholder="https://example.com/issue/123" />
            </div>
            <div className="modal-actions">
              <button type="submit" className="modal-button-save">Save Changes</button>
              <button type="button" onClick={onClose} className="modal-button-cancel">Cancel</button>
            </div>
          </form>

          <div style={{ borderTop: '2px solid #D2B48C', marginTop: '25px', paddingTop: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h3 style={{ margin: 0, color: '#5C4033', fontSize: '1.2em' }}>Log Scope Change</h3>
                <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                     <Tooltip content="Click to show/hide the section for logging a scope change. This is for tracking significant changes made during a sprint." />
                     <button type="button" onClick={() => setIsLogChangeVisible(p => !p)} className="modal-button-cancel" style={{padding: '5px 15px'}}>
                         {isLogChangeVisible ? 'Hide' : 'Show'}
                     </button>
                </div>
            </div>
            {isLogChangeVisible && (
              <>
                <p style={{fontSize: '0.9em', color: '#704214', marginTop: 0, marginBottom: '15px'}}>
                  Use this section to record a significant change in the requirement's scope during the sprint. This action is logged separately from saving other edits.
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
                <div style={{display: 'flex', justifyContent: 'flex-end'}}>
                    <button 
                        type="button" 
                        onClick={handleLogChangeClick} 
                        className="modal-button-save"
                        style={{backgroundColor: '#A0522D'}}
                        disabled={!changeReason.trim()}
                    >
                        Log Change
                    </button>
                </div>
              </>
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
    </>
  );
};

export default EditRequirementModal;
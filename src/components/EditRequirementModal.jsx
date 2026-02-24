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
  const [activeTab, setActiveTab] = useState('core'); // 'core' or 'tracking'

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
      setActiveTab('core'); // Reset to first tab
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

    // If on Core tab, just go to Tracking
    if (activeTab === 'core') {
      setActiveTab('tracking');
      return;
    }

    // If on Tracking tab, perform validation and save
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
    <div>
      <strong>Assign to a Release</strong>
      <p>Associate this requirement with a release. The release marked '(Current)' is the one actively designated for the project.</p>
    </div>
  );

  return (
    <div className="add-new-modal-overlay">
      <div ref={modalRef} className="add-new-modal-content">
        <h2>Edit Requirement</h2>

        {/* TAB NAVIGATION */}
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

            {/* DEFECT WARNING (Only shown in Tracking Tab) */}
            {openDefects.length > 0 && (
              <div className="warning-box" style={{marginBottom: '15px'}}>
                <p className="warning-text">
                  <strong>Warning:</strong> This item has {openDefects.length} open defect(s).
                </p>
                <div className="new-project-toggle" style={{marginBottom: 0}}>
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

            <div className="form-group">
              <label>Sprint:</label>
              <CustomDropdown name="sprint" value={formData.sprint} onChange={handleChange} options={sprintNumberOptions} disabled={formData.isBacklog} />
            </div>
            <div className="form-group new-project-toggle">
              <input type="checkbox" id="isBacklogCheckboxEdit" name="isBacklog" checked={formData.isBacklog || false} onChange={handleChange} />
              <label htmlFor="isBacklogCheckboxEdit" className="checkbox-label optional-label">Assign to Backlog</label>
            </div>

            <div className="form-group">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <label className="optional-label" style={{marginBottom: 0}}>Release:</label>
                <Tooltip content={releaseTooltipContent} className="release" />
              </div>
              <CustomDropdown
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
          </div>

          <div className="modal-actions">
            {activeTab === 'tracking' && (
               <button 
                  type="button" 
                  onClick={() => setActiveTab('core')} 
                  className="modal-button-cancel" 
                  style={{marginRight: 'auto'}}
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

        {/* LOG SCOPE CHANGE SECTION (Always visible at bottom or restricted to Tracking tab? Keeping visible for easy access) */}
        <div style={{ marginTop: '30px', borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 className="modal-section-title" style={{borderBottom: 'none', margin: 0, paddingBottom: 0}}>Log Scope Change</h3>
              <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                   <Tooltip content="Click to show/hide the section for logging a scope change. This is for tracking significant changes made during a sprint." />
                   <button type="button" onClick={() => setIsLogChangeVisible(p => !p)} className="modal-button-cancel" style={{padding: '5px 15px', fontSize: '0.85em'}}>
                       {isLogChangeVisible ? 'Hide' : 'Show'}
                   </button>
              </div>
          </div>
          {isLogChangeVisible && (
            <div style={{marginTop: '15px'}}>
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
              <div style={{display: 'flex', justifyContent: 'flex-end'}}>
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
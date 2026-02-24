import React, { useState, useEffect, useMemo } from 'react';
import CustomDropdown from './CustomDropdown';
import Tooltip from './Tooltip';
import useClickOutside from '../hooks/useClickOutside';
import ConfirmationModal from './ConfirmationModal';

const AddNewRequirementModal = ({ isOpen, onClose, formData, onFormChange, onSubmit, projects, releases }) => {
  const [initialFormData, setInitialFormData] = useState(null);
  const [isCloseConfirmOpen, setIsCloseConfirmOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('core'); // 'core' or 'tracking'

  useEffect(() => {
    if (isOpen) {
      setInitialFormData(formData);
      setActiveTab('core'); // Reset to first tab on open
    }
  }, [isOpen]);

  useEffect(() => {
    if (initialFormData && formData.project !== initialFormData.project) {
        onFormChange({ target: { name: 'release_id', value: '' } });
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
    
    // Validate required fields before allowing user to proceed or save
    if (!formData.project || !formData.project.trim()) {
        alert("Project is required.");
        setActiveTab('core');
        return;
    }
    if (!formData.requirementName || !formData.requirementName.trim()) {
        alert("Requirement Name is required.");
        setActiveTab('core');
        return;
    }
    if (!formData.type || !formData.type.trim()) {
        alert("Type is required.");
        setActiveTab('core');
        return;
    }

    // If we are on the first tab and everything is valid, move to next tab
    if (activeTab === 'core') {
        setActiveTab('tracking');
        return;
    }

    // If we are on the tracking tab, save the requirement
    onSubmit();
  };

  if (!isOpen) return null;

  const projectOptions = projects.map(p => ({ value: p, label: p }));
  const statusOptions = ['To Do', 'Scenarios created', 'Under testing', 'Done'].map(s => ({ value: s, label: s }));
  const typeOptions = ['Change Request', 'Task', 'Bug', 'Story', 'Incident'].map(t => ({ value: t, label: t }));
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

  return (
    <div id="add-new-requirement-modal-wrapper-id">
      <div id="add-new-modal-overlay-id" className="add-new-modal-overlay">
        <div ref={modalRef} id="add-new-modal-content-id" className="add-new-modal-content">
          <h2>Add New Requirement</h2>
          
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
                    disabled={projects.length === 0}
                    placeholder={projects.length === 0 ? "-- No projects available --" : "-- Select a Project --"}
                  />
                </div>
                <div id="form-group-requirement-name-id" className="form-group">
                  <label htmlFor="newReqName">Requirement Name:</label>
                  <input type="text" id="newReqName" name="requirementName" value={formData.requirementName} onChange={onFormChange} placeholder="e.g., User Login Feature TEST-INT-01" />
                </div>
                <div id="form-group-type-id" className="form-group">
                  {/* REMOVED .optional-label here to make the red asterisk appear */}
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
                <div id="form-group-release-id" className="form-group">
                  <div id="release-label-tooltip-container-id" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <label id="newReqRelease-label" htmlFor="newReqRelease-button" className="optional-label" style={{marginBottom: 0}}>Release:</label>
                    <Tooltip content={releaseTooltipContent} className="release" />
                  </div>
                  <CustomDropdown
                    id="newReqRelease"
                    name="release_id"
                    value={formData.release_id}
                    onChange={onFormChange}
                    options={releaseOptions}
                    disabled={!formData.project || releaseOptions.length === 0}
                    placeholder={!formData.project ? "-- Select a project first --" : (releaseOptions.length === 0 ? "-- No releases for this project --" : "-- Select a Release --")}
                  />
                </div>
                <div id="form-group-tags-id" className="form-group">
                  <label htmlFor="newReqTags" className="optional-label">Tags:</label>
                  <input type="text" id="newReqTags" name="tags" value={formData.tags} onChange={onFormChange} placeholder="e.g., Sprint 4, Project Tools" />
                </div>
                <div id="form-group-link-id" className="form-group">
                  <label htmlFor="newReqLink" className="optional-label">Link (e.g., JIRA):</label>
                  <input type="url" id="newReqLink" name="link" value={formData.link} onChange={onFormChange} placeholder="https://example.com/issue/123" />
                </div>
            </div>

            <div id="modal-actions-id" className="modal-actions">
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
                 {activeTab === 'core' ? 'Next: Tracking & Links' : 'Add Requirement'}
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
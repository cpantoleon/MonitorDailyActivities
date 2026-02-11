import React, { useState, useEffect, useMemo } from 'react';
import CustomDropdown from './CustomDropdown';
import useClickOutside from '../hooks/useClickOutside';
import ConfirmationModal from './ConfirmationModal';

const EditProjectModal = ({ isOpen, onClose, onSave, onDelete, projects, currentProject }) => {
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [formData, setFormData] = useState(null);
  const [initialFormData, setInitialFormData] = useState(null);
  const [isCloseConfirmOpen, setIsCloseConfirmOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (currentProject && projects.includes(currentProject)) {
        setSelectedProjectId(currentProject);
      }
    } else {
      setSelectedProjectId('');
      setFormData(null);
      setInitialFormData(null);
    }
  }, [isOpen, currentProject, projects]);

  const projectOptions = useMemo(() => {
    return projects.map(p => ({ value: p, label: p }));
  }, [projects]);

  useEffect(() => {
    if (selectedProjectId) {
      const data = {
        originalName: selectedProjectId,
        newName: selectedProjectId,
      };
      setFormData(data);
      setInitialFormData(data);
    } else {
      setFormData(null);
      setInitialFormData(null);
    }
  }, [selectedProjectId]);

  const handleProjectSelect = (e) => {
    setSelectedProjectId(e.target.value);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  const hasUnsavedChanges = useMemo(() => {
    if (!formData || !initialFormData) return false;
    return formData.newName !== initialFormData.newName;
  }, [formData, initialFormData]);

  const handleCloseRequest = () => {
    if (hasUnsavedChanges) {
      setIsCloseConfirmOpen(true);
    } else {
      onClose();
    }
  };

  const handleSave = (e) => {
    e.preventDefault();
    if (!formData || !formData.newName.trim()) {
        alert("Project name cannot be empty.");
        return;
    }
    onSave(formData);
  };

  const handleDelete = () => {
    if (formData && formData.originalName) {
      onDelete({ name: formData.originalName });
    }
  };
  
  const modalRef = useClickOutside(handleCloseRequest);

  if (!isOpen) return null;

  return (
    <div id="edit-project-modal-wrapper-id">
      <div id="add-new-modal-overlay-id" className="add-new-modal-overlay">
        <div ref={modalRef} id="add-new-modal-content-id" className="add-new-modal-content" style={{ maxWidth: '500px' }}>
          <h2>Edit/Delete Project</h2>
          <div id="form-group-project-select-id" className="form-group">
            <label id="project-select-in-edit-modal-label" htmlFor="project-select-in-edit-modal-button">Select Project:</label>
            <CustomDropdown
              id="project-select-in-edit-modal"
              name="project_selector_in_edit_modal"
              value={selectedProjectId}
              onChange={handleProjectSelect}
              options={projectOptions}
              placeholder="-- Select a Project --"
            />
          </div>
          
          {formData ? (
            <form id="edit-project-form-id" onSubmit={handleSave}>
              <div id="form-group-project-name-id" className="form-group">
                <label htmlFor="edit-project-name">Project Name:</label>
                <input 
                  type="text" 
                  id="edit-project-name" 
                  name="newName" 
                  value={formData.newName} 
                  onChange={handleChange} 
                  required 
                />
              </div>
              <div id="modal-actions-form-id" className="modal-actions">
                <button id="modal-button-save-id" type="submit" className="modal-button-save" disabled={!hasUnsavedChanges}>Save Changes</button>
                <button id="modal-button-delete-id" type="button" onClick={handleDelete} className="modal-button-delete" title={`Delete project: ${formData.originalName}`}>Delete</button>
                <button id="modal-button-cancel-form-id" type="button" onClick={onClose} className="modal-button-cancel">Cancel</button>
              </div>
            </form>
          ) : (
            <div id="modal-actions-no-form-id" className="modal-actions">
              <button id="modal-button-cancel-no-form-id" type="button" onClick={onClose} className="modal-button-cancel">Cancel</button>
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
        message="You have unsaved changes. Are you sure you want to close the window?"
      />
    </div>
  );
};

export default EditProjectModal;
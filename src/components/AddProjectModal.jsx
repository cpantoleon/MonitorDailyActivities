import React, { useState, useEffect, useMemo } from 'react';
import useClickOutside from '../hooks/useClickOutside';
import ConfirmationModal from './ConfirmationModal';

const AddProjectModal = ({ isOpen, onClose, onAddProject }) => {
  const [projectName, setProjectName] = useState('');
  const [isCloseConfirmOpen, setIsCloseConfirmOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setProjectName('');
    }
  }, [isOpen]);

  const hasUnsavedChanges = useMemo(() => projectName.trim() !== '', [projectName]);

  const handleCloseRequest = () => {
    if (hasUnsavedChanges) {
      setIsCloseConfirmOpen(true);
    } else {
      onClose();
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (projectName.trim()) {
      onAddProject(projectName.trim());
    }
  };

  const modalRef = useClickOutside(handleCloseRequest);

  if (!isOpen) return null;

  return (
    <div id="add-project-modal-wrapper-id">
      <div id="add-new-modal-overlay-id" className="add-new-modal-overlay">
        <div ref={modalRef} id="add-new-modal-content-id" className="add-new-modal-content" style={{ maxWidth: '450px' }}>
          <h2>Add New Project</h2>
          <form id="add-project-form-id" onSubmit={handleSubmit}>
            <div id="form-group-project-name-id" className="form-group">
              <label htmlFor="newProjectName">Project Name:</label>
              <input
                type="text"
                id="newProjectName"
                name="newProjectName"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="Enter the name of the new project"
                required
                autoFocus
              />
            </div>
            <div id="modal-actions-id" className="modal-actions">
              <button type="submit" className="modal-button-save">Add Project</button>
              <button type="button" onClick={onClose} className="modal-button-cancel">Cancel</button>
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

export default AddProjectModal;
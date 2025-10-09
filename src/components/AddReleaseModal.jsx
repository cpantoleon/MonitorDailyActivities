import React, { useState, useEffect, useMemo } from 'react';
import DatePicker from 'react-datepicker';
import CustomDropdown from './CustomDropdown';
import "react-datepicker/dist/react-datepicker.css";
import useClickOutside from '../hooks/useClickOutside';
import ConfirmationModal from './ConfirmationModal';

const AddReleaseModal = ({ isOpen, onClose, onAdd, projects, currentProject }) => {
  const getInitialState = (project) => ({
    project: project || '',
    name: '',
    release_date: new Date(),
    is_current: false,
  });

  const [formData, setFormData] = useState(getInitialState(currentProject));
  const [initialFormData, setInitialFormData] = useState(null);
  const [isCloseConfirmOpen, setIsCloseConfirmOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const initialState = getInitialState(currentProject);
      setFormData(initialState);
      setInitialFormData(initialState);
    } else {
      setFormData(getInitialState(''));
      setInitialFormData(null);
    }
  }, [isOpen, currentProject]);

  const hasUnsavedChanges = useMemo(() => {
    if (!initialFormData) return false;
    return formData.name.trim() !== '' || formData.is_current !== false;
  }, [formData, initialFormData]);

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
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleDateChange = (date) => {
    setFormData(prev => ({ ...prev, release_date: date }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.project || !formData.name.trim() || !formData.release_date) {
      alert("Project, Name, and Release Date are required.");
      return;
    }
    const date = formData.release_date;
    const formattedDate = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
    
    onAdd({ ...formData, release_date: formattedDate });
  };

  if (!isOpen) return null;

  const projectOptions = projects.map(p => ({ value: p, label: p }));

  return (
    <div id="add-release-modal-wrapper-id">
      <div id="add-new-modal-overlay-id" className="add-new-modal-overlay">
        <div ref={modalRef} id="add-new-modal-content-id" className="add-new-modal-content" style={{ maxWidth: '500px' }}>
          <h2>Add New Release</h2>
          <form id="add-release-form-id" onSubmit={handleSubmit}>
            <div id="form-group-project-id" className="form-group">
              <label id="release-project-label" htmlFor="release-project-button">Project:</label>
              <CustomDropdown
                id="release-project"
                name="project"
                value={formData.project}
                onChange={handleChange}
                options={projectOptions}
                placeholder="-- Select Project --"
              />
            </div>
            <div id="form-group-release-name-id" className="form-group">
              <label htmlFor="release-name">Release Name:</label>
              <input type="text" id="release-name" name="name" value={formData.name} onChange={handleChange} required />
            </div>
            <div id="form-group-release-date-id" className="form-group">
              <label htmlFor="release-date">Release Date:</label>
              <DatePicker 
                id="release-date" 
                name="release_date" 
                selected={formData.release_date} 
                onChange={handleDateChange} 
                dateFormat="MM/dd/yyyy" 
                className="notes-datepicker" 
                wrapperClassName="date-picker-wrapper" 
                popperPlacement="top-start" 
              />
            </div>
            <div id="form-group-is-current-toggle-id" className="form-group new-project-toggle">
              <input type="checkbox" id="release-is-current" name="is_current" checked={formData.is_current} onChange={handleChange} />
              <label htmlFor="release-is-current" className="checkbox-label optional-label">Set as Current Release for this Project</label>
            </div>
            <div id="modal-actions-id" className="modal-actions">
              <button type="submit" className="modal-button-save">Add Release</button>
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

export default AddReleaseModal;
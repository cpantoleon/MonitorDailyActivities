import React, { useState, useEffect, useMemo } from 'react';
import Select from 'react-select';
import DatePicker from 'react-datepicker';
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

  const handleSelectChange = (selectedOption) => {
    setFormData(prev => ({ ...prev, project: selectedOption ? selectedOption.value : '' }));
  };

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
  const customSelectStyles = {
    menuPortal: base => ({ ...base, zIndex: 9999 })
  };

  return (
    <>
      <div className="add-new-modal-overlay">
        <div ref={modalRef} className="add-new-modal-content" style={{ maxWidth: '500px' }}>
          <h2>Add New Release</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="release-project">Project:</label>
              <Select
                inputId="release-project"
                name="project"
                value={projectOptions.find(opt => opt.value === formData.project)}
                onChange={handleSelectChange}
                options={projectOptions}
                styles={customSelectStyles}
                menuPortalTarget={document.body}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="release-name">Release Name:</label>
              <input type="text" id="release-name" name="name" value={formData.name} onChange={handleChange} required />
            </div>
            <div className="form-group">
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
            <div className="form-group new-project-toggle">
              <input type="checkbox" id="release-is-current" name="is_current" checked={formData.is_current} onChange={handleChange} />
              <label htmlFor="release-is-current" className="checkbox-label optional-label">Set as Current Release for this Project</label>
            </div>
            <div className="modal-actions">
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
    </>
  );
};

export default AddReleaseModal;
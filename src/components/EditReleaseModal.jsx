import React, { useState, useEffect, useMemo } from 'react';
import Select from 'react-select';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import useClickOutside from '../hooks/useClickOutside';
import ConfirmationModal from './ConfirmationModal';

const EditReleaseModal = ({ isOpen, onClose, onSave, onDelete, releases, projects, currentProject }) => {
  const [selectedModalProject, setSelectedModalProject] = useState('');
  const [selectedReleaseId, setSelectedReleaseId] = useState('');
  const [formData, setFormData] = useState(null);
  const [initialFormData, setInitialFormData] = useState(null);
  const [isCloseConfirmOpen, setIsCloseConfirmOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (currentProject && projects.includes(currentProject)) {
        setSelectedModalProject(currentProject);
      }
    } else {
      setSelectedModalProject('');
      setSelectedReleaseId('');
      setFormData(null);
      setInitialFormData(null);
    }
  }, [isOpen, currentProject, projects]);
  
  const projectOptions = projects.map(p => ({ value: p, label: p }));

  const releaseOptions = useMemo(() => {
    if (!selectedModalProject) return [];
    return releases
      .filter(r => r.project === selectedModalProject)
      .map(r => ({ value: r.id, label: r.name }));
  }, [selectedModalProject, releases]);

  const handleProjectSelect = (selectedOption) => {
    setSelectedModalProject(selectedOption ? selectedOption.value : '');
    setSelectedReleaseId('');
    setFormData(null);
    setInitialFormData(null);
  };

  const handleReleaseSelect = (selectedOption) => {
    const releaseId = selectedOption ? selectedOption.value : '';
    setSelectedReleaseId(releaseId);

    if (releaseId) {
      const release = releases.find(r => r.id === releaseId);
      if (release) {
        const data = {
          id: release.id,
          name: release.name,
          release_date: new Date(release.release_date + 'T00:00:00'),
          is_current: !!release.is_current,
          project: release.project
        };
        setFormData(data);
        setInitialFormData(data);
      }
    } else {
      setFormData(null);
      setInitialFormData(null);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleDateChange = (date) => {
    setFormData(prev => ({ ...prev, release_date: date }));
  };
  
  const hasUnsavedChanges = useMemo(() => {
    if (!formData || !initialFormData) return false;
    const initialDate = initialFormData.release_date.toISOString().split('T')[0];
    const currentDate = formData.release_date.toISOString().split('T')[0];
    return initialFormData.name !== formData.name ||
           initialDate !== currentDate ||
           initialFormData.is_current !== formData.is_current;
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
    if (!formData) return;
    const date = formData.release_date;
    const formattedDate = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
    onSave({ ...formData, release_date: formattedDate });
  };

  const handleDelete = () => {
    if (formData && formData.id) {
      onDelete(formData);
    }
  };
  
  const modalRef = useClickOutside(handleCloseRequest);

  if (!isOpen) return null;

  const customSelectStyles = {
    menuPortal: base => ({ ...base, zIndex: 9999 })
  };

  return (
    <div className="add-new-modal-overlay">
      <div ref={modalRef} className="add-new-modal-content" style={{ maxWidth: '500px' }}>
        <h2>Edit/Delete Release</h2>
        <div className="form-group">
          <label htmlFor="project-select-in-modal">Select Project:</label>
          <Select
            inputId="project-select-in-modal"
            name="project_selector_in_modal"
            options={projectOptions}
            value={projectOptions.find(opt => opt.value === selectedModalProject)}
            onChange={handleProjectSelect}
            styles={customSelectStyles}
            menuPortalTarget={document.body}
            placeholder="-- Select a Project --"
          />
        </div>
        <div className="form-group">
          <label htmlFor="release-select">Select Release to Edit:</label>
          <Select
            inputId="release-select"
            name="release_selector"
            value={releaseOptions.find(opt => opt.value === selectedReleaseId) || null}
            onChange={handleReleaseSelect}
            options={releaseOptions}
            styles={customSelectStyles}
            menuPortalTarget={document.body}
            placeholder="-- Select a Release --"
            isDisabled={!selectedModalProject || releaseOptions.length === 0}
          />
        </div>
        
        {formData ? (
          <form onSubmit={handleSave}>
            <div className="form-group">
              <label htmlFor="edit-release-name">Release Name:</label>
              <input type="text" id="edit-release-name" name="name" value={formData.name} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label htmlFor="edit-release-date">Release Date:</label>
              <DatePicker id="edit-release-date" name="release_date" selected={formData.release_date} onChange={handleDateChange} dateFormat="MM/dd/yyyy" className="notes-datepicker" wrapperClassName="date-picker-wrapper" popperPlacement="top-start" />
            </div>
            <div className="form-group new-project-toggle">
              <input type="checkbox" id="edit-release-is-current" name="is_current" checked={formData.is_current} onChange={handleChange} />
              <label htmlFor="edit-release-is-current" className="checkbox-label optional-label">Set as Current Release</label>
            </div>
            <div className="modal-actions">
              <button type="submit" className="modal-button-save">Save Changes</button>
              <button type="button" onClick={handleDelete} className="modal-button-delete" title={`Delete release: ${formData.name}`}>Delete</button>
              <button type="button" onClick={onClose} className="modal-button-cancel">Cancel</button>
            </div>
          </form>
        ) : (
          <div className="modal-actions">
            <button type="button" onClick={onClose} className="modal-button-cancel">Cancel</button>
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
        message="You have unsaved changes. Are you sure you want to close the window?"
      />
    </div>
  );
};

export default EditReleaseModal;
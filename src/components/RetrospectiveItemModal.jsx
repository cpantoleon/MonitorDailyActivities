import React, { useState, useEffect, useMemo } from 'react';
import DatePicker from 'react-datepicker';
import CustomDropdown from './CustomDropdown';
import "react-datepicker/dist/react-datepicker.css";
import useClickOutside from '../hooks/useClickOutside';
import ConfirmationModal from './ConfirmationModal';

const RetrospectiveItemModal = ({ isOpen, onClose, onSubmit, item, columnTypes }) => {
  const getInitialState = () => ({
    column_type: (columnTypes.length > 0 ? columnTypes[0].value : ''),
    description: '',
    details: '',
    item_date: new Date(),
  });

  const [formData, setFormData] = useState(getInitialState());
  const [initialFormData, setInitialFormData] = useState(null);
  const [isCloseConfirmOpen, setIsCloseConfirmOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      let initialState;
      if (item && item.item_date) {
        const dateString = String(item.item_date);
        const parts = dateString.split('-');
        let parsedDate = new Date();
        if (parts.length === 3) {
          const [year, month, day] = parts.map(p => parseInt(p, 10));
          if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
            parsedDate = new Date(year, month - 1, day);
          }
        }
        initialState = {
          column_type: item.column_type || (columnTypes.length > 0 ? columnTypes[0].value : ''),
          description: item.description || '',
          details: item.details || '',
          item_date: parsedDate,
        };
      } else {
        initialState = getInitialState();
      }
      setFormData(initialState);
      setInitialFormData(initialState);
    }
  }, [item, isOpen, columnTypes]);

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

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleDateChange = (date) => {
    if (date) {
        setFormData(prev => ({ ...prev, item_date: date }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.column_type || !formData.description.trim() || !formData.details.trim() || !formData.item_date) {
      alert("Column, description, details, and date are required.");
      return;
    }
    const date = formData.item_date;
    const formattedDate = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
    onSubmit({ ...formData, description: formData.description.trim(), details: formData.details.trim(), item_date: formattedDate });
  };

  if (!isOpen) return null;

  return (
    <div id="retrospective-item-modal-wrapper-id">
      <div id="add-new-modal-overlay-id" className="add-new-modal-overlay">
        <div ref={modalRef} id="add-new-modal-content-id" className="add-new-modal-content" style={{maxWidth: '600px'}}>
          <h2 id="retrospective-item-modal-title-id">{item ? 'Edit Retrospective Item' : 'Add Retrospective Item'}</h2>
          <form id="retrospective-item-form-id" onSubmit={handleSubmit}>
            <div id="form-group-column-type-id" className="form-group">
              <label id="retro-column-type-label" htmlFor="retro-column-type-button">Column:</label>
              <CustomDropdown
                id="retro-column-type"
                name="column_type"
                value={formData.column_type}
                onChange={handleChange}
                options={columnTypes}
              />
            </div>
            <div id="form-group-description-id" className="form-group">
              <label id="retro-description-label-id" htmlFor="retro-description">Description:</label>
              <textarea id="retro-description" name="description" value={formData.description} onChange={handleChange} rows="4" placeholder="What happened? What did you observe?" required />
            </div>
            <div id="form-group-details-id" className="form-group">
              <label id="retro-details-label-id" htmlFor="retro-details">Details:</label>
              <textarea id="retro-details" name="details" value={formData.details} onChange={handleChange} rows="4" placeholder="Provide more details." required />
            </div>
            <div id="form-group-date-id" className="form-group">
              <label id="retro-item-date-label-id" htmlFor="retro-item-date">Date:</label>
              <DatePicker 
                id="retro-item-date" 
                name="item_date" 
                selected={formData.item_date} 
                onChange={handleDateChange} 
                dateFormat="MM/dd/yyyy" 
                className="notes-datepicker" 
                wrapperClassName="date-picker-wrapper" 
                placeholderText="Select a date" 
                // CHANGE HERE
                popperPlacement="top-start"
                portalId="root"
                popperProps={{
                   strategy: "fixed" 
                }}
                autoComplete="off"
              />
            </div>
            <div id="modal-actions-id" className="modal-actions">
              <button id="modal-button-save-id" type="submit" className="btn-primary">{item ? 'Save Changes' : 'Add Item'}</button>
              <button id="modal-button-cancel-id" type="button" onClick={onClose} className="modal-button-cancel">Cancel</button>
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

export default RetrospectiveItemModal;
import React, { useState, useEffect, useMemo } from 'react';
import DatePicker from 'react-datepicker';
import Select from 'react-select';
import "react-datepicker/dist/react-datepicker.css";
import useClickOutside from '../hooks/useClickOutside';
import ConfirmationModal from './ConfirmationModal';

const RetrospectiveItemModal = ({ isOpen, onClose, onSubmit, item, columnTypes }) => {
  const getInitialState = () => ({
    column_type: (columnTypes.length > 0 ? columnTypes[0].value : ''),
    description: '',
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
  
  const handleSelectChange = (name, selectedOption) => {
    setFormData(prev => ({...prev, [name]: selectedOption ? selectedOption.value : '' }));
  };

  const handleDateChange = (date) => {
    if (date) {
        setFormData(prev => ({ ...prev, item_date: date }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.column_type || !formData.description.trim() || !formData.item_date) {
      alert("Column, description, and date are required.");
      return;
    }
    const date = formData.item_date;
    const formattedDate = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
    onSubmit({ ...formData, description: formData.description.trim(), item_date: formattedDate });
  };

  if (!isOpen) return null;

  const customSelectStyles = {
    menuList: (base) => ({ ...base, maxHeight: '180px', overflowY: 'auto' }),
    menuPortal: (base) => ({ ...base, zIndex: 9999 }),
  };

  return (
    <>
      <div className="add-new-modal-overlay">
        <div ref={modalRef} className="add-new-modal-content" style={{maxWidth: '600px'}}>
          <h2>{item ? 'Edit Retrospective Item' : 'Add Retrospective Item'}</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="retro-column-type">Column:</label>
              <Select inputId="retro-column-type" name="column_type" value={columnTypes.find(opt => opt.value === formData.column_type)} onChange={(option) => handleSelectChange('column_type', option)} options={columnTypes} styles={customSelectStyles} menuPortalTarget={document.body} required />
            </div>
            <div className="form-group">
              <label htmlFor="retro-description">Description:</label>
              <textarea id="retro-description" name="description" value={formData.description} onChange={handleChange} rows="4" placeholder="What happened? What did you observe?" required />
            </div>
            <div className="form-group">
              <label htmlFor="retro-item-date">Date:</label>
              <DatePicker id="retro-item-date" name="item_date" selected={formData.item_date} onChange={handleDateChange} dateFormat="MM/dd/yyyy" className="notes-datepicker" wrapperClassName="date-picker-wrapper" placeholderText="Select a date" popperPlacement="top-start" />
            </div>
            <div className="modal-actions">
              <button type="submit" className="modal-button-save">{item ? 'Save Changes' : 'Add Item'}</button>
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

export default RetrospectiveItemModal;
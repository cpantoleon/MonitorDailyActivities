import React from 'react';

const ConfirmationModal = ({ isOpen, onClose, onConfirm, title, message, confirmText = 'Yes', cancelText = 'No' }) => {
  if (!isOpen) return null;

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="confirmation-modal-overlay"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={handleOverlayClick}
    >
      <div className="confirmation-modal-content">
        <h3>{title || 'Confirm Action'}</h3>
        <p>{message || 'Are you sure?'}</p>
        <div className="modal-actions">
          <button onClick={onConfirm} className="modal-button-confirm">{confirmText}</button>
          <button onClick={onClose} className="modal-button-cancel">{cancelText}</button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;
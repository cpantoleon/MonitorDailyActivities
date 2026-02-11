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
      id="confirmation-modal-overlay-id"
      className="confirmation-modal-overlay"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={handleOverlayClick}
    >
      <div id="confirmation-modal-content-id" className="confirmation-modal-content">
        <h3 id="confirmation-modal-title-id">{title || 'Confirm Action'}</h3>
        <p id="confirmation-modal-message-id">{message || 'Are you sure?'}</p>
        <div id="modal-actions-id" className="modal-actions">
          <button id="modal-button-confirm-id" onClick={onConfirm} className="modal-button-confirm">{confirmText}</button>
          <button id="modal-button-cancel-id" onClick={onClose} className="modal-button-cancel">{cancelText}</button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;
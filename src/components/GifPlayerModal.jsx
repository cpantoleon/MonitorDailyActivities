import React from 'react';
import './GifPlayerModal.css';

const GifPlayerModal = ({ isOpen, onClose, gifSrc }) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="gif-modal-overlay"
      onClick={onClose}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div
        className="gif-modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        {isOpen && <img src={`${gifSrc}?${new Date().getTime()}`} alt="How to export from JIRA" />}
      </div>
    </div>
  );
};

export default GifPlayerModal;
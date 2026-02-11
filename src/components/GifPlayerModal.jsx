import React from 'react';
import './GifPlayerModal.css';

const GifPlayerModal = ({ isOpen, onClose, gifSrc }) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div
      id="gif-modal-overlay-id"
      className="gif-modal-overlay"
      onClick={onClose}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div
        id="gif-modal-content-id"
        className="gif-modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        {isOpen && <img id="gif-player-image-id" src={`${gifSrc}?${new Date().getTime()}`} alt="How to export from JIRA" />}
      </div>
    </div>
  );
};

export default GifPlayerModal;
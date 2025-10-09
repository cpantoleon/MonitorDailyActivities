import React from 'react';
import './ReleaseModal.css';

const Modal = ({ isOpen, onClose, title, children }) => {
    if (!isOpen) {
        return null;
    }

    return (
        <div id="modal-overlay-id" className="modal-overlay" onClick={onClose}>
            <div id="modal-content-id" className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div id="modal-header-id" className="modal-header">
                    <h2 id="modal-title-id">{title}</h2>
                    <button id="modal-close-button-id" onClick={onClose} className="modal-close-button">&times;</button>
                </div>
                <div id="modal-body-id" className="modal-body">
                    {children}
                </div>
            </div>
        </div>
    );
};

export default Modal;
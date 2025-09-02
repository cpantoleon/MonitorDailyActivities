import React from 'react';
import './FinalizeReleaseModal.css';

const FinalizeReleaseModal = ({ isOpen, onClose, onConfirm, releaseName }) => {
    if (!isOpen) return null;

    return (
        <div className="confirmation-modal-overlay" onClick={onClose}>
            <div className="confirmation-modal-content" onClick={e => e.stopPropagation()}>
                <h3>Finalize Release: {releaseName}</h3>
                <p>This action is permanent. Choose how to handle the requirements associated with this release.</p>
                
                <div className="finalize-options">
                    <div className="finalize-option">
                        <div className="finalize-option-icon">&#128451;</div>
                        <h4>Archive Only</h4>
                        <p>Creates a permanent, read-only record. Requirements remain on the board, unlinked from this release, to be managed independently.</p>
                        <button 
                            onClick={() => onConfirm('archive_only')} 
                            className="modal-button-confirm"
                        >
                            Select & Archive
                        </button>
                    </div>
                    <div className="finalize-option">
                        <div className="finalize-option-icon">&#128210;</div>
                        <h4>Archive & Complete Items</h4>
                        <p>Creates a permanent record AND marks all associated requirements as 'Done', removing them from the active Kanban board.</p>
                        <button 
                            onClick={() => onConfirm('archive_and_complete')} 
                            className="modal-button-delete"
                        >
                            Select & Complete
                        </button>
                    </div>
                </div>

                <div className="modal-actions" style={{ justifyContent: 'center', marginTop: '20px' }}>
                    <button onClick={onClose} className="modal-button-cancel">Cancel</button>
                </div>
            </div>
        </div>
    );
};

export default FinalizeReleaseModal;

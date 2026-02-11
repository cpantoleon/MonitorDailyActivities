import React from 'react';
import './FinalizeReleaseModal.css';

const FinalizeReleaseModal = ({ isOpen, onClose, onConfirm, releaseName }) => {
    if (!isOpen) return null;

    return (
        <div id="confirmation-modal-overlay-finalize-id" className="confirmation-modal-overlay" onClick={onClose}>
            <div id="confirmation-modal-content-finalize-id" className="confirmation-modal-content" onClick={e => e.stopPropagation()}>
                <h3 id="finalize-release-title-id">Finalize Release: {releaseName}</h3>
                <p id="finalize-release-description-id">This action is permanent. Choose how to handle the requirements associated with this release.</p>
                
                <div id="finalize-options-container-id" className="finalize-options">
                    <div id="finalize-option-archive-only-id" className="finalize-option">
                        <div id="finalize-option-icon-archive-id" className="finalize-option-icon">&#128451;</div>
                        <h4 id="finalize-option-title-archive-id">Archive Only</h4>
                        <p id="finalize-option-description-archive-id">Creates a permanent, read-only record. Requirements remain on the board and are still linked to this release.</p>
                        <button 
                            id="finalize-button-archive-only-id"
                            onClick={() => onConfirm('archive_only')} 
                            className="modal-button-confirm"
                        >
                            Select & Archive
                        </button>
                    </div>
                    <div id="finalize-option-archive-complete-id" className="finalize-option">
                        <div id="finalize-option-icon-complete-id" className="finalize-option-icon">&#128210;</div>
                        <h4 id="finalize-option-title-complete-id">Archive & Complete Items</h4>
                        <p id="finalize-option-description-complete-id">Creates a permanent record AND marks all associated requirements as 'Done', removing them from the active Kanban board.</p>
                        <button 
                            id="finalize-button-archive-complete-id"
                            onClick={() => onConfirm('archive_and_complete')} 
                            className="modal-button-delete"
                        >
                            Select & Complete
                        </button>
                    </div>
                </div>

                <div id="modal-actions-finalize-id" className="modal-actions" style={{ justifyContent: 'center', marginTop: '20px' }}>
                    <button id="modal-button-cancel-finalize-id" onClick={onClose} className="modal-button-cancel">Cancel</button>
                </div>
            </div>
        </div>
    );
};

export default FinalizeReleaseModal;
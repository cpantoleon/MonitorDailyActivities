import React, { useState, useEffect, useMemo } from 'react';
import useClickOutside from '../hooks/useClickOutside';
import ConfirmationModal from './ConfirmationModal';

const UpdateStatusModal = ({ isOpen, onClose, onSave, requirement, newStatus, showMessage }) => {
  const [comment, setComment] = useState('');
  const [isCloseConfirmOpen, setIsCloseConfirmOpen] = useState(false);
  const [acknowledgeDefects, setAcknowledgeDefects] = useState(false);

  const openDefects = useMemo(() => {
    if (!requirement || newStatus !== 'Done') return [];
    return requirement.linkedDefects?.filter(
      (defect) => defect.status === 'Assigned to Developer' || defect.status === 'Assigned to Tester'
    ) || [];
  }, [requirement, newStatus]);

  useEffect(() => {
    if (isOpen) {
      setComment('');
      setAcknowledgeDefects(false);
    }
  }, [isOpen]);

  const hasUnsavedChanges = useMemo(() => comment.trim() !== '', [comment]);

  const handleCloseRequest = () => {
    if (hasUnsavedChanges) {
      setIsCloseConfirmOpen(true);
    } else {
      onClose();
    }
  };

  const handleSave = () => {
    if (openDefects.length > 0 && !acknowledgeDefects) {
      showMessage('Please acknowledge the open defects before proceeding.', 'error');
      return; 
    }
    onSave(comment);
  };

  const modalRef = useClickOutside(handleCloseRequest);

  if (!isOpen || !requirement) return null;

  return (
    <>
      <div className="add-new-modal-overlay">
        <div ref={modalRef} className="add-new-modal-content" style={{ maxWidth: '500px' }}>
          <h2>Update Status</h2>
          <p>
            You are moving requirement <strong>{requirement.requirementUserIdentifier}</strong> to the "<strong>{newStatus}</strong>" column.
          </p>
          <div className="form-group">
            <label htmlFor="updateStatusComment" className="optional-label">Add a comment (optional):</label>
            <textarea
              id="updateStatusComment"
              name="updateStatusComment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows="4"
              placeholder="Why is the status being updated?"
              autoFocus
            />
          </div>

          {openDefects.length > 0 && (
            <div className="form-group" style={{ marginTop: '15px', backgroundColor: '#FFF8DC', padding: '10px', borderRadius: '4px' }}>
              <p style={{marginTop: 0, color: '#8B4513', fontSize: '0.9em'}}>
                <strong>Warning:</strong> This item has {openDefects.length} open defect(s).
              </p>
              <div className="new-project-toggle">
                <input
                  type="checkbox"
                  id="acknowledgeDefectsCheckbox"
                  checked={acknowledgeDefects}
                  onChange={(e) => setAcknowledgeDefects(e.target.checked)}
                />
                <label htmlFor="acknowledgeDefectsCheckbox" className="checkbox-label" style={{fontSize: '0.9em'}}>
                  I acknowledge the open defect(s) and want to proceed.
                </label>
              </div>
            </div>
          )}

          <div className="modal-actions">
            <button 
              onClick={handleSave} 
              className="modal-button-save"
            >
              Confirm Update
            </button>
            <button type="button" onClick={onClose} className="modal-button-cancel">Cancel</button>
          </div>
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
        message="You have an unsaved comment. Are you sure you want to close?"
      />
    </>
  );
};

export default UpdateStatusModal;
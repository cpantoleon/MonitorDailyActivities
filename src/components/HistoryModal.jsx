import React, { useState, useEffect, useRef, useMemo } from 'react';
import useClickOutside from '../hooks/useClickOutside';
import ConfirmationModal from './ConfirmationModal';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";

const formatDateForDisplayInternal = (dateObj) => {
    if (!dateObj) return 'N/A';
    const d = dateObj instanceof Date ? dateObj : new Date(dateObj);
    if (isNaN(d.getTime())) return 'Invalid Date';
    return d.toLocaleDateString();
};

const HistoryModal = ({ requirement, isOpen, onClose, onSaveHistoryEntry, apiBaseUrl }) => {
  const [editingEntryId, setEditingEntryId] = useState(null);
  const [editFormDate, setEditFormDate] = useState(null);
  const [editFormComment, setEditFormComment] = useState('');
  const [isCloseConfirmOpen, setIsCloseConfirmOpen] = useState(false);
  const commentInputRef = useRef(null);
  const [modalForRequirementId, setModalForRequirementId] = useState(null);
  
  const [changeHistory, setChangeHistory] = useState([]);
  const [isLoadingChanges, setIsLoadingChanges] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setEditingEntryId(null);
      setEditFormDate(null);
      setEditFormComment('');
      setModalForRequirementId(null);
      setChangeHistory([]);
      setIsLoadingChanges(false);
    } else if (requirement && (requirement.id !== modalForRequirementId || !modalForRequirementId)) {
      setEditingEntryId(null);
      setEditFormDate(null);
      setEditFormComment('');
      setModalForRequirementId(requirement.id);
      
      const fetchChanges = async () => {
        setIsLoadingChanges(true);
        try {
            const response = await fetch(`${apiBaseUrl}/requirements/${requirement.id}/changes`);
            if (!response.ok) throw new Error("Failed to fetch change history.");
            const result = await response.json();
            setChangeHistory(result.data || []);
        } catch (error) {
            console.error("Error fetching change history:", error);
            setChangeHistory([]);
        } finally {
            setIsLoadingChanges(false);
        }
      };
      fetchChanges();
    }
  }, [isOpen, requirement, modalForRequirementId, apiBaseUrl]);

  useEffect(() => {
    if (editingEntryId && commentInputRef.current) {
      commentInputRef.current.focus();
    }
  }, [editingEntryId]);

  const hasUnsavedChanges = useMemo(() => editingEntryId !== null, [editingEntryId]);

  const handleCloseRequest = () => {
    if (hasUnsavedChanges) {
      setIsCloseConfirmOpen(true);
    } else {
      onClose();
    }
  };

  const modalRef = useClickOutside(handleCloseRequest);

  if (!isOpen || !requirement || !requirement.history) {
    return null;
  }

  const handleStartEdit = (historyEntry) => {
    setEditingEntryId(historyEntry.id);
    setEditFormDate(historyEntry.date);
    setEditFormComment(historyEntry.comment || '');
  };

  const handleSaveEdit = (originalHistoryEntry) => {
    if (!editingEntryId || editingEntryId !== originalHistoryEntry.id) return;
    if (!editFormDate || !(editFormDate instanceof Date) || isNaN(editFormDate.getTime())) {
      alert("A valid date is required.");
      return;
    }

    onSaveHistoryEntry(requirement.id, originalHistoryEntry.activityId, editFormDate, editFormComment);
    setEditingEntryId(null);
  };

  const handleCancelEdit = () => { setEditingEntryId(null); };

  const displayHistory = requirement.history.slice().sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return (
    <div id="history-modal-wrapper-id">
      <div id="history-modal-overlay-id" className="history-modal-overlay">
        <div ref={modalRef} id={`history-modal-content-${requirement.id}`} className="history-modal-content">
          <h2 id={`history-modal-title-${requirement.id}`}>History for: {requirement.requirementUserIdentifier}</h2>
          <button id={`history-modal-close-button-${requirement.id}`} onClick={onClose} className="history-modal-close-button">Close</button>
          
          <h3 id={`status-history-title-${requirement.id}`} style={{marginTop: '20px', marginBottom: '10px', fontSize: '1.2em', color: '#5C4033'}}>Status History</h3>
          <table id={`status-history-table-${requirement.id}`} className="history-modal-table">
            <thead>
              <tr><th>Status</th><th>Date</th><th>Sprint</th><th>Comment</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {displayHistory.map((entry) => {
                const isEditingThisRow = editingEntryId === entry.id;
                return (
                  <tr key={entry.id} id={`history-row-${entry.id}`}>
                    <td id={`history-status-${entry.id}`}>{entry.status}</td>
                    <td id={`history-date-${entry.id}`}>
                      {isEditingThisRow ? (
                        <DatePicker
                          selected={editFormDate}
                          onChange={date => setEditFormDate(date)}
                          dateFormat="MM/dd/yyyy"
                          className="notes-datepicker"
                          wrapperClassName="date-picker-wrapper"
                          popperPlacement="top-start"
                          portalId="root" 
                        />
                      ) : ( formatDateForDisplayInternal(entry.date) )}
                    </td>
                    <td id={`history-sprint-${entry.id}`} style={{ whiteSpace: 'nowrap' }}>{entry.sprint || 'N/A'}</td>
                    <td id={`history-comment-${entry.id}`}>
                      {isEditingThisRow ? (
                        <input ref={commentInputRef} type="text" id={`history-comment-input-${entry.id}`} name={`history-comment-${entry.id}`} value={editFormComment} onChange={e => setEditFormComment(e.target.value)} placeholder="Enter comment" />
                      ) : ( entry.comment || 'N/A' )}
                    </td>
                    <td id={`history-actions-${entry.id}`} style={{ whiteSpace: 'nowrap' }}>
                      {isEditingThisRow ? (
                        <div id={`history-edit-actions-container-${entry.id}`}>
                          <button id={`history-save-button-${entry.id}`} onClick={() => handleSaveEdit(entry)}>Save</button>
                          <button id={`history-cancel-button-${entry.id}`} onClick={handleCancelEdit}>Cancel</button>
                        </div>
                      ) : ( entry.activityId ? 
                        <button 
                          id={`edit-history-button-${entry.id}`}
                          onClick={() => handleStartEdit(entry)}
                          title={`Edit history entry for status '${entry.status}' on ${formatDateForDisplayInternal(entry.date)}`}
                          data-testid={`edit-history-button-${entry.id}`}
                        >
                          Edit
                        </button> : null 
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {isLoadingChanges && <p id={`loading-changes-message-${requirement.id}`}>Loading scope changes...</p>}
          {!isLoadingChanges && changeHistory.length > 0 && (
            <div id={`scope-change-history-section-${requirement.id}`}>
              <h3 id={`scope-change-history-title-${requirement.id}`} style={{marginTop: '30px', marginBottom: '10px', fontSize: '1.2em', color: '#5C4033'}}>Scope Change History</h3>
              <table id={`scope-change-history-table-${requirement.id}`} className="history-modal-table">
                <thead>
                    <tr>
                        <th style={{width: '30%'}}>Date of Change</th>
                        <th>Reason</th>
                    </tr>
                </thead>
                <tbody>
                    {changeHistory.map(change => (
                        <tr key={change.id} id={`change-history-row-${change.id}`}>
                            <td id={`change-history-date-${change.id}`}>{new Date(change.changed_at).toLocaleString()}</td>
                            <td id={`change-history-reason-${change.id}`}>{change.reason || <span style={{fontStyle: 'italic', color: '#888'}}>No reason provided.</span>}</td>
                        </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}

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
        message="You are currently editing a history entry. Are you sure you want to close and discard your changes?"
      />
    </div>
  );
};

export default HistoryModal;
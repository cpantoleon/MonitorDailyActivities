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
    <>
      <div className="history-modal-overlay">
        <div ref={modalRef} className="history-modal-content">
          <h2>History for: {requirement.requirementUserIdentifier}</h2>
          <button onClick={onClose} className="history-modal-close-button">Close</button>
          
          <h3 style={{marginTop: '20px', marginBottom: '10px', fontSize: '1.2em', color: '#5C4033'}}>Status History</h3>
          <table className="history-modal-table">
            <thead>
              <tr><th>Status</th><th>Date</th><th>Sprint</th><th>Comment</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {displayHistory.map((entry) => {
                const isEditingThisRow = editingEntryId === entry.id;
                return (
                  <tr key={entry.id}>
                    <td>{entry.status}</td>
                    <td>
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
                    {/* FIX 2: Added style to prevent wrapping */}
                    <td style={{ whiteSpace: 'nowrap' }}>{entry.sprint || 'N/A'}</td>
                    <td>
                      {isEditingThisRow ? (
                        <input ref={commentInputRef} type="text" id={`history-comment-${entry.id}`} name={`history-comment-${entry.id}`} value={editFormComment} onChange={e => setEditFormComment(e.target.value)} placeholder="Enter comment" />
                      ) : ( entry.comment || 'N/A' )}
                    </td>
                    {/* FIX 3: Added style to prevent wrapping */}
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {isEditingThisRow ? (
                        <><button onClick={() => handleSaveEdit(entry)}>Save</button><button onClick={handleCancelEdit}>Cancel</button></>
                      ) : ( entry.activityId ? 
                        <button 
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

          {isLoadingChanges && <p>Loading scope changes...</p>}
          {!isLoadingChanges && changeHistory.length > 0 && (
            <>
              <h3 style={{marginTop: '30px', marginBottom: '10px', fontSize: '1.2em', color: '#5C4033'}}>Scope Change History</h3>
              <table className="history-modal-table">
                <thead>
                    <tr>
                        <th style={{width: '30%'}}>Date of Change</th>
                        <th>Reason</th>
                    </tr>
                </thead>
                <tbody>
                    {changeHistory.map(change => (
                        <tr key={change.id}>
                            <td>{new Date(change.changed_at).toLocaleString()}</td>
                            <td>{change.reason || <span style={{fontStyle: 'italic', color: '#888'}}>No reason provided.</span>}</td>
                        </tr>
                    ))}
                </tbody>
              </table>
            </>
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
    </>
  );
};

export default HistoryModal;
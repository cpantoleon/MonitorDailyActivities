import React, { useState, useEffect } from 'react';
import useClickOutside from '../hooks/useClickOutside';

const DefectHistoryModal = ({ isOpen, onClose, defect, history, onSaveComment }) => {
  const modalRef = useClickOutside(onClose);
  const [editingId, setEditingId] = useState(null);
  const [editComment, setEditComment] = useState('');

  useEffect(() => {
    if (!isOpen) {
        setEditingId(null);
        setEditComment('');
    }
  }, [isOpen]);

  if (!isOpen || !defect) return null;

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  const handleEditClick = (entry) => {
      setEditingId(entry.id);
      setEditComment(entry.comment || '');
  };

  const handleCancelClick = () => {
      setEditingId(null);
      setEditComment('');
  };

  const handleSaveClick = (historyId) => {
      if (onSaveComment) {
          onSaveComment(historyId, editComment);
      }
      setEditingId(null);
  };

  const renderChangeSummary = (summaryString) => {
    if (!summaryString) return <span id={`summary-text-empty-${defect.id}`}>-</span>;
    try {
      const summary = JSON.parse(summaryString);
      return (
        <ul id={`summary-list-${defect.id}`} style={{ margin: 0, paddingLeft: '20px', listStyleType: 'disc' }}>
          {Object.entries(summary).map(([field, values]) => (
            <li key={field} id={`summary-item-${defect.id}-${field}`} style={{ marginBottom: '3px' }}>
              <strong>{field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}:</strong> 
              <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>"{values.old || '-'}"</span> to <span style={{ fontWeight: '500' }}>"{values.new || '-'}"</span>
            </li>
          ))}
        </ul>
      );
    } catch (e) {
      if (summaryString === "Defect created." || (typeof summaryString === 'string' && summaryString.startsWith('{'))) {
         try {
            const summary = JSON.parse(summaryString);
             return (
                <ul id={`summary-list-created-${defect.id}`} style={{ margin: 0, paddingLeft: '20px', listStyleType: 'disc' }}>
                {Object.entries(summary).map(([field, values]) => (
                    <li key={field} id={`summary-item-created-${defect.id}-${field}`} style={{ marginBottom: '3px' }}>
                    <strong>{field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}:</strong> 
                    <span style={{ fontWeight: '500' }}>"{values.new || '-'}"</span>
                    </li>
                ))}
                </ul>
            );
         } catch (jsonErr) {
            return <span id={`summary-text-plain-${defect.id}`}>{summaryString}</span>;
         }
      }
      return <span id={`summary-text-fallback-${defect.id}`}>{summaryString}</span>;
    }
  };

  return (
    <div id="history-modal-overlay-id" className="history-modal-overlay">
      <div ref={modalRef} id={`history-modal-content-${defect.id}`} className="history-modal-content" style={{maxWidth: '900px'}}>
        <style>{`
          .history-modal-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 15px;
          }
          .history-modal-table th, .history-modal-table td {
            padding: 10px;
            border: 1px solid var(--border-color);
            text-align: left;
            color: var(--text-primary);
          }
          .history-modal-table th {
            background-color: var(--bg-tertiary);
            font-weight: 600;
          }
          .history-modal-table tr:nth-child(even) {
            background-color: var(--bg-secondary);
          }
        `}</style>
        <h2 id={`history-modal-title-${defect.id}`}>History for Defect: {defect.title}</h2>
        <button id="history-modal-close-button-id" onClick={onClose} className="history-modal-close-button">Close</button>
        {history.length === 0 ? (
          <p id={`no-history-message-${defect.id}`}>No history recorded for this defect yet.</p>
        ) : (
          <table id={`history-modal-table-${defect.id}`} className="history-modal-table">
            <thead>
              <tr>
                <th style={{width: '180px'}}>Changed At</th>
                <th>Changes Summary</th>
                <th>Comment</th>
                <th style={{width: '120px'}}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {history.slice().sort((a,b) => new Date(b.changed_at) - new Date(a.changed_at)).map(entry => {
                const isEditing = editingId === entry.id;
                return (
                    <tr key={entry.id} id={`history-entry-row-${entry.id}`}>
                    <td id={`history-entry-date-${entry.id}`}>{formatDate(entry.changed_at)}</td>
                    <td id={`history-entry-summary-${entry.id}`}>{renderChangeSummary(entry.changes_summary)}</td>
                    <td id={`history-entry-comment-${entry.id}`}>
                        {isEditing ? (
                            <input 
                                type="text" 
                                value={editComment} 
                                onChange={(e) => setEditComment(e.target.value)}
                                autoFocus
                            />
                        ) : (
                            entry.comment || '-'
                        )}
                    </td>
                    <td id={`history-entry-actions-${entry.id}`}>
                        {isEditing ? (
                            <div style={{ display: 'flex', gap: '5px' }}>
                                <button onClick={() => handleSaveClick(entry.id)} className="btn-primary" style={{padding: '4px 8px', fontSize: '0.8rem'}}>Save</button>
                                <button onClick={handleCancelClick} className="modal-button-cancel" style={{padding: '4px 8px', fontSize: '0.8rem'}}>Cancel</button>
                            </div>
                        ) : (
                            <button onClick={() => handleEditClick(entry)} className="defect-action-btn" style={{padding: '4px 8px'}}>Edit</button>
                        )}
                    </td>
                    </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default DefectHistoryModal;
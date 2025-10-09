import React from 'react';
import useClickOutside from '../hooks/useClickOutside';

const DefectHistoryModal = ({ isOpen, onClose, defect, history }) => {
  const modalRef = useClickOutside(onClose);

  if (!isOpen || !defect) return null;

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
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
              <span style={{ color: '#777', fontStyle: 'italic' }}>"{values.old || '-'}"</span> to <span style={{ fontWeight: '500' }}>"{values.new || '-'}"</span>
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
      <div ref={modalRef} id={`history-modal-content-${defect.id}`} className="history-modal-content" style={{maxWidth: '800px'}}>
        <h2 id={`history-modal-title-${defect.id}`}>History for Defect: {defect.title}</h2>
        <button id="history-modal-close-button-id" onClick={onClose} className="history-modal-close-button">Close</button>
        {history.length === 0 ? (
          <p id={`no-history-message-${defect.id}`}>No history recorded for this defect yet.</p>
        ) : (
          <table id={`history-modal-table-${defect.id}`} className="history-modal-table">
            <thead>
              <tr>
                <th>Changed At</th>
                <th>Changes Summary</th>
                <th>Comment</th>
              </tr>
            </thead>
            <tbody>
              {history.slice().sort((a,b) => new Date(b.changed_at) - new Date(a.changed_at)).map(entry => (
                <tr key={entry.id} id={`history-entry-row-${entry.id}`}>
                  <td id={`history-entry-date-${entry.id}`}>{formatDate(entry.changed_at)}</td>
                  <td id={`history-entry-summary-${entry.id}`}>{renderChangeSummary(entry.changes_summary)}</td>
                  <td id={`history-entry-comment-${entry.id}`}>{entry.comment || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default DefectHistoryModal;
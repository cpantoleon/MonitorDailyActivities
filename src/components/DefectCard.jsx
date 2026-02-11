import React, { useState } from 'react';

const DefectCard = ({ defect, onEdit, onShowHistory, onDeleteRequest, onNavigate, onDragStart, onMoveToClosed, onUpdateFixedDate }) => {
  
  const getLocalDateTime = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    const pad = (num) => String(num).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  const [isEditingDate, setIsEditingDate] = useState(false);
  const [tempDate, setTempDate] = useState(getLocalDateTime(defect.fixed_date));

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return 'Invalid Date';
    }
    return date.toLocaleDateString();
  };

  const isDraggable = defect.status !== 'Closed';

  const handleDragStart = (e, def) => {
    if (!isDraggable) {
      e.preventDefault();
      return;
    }
    onDragStart(e, def);
    const draggedElement = e.currentTarget;
    setTimeout(() => {
      draggedElement.classList.add('dragging');
    }, 0);
  };

  const handleDragEnd = (e) => {
    e.currentTarget.classList.remove('dragging');
  };

  const handleSaveDate = () => {
      if (onUpdateFixedDate) {
          onUpdateFixedDate(defect, tempDate);
      }
      setIsEditingDate(false);
  };

  const handleCancelDate = () => {
      setTempDate(getLocalDateTime(defect.fixed_date));
      setIsEditingDate(false);
  };

  return (
    <div 
      id={`defect-card-${defect.id}`}
      className="defect-card"
      draggable={isDraggable}
      onDragStart={(e) => handleDragStart(e, defect)}
      onDragEnd={handleDragEnd}
      style={{ cursor: isDraggable ? 'grab' : 'default' }}
    >
      <h4 id={`defect-card-title-${defect.id}`} className="defect-card-title">
        {defect.title}
        {defect.is_fat_defect ? <span id={`fat-defect-badge-${defect.id}`} className="fat-defect-badge">FAT</span> : null}
      </h4>
      {defect.area !== 'Imported' && <p id={`defect-card-area-${defect.id}`} className="defect-card-area"><strong>Area:</strong> {defect.area}</p>}
      {defect.description && <p id={`defect-card-description-${defect.id}`} className="defect-card-description"><strong>Description:</strong> {defect.description}</p>}
      
      {defect.lastComment && defect.lastComment.trim() !== '-' && defect.lastComment.trim() !== '' && (
        <p id={`defect-card-comment-${defect.id}`} className="defect-card-comment">
          <strong>Last Comment:</strong> {defect.lastComment}
        </p>
      )}

      {defect.link && <p id={`defect-card-link-${defect.id}`} className="defect-card-link"><strong>Link:</strong> <a href={defect.link} target="_blank" rel="noopener noreferrer">{defect.link}</a></p>}
      <p id={`defect-card-date-${defect.id}`} className="defect-card-date"><strong>Logged:</strong> {formatDate(defect.created_date)}</p>
      
      {(defect.status === 'Done' || defect.status === 'Closed') && (
        <p 
          id={`defect-card-fixed-date-container-${defect.id}`} 
          className="defect-card-fixed-date"
          style={{ display: 'flex', alignItems: 'center', gap: '5px' }}
        >
            <strong>Fixed Date:</strong>
            {isEditingDate ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <input 
                        type="datetime-local" 
                        value={tempDate} 
                        onChange={(e) => setTempDate(e.target.value)}
                        style={{ padding: '2px', fontSize: '0.9em', border: '1px solid #ccc', borderRadius: '3px' }}
                    />
                    <button 
                        onClick={handleSaveDate} 
                        title="Save"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'green', fontWeight: 'bold', padding: 0 }}
                    >
                        ✓
                    </button>
                    <button 
                        onClick={handleCancelDate} 
                        title="Cancel"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'red', fontWeight: 'bold', padding: 0 }}
                    >
                        ✕
                    </button>
                </span>
            ) : (
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    {defect.fixed_date ? new Date(defect.fixed_date).toLocaleString() : 'N/A'}
                    {defect.status === 'Done' && (
                        <button 
                            onClick={() => { setIsEditingDate(true); setTempDate(getLocalDateTime(defect.fixed_date)); }}
                            title="Edit Fixed Date"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#007bff', padding: 0 }}
                        >
                            ✏️
                        </button>
                    )}
                </span>
            )}
        </p>
      )}

      <p id={`defect-card-updated-${defect.id}`} className="defect-card-updated"><strong>Last Update:</strong> {new Date(defect.updated_at).toLocaleString()}</p>

      {defect.linkedRequirements && defect.linkedRequirements.length > 0 && (
        <div id={`card-detail-item-linked-reqs-${defect.id}`} className="card-detail-item">
          <span id={`detail-label-linked-reqs-${defect.id}`} className="detail-label">Linked Requirements:</span>
          <div id={`linked-items-container-${defect.id}`} className="linked-items-container">
            {defect.linkedRequirements.map(req => (
              <button 
                id={`linked-req-tag-${req.groupId}`}
                key={req.groupId} 
                className="linked-item-tag requirement"
                onClick={() => onNavigate(defect.project, req.sprint, req.groupId)}
                title={`Go to requirement in Sprint: ${req.sprint}`}
              >
                {req.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div id={`defect-card-actions-${defect.id}`} className="defect-card-actions">
        <button id={`defect-action-button-edit-${defect.id}`} onClick={() => onEdit(defect)} className="defect-action-button edit" title={`Edit defect: ${defect.title}`}>Edit</button>
        <button id={`defect-action-button-history-${defect.id}`} onClick={() => onShowHistory(defect)} className="defect-action-button history" title={`View history for defect: ${defect.title}`}>History</button>
        <button 
          id={`defect-action-button-delete-${defect.id}`}
          onClick={() => onDeleteRequest(defect)} 
          className="defect-action-button delete"
          title={`Delete defect: ${defect.title}`}
        >
          Delete
        </button>
        {defect.status !== 'Closed' && (
            <button 
                id={`defect-action-button-move-${defect.id}`}
                onClick={() => onMoveToClosed(defect)} 
                className="defect-action-button move"
                title="Move defect to Closed"
            >
                Move to Closed
            </button>
        )}
      </div>
    </div>
  );
};

export default DefectCard;
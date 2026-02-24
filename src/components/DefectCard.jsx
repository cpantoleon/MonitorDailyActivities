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
      className="defect-card kanban-card"
      draggable={isDraggable}
      onDragStart={(e) => handleDragStart(e, defect)}
      onDragEnd={handleDragEnd}
      style={{ cursor: isDraggable ? 'grab' : 'default', position: 'relative' }}
    >
      {!!defect.is_fat_defect && <div className="fat-bubble">FAT</div>}
      
      {isDraggable && (
        <div style={{
            position: 'absolute',
            top: '8px',
            right: '8px',
            cursor: 'grab',
            color: 'var(--text-secondary)',
            opacity: 0.4,
            fontSize: '14px',
            lineHeight: 1,
            userSelect: 'none'
        }} title="Drag to move">
          ⋮⋮
        </div>
      )}

      <div className="kanban-card-main-content" style={{ flexGrow: 1 }}>
        <strong id={`defect-card-title-${defect.id}`} style={{ display: 'block', marginBottom: '12px', color: 'var(--text-primary)', fontWeight: '600', fontSize: '1.05rem', wordBreak: 'break-word' }}>
          {defect.title}
        </strong>

        <div className="kanban-card-details">
          {defect.area !== 'Imported' && (
            <div className="card-detail-item">
              <span className="detail-label">Area:</span>
              <span className="detail-value">{defect.area}</span>
            </div>
          )}

          {defect.description && (
            <div className="card-detail-item">
              <span className="detail-label">Description:</span>
              <span className="detail-value" style={{ whiteSpace: 'pre-wrap' }}>{defect.description}</span>
            </div>
          )}
          
          {defect.lastComment && defect.lastComment.trim() !== '-' && defect.lastComment.trim() !== '' && (
            <div className="card-detail-item">
              <span className="detail-label">Last Comment:</span>
              <span className="detail-value" style={{ whiteSpace: 'pre-wrap' }}>{defect.lastComment}</span>
            </div>
          )}

          {defect.link && (
            <div className="card-detail-item">
              <span className="detail-label">Link:</span>
              <a href={defect.link} target="_blank" rel="noopener noreferrer" className="detail-value">{defect.link}</a>
            </div>
          )}

          <div className="card-detail-item">
            <span className="detail-label">Logged:</span>
            <span className="detail-value">{formatDate(defect.created_date)}</span>
          </div>
          
          {(defect.status === 'Done' || defect.status === 'Closed') && (
            <div className="card-detail-item">
                <span className="detail-label">Fixed Date:</span>
                <span className="detail-value" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    {isEditingDate ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <input 
                                type="datetime-local" 
                                value={tempDate} 
                                onChange={(e) => setTempDate(e.target.value)}
                                style={{ padding: '4px', fontSize: '0.9em', border: '1px solid var(--border-color)', borderRadius: '4px', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                            />
                            <button 
                                onClick={handleSaveDate} 
                                title="Save"
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#28a745', fontWeight: 'bold', padding: '0 5px', fontSize: '1.1em' }}
                            >
                                ✓
                            </button>
                            <button 
                                onClick={handleCancelDate} 
                                title="Cancel"
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc3545', fontWeight: 'bold', padding: '0 5px', fontSize: '1.1em' }}
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
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-color)', padding: 0 }}
                                >
                                    ✏️
                                </button>
                            )}
                        </span>
                    )}
                </span>
            </div>
          )}

          <div className="card-detail-item">
            <span className="detail-label">Last Update:</span>
            <span className="detail-value">{new Date(defect.updated_at).toLocaleString()}</span>
          </div>

          {defect.linkedRequirements && defect.linkedRequirements.length > 0 && (
            <div className="card-detail-item" style={{ marginTop: '10px' }}>
              <span className="detail-label" style={{ marginBottom: '5px' }}>Linked Requirements:</span>
              <div className="linked-items-container">
                {defect.linkedRequirements.map(req => (
                  <button 
                    id={`linked-req-tag-${req.groupId}`}
                    key={req.groupId} 
                    className="linked-item-tag"
                    onClick={() => onNavigate(defect.project, req.sprint, req.groupId)}
                    title={`Go to requirement in Sprint: ${req.sprint}`}
                  >
                    {req.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="defect-card-actions">
        <button id={`defect-action-button-edit-${defect.id}`} onClick={() => onEdit(defect)} className="defect-action-btn edit" title={`Edit defect: ${defect.title}`}>Edit</button>
        <button id={`defect-action-button-history-${defect.id}`} onClick={() => onShowHistory(defect)} className="defect-action-btn history" title={`View history for defect: ${defect.title}`}>History</button>
        {defect.status !== 'Closed' && (
            <button 
                id={`defect-action-button-move-${defect.id}`}
                onClick={() => onMoveToClosed(defect)} 
                className="defect-action-btn close-btn"
                title="Move defect to Closed"
            >
                Close
            </button>
        )}
        <button 
          id={`defect-action-button-delete-${defect.id}`}
          onClick={() => onDeleteRequest(defect)} 
          className="defect-action-btn delete"
          title={`Delete defect: ${defect.title}`}
        >
          Delete
        </button>
      </div>
    </div>
  );
};

export default DefectCard;
import React from 'react';

const DefectCard = ({ defect, onEdit, onShowHistory, onDeleteRequest, onNavigate, onDragStart, onMoveToClosed }) => {
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
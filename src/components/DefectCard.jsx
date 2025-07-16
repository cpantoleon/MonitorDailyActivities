import React from 'react';

const DefectCard = ({ defect, onEdit, onShowHistory, onDeleteRequest, onNavigate, onDragStart }) => {
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString + 'T00:00:00').toLocaleDateString();
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
      className="defect-card"
      draggable={isDraggable}
      onDragStart={(e) => handleDragStart(e, defect)}
      onDragEnd={handleDragEnd}
      style={{ cursor: isDraggable ? 'grab' : 'default' }}
    >
      <h4 className="defect-card-title">{defect.title}</h4>
      {defect.area !== 'Imported' && <p className="defect-card-area"><strong>Area:</strong> {defect.area}</p>}
      {defect.description && <p className="defect-card-description"><strong>Description:</strong> {defect.description}</p>}
      {defect.link && <p className="defect-card-link"><strong>Link:</strong> <a href={defect.link} target="_blank" rel="noopener noreferrer">{defect.link}</a></p>}
      <p className="defect-card-date"><strong>Logged:</strong> {formatDate(defect.created_date)}</p>
      <p className="defect-card-updated"><strong>Last Update:</strong> {new Date(defect.updated_at).toLocaleString()}</p>
      
      {defect.linkedRequirements && defect.linkedRequirements.length > 0 && (
        <div className="card-detail-item">
          <span className="detail-label">Linked Requirements:</span>
          <div className="linked-items-container">
            {defect.linkedRequirements.map(req => (
              <button 
                key={req.groupId} 
                className="linked-item-tag requirement"
                onClick={() => onNavigate(defect.project, req.sprint)}
                title={`Go to requirement in Sprint: ${req.sprint}`}
              >
                {req.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="defect-card-actions">
        <button onClick={() => onEdit(defect)} className="defect-action-button edit" title={`Edit defect: ${defect.title}`}>Edit</button>
        <button onClick={() => onShowHistory(defect)} className="defect-action-button history" title={`View history for defect: ${defect.title}`}>History</button>
        <button 
          onClick={() => onDeleteRequest(defect)} 
          className="defect-action-button delete"
          title={`Delete defect: ${defect.title}`}
        >
          Delete
        </button>
      </div>
    </div>
  );
};

export default DefectCard;
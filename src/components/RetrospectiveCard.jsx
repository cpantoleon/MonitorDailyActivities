import React from 'react';

const RetrospectiveCard = ({ item, onEdit, onDelete, onDragStart }) => {
  const formatDate_MMDDYYYY = (dateString_YYYY_MM_DD) => {
    if (!dateString_YYYY_MM_DD) {
      return 'N/A';
    }
    const parts = String(dateString_YYYY_MM_DD).split('-');

    if (parts.length === 3) {
      const year = parts[0];
      const month = parts[1];
      const day = parts[2];
      return `${month}/${day}/${year}`;
    }
    return dateString_YYYY_MM_DD;
  };

  const handleDragStart = (e, itm) => {
    onDragStart(e, itm);
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
      id={`retrospective-card-${item.id}`}
      className="retro-item"
      draggable="true"
      onDragStart={(e) => handleDragStart(e, item)}
      onDragEnd={handleDragEnd}
      style={{ cursor: 'grab' }}
    >
      <div className="retro-card-content" style={{ flexGrow: 1 }}>
        <strong id={`retro-card-description-${item.id}`} style={{ display: 'block', marginBottom: '12px', color: 'var(--text-primary)', fontWeight: '600', fontSize: '1.05rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {item.description}
        </strong>
        
        <div className="kanban-card-details">
          {item.details && (
            <div id={`retro-card-details-${item.id}`} className="card-detail-item">
              <span className="detail-label">Details:</span>
              <span className="detail-value" style={{ whiteSpace: 'pre-wrap' }}>{item.details}</span>
            </div>
          )}

          <div id={`retro-card-date-${item.id}`} className="card-detail-item">
            <span className="detail-label">Date:</span>
            <span className="detail-value">{formatDate_MMDDYYYY(item.item_date)}</span>
          </div>
        </div>
      </div>
      
      <div id={`retro-card-actions-${item.id}`} className="retro-item-actions">
        <button id={`retro-button-edit-${item.id}`} onClick={() => onEdit(item)} className="retro-action-btn" title={`Edit item: ${item.description}`}>Edit</button>
        <button id={`retro-button-delete-${item.id}`} onClick={() => onDelete(item.id)} className="retro-action-btn delete" title={`Delete item: ${item.description}`}>Delete</button>
      </div>
    </div>
  );
};

export default RetrospectiveCard;
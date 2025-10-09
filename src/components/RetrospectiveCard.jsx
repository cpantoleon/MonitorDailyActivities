import React from 'react';
import './RetrospectiveCard.css';

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
      className="retrospective-card"
      draggable="true"
      onDragStart={(e) => handleDragStart(e, item)}
      onDragEnd={handleDragEnd}
      style={{ cursor: 'grab' }}
    >
      <p id={`retro-card-description-${item.id}`} className="retro-card-description">{item.description}</p>
      <p id={`retro-card-details-${item.id}`} className="retro-card-details"><strong>Details:</strong> {item.details}</p>
      <p id={`retro-card-date-${item.id}`} className="retro-card-date">Date: {formatDate_MMDDYYYY(item.item_date)}</p>
      <div id={`retro-card-actions-${item.id}`} className="retro-card-actions">
        <button id={`retro-button-edit-${item.id}`} onClick={() => onEdit(item)} className="retro-button retro-button-edit" title={`Edit item: ${item.description}`}>Edit</button>
        <button id={`retro-button-delete-${item.id}`} onClick={() => onDelete(item.id)} className="retro-button retro-button-delete" title={`Delete item: ${item.description}`}>Delete</button>
      </div>
    </div>
  );
};

export default RetrospectiveCard;
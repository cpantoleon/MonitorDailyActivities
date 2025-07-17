import React from 'react';
import { useNavigate } from 'react-router-dom';

const KanbanCard = React.memo(({
  requirement,
  onShowHistory,
  onEditRequirement,
  onDeleteRequirement,
  onDragStart
}) => {
  const { comment, link, type, tags, releaseName, releaseDate } = requirement.currentStatusDetails;
  const navigate = useNavigate();

  const handleDefectClick = (project) => {
    navigate(`/defects?project=${encodeURIComponent(project)}`);
  };

  const handleDragStart = (e, req) => {
    onDragStart(e, req);
    
    const draggedElement = e.currentTarget;
    
    setTimeout(() => {
      draggedElement.classList.add('dragging');
    }, 0);
  };

  const handleDragEnd = (e) => {
    e.currentTarget.classList.remove('dragging');
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    // Add 'T00:00:00' to treat the date string as local, not UTC
    return new Date(dateString + 'T00:00:00').toLocaleDateString();
  };

  return (
    <div 
      className="kanban-card"
      draggable="true"
      onDragStart={(e) => handleDragStart(e, requirement)}
      onDragEnd={handleDragEnd}
    >
      <div className="kanban-card-main-content">
        <strong>{requirement.requirementUserIdentifier}</strong>

        <div className="kanban-card-details">
          {releaseName && (
            <p className="card-detail-item">
              <span className="detail-label">Release:</span>
              <span className="detail-value">{releaseName} (Due: {formatDate(releaseDate)})</span>
            </p>
          )}

          {type && (
            <p className="card-detail-item">
              <span className="detail-label">Type:</span>
              <span className="detail-value">{type}</span>
            </p>
          )}

          {tags && (
            <p className="card-detail-item">
              <span className="detail-label">Tags:</span>
              <span className="detail-value">{tags}</span>
            </p>
          )}

          {comment && (
            <p className="card-detail-item">
              <span className="detail-label">Comment:</span>
              <span className="detail-value">{comment}</span>
            </p>
          )}

          {link && (
            <p className="card-detail-item">
              <span className="detail-label">Link:</span>
              <a href={link} target="_blank" rel="noopener noreferrer" className="detail-value">
                {link}
              </a>
            </p>
          )}

          {requirement.linkedDefects && requirement.linkedDefects.length > 0 && (
            <div className="card-detail-item">
              <span className="detail-label">Linked Defects:</span>
              <div className="linked-items-container">
                {requirement.linkedDefects.map(defect => (
                  <button 
                    key={defect.id} 
                    className={`linked-item-tag defect ${defect.status === 'Closed' ? 'closed' : ''}`}
                    onClick={() => handleDefectClick(requirement.project)}
                    title={`Go to defects for project ${requirement.project} (Status: ${defect.status})`}
                  >
                    {defect.title}
                  </button>
                ))}
              </div>
            </div>
          )}

          {!releaseName && !comment && !link && !type && !tags && (!requirement.linkedDefects || requirement.linkedDefects.length === 0) && (
            <p className="card-detail-item-empty">No additional details.</p>
          )}
        </div>
      </div>

      <div className="kanban-card-buttons-container">
        <button 
          onClick={() => onEditRequirement(requirement)} 
          className="edit-card-button"
          title={`Edit ${requirement.requirementUserIdentifier}`}
        >
          Edit
        </button>
        
        <button 
          onClick={() => onShowHistory(requirement)} 
          className="history-card-button"
          title={`View history for ${requirement.requirementUserIdentifier}`}
        >
          History
        </button>

        <button
          onClick={() => onDeleteRequirement(requirement.id, requirement.project, requirement.requirementUserIdentifier)}
          className="delete-card-button"
          title={`Delete ${requirement.requirementUserIdentifier}`}
        >
          Delete
        </button>
      </div>
    </div>
  );
});

export default KanbanCard;
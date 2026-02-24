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

  const handleDefectClick = (project, defect) => {
    let url = `/defects?project=${encodeURIComponent(project)}&highlight=${defect.id}`;
    if (defect.status === 'Closed') {
      url += '&view=closed';
    }
    navigate(url);
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
    return new Date(dateString + 'T00:00:00').toLocaleDateString();
  };

  const getDefectStatusClass = (status) => {
    switch (status) {
      case 'Closed':
        return 'closed';
      case 'Done':
        return 'done';
      default:
        return 'open';
    }
  };

  return (
    <div 
      id={`req-card-${requirement.id}`}
      className="kanban-card"
      draggable="true"
      onDragStart={(e) => handleDragStart(e, requirement)}
      onDragEnd={handleDragEnd}
      style={{ position: 'relative' }}
    >
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
      <div id={`kanban-card-main-content-${requirement.id}`} className="kanban-card-main-content">
        <strong id={`requirement-identifier-${requirement.id}`}>{requirement.requirementUserIdentifier}</strong>

        <div id={`kanban-card-details-${requirement.id}`} className="kanban-card-details">
          {releaseName && (
            <p id={`card-detail-item-release-${requirement.id}`} className="card-detail-item">
              <span className="detail-label">Release:</span>
              <span className="detail-value">{releaseName} (Due: {formatDate(releaseDate)})</span>
            </p>
          )}

          {type && (
            <p id={`card-detail-item-type-${requirement.id}`} className="card-detail-item">
              <span className="detail-label">Type:</span>
              <span className="detail-value">{type}</span>
            </p>
          )}

          {tags && (
            <p id={`card-detail-item-tags-${requirement.id}`} className="card-detail-item">
              <span className="detail-label">Tags:</span>
              <span className="detail-value">{tags}</span>
            </p>
          )}

          {comment && (
            <p id={`card-detail-item-comment-${requirement.id}`} className="card-detail-item">
              <span className="detail-label">Comment:</span>
              <span className="detail-value">{comment}</span>
            </p>
          )}

          {link && (
            <p id={`card-detail-item-link-${requirement.id}`} className="card-detail-item">
              <span className="detail-label">Link:</span>
              <a href={link} target="_blank" rel="noopener noreferrer" className="detail-value">
                {link}
              </a>
            </p>
          )}

          {requirement.linkedDefects && requirement.linkedDefects.length > 0 && (
            <div id={`card-detail-item-defects-${requirement.id}`} className="card-detail-item">
              <span className="detail-label">Linked Defects:</span>
              <div id={`linked-items-container-${requirement.id}`} className="linked-items-container">
                {requirement.linkedDefects.map(defect => (
                  <button 
                    key={defect.id} 
                    id={`linked-defect-tag-${defect.id}`}
                    className={`linked-item-tag defect ${getDefectStatusClass(defect.status)}`}
                    onClick={() => handleDefectClick(requirement.project, defect)}
                    title={`Go to defects for project ${requirement.project} (Status: ${defect.status})`}
                  >
                    {defect.title}
                  </button>
                ))}
              </div>
            </div>
          )}

          {!releaseName && !comment && !link && !type && !tags && (!requirement.linkedDefects || requirement.linkedDefects.length === 0) && (
            <p id={`card-detail-item-empty-${requirement.id}`} className="card-detail-item-empty">No additional details.</p>
          )}
        </div>
      </div>

      <div id={`kanban-card-buttons-container-${requirement.id}`} className="kanban-card-buttons-container">
        <button 
          id={`edit-card-button-${requirement.id}`}
          onClick={() => onEditRequirement(requirement)} 
          className="edit-card-button"
          title={`Edit ${requirement.requirementUserIdentifier}`}
        >
          Edit
        </button>
        
        <button 
          id={`history-card-button-${requirement.id}`}
          onClick={() => onShowHistory(requirement)} 
          className="history-card-button"
          title={`View history for ${requirement.requirementUserIdentifier}`}
        >
          History
        </button>

        <button
          id={`delete-card-button-${requirement.id}`}
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
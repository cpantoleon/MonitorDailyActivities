import React from 'react';
import { useNavigate } from 'react-router-dom';

// Επαγγελματικό SVG Icon (Μάτι)
const FocusIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
    <circle cx="12" cy="12" r="3"></circle>
  </svg>
);

const getTypeClass = (type) => {
  if (!type) return 'default';
  const lowerType = type.toLowerCase();
  if (lowerType.includes('bug') || lowerType.includes('defect')) return 'bug';
  if (lowerType.includes('story')) return 'story';
  if (lowerType.includes('task') && !lowerType.includes('sub')) return 'task';
  if (lowerType.includes('sub-task') || lowerType.includes('subtask')) return 'sub-task';
  if (lowerType.includes('change') || lowerType.includes('cr')) return 'change-request';
  if (lowerType.includes('incident')) return 'incident';
  return 'default';
};

const KanbanCard = React.memo(({
  requirement,
  allRequirements,
  onShowHistory,
  onEditRequirement,
  onDeleteRequirement,
  onDragStart,
  focusedFamilyId,
  setFocusedFamilyId,
  onAddSubtask
}) => {
  const { comment, link, type, tags, releaseName, releaseDate } = requirement.currentStatusDetails;
  const navigate = useNavigate();

  // Υπολογισμοί για Sub-tasks & Focus Mode
  const isSubtask = !!requirement.parentId;
  
  // Ελέγχουμε αν αυτή η κάρτα (ως Parent) έχει παιδιά
  const hasSubtasks = allRequirements ? allRequirements.some(r => r.parentId === requirement.id) : false;
  
  // Το μάτι θα φαίνεται ΜΟΝΟ αν είναι subtask Ή αν είναι parent που έχει subtasks
  const showFocusIcon = isSubtask || hasSubtasks;

  const myFamilyId = isSubtask ? String(requirement.parentId) : String(requirement.id);
  const currentFocusId = focusedFamilyId ? String(focusedFamilyId) : null;
  
  const isFocused = currentFocusId === myFamilyId;
  let focusClass = '';
  if (currentFocusId) {
      if (isFocused) {
          focusClass = 'focus-active ' + (isSubtask ? 'focus-child' : 'focus-parent');
      }
  }

  let parentName = "Unknown Parent";
  if (isSubtask && allRequirements) {
      const parent = allRequirements.find(r => String(r.id) === String(requirement.parentId));
      if (parent) parentName = parent.requirementUserIdentifier;
  }

  const handleFocusToggle = (e) => {
      e.stopPropagation();
      if (focusedFamilyId === myFamilyId) {
          setFocusedFamilyId(null); 
      } else {
          setFocusedFamilyId(myFamilyId); 
      }
  };

  const handleDefectClick = (project, defect) => {
    let url = `/defects?d_project=${encodeURIComponent(project)}&highlight=${defect.id}`;
    if (defect.status === 'Closed') url += '&view=closed';
    navigate(url);
  };

  const handleDragStart = (e, req) => {
    onDragStart(e, req);
    const draggedElement = e.currentTarget;
    setTimeout(() => { draggedElement.classList.add('dragging'); }, 0);
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
      case 'Closed': return 'closed';
      case 'Done': return 'done';
      default: return 'open';
    }
  };

  return (
    <div 
      id={`req-card-${requirement.id}`}
      className={`kanban-card ${focusClass}`}
      draggable="true"
      onDragStart={(e) => handleDragStart(e, requirement)}
      onDragEnd={handleDragEnd}
      style={{ position: 'relative' }}
    >
      <div style={{
          position: 'absolute', top: '8px', right: '8px', cursor: 'grab',
          color: 'var(--text-secondary)', opacity: 0.4, fontSize: '14px',
          lineHeight: 1, userSelect: 'none'
      }} title="Drag to move">
        ⋮⋮
      </div>

      <div id={`kanban-card-main-content-${requirement.id}`} className="kanban-card-main-content">
        
        {/* Top Header: Εδώ μπαίνει το Μάτι (αριστερά) */}
        <div className="card-header-top" style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            {showFocusIcon && (
                <button 
                    type="button"
                    className={`focus-toggle-btn ${isFocused ? 'active' : ''}`} 
                    onClick={handleFocusToggle}
                    onMouseDown={(e) => e.stopPropagation()}
                    title={isFocused ? "Remove Focus" : "Highlight Family (Parent & Sub-tasks)"}
                    style={{ 
                        display: 'flex', 
                        alignItems: 'center',
                        color: isFocused ? 'var(--accent-color)' : 'var(--text-secondary)',
                        padding: 0,
                        margin: 0
                    }}
                >
                    <FocusIcon />
                </button>
            )}
        </div>

        <strong id={`requirement-identifier-${requirement.id}`}>{requirement.requirementUserIdentifier}</strong>

        <div id={`kanban-card-details-${requirement.id}`} className="kanban-card-details">
          {!isSubtask && releaseName && (
            <p id={`card-detail-item-release-${requirement.id}`} className="card-detail-item">
              <span className="detail-label">Release:</span>
              <span className="detail-value">{releaseName} (Due: {formatDate(releaseDate)})</span>
            </p>
          )}

          {/* ΕΔΩ ΕΙΝΑΙ Η ΑΛΛΑΓΗ ΓΙΑ ΤΟ TYPE BADGE */}
          {type && (
            <div id={`card-detail-item-type-${requirement.id}`} className="card-detail-item" style={{ flexDirection: 'row', alignItems: 'center', gap: '8px' }}>
              <span className="detail-label">Type:</span>
              <span className={`type-badge ${getTypeClass(type)}`}>{type}</span>
            </div>
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

          {!isSubtask && requirement.linkedDefects && requirement.linkedDefects.length > 0 && (
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
        </div>
      </div>

      {!isSubtask && (
          <button 
            type="button"
            className="add-subtask-btn" 
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onAddSubtask(requirement);
            }}
            onMouseDown={(e) => e.stopPropagation()}
            title="Create a new sub-task under this item"
          >
            + Add Sub-task
          </button>
      )}

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
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// Επαγγελματικό SVG Icon (Μάτι)
const FocusIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
    <circle cx="12" cy="12" r="3"></circle>
  </svg>
);

// Εικονίδιο Expand/Collapse (Απλό, καθαρό chevron)
const ToggleIcon = ({ isExpanded }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width="16" height="16" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2.5" 
    strokeLinecap="round" 
    strokeLinejoin="round"
    style={{
      transition: 'transform 0.3s ease',
      transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)'
    }}
  >
    <polyline points="6 9 12 15 18 9"></polyline>
  </svg>
);

// Εικονίδια για Expand / Collapse
const ChevronUp = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="18 15 12 9 6 15"></polyline>
  </svg>
);

const ChevronDown = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9"></polyline>
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
  const { comment, link, type, tags, releaseName, releaseDate, activityId, is_expanded } = requirement.currentStatusDetails;
  const navigate = useNavigate();

  // State για το Expand / Collapse
  // Αν το is_expanded είναι undefined (π.χ. παλιές εγγραφές πριν το migration), το θεωρούμε true (1)
  const [isExpanded, setIsExpanded] = useState(is_expanded !== 0);

  // Συγχρονισμός με το global state (όταν πατιέται το Expand All / Collapse All)
  useEffect(() => {
    setIsExpanded(is_expanded !== 0);
  }, [is_expanded]);

  const handleToggleExpand = (e) => {
    e.stopPropagation();
    const newState = !isExpanded;
    setIsExpanded(newState);
    
    // Ενημέρωση της βάσης στο background
    if (activityId) {
      fetch(`/api/activities/${activityId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_expanded: newState ? 1 : 0 })
      }).catch(err => console.error("Failed to save expand state", err));
    }
  };

  // Υπολογισμοί για Sub-tasks & Focus Mode
  const isSubtask = !!requirement.parentId;
  const hasSubtasks = allRequirements ? allRequirements.some(r => r.parentId === requirement.id) : false;
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
      data-id={requirement.id}
      className={`kanban-card ${focusClass}`}
      draggable="true"
      onDragStart={(e) => handleDragStart(e, requirement)}
      onDragEnd={handleDragEnd}
      style={{ position: 'relative' }}
    >
      {/* Drag Handle */}
      <div style={{
          position: 'absolute', top: '8px', right: '8px', cursor: 'grab',
          color: 'var(--text-secondary)', opacity: 0.4, fontSize: '14px',
          lineHeight: 1, userSelect: 'none'
      }} title="Drag to move">
        ⋮⋮
      </div>

      {/* Type Bubble (Εμφανίζεται ΜΟΝΟ όταν η κάρτα είναι collapsed) */}
      {!isExpanded && type && (
        <div className={`type-bubble type-badge ${getTypeClass(type)}`}>
          {type}
        </div>
      )}

      <div id={`kanban-card-main-content-${requirement.id}`} className="kanban-card-main-content">
        
        {/* Top Header: Μάτι (αριστερά) και Κουμπί Expand/Collapse (δεξιά) */}
        <div className="card-header-top" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', minHeight: '24px' }}>
            <div style={{ display: 'flex', gap: '10px' }}>
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
            
            {/* Νέο, διακριτικό κυκλικό κουμπί */}
            <button 
                type="button" 
                onClick={handleToggleExpand} 
                onMouseDown={(e) => e.stopPropagation()}
                title={isExpanded ? "Collapse Card" : "Expand Card"}
                style={{ 
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-color)',
                    width: '24px',
                    height: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 0, 
                    margin: 0, 
                    marginRight: '20px', /* Αφήνει χώρο για το drag handle */
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    borderRadius: '50%',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                }}
                onMouseOver={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'; e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.borderColor = 'var(--text-primary)'; }}
                onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'; e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'var(--border-color)'; }}
            >
                <ToggleIcon isExpanded={isExpanded} />
            </button>
        </div>

        <strong id={`requirement-identifier-${requirement.id}`}>{requirement.requirementUserIdentifier}</strong>

        {/* Λεπτομέρειες (Κρύβονται αν η κάρτα είναι Collapsed) */}
        {isExpanded && (
          <div id={`kanban-card-details-${requirement.id}`} className="kanban-card-details">
            {!isSubtask && releaseName && (
              <p id={`card-detail-item-release-${requirement.id}`} className="card-detail-item">
                <span className="detail-label">Release:</span>
                <span className="detail-value">{releaseName} (Due: {formatDate(releaseDate)})</span>
              </p>
            )}

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
        )}
      </div>

      {/* Κουμπί Add Sub-task (Ορατό μόνο αν δεν είναι subtask ΚΑΙ η κάρτα είναι ανοιχτή) */}
      {!isSubtask && isExpanded && (
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
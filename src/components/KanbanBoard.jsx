import React, { useState } from 'react';
import KanbanColumn from './KanbanColumn';

const KanbanBoard = ({
  requirements,
  allRequirements,
  onShowHistory,
  onEditRequirement,
  onDeleteRequirement,
  isSearching,
  onStatusUpdateRequest,
  onAddSubtask,
  onReorderRequirements,
  isSelectionMode,
  selectedIds,
  onToggleSelect,
  projectReleases
}) => {
  const columnTitles = ['To Do', 'Scenarios created', 'Under testing', 'Done'];
  
  // State για το Focus Mode (κρατάει το ID του Parent)
  const [focusedFamilyId, setFocusedFamilyId] = useState(null);

  const handleDragStart = (e, requirement) => {
    e.dataTransfer.setData("requirementId", requirement.id);
  };

  const handleDrop = (e, targetStatus, targetIndex) => {
    const requirementId = e.dataTransfer.getData("requirementId");
    const draggedRequirement = requirements.find(r => r.id.toString() === requirementId.toString());
    
    if (draggedRequirement && draggedRequirement.currentStatusDetails.status !== targetStatus) {
      onStatusUpdateRequest(draggedRequirement, targetStatus, targetIndex); // <--- Προστέθηκε το targetIndex
    }
  };

  const getRequirementsForColumn = (title) => {
    return requirements.filter(
      req => req.currentStatusDetails && req.currentStatusDetails.status === title
    );
  };

  return (
    <div id="kanban-board-container-id" className={`kanban-board-container ${focusedFamilyId ? 'focus-mode' : ''}`}>
      {columnTitles.map((title) => (
        <KanbanColumn
          key={title}
          title={title}
          requirements={getRequirementsForColumn(title)}
          allRequirements={allRequirements}
          onShowHistory={onShowHistory}
          onEditRequirement={onEditRequirement}
          onDeleteRequirement={onDeleteRequirement}
          onDragStart={handleDragStart}
          onDrop={handleDrop}
          focusedFamilyId={focusedFamilyId}
          setFocusedFamilyId={setFocusedFamilyId}
          onAddSubtask={onAddSubtask}
          onReorder={onReorderRequirements}
          isSelectionMode={isSelectionMode}
          selectedIds={selectedIds}
          onToggleSelect={onToggleSelect}
          projectReleases={projectReleases}
        />
      ))}
    </div>
  );
};

export default KanbanBoard;
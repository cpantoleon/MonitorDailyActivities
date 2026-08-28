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
    if (isSelectionMode && selectedIds.includes(requirement.id)) {
      e.dataTransfer.setData("isMultiDrag", "true");
      e.dataTransfer.setData("selectedIds", JSON.stringify(selectedIds));
    } else {
      e.dataTransfer.setData("isMultiDrag", "false");
    }
  };

  const handleDrop = (e, targetStatus, targetIndex) => {
    const isMultiDrag = e.dataTransfer.getData("isMultiDrag") === "true";

    if (isMultiDrag) {
      const selectedIdsArray = JSON.parse(e.dataTransfer.getData("selectedIds"));
      const draggedRequirements = requirements.filter(r => selectedIdsArray.includes(r.id) && r.currentStatusDetails.status !== targetStatus);

      if (draggedRequirements.length > 0) {
         const uniqueStatuses = new Set(draggedRequirements.map(r => r.currentStatusDetails.status));
         if (uniqueStatuses.size > 1) {
            if (!window.confirm("The selected items are currently in different statuses. Are you sure you want to move them all to " + targetStatus + "?")) {
                return;
            }
         }
         onStatusUpdateRequest(draggedRequirements, targetStatus, null); // bulk update usually loses order logic, so null index
      }
    } else {
      const requirementId = e.dataTransfer.getData("requirementId");
      const draggedRequirement = requirements.find(r => r.id.toString() === requirementId.toString());
      
      if (draggedRequirement && draggedRequirement.currentStatusDetails.status !== targetStatus) {
        onStatusUpdateRequest(draggedRequirement, targetStatus, targetIndex);
      }
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
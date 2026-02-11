import React from 'react';
import KanbanColumn from './KanbanColumn';

const KanbanBoard = ({
  requirements,
  onShowHistory,
  onEditRequirement,
  onDeleteRequirement,
  isSearching,
  onStatusUpdateRequest
}) => {
  const columnTitles = ['To Do', 'Scenarios created', 'Under testing', 'Done'];

  const handleDragStart = (e, requirement) => {
    e.dataTransfer.setData("requirementId", requirement.id);
  };

  const handleDrop = (e, targetStatus) => {
    const requirementId = e.dataTransfer.getData("requirementId");
    const draggedRequirement = requirements.find(r => r.id.toString() === requirementId.toString());
    
    if (draggedRequirement && draggedRequirement.currentStatusDetails.status !== targetStatus) {
      onStatusUpdateRequest(draggedRequirement, targetStatus);
    }
  };

  const getRequirementsForColumn = (title) => {
    return requirements.filter(
      req => req.currentStatusDetails && req.currentStatusDetails.status === title
    );
  };

  return (
    <div id="kanban-board-container-id" className="kanban-board-container">
      {columnTitles.map((title) => (
        <KanbanColumn
          key={title}
          title={title}
          requirements={getRequirementsForColumn(title)}
          onShowHistory={onShowHistory}
          onEditRequirement={onEditRequirement}
          onDeleteRequirement={onDeleteRequirement}
          onDragStart={handleDragStart}
          onDrop={handleDrop}
        />
      ))}
    </div>
  );
};

export default KanbanBoard;
import React, { useState, useRef } from 'react';
import KanbanCard from './KanbanCard';

const KanbanColumn = ({
  title,
  requirements,
  onShowHistory,
  onEditRequirement,
  onDeleteRequirement,
  onDragStart,
  onDrop
}) => {
  const [isDraggedOver, setIsDraggedOver] = useState(false);
  const dragCounter = useRef(0);

  const handleDragEnter = (e) => {
    e.preventDefault();
    dragCounter.current++;
    if (dragCounter.current === 1) {
      setIsDraggedOver(true);
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDraggedOver(false);
    }
  };
  
  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDraggedOver(false);
    dragCounter.current = 0;
    onDrop(e, title);
  };

  const safeTitleId = title.replace(/\s+/g, '-').toLowerCase();

  return (
    <div 
      id={`kanban-column-${safeTitleId}-id`}
      className={`kanban-column ${isDraggedOver ? 'drag-over' : ''}`}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div id={`column-title-section-${safeTitleId}-id`} className="column-title-section">
        <h3 id={`column-title-${safeTitleId}-id`} className="column-title">{title}</h3>
      </div>
      <div id={`cards-container-${safeTitleId}-id`} className="cards-container">
        {requirements.map(req => (
          <KanbanCard
            key={req.id}
            requirement={req}
            onShowHistory={onShowHistory}
            onEditRequirement={onEditRequirement}
            onDeleteRequirement={onDeleteRequirement}
            onDragStart={onDragStart}
          />
        ))}
      </div>
    </div>
  );
};

export default KanbanColumn;
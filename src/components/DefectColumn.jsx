
import React, { useState, useRef } from 'react';
import DefectCard from './DefectCard';

const DefectColumn = ({ title, defects, onEditDefect, onShowHistory, onDeleteRequest, onNavigate, onDragStart, onDrop, onMoveToClosed, onUpdateFixedDate }) => {
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
    if (onDrop) {
      onDrop(e, title);
    }
  };
  
  const safeTitleId = title.replace(/\s+/g, '-').toLowerCase();

  return (
    <div 
      id={`defect-kanban-column-${safeTitleId}-id`}
      className={`defect-column ${isDraggedOver ? 'drag-over' : ''}`}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div id={`column-title-section-${safeTitleId}-id`} className="column-title-section">
        <h3 id={`column-title-${safeTitleId}-id`} className="column-title">{title}</h3>
      </div>
      <div id={`defect-cards-container-${safeTitleId}-id`} className="defect-cards-container">
        {defects.length === 0 && <p id={`empty-column-message-${safeTitleId}-id`} className="empty-column-message">No defects in this status.</p>}
        {defects.map(defect => (
          <DefectCard
            key={defect.id}
            defect={defect}
            onEdit={onEditDefect}
            onShowHistory={onShowHistory}
            onDeleteRequest={onDeleteRequest}
            onNavigate={onNavigate}
            onDragStart={onDragStart}
            onMoveToClosed={onMoveToClosed}
            onUpdateFixedDate={onUpdateFixedDate}
          />
        ))}
      </div>
    </div>
  );
};

export default DefectColumn;
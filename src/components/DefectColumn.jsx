import React, { useState, useRef } from 'react';
import DefectCard from './DefectCard';

const DefectColumn = ({ title, defects, onEditDefect, onShowHistory, onDeleteRequest, onNavigate, onDragStart, onDrop, onMoveToClosed }) => {
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

  return (
    <div 
      className={`defect-kanban-column ${isDraggedOver ? 'drag-over' : ''}`}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div className="column-title-section">
        <h3 className="column-title">{title}</h3>
      </div>
      <div className="defect-cards-container">
        {defects.length === 0 && <p className="empty-column-message">No defects in this status.</p>}
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
          />
        ))}
      </div>
    </div>
  );
};

export default DefectColumn;
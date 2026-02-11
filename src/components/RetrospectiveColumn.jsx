import React, { useState, useRef } from 'react';
import RetrospectiveCard from './RetrospectiveCard';

const RetrospectiveColumn = ({ title, columnType, items, onEditItem, onDeleteItem, onDragStart, onDrop }) => {
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
      onDrop(e, columnType);
    }
  };

  return (
    <div 
      id={`retrospective-column-${columnType}-id`}
      className={`retrospective-column ${isDraggedOver ? 'drag-over' : ''}`}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <h3 id={`retrospective-column-title-${columnType}-id`} className="retrospective-column-title">{title}</h3>
      <div id={`retrospective-cards-container-${columnType}-id`} className="retrospective-cards-container">
        {items.length === 0 && <p id={`empty-column-message-${columnType}-id`} className="empty-column-message">No items yet.</p>}
        {items.map(item => (
          <RetrospectiveCard
            key={item.id}
            item={item}
            onEdit={onEditItem}
            onDelete={onDeleteItem}
            onDragStart={onDragStart}
          />
        ))}
      </div>
    </div>
  );
};

export default RetrospectiveColumn;
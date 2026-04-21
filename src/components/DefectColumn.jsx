import React, { useState, useRef, useEffect } from 'react';
import DefectCard from './DefectCard';

const DefectColumn = ({ title, defects, onEditDefect, onShowHistory, onDeleteRequest, onNavigate, onDragStart, onDrop, onMoveToClosed, onUpdateFixedDate, onReorder, isSelectionMode, selectedIds, onToggleSelect }) => {
  const [isDraggedOver, setIsDraggedOver] = useState(false);
  const dragCounter = useRef(0);
  const containerRef = useRef(null);
  const scrollInterval = useRef(null);
  const scrollSpeed = useRef(0);
  
  const [sortedDefects, setSortedDefects] = useState([]);
  const [dropIndicator, setDropIndicator] = useState({ id: null, position: null });

  useEffect(() => {
    setSortedDefects(prev => {
      const sortedNew = [...defects].sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
      if (dragCounter.current === 0) return sortedNew;
      return prev;
    });
  }, [defects]);

  const startScrolling = () => {
    if (!scrollInterval.current) {
      scrollInterval.current = setInterval(() => {
        if (scrollSpeed.current !== 0) window.scrollBy(0, scrollSpeed.current);
      }, 16);
    }
  };

  const stopScrolling = () => {
    if (scrollInterval.current) {
      clearInterval(scrollInterval.current);
      scrollInterval.current = null;
    }
    scrollSpeed.current = 0;
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    const threshold = 250; 
    const mouseY = e.clientY;
    const windowHeight = window.innerHeight;

    if (mouseY < threshold) {
      scrollSpeed.current = -(((threshold - mouseY) / threshold) * 28 + 2); 
      startScrolling();
    } else if (windowHeight - mouseY < threshold) {
      scrollSpeed.current = (((threshold - (windowHeight - mouseY)) / threshold) * 28 + 2);
      startScrolling();
    } else {
      stopScrolling();
    }

    const targetCard = e.target.closest('.defect-card');
    if (targetCard && !targetCard.classList.contains('dragging')) {
      const targetId = targetCard.id.replace('defect-card-', '');
      const cardRect = targetCard.getBoundingClientRect();
      const midPoint = cardRect.top + cardRect.height / 2;
      const position = e.clientY < midPoint ? 'before' : 'after';

      if (dropIndicator.id !== targetId || dropIndicator.position !== position) {
        setDropIndicator({ id: targetId, position });
      }
    } else {
      if (dropIndicator.id) setDropIndicator({ id: null, position: null });
    }
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    dragCounter.current++;
    if (dragCounter.current === 1) setIsDraggedOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    dragCounter.current--;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setIsDraggedOver(false);
      setDropIndicator({ id: null, position: null });
      stopScrolling();
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    stopScrolling();
    setIsDraggedOver(false);
    dragCounter.current = 0;
    
    const finalIndicator = { ...dropIndicator };
    setDropIndicator({ id: null, position: null });

    const draggedId = e.dataTransfer.getData("defectId");
    if (!draggedId) return;

    const isSameColumn = sortedDefects.some(d => d.id.toString() === draggedId.toString());

    if (isSameColumn) {
      const draggedIndex = sortedDefects.findIndex(d => d.id.toString() === draggedId.toString());
      if (draggedIndex === -1) return;

      const newSorted = [...sortedDefects];
      const [removed] = newSorted.splice(draggedIndex, 1);

      if (finalIndicator.id) {
        let targetIndex = newSorted.findIndex(d => d.id.toString() === finalIndicator.id.toString());
        if (finalIndicator.position === 'after') targetIndex += 1;
        newSorted.splice(targetIndex, 0, removed);
      } else {
        newSorted.push(removed);
      }
      
      setSortedDefects(newSorted);

      if (onReorder) {
        const orderedIds = newSorted.map(d => d.id);
        onReorder(orderedIds);
      }
      return;
    }
    
    let targetIndex = sortedDefects.length;
    if (finalIndicator.id) {
      targetIndex = sortedDefects.findIndex(d => d.id.toString() === finalIndicator.id.toString());
      if (finalIndicator.position === 'after') targetIndex += 1;
    }
    
    if (onDrop) onDrop(e, title, targetIndex);
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
      <div className="column-title-section">
        <h3 className="column-title">{title}</h3>
      </div>
      <div ref={containerRef} className="defect-cards-container">
        {sortedDefects.length === 0 && <p className="empty-column-message">No defects in this status.</p>}
        {sortedDefects.map(defect => {
          const isDropTarget = dropIndicator.id === defect.id.toString();
          let wrapperStyle = { transition: 'all 0.1s ease', borderRadius: '4px' };

          if (isDropTarget) {
            const indicatorLine = '4px solid var(--accent-color)';
            if (dropIndicator.position === 'before') {
              wrapperStyle.borderTop = indicatorLine;
              wrapperStyle.paddingTop = '8px';
              wrapperStyle.marginTop = '-8px';
            } else {
              wrapperStyle.borderBottom = indicatorLine;
              wrapperStyle.paddingBottom = '8px';
              wrapperStyle.marginBottom = '-8px';
            }
          }

          return (
            <div key={defect.id} style={wrapperStyle}>
                <DefectCard
                    defect={defect}
                    onEdit={onEditDefect}
                    onShowHistory={onShowHistory}
                    onDeleteRequest={onDeleteRequest}
                    onNavigate={onNavigate}
                    onDragStart={onDragStart}
                    onMoveToClosed={onMoveToClosed}
                    onUpdateFixedDate={onUpdateFixedDate}
                    isSelectionMode={isSelectionMode}
                    isSelected={selectedIds && selectedIds.includes(defect.id)}
                    onToggleSelect={onToggleSelect}
                />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DefectColumn;
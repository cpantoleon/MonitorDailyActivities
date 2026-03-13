import React, { useState, useRef, useEffect } from 'react';
import KanbanCard from './KanbanCard';

const KanbanColumn = ({
  title,
  requirements,
  allRequirements,
  onShowHistory,
  onEditRequirement,
  onDeleteRequirement,
  onDragStart,
  onDrop,
  focusedFamilyId,
  setFocusedFamilyId,
  onAddSubtask
}) => {
  const [isDraggedOver, setIsDraggedOver] = useState(false);
  const dragCounter = useRef(0);
  const containerRef = useRef(null);

  // Scroll State για τη ΔΥΝΑΜΙΚΗ ταχύτητα
  const scrollInterval = useRef(null);
  const scrollSpeed = useRef(0); // Αντί για direction, αποθηκεύουμε την ακριβή ταχύτητα

  const [sortedRequirements, setSortedRequirements] = useState([]);
  const [dropIndicator, setDropIndicator] = useState({ id: null, position: null });

  useEffect(() => {
    setSortedRequirements(prev => {
      const prevIds = prev.map(p => p.id);
      const newReqs = requirements.filter(r => !prevIds.includes(r.id));
      const existingReqs = prev
        .filter(p => requirements.some(r => r.id === p.id))
        .map(p => requirements.find(r => r.id === p.id));
      return [...existingReqs, ...newReqs];
    });
  }, [requirements]);

  // Το interval ξεκινάει ΜΙΑ φορά και διαβάζει το scrollSpeed.current
  const startScrolling = () => {
    if (!scrollInterval.current) {
      scrollInterval.current = setInterval(() => {
        if (scrollSpeed.current !== 0) {
          window.scrollBy(0, scrollSpeed.current);
        }
      }, 16); // ~60 frames το δευτερόλεπτο για απόλυτο smoothness
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

    // --- ΔΥΝΑΜΙΚΗ ΤΑΧΥΤΗΤΑ SCROLL ---
    const threshold = 250; 
    const mouseY = e.clientY;
    const windowHeight = window.innerHeight;

    if (mouseY < threshold) {
      // Scroll ΠΑΝΩ: Υπολογίζουμε πόσο "βαθιά" μέσα στο threshold είμαστε (0 έως 1)
      const intensity = (threshold - mouseY) / threshold;
      // Ταχύτητα από 2 (αργά) μέχρι 30 (πολύ γρήγορα) pixels/frame
      scrollSpeed.current = -(intensity * 28 + 2); 
      startScrolling();
    } else if (windowHeight - mouseY < threshold) {
      // Scroll ΚΑΤΩ
      const distBottom = windowHeight - mouseY;
      const intensity = (threshold - distBottom) / threshold;
      scrollSpeed.current = (intensity * 28 + 2);
      startScrolling();
    } else {
      // Αν βγούμε από τη ζώνη, σταματάμε το scroll
      stopScrolling();
    }

    // --- DROP INDICATOR LOGIC ---
    const targetCard = e.target.closest('.kanban-card');
    if (targetCard && !targetCard.classList.contains('dragging')) {
      const targetId = targetCard.getAttribute('data-id');
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

    const draggedId = e.dataTransfer.getData("requirementId");
    if (!draggedId) return;

    const isSameColumn = sortedRequirements.some(r => r.id.toString() === draggedId.toString());

    if (isSameColumn && finalIndicator.id) {
      const targetId = finalIndicator.id;
      if (draggedId !== targetId) {
        const draggedIndex = sortedRequirements.findIndex(r => r.id.toString() === draggedId.toString());
        let targetIndex = sortedRequirements.findIndex(r => r.id.toString() === targetId.toString());

        if (draggedIndex !== -1 && targetIndex !== -1) {
          const newSorted = [...sortedRequirements];
          const [removed] = newSorted.splice(draggedIndex, 1);
          targetIndex = newSorted.findIndex(r => r.id.toString() === targetId.toString());
          if (finalIndicator.position === 'after') targetIndex += 1;
          newSorted.splice(targetIndex, 0, removed);
          setSortedRequirements(newSorted);
        }
      }
      return;
    }
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
      <div className="column-title-section">
        <h3 className="column-title">{title}</h3>
      </div>

      <div ref={containerRef} className="cards-container">
        {sortedRequirements.map(req => {
          const isDropTarget = dropIndicator.id === req.id.toString();
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
            <div key={req.id} style={wrapperStyle} data-id={req.id} className="kanban-card-wrapper">
              <KanbanCard
                requirement={req}
                allRequirements={allRequirements}
                onShowHistory={onShowHistory}
                onEditRequirement={onEditRequirement}
                onDeleteRequirement={onDeleteRequirement}
                onDragStart={onDragStart}
                focusedFamilyId={focusedFamilyId}
                setFocusedFamilyId={setFocusedFamilyId}
                onAddSubtask={onAddSubtask}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default KanbanColumn;
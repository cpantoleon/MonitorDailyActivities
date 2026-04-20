import React, { useState, useEffect, useMemo } from 'react';
import useClickOutside from '../hooks/useClickOutside';
import ConfirmationModal from './ConfirmationModal';

// Το modal πλέον δέχεται 'item' (το πλήρες αντικείμενο) και 'itemType' ('requirement' ή 'defect')
const UpdateStatusModal = ({ isOpen, onClose, onSave, item, itemType, newStatus, showMessage }) => {
  const [comment, setComment] = useState('');
  const [isCloseConfirmOpen, setIsCloseConfirmOpen] = useState(false);
  const [acknowledgeDefects, setAcknowledgeDefects] = useState(false);

  // States για τον χρόνο (Requirements)
  const [realTimeTc, setRealTimeTc] = useState('');
  const [realTimeTcUnit, setRealTimeTcUnit] = useState('h');
  const [realTimeTesting, setRealTimeTesting] = useState('');
  const [realTimeTestingUnit, setRealTimeTestingUnit] = useState('h');

  // States για τον χρόνο (Defects)
  const [realTimeDefect, setRealTimeDefect] = useState('');
  const [realTimeDefectUnit, setRealTimeDefectUnit] = useState('h');

  const [noTestingRequired, setNoTestingRequired] = useState(false);

  const openDefects = useMemo(() => {
    if (!item || itemType !== 'requirement' || newStatus !== 'Done') return [];
    return item.linkedDefects?.filter(
      (defect) => defect.status === 'Assigned to Developer' || defect.status === 'Assigned to Tester'
    ) || [];
  }, [item, itemType, newStatus]);

  // Μετατροπέας χρόνου για να γεμίζουμε τα inputs
  const parseTimeToObj = (hours) => {
    if (hours === null || hours === undefined || hours === '') return { val: '', unit: 'h' };
    const h = parseFloat(hours);
    if (h > 0 && h % 8 === 0) return { val: h / 8, unit: 'd' };
    return { val: h, unit: 'h' };
  };

  useEffect(() => {
    if (isOpen && item) {
      setComment('');
      setAcknowledgeDefects(false);
      setNoTestingRequired(false);

      if (itemType === 'requirement') {
        const tc = parseTimeToObj(item.currentStatusDetails?.real_time_tc_creation);
        const test = parseTimeToObj(item.currentStatusDetails?.real_time_testing);
        setRealTimeTc(tc.val); setRealTimeTcUnit(tc.unit);
        setRealTimeTesting(test.val); setRealTimeTestingUnit(test.unit);
      } else {
        const rt = parseTimeToObj(item.real_time);
        setRealTimeDefect(rt.val); setRealTimeDefectUnit(rt.unit);
      }
    }
  }, [isOpen, item, itemType]);

  const hasUnsavedChanges = useMemo(() => comment.trim() !== '', [comment]);

  const handleCloseRequest = () => {
    if (hasUnsavedChanges) {
      setIsCloseConfirmOpen(true);
    } else {
      onClose();
    }
  };

  const calcH = (v, u) => (v !== '' && v !== null && !isNaN(v) ? parseFloat(v) * (u === 'd' ? 8 : 1) : null);

  const handleSave = () => {
    if (openDefects.length > 0 && !acknowledgeDefects) {
      showMessage('Please acknowledge the open defects before proceeding.', 'error');
      return; 
    }

    // --- Validation Χρόνου αν πάει στο Done ---
    let finalTimeData = {};

    if (newStatus === 'Done') {
      if (itemType === 'requirement') {
        const tcHours = calcH(realTimeTc, realTimeTcUnit) || 0;
        const testHours = calcH(realTimeTesting, realTimeTestingUnit) || 0;
        
        if (!noTestingRequired && (tcHours + testHours <= 0)) {
          showMessage('Please fill in the real time spent (Test Cases or Testing) before closing this requirement, or check "No testing/fixing required".', 'error');
          return;
        }
        finalTimeData = {
          real_time_tc_creation: calcH(realTimeTc, realTimeTcUnit),
          real_time_testing: calcH(realTimeTesting, realTimeTestingUnit)
        };
      } else if (itemType === 'defect') {
        const defectHours = calcH(realTimeDefect, realTimeDefectUnit) || 0;
        
        if (!noTestingRequired && defectHours <= 0) {
          showMessage('Please fill in the real time spent before closing this defect, or check "No testing/fixing required".', 'error');
          return;
        }
        finalTimeData = { real_time: calcH(realTimeDefect, realTimeDefectUnit) };
      }
    } else {
      // Αν δεν πάει στο done, απλά στέλνουμε τις μετατροπές (αν υπάρχουν)
      if (itemType === 'requirement') {
        finalTimeData = {
          real_time_tc_creation: calcH(realTimeTc, realTimeTcUnit),
          real_time_testing: calcH(realTimeTesting, realTimeTestingUnit)
        };
      } else {
        finalTimeData = { real_time: calcH(realTimeDefect, realTimeDefectUnit) };
      }
    }

    // Στέλνουμε το comment και τα timeData πίσω στο parent component
    onSave({ comment, timeData: finalTimeData });
  };

  const modalRef = useClickOutside(handleCloseRequest);

  if (!isOpen || !item) return null;

  const itemName = itemType === 'requirement' ? item.requirementUserIdentifier : item.title;

  return (
    <div id="update-status-modal-wrapper-id">
      <div id="add-new-modal-overlay-id" className="add-new-modal-overlay">
        <div ref={modalRef} id="add-new-modal-content-id" className="add-new-modal-content" style={{ maxWidth: '550px' }}>
          <h2 id="update-status-title-id">Update Status</h2>
          <p id="update-status-description-id">
            You are moving {itemType} <strong>{itemName}</strong> to the "<strong>{newStatus}</strong>" column.
          </p>

          <div id="form-group-comment-id" className="form-group">
            <label htmlFor="updateStatusComment" className="optional-label">Add a comment (optional):</label>
            <textarea
              id="updateStatusComment"
              name="updateStatusComment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows="3"
              placeholder="Why is the status being updated?"
              autoFocus
            />
          </div>

          {/* Time Tracking Section - ΜΟΝΟ ΟΤΑΝ ΤΟ STATUS ΕΙΝΑΙ DONE */}
          {newStatus === 'Done' && (
            <fieldset style={{ border: '1px solid var(--border-color)', borderRadius: '6px', padding: '15px', marginTop: '15px' }}>
                <legend style={{ padding: '0 5px', fontSize: '0.9em', color: 'var(--text-primary)', fontWeight: '600' }}>
                    Time Tracking {!noTestingRequired && <span style={{ color: 'var(--danger-color)' }}>*</span>}
                </legend>
                <p style={{ fontSize: '0.85em', color: 'var(--text-secondary)', marginTop: 0, marginBottom: '15px' }}>
                    Please log the real time spent before marking this item as Done.
                </p>
                
                {itemType === 'requirement' ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                        <div>
                            <label style={{ fontSize: '0.85em' }}>Test Cases Creation</label>
                            <div style={{ display: 'flex', gap: '5px' }}>
                                <input type="number" value={realTimeTc} onChange={(e) => setRealTimeTc(e.target.value)} min="0" step="0.5" style={{ width: '60px', padding: '6px', backgroundColor: 'var(--bg-primary)' }} />
                                <select value={realTimeTcUnit} onChange={(e) => setRealTimeTcUnit(e.target.value)} style={{ padding: '6px', flexGrow: 1, backgroundColor: 'var(--bg-primary)' }}>
                                    <option value="h">hours</option>
                                    <option value="d">days</option>
                                </select>
                            </div>
                        </div>
                        <div>
                            <label style={{ fontSize: '0.85em' }}>Testing Execution</label>
                            <div style={{ display: 'flex', gap: '5px' }}>
                                <input type="number" value={realTimeTesting} onChange={(e) => setRealTimeTesting(e.target.value)} min="0" step="0.5" style={{ width: '60px', padding: '6px', backgroundColor: 'var(--bg-primary)' }} />
                                <select value={realTimeTestingUnit} onChange={(e) => setRealTimeTestingUnit(e.target.value)} style={{ padding: '6px', flexGrow: 1, backgroundColor: 'var(--bg-primary)' }}>
                                    <option value="h">hours</option>
                                    <option value="d">days</option>
                                </select>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div>
                        <label style={{ fontSize: '0.85em' }}>Real Time Spent (Defect Fix/Test)</label>
                        <div style={{ display: 'flex', gap: '5px', maxWidth: '250px' }}>
                            <input type="number" value={realTimeDefect} onChange={(e) => setRealTimeDefect(e.target.value)} min="0" step="0.5" style={{ width: '80px', padding: '6px', backgroundColor: 'var(--bg-primary)' }} />
                            <select value={realTimeDefectUnit} onChange={(e) => setRealTimeDefectUnit(e.target.value)} style={{ padding: '6px', flexGrow: 1, backgroundColor: 'var(--bg-primary)' }}>
                                <option value="h">hours</option>
                                <option value="d">days</option>
                            </select>
                        </div>
                    </div>
                )}

                <div className="new-project-toggle" style={{ marginTop: '15px', marginBottom: 0 }}>
                  <input
                    type="checkbox"
                    id="noTestingRequiredCheckbox"
                    checked={noTestingRequired}
                    onChange={(e) => setNoTestingRequired(e.target.checked)}
                  />
                  <label htmlFor="noTestingRequiredCheckbox" className="checkbox-label" style={{fontSize: '0.9em'}}>
                    Acknowledge to continue without logging time (No testing/fixing required)
                  </label>
                </div>
            </fieldset>
          )}

          {openDefects.length > 0 && (
            <div id="open-defects-warning-container-id" className="form-group" style={{ marginTop: '15px', backgroundColor: '#FFF8DC', padding: '10px', borderRadius: '4px' }}>
              <p id="open-defects-warning-text-id" style={{marginTop: 0, color: '#8B4513', fontSize: '0.9em'}}>
                <strong>Warning:</strong> This item has {openDefects.length} open defect(s).
              </p>
              <div id="acknowledge-defects-toggle-id" className="new-project-toggle" style={{ marginBottom: 0 }}>
                <input
                  type="checkbox"
                  id="acknowledgeDefectsCheckbox"
                  checked={acknowledgeDefects}
                  onChange={(e) => setAcknowledgeDefects(e.target.checked)}
                />
                <label htmlFor="acknowledgeDefectsCheckbox" className="checkbox-label" style={{fontSize: '0.9em'}}>
                  I acknowledge the open defect(s) and want to proceed.
                </label>
              </div>
            </div>
          )}

          <div id="modal-actions-update-status-id" className="modal-actions">
            <button id="cancel-update-button-id" type="button" onClick={onClose} className="modal-button-cancel">Cancel</button>
            <button id="confirm-update-button-id" onClick={handleSave} className="modal-button-save">
              Confirm Update
            </button>
          </div>
        </div>
      </div>
      <ConfirmationModal
        isOpen={isCloseConfirmOpen}
        onClose={() => setIsCloseConfirmOpen(false)}
        onConfirm={() => {
          setIsCloseConfirmOpen(false);
          onClose();
        }}
        title="Unsaved Changes"
        message="You have an unsaved comment. Are you sure you want to close?"
      />
    </div>
  );
};

export default UpdateStatusModal;
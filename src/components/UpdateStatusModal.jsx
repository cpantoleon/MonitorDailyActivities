import React, { useState, useEffect, useMemo } from 'react';
import useClickOutside from '../hooks/useClickOutside';
import ConfirmationModal from './ConfirmationModal';
import Tooltip from './Tooltip';
import { useGlobal } from '../context/GlobalContext';
import TimeInputGroup from './TimeInputGroup';

// Το modal πλέον δέχεται 'item' (το πλήρες αντικείμενο) και 'itemType' ('requirement' ή 'defect')
const UpdateStatusModal = ({ isOpen, onClose, onSave, item, items, itemType, newStatus, showMessage, releases = [] }) => {
  const selectedItems = useMemo(() => items || (item ? [item] : []), [items, item]);
  const primaryItem = selectedItems[0];
  const { isMultiReleaseMode } = useGlobal();
  const [comment, setComment] = useState('');
  const [isCloseConfirmOpen, setIsCloseConfirmOpen] = useState(false);
  const [acknowledgeDefects, setAcknowledgeDefects] = useState(false);

  const [itemTimes, setItemTimes] = useState({});
  const [noTestingRequired, setNoTestingRequired] = useState(false);

  const openDefects = useMemo(() => {
    if (selectedItems.length === 0 || itemType !== 'requirement' || newStatus !== 'Done') return [];
    let defects = [];
    selectedItems.forEach(i => {
      const d = i.linkedDefects?.filter(
        (defect) => defect.status === 'Assigned to Developer' || defect.status === 'Assigned to Tester'
      ) || [];
      defects = [...defects, ...d];
    });
    return defects;
  }, [selectedItems, itemType, newStatus]);

  // Μετατροπέας χρόνου για να γεμίζουμε τα inputs
  const parseTimeToObj = (hours) => {
    if (hours === null || hours === undefined || hours === '') return { val: '', unit: 'h' };
    const h = parseFloat(hours);
    if (h > 0 && h % 8 === 0) return { val: h / 8, unit: 'd' };
    return { val: h, unit: 'h' };
  };

  const formatTimeHelper = (val, unit) => {
    if (!val || isNaN(val) || val <= 0) return '';
    const totalHours = unit === 'd' ? parseFloat(val) * 8 : parseFloat(val);
    const d = Math.floor(totalHours / 8);
    const h = parseFloat((totalHours % 8).toFixed(2));

    if (d > 0 && h > 0) return `(${d}d ${h}h)`;
    if (d > 0) return `(${d}d)`;
    return `(${h}h)`;
  };

  useEffect(() => {
    if (isOpen && selectedItems.length > 0) {
      setComment('');
      setAcknowledgeDefects(false);
      setNoTestingRequired(false);

      const initialItemTimes = {};
      selectedItems.forEach(item => {
        if (itemType === 'requirement') {
          const tc = parseTimeToObj(item.currentStatusDetails?.real_time_tc_creation);
          const test = parseTimeToObj(item.currentStatusDetails?.real_time_testing);
          initialItemTimes[item.id] = {
            realTimeTc: tc.val,
            realTimeTcUnit: tc.unit,
            realTimeTesting: test.val,
            realTimeTestingUnit: test.unit,
            releaseTimeTracking: item.currentStatusDetails?.release_time_tracking || {}
          };
        } else {
          const rt = parseTimeToObj(item.real_time);
          initialItemTimes[item.id] = {
            realTimeDefect: rt.val,
            realTimeDefectUnit: rt.unit
          };
        }
      });
      setItemTimes(initialItemTimes);
    }
  }, [isOpen, selectedItems, itemType]);

  const hasUnsavedChanges = useMemo(() => comment.trim() !== '', [comment]);

  const handleCloseRequest = () => {
    if (hasUnsavedChanges) {
      setIsCloseConfirmOpen(true);
    } else {
      onClose();
    }
  };

  const calcH = (v, u) => (v !== '' && v !== null && !isNaN(v) ? parseFloat(v) * (u === 'd' ? 8 : 1) : null);
  const handleItemTimeChange = (itemId, field, value) => {
    setItemTimes(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        [field]: value
      }
    }));
  };

  const handleItemReleaseTimeChange = (itemId, releaseId, field, value) => {
    setItemTimes(prev => {
      const currentItem = prev[itemId] || {};
      const currentRelTracking = currentItem.releaseTimeTracking || {};
      const currentRelData = currentRelTracking[releaseId] || { tc: '', test: '', tc_unit: 'h', test_unit: 'h' };
      
      return {
        ...prev,
        [itemId]: {
          ...currentItem,
          releaseTimeTracking: {
            ...currentRelTracking,
            [releaseId]: {
              ...currentRelData,
              [field]: value
            }
          }
        }
      };
    });
  };



  const handleSave = () => {
    if (openDefects.length > 0 && !acknowledgeDefects) {
      showMessage('Please acknowledge the open defects before proceeding.', 'error');
      return; 
    }

    let timeDataByItemId = {};

    for (const item of selectedItems) {
      const itmState = itemTimes[item.id] || {};
      let finalTimeData = {};

      if (newStatus === 'Done') {
        if (itemType === 'requirement') {
          if (isMultiReleaseMode && item.currentStatusDetails?.releaseIds?.length > 0) {
            let totalHours = 0;
            item.currentStatusDetails.releaseIds.forEach(relId => {
              const relData = (itmState.releaseTimeTracking || {})[relId] || {};
              const tcH = calcH(relData.tc, relData.tc_unit) || 0;
              const testH = calcH(relData.test, relData.test_unit) || 0;
              totalHours += (tcH + testH);
            });

            if (!noTestingRequired && totalHours <= 0) {
              showMessage(`Please fill in the real time spent per release for requirement ${item.requirementUserIdentifier}, or check "No testing/fixing required".`, 'error');
              return;
            }

            finalTimeData = {
              real_time_tc_creation: undefined,
              real_time_testing: undefined,
              release_time_tracking: itmState.releaseTimeTracking || {}
            };
          } else {
            const tcHours = calcH(itmState.realTimeTc, itmState.realTimeTcUnit) || 0;
            const testHours = calcH(itmState.realTimeTesting, itmState.realTimeTestingUnit) || 0;
            
            if (!noTestingRequired && (tcHours + testHours <= 0)) {
              showMessage(`Please fill in the real time spent for requirement ${item.requirementUserIdentifier}, or check "No testing/fixing required".`, 'error');
              return;
            }
            finalTimeData = {
              real_time_tc_creation: calcH(itmState.realTimeTc, itmState.realTimeTcUnit),
              real_time_testing: calcH(itmState.realTimeTesting, itmState.realTimeTestingUnit),
              release_time_tracking: item.currentStatusDetails?.release_time_tracking || {}
            };
          }
        } else if (itemType === 'defect') {
          const defectHours = calcH(itmState.realTimeDefect, itmState.realTimeDefectUnit) || 0;
          
          if (!noTestingRequired && defectHours <= 0) {
            showMessage(`Please fill in the real time spent for defect ${item.title}, or check "No testing/fixing required".`, 'error');
            return;
          }
          finalTimeData = { real_time: calcH(itmState.realTimeDefect, itmState.realTimeDefectUnit) };
        }
      } else {
        if (itemType === 'requirement') {
          finalTimeData = {
            real_time_tc_creation: calcH(itmState.realTimeTc, itmState.realTimeTcUnit),
            real_time_testing: calcH(itmState.realTimeTesting, itmState.realTimeTestingUnit),
            release_time_tracking: itmState.releaseTimeTracking || {}
          };
        } else {
          finalTimeData = { real_time: calcH(itmState.realTimeDefect, itmState.realTimeDefectUnit) };
        }
      }
      timeDataByItemId[item.id] = finalTimeData;
    }

    onSave({ comment, timeDataByItemId });
  };

  const modalRef = useClickOutside(handleCloseRequest);

  if (!isOpen || selectedItems.length === 0) return null;

  const itemName = selectedItems.length > 1 ? `${selectedItems.length} items` : (itemType === 'requirement' ? primaryItem.requirementUserIdentifier : primaryItem.title);

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
                    Please log the real time spent before marking {selectedItems.length > 1 ? "these items" : "this item"} as Done.
                </p>
                
                <div style={{ maxHeight: '350px', overflowY: 'auto', paddingRight: '10px' }}>
                {selectedItems.map((item, index) => {
                    const itmState = itemTimes[item.id] || {};
                    return (
                      <div key={item.id} style={{ marginBottom: index < selectedItems.length - 1 ? '20px' : '0', paddingBottom: index < selectedItems.length - 1 ? '15px' : '0', borderBottom: index < selectedItems.length - 1 ? '1px solid var(--border-color)' : 'none' }}>
                         {selectedItems.length > 1 && (
                             <div style={{ fontWeight: 'bold', marginBottom: '10px', color: 'var(--accent-color)' }}>
                                {itemType === 'requirement' ? item.requirementUserIdentifier : item.title}
                             </div>
                         )}
                         
                         {itemType === 'requirement' ? (
                            isMultiReleaseMode && item.currentStatusDetails?.releaseIds && item.currentStatusDetails.releaseIds.length > 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    <label style={{ fontSize: '0.85em', fontWeight: 'bold', borderBottom: '1px solid var(--border-color)', paddingBottom: '5px' }}>
                                        Real Time Logged Per Release: {!noTestingRequired && <span style={{ color: 'var(--danger-color)' }}>*</span>}
                                    </label>
                                    {item.currentStatusDetails.releaseIds.map(relId => {
                                        const relName = releases.find(r => String(r.id) === String(relId))?.name || `Release ${relId}`;
                                        const relData = (itmState.releaseTimeTracking || {})[relId] || { tc: '', test: '', tc_unit: 'h', test_unit: 'h' };

                                        const tcDisplayVal = relData.tc_unit === 'd' && relData.tc !== '' ? relData.tc / 8 : relData.tc;
                                        const testDisplayVal = relData.test_unit === 'd' && relData.test !== '' ? relData.test / 8 : relData.test;

                                        return (
                                            <div key={relId} style={{ backgroundColor: 'var(--bg-primary)', padding: '10px', borderRadius: '4px' }}>
                                                <span style={{ fontSize: '0.85em', fontWeight: '600', display: 'block', marginBottom: '8px' }}>{relName}</span>
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                                                    <div>
                                                        <label style={{ fontSize: '0.8em', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                                                            TC Creation
                                                            <span style={{ color: 'var(--accent-color)', fontWeight: 'bold', marginLeft: '5px' }}>
                                                                {formatTimeHelper(tcDisplayVal, relData.tc_unit)}
                                                            </span>
                                                        </label>
                                                        <div style={{ display: 'flex', gap: '5px' }}>
                                                                <TimeInputGroup
                                                                    value={tcDisplayVal}
                                                                    unit={relData.tc_unit || 'h'}
                                                                    onValueChange={(val) => {
                                                                        const inHours = val !== '' ? val * (relData.tc_unit === 'd' ? 8 : 1) : '';
                                                                        handleItemReleaseTimeChange(item.id, relId, 'tc', inHours);
                                                                    }}
                                                                    onUnitChange={(u) => handleItemReleaseTimeChange(item.id, relId, 'tc_unit', u)}
                                                                    inputStyle={{ padding: '6px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'var(--text-primary)' }}
                                                                    selectStyle={{ padding: '6px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'var(--text-primary)' }}
                                                                />
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <label style={{ fontSize: '0.8em', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                                                            Testing
                                                            <span style={{ color: 'var(--accent-color)', fontWeight: 'bold', marginLeft: '5px' }}>
                                                                {formatTimeHelper(testDisplayVal, relData.test_unit)}
                                                            </span>
                                                        </label>
                                                            <TimeInputGroup
                                                                value={testDisplayVal}
                                                                unit={relData.test_unit || 'h'}
                                                                onValueChange={(val) => {
                                                                    const inHours = val !== '' ? val * (relData.test_unit === 'd' ? 8 : 1) : '';
                                                                    handleItemReleaseTimeChange(item.id, relId, 'test', inHours);
                                                                }}
                                                                onUnitChange={(u) => handleItemReleaseTimeChange(item.id, relId, 'test_unit', u)}
                                                                inputStyle={{ padding: '6px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'var(--text-primary)' }}
                                                                selectStyle={{ padding: '6px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'var(--text-primary)' }}
                                                            />
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                                <div>
                                    <label style={{ fontSize: '0.85em' }}>Test Cases Creation</label>
                                    <TimeInputGroup
                                        value={itmState.realTimeTc || ''}
                                        unit={itmState.realTimeTcUnit || 'h'}
                                        onValueChange={(val) => handleItemTimeChange(item.id, 'realTimeTc', val)}
                                        onUnitChange={(val) => handleItemTimeChange(item.id, 'realTimeTcUnit', val)}
                                        inputStyle={{ padding: '6px', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'var(--text-primary)' }}
                                        selectStyle={{ padding: '6px', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'var(--text-primary)' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ fontSize: '0.85em' }}>Testing Execution</label>
                                    <TimeInputGroup
                                        value={itmState.realTimeTesting || ''}
                                        unit={itmState.realTimeTestingUnit || 'h'}
                                        onValueChange={(val) => handleItemTimeChange(item.id, 'realTimeTesting', val)}
                                        onUnitChange={(val) => handleItemTimeChange(item.id, 'realTimeTestingUnit', val)}
                                        inputStyle={{ padding: '6px', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'var(--text-primary)' }}
                                        selectStyle={{ padding: '6px', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'var(--text-primary)' }}
                                    />
                                </div>
                            </div>
                            )
                         ) : (
                            <div>
                                <label style={{ fontSize: '0.85em' }}>Real Time Spent (Defect Fix/Test)</label>
                                <TimeInputGroup
                                    value={itmState.realTimeDefect || ''}
                                    unit={itmState.realTimeDefectUnit || 'h'}
                                    onValueChange={(val) => handleItemTimeChange(item.id, 'realTimeDefect', val)}
                                    onUnitChange={(val) => handleItemTimeChange(item.id, 'realTimeDefectUnit', val)}
                                    style={{ maxWidth: '250px' }}
                                    inputStyle={{ padding: '6px', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'var(--text-primary)' }}
                                    selectStyle={{ padding: '6px', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'var(--text-primary)' }}
                                />
                            </div>
                         )}
                      </div>
                    );
                })}
                </div>

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
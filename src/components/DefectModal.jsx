import React, { useState, useEffect, useMemo } from 'react';
import DatePicker from 'react-datepicker';
import CustomDropdown from './CustomDropdown';
import "react-datepicker/dist/react-datepicker.css";
import useClickOutside from '../hooks/useClickOutside';
import ConfirmationModal from './ConfirmationModal';
import ToggleSwitch from './ToggleSwitch';

const DEFECT_STATUSES = ['Assigned to Developer', 'Assigned to Tester', 'Done'];

const DefectModal = ({ isOpen, onClose, onSubmit, defect, projects, currentSelectedProject, allRequirements = [], allDefects = [] }) => {

  const getInitialFormState = (project) => ({
    project: project || '',
    title: '',
    description: '',
    area: '',
    status: DEFECT_STATUSES[0],
    link: '',
    created_date: new Date(),
    comment: '',
    linkedRequirementGroupIds: [],
    is_fat_defect: false,
  });

  const [formData, setFormData] = useState(getInitialFormState(currentSelectedProject));
  const [initialFormData, setInitialFormData] = useState(null);
  const [isCloseConfirmOpen, setIsCloseConfirmOpen] = useState(false);
  const [isCustomArea, setIsCustomArea] = useState(false);
  const [modalAreas, setModalAreas] = useState([]);
  const [activeTab, setActiveTab] = useState('core'); // 'core' or 'tracking'

  const [availableRequirements, setAvailableRequirements] = useState([]);
  const [selectedRequirements, setSelectedRequirements] = useState([]);
  const [toAdd, setToAdd] = useState([]);
  const [toRemove, setToRemove] = useState([]);

  const [availableSearchQuery, setAvailableSearchQuery] = useState('');
  const [selectedSearchQuery, setSelectedSearchQuery] = useState('');

  const requirementsForSelectedProject = useMemo(() => {
    if (!formData.project || !allRequirements) return [];
    return allRequirements.filter(r => r.project === formData.project && r.isActive);
  }, [formData.project, allRequirements]);

  useEffect(() => {
    if (isOpen) {
      let initialData;
      if (defect) {
        initialData = {
          project: defect.project,
          title: defect.title || '',
          description: defect.description || '',
          area: defect.area || '',
          status: defect.status || DEFECT_STATUSES[0],
          link: defect.link || '',
          created_date: defect.created_date ? new Date(defect.created_date) : new Date(),
          comment: '',
          linkedRequirementGroupIds: defect.linkedRequirements ? defect.linkedRequirements.map(r => r.groupId) : [],
          is_fat_defect: defect.is_fat_defect || false,
        };
      } else {
        const initialProject = currentSelectedProject || '';
        initialData = getInitialFormState(initialProject);
      }
      setFormData(initialData);
      setInitialFormData(initialData);
      setActiveTab('core'); // Πάντα άνοιγμα στην πρώτη καρτέλα
    } else {
      setFormData(getInitialFormState(''));
      setInitialFormData(null);
      setIsCustomArea(false);
      setModalAreas([]);
    }
  }, [defect, isOpen, currentSelectedProject]);

  const hasUnsavedChanges = useMemo(() => {
    if (!initialFormData) return false;
    const sortedCurrentLinks = [...formData.linkedRequirementGroupIds].sort();
    const sortedInitialLinks = [...initialFormData.linkedRequirementGroupIds].sort();
    const linksChanged = JSON.stringify(sortedCurrentLinks) !== JSON.stringify(sortedInitialLinks);

    return formData.title !== initialFormData.title ||
           formData.description !== initialFormData.description ||
           formData.area !== initialFormData.area ||
           formData.status !== initialFormData.status ||
           formData.link !== initialFormData.link ||
           formData.created_date.toISOString().split('T')[0] !== initialFormData.created_date.toISOString().split('T')[0] ||
           formData.comment.trim() !== '' ||
           formData.is_fat_defect !== initialFormData.is_fat_defect ||
           linksChanged;
  }, [formData, initialFormData]);

  const handleCloseRequest = () => {
    if (hasUnsavedChanges) {
      setIsCloseConfirmOpen(true);
    } else {
      onClose();
    }
  };

  const modalRef = useClickOutside(handleCloseRequest);

  useEffect(() => {
    if (isOpen && formData.project) {
      const projectDefects = allDefects.filter(d => d.project === formData.project);
      const areas = [...new Set(projectDefects.map(d => d.area).filter(Boolean))].sort();
      setModalAreas(areas);

      if (defect && defect.project === formData.project) {
        setIsCustomArea(!areas.includes(defect.area));
      } else {
        setIsCustomArea(areas.length === 0);
      }
    } else {
      setModalAreas([]);
    }
  }, [isOpen, formData.project, defect, allDefects]);

  useEffect(() => {
    if (isOpen) {
      const linkedIdsSet = new Set(formData.linkedRequirementGroupIds);
      let available = requirementsForSelectedProject.filter(r => !linkedIdsSet.has(r.id));
      let selected = requirementsForSelectedProject.filter(r => linkedIdsSet.has(r.id));

      if (availableSearchQuery) {
        available = available.filter(r =>
          r.requirementUserIdentifier.toLowerCase().includes(availableSearchQuery.toLowerCase())
        );
      }
      if (selectedSearchQuery) {
        selected = selected.filter(r =>
          r.requirementUserIdentifier.toLowerCase().includes(selectedSearchQuery.toLowerCase())
        );
      }

      setAvailableRequirements(available);
      setSelectedRequirements(selected);
    } else {
        setAvailableRequirements([]);
        setSelectedRequirements([]);
        setToAdd([]);
        setToRemove([]);
        setAvailableSearchQuery('');
        setSelectedSearchQuery('');
    }
  }, [isOpen, requirementsForSelectedProject, formData.linkedRequirementGroupIds, availableSearchQuery, selectedSearchQuery]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'project') {
      setFormData(prev => ({
        ...getInitialFormState(value),
        project: value,
      }));
    } else if (name === 'is_fat_defect') {
      setFormData(prev => ({ ...prev, [name]: e.target.checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleCustomAreaToggle = (e) => {
    const checked = e.target.checked;
    setIsCustomArea(checked);
    if (!checked && modalAreas.length > 0) {
      setFormData(prev => ({ ...prev, area: modalAreas[0] || '' }));
    } else {
      setFormData(prev => ({ ...prev, area: '' }));
    }
  };

  const handleSelectionChange = (e, setter) => {
    const selectedIds = Array.from(e.target.selectedOptions, option => parseInt(option.value, 10));
    setter(selectedIds);
  };

  const handleAdd = () => {
    setFormData(prev => ({
      ...prev,
      linkedRequirementGroupIds: [...new Set([...prev.linkedRequirementGroupIds, ...toAdd])]
    }));
    setToAdd([]);
  };

  const handleRemove = () => {
    const toRemoveSet = new Set(toRemove);
    setFormData(prev => ({
      ...prev,
      linkedRequirementGroupIds: prev.linkedRequirementGroupIds.filter(id => !toRemoveSet.has(id))
    }));
    setToRemove([]);
  };

  const handleDateChange = (date) => {
    if (date instanceof Date && !isNaN(date)) {
      setFormData(prev => ({ ...prev, created_date: date }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!formData.project || !formData.title.trim() || !formData.area.trim()) {
      alert("Project, Title, and Area are required.");
      setActiveTab('core');
      return;
    }

    if (activeTab === 'core') {
        setActiveTab('tracking');
        return;
    }

    if (!formData.status || !formData.created_date) {
      alert("Status and Date Logged are required.");
      return;
    }

    onSubmit({ ...formData, area: formData.area.trim() });
  };

  if (!isOpen) return null;

  const projectOptions = projects.map(p => ({ value: p, label: p }));
  const areaOptions = modalAreas.map(pa => ({ value: pa, label: pa }));
  const statusOptionsList = defect ? [...DEFECT_STATUSES, 'Closed'] : DEFECT_STATUSES;
  const statusSelectOptions = statusOptionsList.map(s => ({ value: s, label: s }));

  return (
    <div id="defect-modal-wrapper-id">
      <div id="defect-modal-overlay-id" className="add-new-modal-overlay">
        <div ref={modalRef} id="defect-modal-content-id" className="add-new-modal-content" style={{ maxWidth: '800px' }}>
          <style>{`
            .dual-listbox-container {
              display: flex;
              flex-direction: row;
              gap: 15px;
              align-items: flex-start;
            }
            .listbox-wrapper {
              flex: 1;
              display: flex;
              flex-direction: column;
            }
            .listbox-actions {
              display: flex;
              flex-direction: column;
              justify-content: center;
              gap: 10px;
              padding-top: 25px;
            }
            .listbox-actions button {
              padding: 5px 10px;
              cursor: pointer;
              background-color: var(--bg-tertiary);
              border: 1px solid var(--border-color);
              border-radius: 4px;
              color: var(--text-primary);
            }
            .listbox-actions button:hover:not(:disabled) {
              background-color: var(--accent-color);
              color: white;
            }
            .listbox-actions button:disabled {
              opacity: 0.5;
              cursor: not-allowed;
            }
            select[multiple] {
              height: 150px;
              width: 100%;
              border: 1px solid var(--border-color);
              border-radius: 4px;
              background-color: var(--bg-primary);
              color: var(--text-primary);
              padding: 5px;
            }
            .listbox-search-input {
              margin-bottom: 5px;
              padding: 5px;
              border: 1px solid var(--border-color);
              border-radius: 4px;
              background-color: var(--bg-primary);
              color: var(--text-primary);
            }
          `}</style>
          
          <div id="defect-modal-header-id" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '15px', marginBottom: '20px' }}>
            <h2 style={{ margin: 0, borderBottom: 'none', paddingBottom: 0 }}>{defect ? 'Edit Defect' : 'Create New Defect'}</h2>
            <div id="fat-defect-toggle-container-id" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div id="fat-defect-label-id" style={{ fontWeight: 'bold' }}>FAT Defect: </div>
              <ToggleSwitch
                id="fat-defect-toggle"
                name="is_fat_defect"
                checked={formData.is_fat_defect}
                onChange={handleChange}
                variant="simple"
                title="Toggle FAT Defect Status"
              />
            </div>
          </div>

          <div className="modal-tabs">
              <button 
                type="button" 
                className={`modal-tab-button ${activeTab === 'core' ? 'active' : ''}`} 
                onClick={() => setActiveTab('core')}
              >
                  Core Details
              </button>
              <button 
                type="button" 
                className={`modal-tab-button ${activeTab === 'tracking' ? 'active' : ''}`} 
                onClick={() => setActiveTab('tracking')}
              >
                  Tracking & Links
              </button>
          </div>

          <form id="defect-modal-form-id" onSubmit={handleSubmit}>
            
            {/* TAB 1: CORE DETAILS */}
            <div style={{ display: activeTab === 'core' ? 'block' : 'none' }}>
              <div id="form-group-project-id" className="form-group">
                <label id="defect-project-label" htmlFor="defect-project-button">Project:</label>
                <CustomDropdown
                  id="defect-project"
                  name="project"
                  value={formData.project}
                  onChange={handleChange}
                  options={projectOptions}
                  placeholder="-- Select Project --"
                  disabled={!!defect}
                />
              </div>
              <div id="form-group-title-id" className="form-group">
                <label htmlFor="defect-title">Title:</label>
                <input type="text" id="defect-title" name="title" value={formData.title} onChange={handleChange} required />
              </div>
              <div id="form-group-description-id" className="form-group">
                <label htmlFor="defect-description" className="optional-label">Description:</label>
                <textarea id="defect-description" name="description" value={formData.description} onChange={handleChange} rows="3" />
              </div>
              <div id="form-group-area-id" className="form-group">
                <label id="defect-area-label" htmlFor="defect-area-button">Area:</label>
                {isCustomArea ? (
                  <input type="text" id="defect-area-input" name="area" value={formData.area} onChange={handleChange} placeholder="Enter new area description" required />
                ) : (
                  <CustomDropdown
                    id="defect-area"
                    name="area"
                    value={formData.area}
                    onChange={handleChange}
                    options={areaOptions}
                    placeholder="-- Select Area --"
                  />
                )}
              </div>
              <div id="form-group-custom-area-toggle-id" className="form-group new-project-toggle">
                <input type="checkbox" id="isCustomAreaCheckbox" name="isCustomArea" checked={isCustomArea} onChange={handleCustomAreaToggle} />
                <label htmlFor="isCustomAreaCheckbox" className="checkbox-label optional-label">Add New Area</label>
              </div>
            </div>

            {/* TAB 2: TRACKING & LINKS */}
            <div style={{ display: activeTab === 'tracking' ? 'block' : 'none' }}>
              <div id="form-group-status-id" className="form-group">
                <label id="defect-status-label" htmlFor="defect-status-button">Status:</label>
                <CustomDropdown
                  id="defect-status"
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  options={statusSelectOptions}
                />
              </div>
              <div id="form-group-link-id" className="form-group">
                <label htmlFor="defect-link" className="optional-label">Link:</label>
                <input type="url" id="defect-link" name="link" value={formData.link} onChange={handleChange} />
              </div>
              <div id="form-group-date-logged-id" className="form-group">
                <label htmlFor="defect-created-date">Date Logged:</label>
                <DatePicker 
                    id="defect-created-date" 
                    name="created_date" 
                    selected={formData.created_date} 
                    onChange={handleDateChange} 
                    dateFormat="MM/dd/yyyy" 
                    className="notes-datepicker" 
                    wrapperClassName="date-picker-wrapper" 
                    // CHANGE HERE: Add portalId, strategy, and set to top
                    popperPlacement="top-start" 
                    portalId="root"
                    popperProps={{
                       strategy: "fixed" 
                    }}
                    autoComplete="off"
                />
              </div>
              <div id="form-group-linked-requirements-id" className="form-group">
                <fieldset id="linked-requirements-fieldset-id" style={{ border: 'none', padding: 0, margin: 0 }}>
                  <legend id="linked-requirements-legend-id" className="optional-label" style={{ padding: 0, marginBottom: '5px' }}>Link to Requirements:</legend>
                  <div id="dual-listbox-container-id" className="dual-listbox-container">
                    <div id="listbox-wrapper-available-id" className="listbox-wrapper">
                      <label id="available-requirements-label-id" htmlFor="available-requirements-listbox" className="optional-label">Available</label>
                      <input
                        id="available-requirements-search-id"
                        type="text"
                        placeholder="Search available..."
                        className="listbox-search-input"
                        value={availableSearchQuery}
                        onChange={(e) => setAvailableSearchQuery(e.target.value)}
                      />
                      <select multiple id="available-requirements-listbox" name="available-requirements" value={toAdd} onChange={(e) => handleSelectionChange(e, setToAdd)} disabled={requirementsForSelectedProject.length === 0}>
                        {availableRequirements.map(req => <option key={req.id} value={req.id} title={req.requirementUserIdentifier}>{req.requirementUserIdentifier}</option>)}
                      </select>
                    </div>
                    <div id="listbox-actions-id" className="listbox-actions">
                      <button id="listbox-add-button-id" type="button" onClick={handleAdd} disabled={toAdd.length === 0}>{'>>'}</button>
                      <button id="listbox-remove-button-id" type="button" onClick={handleRemove} disabled={toRemove.length === 0}>{'<<'}</button>
                    </div>
                    <div id="listbox-wrapper-selected-id" className="listbox-wrapper">
                      <label id="selected-requirements-label-id" htmlFor="selected-requirements-listbox" className="optional-label">Selected</label>
                      <input
                        id="selected-requirements-search-id"
                        type="text"
                        placeholder="Search selected..."
                        className="listbox-search-input"
                        value={selectedSearchQuery}
                        onChange={(e) => setSelectedSearchQuery(e.target.value)}
                      />
                      <select multiple id="selected-requirements-listbox" name="selected-requirements" value={toRemove} onChange={(e) => handleSelectionChange(e, setToRemove)} disabled={selectedRequirements.length === 0}>
                        {selectedRequirements.map(req => <option key={req.id} value={req.id} title={req.requirementUserIdentifier}>{req.requirementUserIdentifier}</option>)}
                      </select>
                    </div>
                  </div>
                </fieldset>
              </div>
              <div id="form-group-comment-id" className="form-group">
                <label htmlFor="defect-comment" className="optional-label">Comment:</label>
                <textarea id="defect-comment" name="comment" value={formData.comment} onChange={handleChange} rows="2" />
              </div>
            </div>

            <div id="modal-actions-id" className="modal-actions">
              {activeTab === 'tracking' && (
                 <button 
                    type="button" 
                    onClick={() => setActiveTab('core')} 
                    className="modal-button-cancel" 
                    style={{marginRight: 'auto'}}
                 >
                     Back
                 </button>
              )}
              <button type="button" id="modal-button-cancel-id" onClick={onClose} className="modal-button-cancel">Cancel</button>
              
              <button type="submit" id="modal-button-save-id" className="modal-button-save">
                 {activeTab === 'core' ? 'Next: Tracking & Links' : (defect ? 'Save Changes' : 'Create Defect')}
              </button>
            </div>
          </form>
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
        message="You have unsaved changes. Are you sure you want to close?"
      />
    </div>
  );
};

export default DefectModal;
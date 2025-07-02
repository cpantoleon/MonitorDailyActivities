import React, { useState, useEffect, useMemo } from 'react';
import DatePicker from 'react-datepicker';
import Select from 'react-select';
import "react-datepicker/dist/react-datepicker.css";
import useClickOutside from '../hooks/useClickOutside';
import ConfirmationModal from './ConfirmationModal';

const API_BASE_URL = '/api';
const DEFECT_STATUSES = ['Assigned to Developer', 'Assigned to Tester', 'Done'];

const DefectModal = ({ isOpen, onClose, onSubmit, defect, projects, currentSelectedProject, allRequirements = [] }) => {
  
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
  });

  const [formData, setFormData] = useState(getInitialFormState(currentSelectedProject));
  const [initialFormData, setInitialFormData] = useState(null);
  const [isCloseConfirmOpen, setIsCloseConfirmOpen] = useState(false);
  const [isCustomArea, setIsCustomArea] = useState(false);
  const [modalAreas, setModalAreas] = useState([]);
  
  const [availableRequirements, setAvailableRequirements] = useState([]);
  const [selectedRequirements, setSelectedRequirements] = useState([]);
  const [toAdd, setToAdd] = useState([]);
  const [toRemove, setToRemove] = useState([]);

  const requirementsForSelectedProject = useMemo(() => {
    if (!formData.project || !allRequirements) return [];
    return allRequirements.filter(r => r.project === formData.project);
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
          created_date: defect.created_date ? new Date(defect.created_date + 'T00:00:00') : new Date(),
          comment: '',
          linkedRequirementGroupIds: defect.linkedRequirements ? defect.linkedRequirements.map(r => r.groupId) : [],
        };
      } else {
        const initialProject = currentSelectedProject || '';
        initialData = getInitialFormState(initialProject);
      }
      setFormData(initialData);
      setInitialFormData(initialData);
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
    if (!isOpen || !formData.project) {
      setModalAreas([]);
      return;
    }
    
    const fetchAreasForProject = async (project) => {
      try {
        const res = await fetch(`${API_BASE_URL}/defects/${project}?statusType=all`);
        if (!res.ok) throw new Error('Failed to fetch areas');
        const result = await res.json();
        const areas = [...new Set(result.data.map(d => d.area).filter(Boolean))].sort();
        setModalAreas(areas);

        if (defect && defect.project === project) {
          setIsCustomArea(!areas.includes(defect.area));
        } else {
          setIsCustomArea(areas.length === 0);
        }
      } catch (error) {
        console.error("Could not fetch areas for project:", error);
        setModalAreas([]);
        setIsCustomArea(true);
      }
    };

    fetchAreasForProject(formData.project);
  }, [isOpen, formData.project, defect]);
  
  useEffect(() => {
    if (isOpen) {
      const linkedIdsSet = new Set(formData.linkedRequirementGroupIds);
      const available = requirementsForSelectedProject.filter(r => !linkedIdsSet.has(r.id));
      const selected = requirementsForSelectedProject.filter(r => linkedIdsSet.has(r.id));
      setAvailableRequirements(available);
      setSelectedRequirements(selected);
    } else {
        setAvailableRequirements([]);
        setSelectedRequirements([]);
        setToAdd([]);
        setToRemove([]);
    }
  }, [isOpen, requirementsForSelectedProject, formData.linkedRequirementGroupIds]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name, selectedOption) => {
    const value = selectedOption ? selectedOption.value : '';
    if (name === 'project') {
      setFormData(prev => ({
        ...getInitialFormState(value),
        project: value,
      }));
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
    if (!formData.project || !formData.title.trim() || !formData.area.trim() || !formData.status || !formData.created_date) {
      alert("Project, Title, Area, Status, and Date Logged are required.");
      return;
    }
    onSubmit({ ...formData, area: formData.area.trim() });
  };

  if (!isOpen) return null;

  const customSelectStyles = {
    menuList: (base) => ({ ...base, maxHeight: '180px', overflowY: 'auto' }),
    menuPortal: (base) => ({ ...base, zIndex: 9999 }),
  };
  
  const projectOptions = projects.map(p => ({ value: p, label: p }));
  const areaOptions = modalAreas.map(pa => ({ value: pa, label: pa }));
  const statusOptionsList = defect ? [...DEFECT_STATUSES, 'Closed'] : DEFECT_STATUSES;
  const statusSelectOptions = statusOptionsList.map(s => ({ value: s, label: s }));

  return (
    <>
      <div className="add-new-modal-overlay">
        <div ref={modalRef} className="add-new-modal-content" style={{ maxWidth: '800px' }}>
          <h2>{defect ? 'Edit Defect' : 'Create New Defect'}</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="defect-project">Project:</label>
              <Select id="defect-project" name="project" value={projectOptions.find(opt => opt.value === formData.project)} onChange={(option) => handleSelectChange('project', option)} options={projectOptions} styles={customSelectStyles} menuPortalTarget={document.body} placeholder="-- Select Project --" required isDisabled={!!defect} />
            </div>
            <div className="form-group">
              <label htmlFor="defect-title">Title:</label>
              <input type="text" id="defect-title" name="title" value={formData.title} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label htmlFor="defect-description" className="optional-label">Description:</label>
              <textarea id="defect-description" name="description" value={formData.description} onChange={handleChange} rows="3" />
            </div>
            <div className="form-group">
              <label htmlFor="defect-area">Area:</label>
              {isCustomArea ? (
                <input type="text" id="defect-area" name="area" value={formData.area} onChange={handleChange} placeholder="Enter new area description" required />
              ) : (
                <Select id="defect-area" name="area" value={areaOptions.find(opt => opt.value === formData.area)} onChange={(option) => handleSelectChange('area', option)} options={areaOptions} styles={customSelectStyles} menuPortalTarget={document.body} placeholder="-- Select Area --" required />
              )}
            </div>
            <div className="form-group new-project-toggle">
              <input type="checkbox" id="isCustomAreaCheckbox" checked={isCustomArea} onChange={handleCustomAreaToggle} />
              <label htmlFor="isCustomAreaCheckbox" className="checkbox-label optional-label">Add New Area</label>
            </div>
            <div className="form-group">
              <label htmlFor="defect-status">Status:</label>
              <Select id="defect-status" name="status" value={statusSelectOptions.find(opt => opt.value === formData.status)} onChange={(option) => handleSelectChange('status', option)} options={statusSelectOptions} styles={customSelectStyles} menuPortalTarget={document.body} required />
            </div>
            <div className="form-group">
              <label htmlFor="defect-link" className="optional-label">Link:</label>
              <input type="url" id="defect-link" name="link" value={formData.link} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label htmlFor="defect-created-date">Date Logged:</label>
              <DatePicker selected={formData.created_date} onChange={handleDateChange} dateFormat="MM/dd/yyyy" className="notes-datepicker" wrapperClassName="date-picker-wrapper" />
            </div>
            <div className="form-group">
              <label className="optional-label">Link to Requirements:</label>
              <div className="dual-listbox-container">
                <div className="listbox-wrapper">
                  <label className="optional-label">Available</label>
                  <select multiple value={toAdd} onChange={(e) => handleSelectionChange(e, setToAdd)} disabled={requirementsForSelectedProject.length === 0}>
                    {availableRequirements.map(req => <option key={req.id} value={req.id}>{req.requirementUserIdentifier}</option>)}
                  </select>
                </div>
                <div className="listbox-actions">
                  <button type="button" onClick={handleAdd} disabled={toAdd.length === 0}>{'>>'}</button>
                  <button type="button" onClick={handleRemove} disabled={toRemove.length === 0}>{'<<'}</button>
                </div>
                <div className="listbox-wrapper">
                  <label className="optional-label">Selected</label>
                  <select multiple value={toRemove} onChange={(e) => handleSelectionChange(e, setToRemove)} disabled={selectedRequirements.length === 0}>
                    {selectedRequirements.map(req => <option key={req.id} value={req.id}>{req.requirementUserIdentifier}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="defect-comment" className="optional-label">Comment:</label>
              <textarea id="defect-comment" name="comment" value={formData.comment} onChange={handleChange} rows="2" />
            </div>
            <div className="modal-actions">
              <button type="submit" className="modal-button-save">{defect ? 'Save Changes' : 'Create Defect'}</button>
              <button type="button" onClick={onClose} className="modal-button-cancel">Cancel</button>
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
    </>
  );
};

export default DefectModal;
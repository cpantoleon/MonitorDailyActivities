import React, { useState, useEffect, useMemo } from 'react';
import CustomDropdown from './CustomDropdown'; // Use the new component
import Tooltip from './Tooltip';
import useClickOutside from '../hooks/useClickOutside';
import ConfirmationModal from './ConfirmationModal';
import GifPlayerModal from './GifPlayerModal';

const ImportRequirementsModal = ({ isOpen, onClose, onImport, projects, releases, currentProject }) => {
  const getInitialState = (project = '') => ({
    selectedFile: null,
    targetProject: project,
    targetSprint: '1',
    targetReleaseId: '',
    isBacklog: false,
  });

  const [state, setState] = useState(getInitialState());
  const [initialState, setInitialState] = useState(null);
  const [error, setError] = useState('');
  const [isCloseConfirmOpen, setIsCloseConfirmOpen] = useState(false);
  const [isGifModalOpen, setIsGifModalOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const initial = getInitialState(currentProject);
      setState(initial);
      setInitialState(initial);
    } else {
      setState(getInitialState());
      setError('');
    }
  }, [isOpen, currentProject]);

  const releaseOptions = useMemo(() => {
    if (!state.targetProject) return [];
    return releases
      .filter(r => r.project === state.targetProject)
      .map(r => ({
        value: r.id,
        label: `${r.name} ${r.is_current ? '(Current)' : ''}`
      }));
  }, [state.targetProject, releases]);

  const hasUnsavedChanges = useMemo(() => {
    if (!initialState) return false;
    return JSON.stringify(state) !== JSON.stringify(initialState);
  }, [state, initialState]);

  const handleCloseRequest = () => {
    if (hasUnsavedChanges) {
      setIsCloseConfirmOpen(true);
    } else {
      onClose();
    }
  };

  const modalRef = useClickOutside(handleCloseRequest);

  const handleFileChange = (e) => {
    setState(prev => ({...prev, selectedFile: e.target.files[0]}));
    setError('');
  };

  const handleImport = () => {
    if (!state.selectedFile) {
      setError('Please select a file to import.');
      return;
    }
    if (!state.targetProject) {
      setError('Please select a target project.');
      return;
    }
    
    const sprintValue = state.isBacklog ? 'Backlog' : `Sprint ${state.targetSprint}`;
    onImport(state.selectedFile, state.targetProject, sprintValue, state.targetReleaseId);
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const val = type === 'checkbox' ? checked : value;

    if (name === 'targetProject') {
        setState(prev => ({
            ...prev,
            targetProject: val,
            targetReleaseId: ''
        }));
    } else {
        setState(prev => ({...prev, [name]: val}));
    }
  };

  const projectOptions = projects.map(p => ({ value: p, label: p }));
  const sprintNumberOptions = Array.from({ length: 20 }, (_, i) => ({
    value: `${i + 1}`,
    label: `${i + 1}`
  }));

  const tooltipContent = (
    <>
      <strong>Excel File Format Guide:</strong>
      <ul>
        <li>Only rows with a valid type in the 'T' column will be imported. Valid types are: 'Change Request', 'Task', 'Bug', 'Story', 'Incident'.</li>
        <li>The 'Summary' column is required and will become the requirement's title.</li>
        <li>The 'Key' column (e.g., 'PROJ-123') is used for JIRA links and duplicate checking.</li>
        <li>If a requirement with the same 'Key' already exists, it will be imported with a modified title (e.g., "Title (1)").</li>
        <li>The 'Sprint' column can be used to add tags to the requirement.</li>
        <li>Other columns are ignored.</li>
      </ul>
    </>
  );

  if (!isOpen) return null;

  return (
    <>
      <div className="add-new-modal-overlay">
        <div ref={modalRef} className="add-new-modal-content">
          <div className="modal-header-with-tooltip">
            <div>
              <h2>Import Requirements from Excel</h2>
              <span className="how-to-export-link" onClick={() => setIsGifModalOpen(true)}>
                How to Export from JIRA?
              </span>
            </div>
            <Tooltip content={tooltipContent} />
          </div>
          {error && <p className="error-message-modal">{error}</p>}
          <div className="form-group">
            <label htmlFor="importReqFile">Excel File (.xlsx, .xls):</label>
            <input type="file" id="importReqFile" name="importReqFile" accept=".xlsx, .xls" onChange={handleFileChange} />
          </div>
          <div className="form-group">
            {/* FIX: The label now has an ID that we can reference */}
            <label id="importReqProject-label" htmlFor="importReqProject-button">Target Project:</label>
            <CustomDropdown
              id="importReqProject"
              name="targetProject"
              value={state.targetProject}
              onChange={handleChange}
              options={projectOptions}
              placeholder="-- Select a Project --"
            />
          </div>
          <div className="form-group">
            {/* FIX: The label now has an ID that we can reference */}
            <label id="importReqSprint-label" htmlFor="importReqSprint-button">Target Sprint:</label>
            <CustomDropdown
              id="importReqSprint"
              name="targetSprint"
              value={state.targetSprint}
              onChange={handleChange}
              options={sprintNumberOptions}
              disabled={state.isBacklog}
            />
          </div>
          <div className="form-group new-project-toggle">
            <input type="checkbox" id="importIsBacklog" name="isBacklog" checked={state.isBacklog} onChange={handleChange} />
            <label htmlFor="importIsBacklog" className="checkbox-label optional-label">Assign to Backlog</label>
          </div>
          <div className="form-group">
            {/* FIX: The label now has an ID that we can reference */}
            <label id="importReqRelease-label" htmlFor="importReqRelease-button" className="optional-label">Assign to Release (Optional):</label>
            <CustomDropdown
              id="importReqRelease"
              name="targetReleaseId"
              value={state.targetReleaseId}
              onChange={handleChange}
              options={releaseOptions}
              disabled={!state.targetProject || releaseOptions.length === 0}
              placeholder={!state.targetProject ? "-- Select a project first --" : (releaseOptions.length === 0 ? "-- No releases for this project --" : "-- Select a Release --")}
            />
          </div>
          <div className="modal-actions">
            <button onClick={handleImport} className="modal-button-save">Import</button>
            <button type="button" onClick={onClose} className="modal-button-cancel">Cancel</button>
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
        message="You have unsaved changes. Are you sure you want to close?"
      />
      <GifPlayerModal 
        isOpen={isGifModalOpen}
        onClose={() => setIsGifModalOpen(false)}
        gifSrc="/exportJira.gif"
      />
    </>
  );
};

export default ImportRequirementsModal;
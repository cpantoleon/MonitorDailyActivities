import React, { useState, useEffect, useMemo } from 'react';
import CustomDropdown from './CustomDropdown';
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
    <div id="import-reqs-tooltip-content-id">
      <strong style={{ color: 'var(--text-primary)' }}>Excel File Format Guide:</strong>
      <ul style={{ paddingLeft: '20px', margin: '5px 0 0 0', color: 'var(--text-secondary)' }}>
        <li>Only rows with a valid type in the 'T' column will be imported. Valid types are: 'Change Request', 'Task', 'Bug', 'Story', 'Incident'.</li>
        <li>The 'Summary' column is required and will become the requirement's title.</li>
        <li>The 'Key' column (e.g., 'PROJ-123') is used for JIRA links and duplicate checking.</li>
        <li>If a requirement with the same 'Key' already exists, it will be imported with a modified title (e.g., "Title (1)").</li>
        <li>The 'Sprint' column can be used to add tags to the requirement.</li>
        <li>Other columns are ignored.</li>
      </ul>
    </div>
  );

  if (!isOpen) return null;

  return (
    <div id="import-requirements-modal-wrapper-id">
      <div id="add-new-modal-overlay-id" className="add-new-modal-overlay">
        <div ref={modalRef} id="add-new-modal-content-id" className="add-new-modal-content" style={{ maxWidth: '650px' }}>
          
          {/* UPDATED HEADER: Flexbox prevents wrapping and uses theme variables */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '15px', marginBottom: '20px', gap: '15px' }}>
            <h2 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.5em', flexGrow: 1 }}>
              Import Requirements
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
              <span 
                onClick={() => setIsGifModalOpen(true)}
                style={{ cursor: 'pointer', color: 'var(--accent-color)', textDecoration: 'underline', fontSize: '0.9em', fontWeight: '500' }}
              >
                How to Export from JIRA?
              </span>
              <Tooltip content={tooltipContent} position="bottom" />
            </div>
          </div>

          {/* UPDATED ERROR MESSAGE */}
          {error && <p id="error-message-modal-id" className="error-message-modal" style={{ color: 'var(--danger-color)', marginBottom: '15px', fontWeight: '500' }}>{error}</p>}
          
          <div id="form-group-file-id" className="form-group">
            <label htmlFor="importReqFile">Excel File (.xlsx, .xls):</label>
            {/* UPDATED INPUT FILE COLOR */}
            <input type="file" id="importReqFile" name="importReqFile" accept=".xlsx, .xls" onChange={handleFileChange} style={{ color: 'var(--text-primary)' }} />
          </div>
          <div id="form-group-project-id" className="form-group">
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
          <div id="form-group-sprint-id" className="form-group">
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
          <div id="form-group-backlog-toggle-id" className="form-group new-project-toggle">
            <input type="checkbox" id="importIsBacklog" name="isBacklog" checked={state.isBacklog} onChange={handleChange} />
            <label htmlFor="importIsBacklog" className="checkbox-label optional-label">Assign to Backlog</label>
          </div>
          <div id="form-group-release-id" className="form-group">
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
          
          <div id="modal-actions-id" className="modal-actions">
            {/* MATCHING BUTTON CLASSES */}
            <button id="import-button-id" onClick={handleImport} className="modal-button-save">Import</button>
            <button id="cancel-button-id" type="button" onClick={onClose} className="modal-button-cancel">Cancel</button>
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
    </div>
  );
};

export default ImportRequirementsModal;
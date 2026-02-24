import React, { useState, useMemo, useEffect } from 'react';
import CustomDropdown from './CustomDropdown';
import Tooltip from './Tooltip';
import useClickOutside from '../hooks/useClickOutside';
import ConfirmationModal from './ConfirmationModal';
import GifPlayerModal from './GifPlayerModal';

const ImportDefectsModal = ({ isOpen, onImport, projects, currentProject, onClose }) => {
  const getInitialState = (project = '') => ({
    selectedFile: null,
    targetProject: project,
  });

  const [formState, setFormState] = useState(getInitialState());
  const [initialState, setInitialState] = useState(null);
  const [error, setError] = useState('');
  const [isCloseConfirmOpen, setIsCloseConfirmOpen] = useState(false);
  const [isGifModalOpen, setIsGifModalOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const initial = getInitialState(currentProject);
      setFormState(initial);
      setInitialState(initial);
    } else {
      setFormState(getInitialState());
      setInitialState(null);
      setError('');
    }
  }, [isOpen, currentProject]);

  const hasUnsavedChanges = useMemo(() => {
    if (!initialState) return false;
    const fileChanged = formState.selectedFile?.name !== initialState.selectedFile?.name;
    const projectChanged = formState.targetProject !== initialState.targetProject;
    return fileChanged || projectChanged;
  }, [formState, initialState]);

  const handleCloseRequest = () => {
    if (hasUnsavedChanges) {
      setIsCloseConfirmOpen(true);
    } else {
      onClose();
    }
  };

  const modalRef = useClickOutside(handleCloseRequest);

  const projectOptions = projects.map(p => ({ value: p, label: p }));

  const handleFileChange = (e) => {
    setFormState(prev => ({...prev, selectedFile: e.target.files[0]}));
    setError('');
  };

  const handleImport = () => {
    if (!formState.selectedFile) {
      setError('Please select a file to import.');
      return;
    }
    if (!formState.targetProject) {
      setError('Please select a target project.');
      return;
    }
    onImport(formState.selectedFile, formState.targetProject);
  };

  const handleProjectChange = (e) => {
    setFormState(prev => ({...prev, targetProject: e.target.value }));
  };

  const tooltipContent = (
    <div id="import-defects-tooltip-content-id">
      <strong style={{ color: 'var(--text-primary)' }}>Excel File Format Guide:</strong>
      <ul style={{ paddingLeft: '20px', margin: '5px 0 0 0', color: 'var(--text-secondary)' }}>
        <li>Only rows with the type 'Defect' in the 'T' column will be imported.</li>
        <li>The 'Summary' column is required and will become the defect's title.</li>
        <li>The 'Key' column (e.g., 'PROJ-123') is used to create a JIRA link and check for duplicates.</li>
        <li>If a defect with the same 'Key' already exists, it will be imported with a modified title (e.g., "Title (1)").</li>
        <li>Other columns are ignored.</li>
      </ul>
    </div>
  );

  if (!isOpen) return null;

  return (
    <div id="import-defects-modal-wrapper-id">
      <div id="add-new-modal-overlay-id" className="add-new-modal-overlay">
        <div ref={modalRef} id="add-new-modal-content-id" className="add-new-modal-content">
          
          {/* UPDATED HEADER: Flexbox prevents wrapping and overlapping */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '15px', marginBottom: '20px', gap: '15px' }}>
            <h2 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.5em', flexGrow: 1 }}>
              Import Defects
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

          {error && <p id="error-message-modal-id" className="error-message-modal" style={{ color: 'var(--danger-color)', marginBottom: '15px' }}>{error}</p>}
          
          <div id="form-group-file-id" className="form-group">
            <label htmlFor="importDefectFile">Excel File (.xlsx, .xls):</label>
            <input type="file" id="importDefectFile" name="importDefectFile" accept=".xlsx, .xls" onChange={handleFileChange} style={{ color: 'var(--text-primary)' }}/>
          </div>
          <div id="form-group-project-id" className="form-group">
            <label id="importDefectProject-label" htmlFor="importDefectProject-button">Target Project:</label>
            <CustomDropdown
              id="importDefectProject"
              name="targetProject"
              value={formState.targetProject}
              onChange={handleProjectChange}
              options={projectOptions}
              placeholder="-- Select a Project --"
            />
          </div>
          <div id="modal-actions-id" className="modal-actions">
            <button id="import-button-id" onClick={handleImport} className="btn-primary">Import</button>
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

export default ImportDefectsModal;
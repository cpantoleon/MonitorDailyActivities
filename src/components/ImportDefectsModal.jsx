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
      <strong>Excel File Format Guide:</strong>
      <ul>
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
          <div id="modal-header-with-tooltip-id" className="modal-header-with-tooltip">
            <div id="modal-header-content-id">
              <h2 id="import-defects-title-id">Import Defects from Excel</h2>
              <span id="how-to-export-link-id" className="how-to-export-link" onClick={() => setIsGifModalOpen(true)}>
                How to Export from JIRA?
              </span>
            </div>
            <Tooltip content={tooltipContent} position="bottom" />
          </div>
          {error && <p id="error-message-modal-id" className="error-message-modal">{error}</p>}
          <div id="form-group-file-id" className="form-group">
            <label htmlFor="importDefectFile">Excel File (.xlsx, .xls):</label>
            <input type="file" id="importDefectFile" name="importDefectFile" accept=".xlsx, .xls" onChange={handleFileChange} />
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

export default ImportDefectsModal;
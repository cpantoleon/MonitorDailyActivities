import React, { useState, useMemo, useEffect } from 'react';
import CustomDropdown from './CustomDropdown';
import Tooltip from './Tooltip';
import useClickOutside from '../hooks/useClickOutside';
import ConfirmationModal from './ConfirmationModal';
import GifPlayerModal from './GifPlayerModal';

import { useGlobal } from '../context/GlobalContext';

const ImportDefectsModal = ({ isOpen, onImport, projects, currentProject, onClose, allReleases = [] }) => {
  const { isMultiReleaseMode } = useGlobal();

  const getInitialState = (project = '') => ({
    selectedFile: null,
    targetProject: project,
    mapFixVersions: false,
    manualReleaseIds: []
  });

  const [formState, setFormState] = useState(getInitialState());
  const [initialState, setInitialState] = useState(null);
  const [error, setError] = useState('');
  const [isCloseConfirmOpen, setIsCloseConfirmOpen] = useState(false);
  const [isGifModalOpen, setIsGifModalOpen] = useState(false);

  const [isReleaseWarningOpen, setIsReleaseWarningOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const initial = getInitialState(currentProject);
      setFormState(initial);
      setInitialState(initial);
    } else {
      setFormState(getInitialState());
      setInitialState(null);
      setError('');
      setIsReleaseWarningOpen(false);
    }
  }, [isOpen, currentProject]);

  const hasUnsavedChanges = useMemo(() => {
    if (!initialState) return false;
    const fileChanged = formState.selectedFile?.name !== initialState.selectedFile?.name;
    const projectChanged = formState.targetProject !== initialState.targetProject;
    const mapChanged = formState.mapFixVersions !== initialState.mapFixVersions;
    const releaseChanged = JSON.stringify(formState.manualReleaseIds) !== JSON.stringify(initialState.manualReleaseIds);
    return fileChanged || projectChanged || mapChanged || releaseChanged;
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

  const executeImport = () => {
    setIsReleaseWarningOpen(false);
    onImport(formState.selectedFile, formState.targetProject, formState.mapFixVersions, formState.manualReleaseIds);
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

    if (formState.manualReleaseIds.length === 0) {
      setIsReleaseWarningOpen(true);
      return;
    }

    executeImport();
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

          <div className="form-group">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <input 
                    type="checkbox" 
                    id="mapFixVersions" 
                    checked={formState.mapFixVersions} 
                    onChange={(e) => setFormState(prev => ({ ...prev, mapFixVersions: e.target.checked }))} 
                />
                <label htmlFor="mapFixVersions" style={{ marginBottom: 0 }}>Map Jira "Fix Version" to project releases</label>
            </div>
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

      {isReleaseWarningOpen && (
        <div className="add-new-modal-overlay" style={{ zIndex: 1100 }}>
          <div className="add-new-modal-content" style={{ maxWidth: '500px' }}>
            <h3 style={{ marginBottom: '15px' }}>Warning: No Release Selected</h3>
            <p style={{ marginBottom: '20px', color: 'var(--text-secondary)' }}>
              {formState.mapFixVersions ? (
                <>
                  You have chosen to map Jira "Fix Versions". However, if a defect has no Fix Version or it doesn't match an active release, it will be imported as an orphan and won't appear in the release dashboard.
                  <br /><br />
                  Would you like to assign a fallback release?
                </>
              ) : (
                <>
                  You are importing defects without mapping them to a release. Since they do not have linked requirements yet, they will not appear in any release dashboard.
                  <br /><br />
                  Would you like to assign them to an active release?
                </>
              )}
            </p>

            <div className="form-group">
              <label>Assign to Release(s):</label>
              {isMultiReleaseMode ? (
                  <select
                      multiple
                      value={formState.manualReleaseIds}
                      onChange={(e) => {
                          const values = Array.from(e.target.selectedOptions, option => parseInt(option.value, 10));
                          setFormState(prev => ({ ...prev, manualReleaseIds: values }));
                      }}
                      style={{
                          width: '100%', height: '90px', padding: '6px', borderRadius: '6px',
                          border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)',
                          color: 'var(--text-primary)', fontFamily: 'inherit'
                      }}
                  >
                      {allReleases.filter(r => r.project === formState.targetProject && r.status !== 'archived' && r.status !== 'closed').map(r => (
                          <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                  </select>
              ) : (
                  <CustomDropdown
                      value={formState.manualReleaseIds[0] || ''}
                      onChange={(e) => {
                          const val = e.target.value ? [parseInt(e.target.value, 10)] : [];
                          setFormState(prev => ({ ...prev, manualReleaseIds: val }));
                      }}
                      options={[
                          { value: '', label: '-- None --' },
                          ...allReleases.filter(r => r.project === formState.targetProject && r.status !== 'archived' && r.status !== 'closed').map(r => ({ value: r.id, label: r.name }))
                      ]}
                      placeholder="-- Select a Release --"
                  />
              )}
            </div>

            <div className="modal-actions" style={{ marginTop: '25px', justifyContent: 'flex-end', gap: '10px' }}>
              <button className="modal-button-cancel" onClick={() => setIsReleaseWarningOpen(false)}>Back</button>
              <button className="btn-secondary" onClick={executeImport}>Import as Orphans</button>
              <button className="btn-primary" onClick={executeImport} disabled={formState.manualReleaseIds.length === 0}>
                Assign & Import
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImportDefectsModal;
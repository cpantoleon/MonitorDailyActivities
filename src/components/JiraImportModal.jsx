import React, { useState, useEffect, useMemo } from 'react';
import CustomDropdown from './CustomDropdown';
import Tooltip from './Tooltip';
import useClickOutside from '../hooks/useClickOutside';
import ConfirmationModal from './ConfirmationModal';

const JiraImportModal = ({ isOpen, onClose, onImportSuccess, projects, releases, currentProject, importType, showMessage }) => {
    const [token, setToken] = useState('');
    const [hasSavedToken, setHasSavedToken] = useState(false);
    const [selectedProject, setSelectedProject] = useState('');
    const [selectedReleaseId, setSelectedReleaseId] = useState('');
    
    const [targetSprint, setTargetSprint] = useState('1');
    const [isBacklog, setIsBacklog] = useState(false);

    const [jqlQuery, setJqlQuery] = useState('');
    const [initialJql, setInitialJql] = useState(''); // Added to track initial DB value
    
    const [saveToken, setSaveToken] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const [isCloseConfirmOpen, setIsCloseConfirmOpen] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setSelectedProject(currentProject || '');
            setSelectedReleaseId('');
            setTargetSprint('1');
            setIsBacklog(false);
            
            setJqlQuery('');
            setInitialJql('');
            setToken('');
            setSaveToken(true);
            checkTokenExistence();
        }
    }, [isOpen, currentProject]);

    useEffect(() => {
        if (isOpen && selectedProject) {
            fetchJqlConfig(selectedProject);
        }
    }, [isOpen, selectedProject]);

    const checkTokenExistence = async () => {
        try {
            const response = await fetch('/api/settings/jira-token-exists');
            const data = await response.json();
            setHasSavedToken(data.exists);
        } catch (error) {
            console.error("Failed to check token existence", error);
        }
    };

    const fetchJqlConfig = async (project) => {
        try {
            const response = await fetch(`/api/jira/config/${encodeURIComponent(project)}`);
            if (response.ok) {
                const data = await response.json();
                if (data.jql) {
                    setJqlQuery(data.jql);
                    setInitialJql(data.jql); // Set initial so we know if user changed it
                } else {
                    setJqlQuery('');
                    setInitialJql('');
                }
            }
        } catch (error) {
            console.error("Failed to fetch JQL config", error);
        }
    };

    const releaseOptions = useMemo(() => {
        if (!selectedProject) return [];
        return releases
            .filter(r => r.project === selectedProject)
            .map(r => ({
                value: r.id,
                label: `${r.name} ${r.is_current ? '(Current)' : ''}`
            }));
    }, [selectedProject, releases]);

    const sprintNumberOptions = useMemo(() => {
        return Array.from({ length: 20 }, (_, i) => ({
            value: `${i + 1}`,
            label: `${i + 1}`
        }));
    }, []);

    const hasUnsavedChanges = useMemo(() => {
        // Compare with initialJql instead of just empty string
        return token !== '' || jqlQuery !== initialJql;
    }, [token, jqlQuery, initialJql]);

    const handleCloseRequest = () => {
        if (hasUnsavedChanges) {
            setIsCloseConfirmOpen(true);
        } else {
            onClose();
        }
    };

    const modalRef = useClickOutside(handleCloseRequest);

    const handleImport = async () => {
        if (!selectedProject) {
            showMessage("Please select a project.", "error");
            return;
        }
        if (!jqlQuery.trim()) {
            showMessage("Please enter a JQL query.", "error");
            return;
        }

        setIsLoading(true);
        try {
            const sprintValue = isBacklog ? 'Backlog' : `Sprint ${targetSprint}`;

            const payload = {
                project: selectedProject,
                jql: jqlQuery,
                importType: importType,
                release_id: selectedReleaseId || null,
                sprint: sprintValue,
                token: token || null, 
                saveToken: saveToken
            };

            const response = await fetch('/api/jira/import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || "Import failed");
            }

            showMessage(result.message, "success");
            onImportSuccess(selectedProject, sprintValue);
            onClose();
        } catch (error) {
            showMessage(error.message, "error");
        } finally {
            setIsLoading(false);
        }
    };

    const projectOptions = projects.map(p => ({ value: p, label: p }));

    const jqlTooltipContent = (
        <div>
            <strong>JIRA Query Language (JQL)</strong>
            <p>Enter a specific JQL query to filter items from JIRA.</p>
            <p>Example: <code>project = "PROJECTCOOP" AND issuetype = Bug</code></p>
            <p>The query you enter will be saved for this project for future use.</p>
        </div>
    );

    if (!isOpen) return null;

    return (
        <div id="jira-import-modal-wrapper">
            <div className="add-new-modal-overlay">
                <div ref={modalRef} className="add-new-modal-content">
                    <div className="modal-header-with-tooltip">
                        <div id="modal-header-content">
                            <h2>Import {importType === 'requirements' ? 'Requirements' : 'Defects'} from JIRA</h2>
                        </div>
                    </div>

                    <div className="form-group">
                        <label htmlFor="jiraToken">Personal Access Token:</label>
                        {/* Hidden input to absorb autofill usernames to protect the Search bar */}
                        <input type="text" name="fakeUsername" style={{display: 'none'}} aria-hidden="true" autoComplete="username" />
                        
                        {/* Changed autoComplete to "new-password" to trick autofill managers */}
                        <input 
                            type="password" 
                            id="jiraToken" 
                            name="jiraTokenPassword"
                            value={token} 
                            onChange={(e) => setToken(e.target.value)} 
                            placeholder={hasSavedToken ? "****************" : "Enter JIRA Token"} 
                            autoComplete="new-password"
                            data-1p-ignore="true" 
                            data-lpignore="true"
                        />
                        <div className="new-project-toggle" style={{marginTop: '5px'}}>
                            <input 
                                type="checkbox" 
                                id="saveTokenCheck" 
                                checked={saveToken} 
                                onChange={(e) => setSaveToken(e.target.checked)} 
                            />
                            <label htmlFor="saveTokenCheck" className="checkbox-label optional-label">Save Token for future use</label>
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Target Project:</label>
                        <CustomDropdown
                            id="jiraProjectSelect"
                            name="targetProject"
                            value={selectedProject}
                            onChange={(e) => setSelectedProject(e.target.value)}
                            options={projectOptions}
                            placeholder="-- Select a Project --"
                        />
                    </div>

                    {importType === 'requirements' && (
                        <>
                            <div className="form-group">
                                <label>Target Sprint:</label>
                                <CustomDropdown
                                    id="jiraSprintSelect"
                                    name="targetSprint"
                                    value={targetSprint}
                                    onChange={(e) => setTargetSprint(e.target.value)}
                                    options={sprintNumberOptions}
                                    disabled={isBacklog}
                                />
                            </div>
                            <div className="form-group new-project-toggle">
                                <input 
                                    type="checkbox" 
                                    id="jiraIsBacklog" 
                                    name="isBacklog" 
                                    checked={isBacklog} 
                                    onChange={(e) => setIsBacklog(e.target.checked)} 
                                />
                                <label htmlFor="jiraIsBacklog" className="checkbox-label optional-label">Assign to Backlog</label>
                            </div>

                            <div className="form-group">
                                <label>Assign to Release (Optional):</label>
                                <CustomDropdown
                                    id="jiraReleaseSelect"
                                    name="targetReleaseId"
                                    value={selectedReleaseId}
                                    onChange={(e) => setSelectedReleaseId(e.target.value)}
                                    options={releaseOptions}
                                    disabled={!selectedProject || releaseOptions.length === 0}
                                    placeholder={!selectedProject ? "-- Select a project first --" : "-- Select a Release --"}
                                />
                            </div>
                        </>
                    )}

                    <div className="form-group">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                            <label htmlFor="jqlQuery" style={{marginBottom: 0}}>JQL Query:</label>
                            <Tooltip content={jqlTooltipContent} position="bottom" />
                        </div>
                        <textarea 
                            id="jqlQuery" 
                            value={jqlQuery} 
                            onChange={(e) => setJqlQuery(e.target.value)} 
                            rows="4" 
                            placeholder='e.g., project = "MYPROJ" AND sprint in openSprints()'
                        />
                    </div>

                    <div className="modal-actions">
                        <button onClick={handleImport} className="modal-button-save" disabled={isLoading}>
                            {isLoading ? 'Importing...' : 'Fetch & Import'}
                        </button>
                        <button onClick={onClose} className="modal-button-cancel" disabled={isLoading}>Cancel</button>
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
                message="You have entered data. Are you sure you want to close?"
            />
        </div>
    );
};

export default JiraImportModal;
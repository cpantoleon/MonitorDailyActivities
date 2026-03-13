import React, { useState, useEffect, useMemo } from 'react';
import CustomDropdown from './CustomDropdown';
import Tooltip from './Tooltip';
import useClickOutside from '../hooks/useClickOutside';
import ConfirmationModal from './ConfirmationModal';

const JiraImportModal = ({ isOpen, onClose, onImportSuccess, projects, releases, currentProject, importType, showMessage }) => {
    const [step, setStep] = useState(1); // 1: Config, 2: Review Hierarchy
    const [token, setToken] = useState('');
    const [hasSavedToken, setHasSavedToken] = useState(false);
    const [selectedProject, setSelectedProject] = useState('');
    const [selectedReleaseId, setSelectedReleaseId] = useState('');
    
    const [targetSprint, setTargetSprint] = useState('1');
    const [isBacklog, setIsBacklog] = useState(false);

    const [jqlQuery, setJqlQuery] = useState('');
    const [initialJql, setInitialJql] = useState('');
    
    const [saveToken, setSaveToken] = useState(true);
    const [includeSubtasks, setIncludeSubtasks] = useState(true); // Νέο state
    
    const [isLoading, setIsLoading] = useState(false);
    const [isCloseConfirmOpen, setIsCloseConfirmOpen] = useState(false);

    // State για το Step 2 (Hierarchy)
    const [hierarchyData, setHierarchyData] = useState([]);
    const [selectedSubtasks, setSelectedSubtasks] = useState(new Set());

    useEffect(() => {
        if (isOpen) {
            setStep(1);
            setSelectedProject(currentProject || '');
            setSelectedReleaseId('');
            setTargetSprint('1');
            setIsBacklog(false);
            setJqlQuery('');
            setInitialJql('');
            setToken('');
            setSaveToken(true);
            setIncludeSubtasks(importType === 'requirements'); // Default true μόνο για requirements
            setHierarchyData([]);
            setSelectedSubtasks(new Set());
            checkTokenExistence();
        }
    }, [isOpen, currentProject, importType]);

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
                    setInitialJql(data.jql);
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
        return token !== '' || jqlQuery !== initialJql;
    }, [token, jqlQuery, initialJql]);

    const handleCloseRequest = () => {
        if (hasUnsavedChanges && step === 1) {
            setIsCloseConfirmOpen(true);
        } else {
            onClose();
        }
    };

    const modalRef = useClickOutside(handleCloseRequest);

    // --- ACTION: FETCH OR DIRECT IMPORT ---
    const handlePrimaryAction = async () => {
        if (!selectedProject) { showMessage("Please select a project.", "error"); return; }
        if (!jqlQuery.trim()) { showMessage("Please enter a JQL query.", "error"); return; }

        setIsLoading(true);
        const sprintValue = isBacklog ? 'Backlog' : `Sprint ${targetSprint}`;

        // Αν ΔΕΝ θέλουμε review subtasks (ή είναι defects), καλούμε τα παλιά σου endpoints
        if (!includeSubtasks || importType === 'defects') {
            try {
                const endpoint = importType === 'requirements' ? '/api/jira/import/requirements' : '/api/jira/import/defects';
                const payload = {
                    project: selectedProject, jql: jqlQuery, release_id: selectedReleaseId || null,
                    sprint: sprintValue, token: token || null, saveToken: saveToken
                };

                const response = await fetch(endpoint, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
                });
                const result = await response.json();
                if (!response.ok) throw new Error(result.error || "Import failed");

                showMessage(result.message, "success");
                onImportSuccess(selectedProject, sprintValue);
                onClose();
            } catch (error) {
                showMessage(error.message, "error");
            } finally {
                setIsLoading(false);
            }
            return;
        }

        // Αν ΘΕΛΟΥΜΕ review subtasks, καλούμε το νέο FETCH endpoint
        try {
            const payload = { project: selectedProject, jql: jqlQuery, token: token || null, saveToken: saveToken };
            const response = await fetch('/api/jira/fetch', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || "Fetch failed");

            setHierarchyData(result.data.hierarchy || []);
            setStep(2); // Πάμε στο Step 2
        } catch (error) {
            showMessage(error.message, "error");
        } finally {
            setIsLoading(false);
        }
    };

    // --- ACTION: FINAL IMPORT (Step 2) ---
    const handleFinalImport = async () => {
        setIsLoading(true);
        const sprintValue = isBacklog ? 'Backlog' : `Sprint ${targetSprint}`;

        // Χτίζουμε το payload με τα parents και ΜΟΝΟ τα επιλεγμένα subtasks
        const itemsToImport = hierarchyData.map(parent => {
            const selectedSubs = parent.subtasks.filter(sub => selectedSubtasks.has(sub.key));
            return { ...parent, selectedSubtasks: selectedSubs };
        });

        try {
            const payload = {
                project: selectedProject, sprint: sprintValue, release_id: selectedReleaseId || null, itemsToImport
            };
            const response = await fetch('/api/jira/import', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || "Import failed");

            showMessage(result.message, "success");
            onImportSuccess(selectedProject, sprintValue);
            onClose();
        } catch (error) {
            showMessage(error.message, "error");
        } finally {
            setIsLoading(false);
        }
    };

    const toggleSubtask = (subtaskKey) => {
        const newSet = new Set(selectedSubtasks);
        if (newSet.has(subtaskKey)) newSet.delete(subtaskKey);
        else newSet.add(subtaskKey);
        setSelectedSubtasks(newSet);
    };

    const projectOptions = projects.map(p => ({ value: p, label: p }));

    if (!isOpen) return null;

    return (
        <div id="jira-import-modal-wrapper">
            <div className="add-new-modal-overlay">
                <div ref={modalRef} className="add-new-modal-content" style={{ maxWidth: step === 2 ? '800px' : '650px' }}>
                    
                    {/* STEP 1: CONFIGURATION */}
                    {step === 1 && (
                        <>
                            <div className="modal-header-with-tooltip">
                                <div id="modal-header-content">
                                    <h2>Import {importType === 'requirements' ? 'Requirements' : 'Defects'} from JIRA</h2>
                                </div>
                            </div>

                            <div className="form-group">
                                <label htmlFor="jiraToken">Personal Access Token:</label>
                                <input type="text" name="fakeUsername" style={{display: 'none'}} aria-hidden="true" autoComplete="username" />
                                <input 
                                    type="password" id="jiraToken" name="jiraTokenPassword" value={token} 
                                    onChange={(e) => setToken(e.target.value)} 
                                    placeholder={hasSavedToken ? "****************" : "Enter JIRA Token"} 
                                    autoComplete="new-password" data-1p-ignore="true" data-lpignore="true"
                                />
                                <div className="new-project-toggle" style={{marginTop: '5px'}}>
                                    <input type="checkbox" id="saveTokenCheck" checked={saveToken} onChange={(e) => setSaveToken(e.target.checked)} />
                                    <label htmlFor="saveTokenCheck" className="checkbox-label optional-label">Save Token for future use</label>
                                </div>
                            </div>

                            <div className="form-group">
                                <label>Target Project:</label>
                                <CustomDropdown id="jiraProjectSelect" name="targetProject" value={selectedProject} onChange={(e) => setSelectedProject(e.target.value)} options={projectOptions} placeholder="-- Select a Project --" />
                            </div>

                            {importType === 'requirements' && (
                                <>
                                    <div className="form-group">
                                        <label>Target Sprint:</label>
                                        <CustomDropdown id="jiraSprintSelect" name="targetSprint" value={targetSprint} onChange={(e) => setTargetSprint(e.target.value)} options={sprintNumberOptions} disabled={isBacklog} />
                                    </div>
                                    <div className="form-group new-project-toggle">
                                        <input type="checkbox" id="jiraIsBacklog" name="isBacklog" checked={isBacklog} onChange={(e) => setIsBacklog(e.target.checked)} />
                                        <label htmlFor="jiraIsBacklog" className="checkbox-label optional-label">Assign to Backlog</label>
                                    </div>

                                    <div className="form-group">
                                        <label>Assign to Release (Optional):</label>
                                        <CustomDropdown id="jiraReleaseSelect" name="targetReleaseId" value={selectedReleaseId} onChange={(e) => setSelectedReleaseId(e.target.value)} options={releaseOptions} disabled={!selectedProject || releaseOptions.length === 0} placeholder={!selectedProject ? "-- Select a project first --" : "-- Select a Release --"} />
                                    </div>

                                    <div className="form-group new-project-toggle" style={{ marginTop: '20px', padding: '10px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                                        <input type="checkbox" id="includeSubtasks" checked={includeSubtasks} onChange={(e) => setIncludeSubtasks(e.target.checked)} />
                                        <label htmlFor="includeSubtasks" className="checkbox-label" style={{ fontWeight: 'bold' }}>
                                            Review and Include Sub-tasks
                                        </label>
                                        <p style={{ margin: '5px 0 0 25px', fontSize: '0.85em', color: 'var(--text-secondary)' }}>
                                            If checked, you will see a list of items and their sub-tasks to select before importing.
                                        </p>
                                    </div>
                                </>
                            )}

                            <div className="form-group">
                                <label htmlFor="jqlQuery">JQL Query:</label>
                                <textarea id="jqlQuery" value={jqlQuery} onChange={(e) => setJqlQuery(e.target.value)} rows="4" placeholder='e.g., project = "MYPROJ" AND sprint in openSprints()' />
                            </div>

                            <div className="modal-actions">
                                <button onClick={handlePrimaryAction} className="modal-button-save" disabled={isLoading}>
                                    {isLoading ? 'Processing...' : (includeSubtasks && importType === 'requirements' ? 'Fetch & Review' : 'Import Directly')}
                                </button>
                                <button onClick={onClose} className="modal-button-cancel" disabled={isLoading}>Cancel</button>
                            </div>
                        </>
                    )}

                    {/* STEP 2: REVIEW HIERARCHY */}
                    {step === 2 && (
                        <>
                            <h2>Review Items & Sub-tasks</h2>
                            <p style={{ color: 'var(--text-secondary)', marginBottom: '15px' }}>
                                All parent items will be imported. Select the specific sub-tasks you want to include.
                            </p>

                            <div style={{ maxHeight: '50vh', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '10px', backgroundColor: 'var(--bg-primary)' }}>
                                {hierarchyData.length === 0 ? (
                                    <p style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>No items found for this query.</p>
                                ) : (
                                    hierarchyData.map(parent => (
                                        <div key={parent.key} style={{ marginBottom: '15px', backgroundColor: 'var(--bg-secondary)', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                                            <div style={{ fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: '8px' }}>
                                                [{parent.key}] {parent.summary}
                                            </div>
                                            
                                            {parent.subtasks && parent.subtasks.length > 0 ? (
                                                <div style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                    {parent.subtasks.map(sub => (
                                                        <label key={sub.key} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9em', color: 'var(--text-primary)' }}>
                                                            <input 
                                                                type="checkbox" 
                                                                checked={selectedSubtasks.has(sub.key)}
                                                                onChange={() => toggleSubtask(sub.key)}
                                                                style={{ width: '16px', height: '16px', margin: 0 }}
                                                            />
                                                            <span>[{sub.key}] {sub.summary}</span>
                                                        </label>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div style={{ paddingLeft: '20px', fontSize: '0.85em', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                                                    No sub-tasks found.
                                                </div>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>

                            <div className="modal-actions">
                                <button onClick={() => setStep(1)} className="modal-button-cancel" disabled={isLoading}>Back</button>
                                <button onClick={handleFinalImport} className="modal-button-save" disabled={isLoading || hierarchyData.length === 0}>
                                    {isLoading ? 'Importing...' : 'Confirm & Import'}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
            <ConfirmationModal
                isOpen={isCloseConfirmOpen}
                onClose={() => setIsCloseConfirmOpen(false)}
                onConfirm={() => { setIsCloseConfirmOpen(false); onClose(); }}
                title="Unsaved Changes"
                message="You have entered data. Are you sure you want to close?"
            />
        </div>
    );
};

export default JiraImportModal;
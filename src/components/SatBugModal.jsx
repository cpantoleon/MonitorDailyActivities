import React, { useState, useEffect } from 'react';
import Modal from './ReleaseModal';
import CustomDropdown from './CustomDropdown';
import LabelDescriptionModal from './LabelDescriptionModal';

const BUG_LABELS = [
    { value: 'EUIPO_DEPLOYMENT/CONFIGURATION', label: 'EUIPO_DEPLOYMENT/CONFIGURATION', description: 'bug caused by missing/undocumented step in deployment or configuration' },
    { value: 'EUIPO_ENVIRONMENT_LIMITATION', label: 'EUIPO_ENVIRONMENT_LIMITATION', description: 'bug was not shown in integration/Intrasoft env' },
    { value: 'EUIPO_SECURITY', label: 'EUIPO_SECURITY', description: 'bug is related to security testing' },
    { value: 'EUIPO_DATA_CORRECTION', label: 'EUIPO_DATA_CORRECTION', description: 'for issues occurring after data fixes, db. updates etc..' },
    { value: 'EUIPO_BUG', label: 'EUIPO_BUG', description: 'for actual application defects' },
    { value: 'EUIPO_USER_ERROR', label: 'EUIPO_USER_ERROR', description: 'users not using correctly the app and we are then called to provide feedback on how to \'undo\' them' },
    { value: 'EUIPO_OBSOLETE', label: 'EUIPO_OBSOLETE', description: 'for obsolete issues' },
    { value: 'EUIPO_DUPLICATE', label: 'EUIPO_DUPLICATE', description: 'for duplications' },
    { value: 'EUIPO_DEVOPS_APPADMINS', label: 'EUIPO_DEVOPS_APPADMINS', description: 'for issues that should have been handled by DevOps or DbAdmins' },
    { value: 'EUIPO_WORKFLOW_ISSUE', label: 'EUIPO_WORKFLOW_ISSUE', description: 'problems with the workflows; maybe in these cases to see if any possible improvement exists' },
    { value: 'EUIPO_INSTRUCTIONS', label: 'EUIPO_INSTRUCTIONS', description: 'in cases where our help with instructions or info on the expected behavior is required' },
    { value: 'EUIPO_UNCLEAR_LACK_OF_REQUIREMENTS', label: 'EUIPO_UNCLEAR_LACK_OF_REQUIREMENTS', description: 'bug caused by unclear or absent requirements' },
    { value: 'EUIPO_OUT_OF_SCOPE', label: 'EUIPO_OUT_OF_SCOPE', description: 'SAT finding is out of scope (e.g. requirement not yet implemented)' },
    { value: 'EUIPO_WORKS_AS_EXPECTED', label: 'EUIPO_WORKS_AS_EXPECTED', description: 'SAT finding is not a bug' },
    { value: 'EUIPO_ALREADY_EXISTS_INPROD', label: 'EUIPO_ALREADY_EXISTS_INPROD', description: 'bug already exists in production' },
    { value: 'EUIPO_RELEASE_DOCUMENTATION', label: 'EUIPO_RELEASE_DOCUMENTATION', description: 'issue opened and related to lack of info in the release documentation provided to EUIPO' },
    { value: 'EUIPO_MORE_EXPLORATORY_TESTING', label: 'EUIPO_MORE_EXPLORATORY_TESTING', description: 'bug caused by specific combination of data (issue not exist with other data)' },
    { value: 'EUIPO_MISSED_DURING_FAT', label: 'EUIPO_MISSED_DURING_FAT', description: 'bug caused by not properly executed test case or by non-existing test case' },
    { value: 'EUIPO_REGRESSION', label: 'EUIPO_REGRESSION', description: 'bug could have been found during internal testing if more regression test cases were run' },
    { value: 'EUIPO_PERFORMANCE', label: 'EUIPO_PERFORMANCE', description: 'for performance issues' },
    { value: 'EUIPO_SAT/UAT_RUN_IN_PARALLEL_WITH_FAT', label: 'EUIPO_SAT/UAT_RUN_IN_PARALLEL_WITH_FAT', description: 'bugs found during FAT period from EUIPO' },
    { value: 'EUIPO_FOUND_IN_FAT_NOTFIXED', label: 'EUIPO_FOUND_IN_FAT_NOTFIXED', description: 'bug found during FAT and not fixed (time limitations etc.)' },
    { value: 'EUIPO_FOUND_IN_SAT_NOTFIXED', label: 'EUIPO_FOUND_IN_SAT_NOTFIXED', description: 'bug found during SAT and not fixed' }
];

const SatBugModal = ({ isOpen, onClose, onSave, archiveId, bugToEdit, showMainMessage }) => {
    const [title, setTitle] = useState('');
    const [link, setLink] = useState('');
    const [estimation, setEstimation] = useState('');
    const [estimationUnit, setEstimationUnit] = useState('h');
    const [label, setLabel] = useState('');
    const [isDescriptionModalOpen, setIsDescriptionModalOpen] = useState(false);

    useEffect(() => {
        if (isOpen) {
            if (bugToEdit) {
                setTitle(bugToEdit.title);
                setLink(bugToEdit.link);
                setLabel(bugToEdit.label || '');
                if (bugToEdit.estimation) {
                    const hours = bugToEdit.estimation;
                    if (hours > 0 && hours % 8 === 0) {
                        setEstimation(hours / 8);
                        setEstimationUnit('d');
                    } else {
                        setEstimation(hours || '');
                        setEstimationUnit('h');
                    }
                } else {
                    setEstimation('');
                    setEstimationUnit('h');
                }
            } else {
                setTitle('');
                setLink('');
                setEstimation('');
                setEstimationUnit('h');
                setLabel('');
            }
        }
    }, [bugToEdit, isOpen]);

    const handleSave = async () => {
        if (!title.trim() || !link.trim()) {
            showMainMessage('Title and Link cannot be empty.', 'error');
            return;
        }

        const url = bugToEdit
            ? `/api/archives/sat-bugs/${bugToEdit.id}`
            : `/api/archives/${archiveId}/sat-bugs`;
        
        const method = bugToEdit ? 'PUT' : 'POST';

        try {
            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, link, estimation, estimation_unit: estimationUnit, label }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Failed to save SAT bug.');
            showMainMessage(result.message, 'success');
            onSave();
        } catch (error) {
            showMainMessage(error.message, 'error');
        }
    };

    return (
        <>
            <Modal isOpen={isOpen} onClose={onClose} title={bugToEdit ? 'Edit SAT Bug' : 'Add SAT Bug'}>
                <div className="form-group">
                    <label htmlFor="sat-bug-title">Title</label>
                    <input
                        type="text"
                        id="sat-bug-title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="e.g., UI glitch on login page"
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="sat-bug-link">Link</label>
                    <input
                        type="text"
                        id="sat-bug-link"
                        value={link}
                        onChange={(e) => setLink(e.target.value)}
                        placeholder="e.g., https://jira.example.com/browse/PROJ-123"
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="sat-bug-label" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span>Label</span>
                        <button 
                            type="button" 
                            onClick={(e) => { e.preventDefault(); setIsDescriptionModalOpen(true); }}
                            className="info-button"
                            title="Show label descriptions"
                        >
                            ?
                        </button>
                    </label>
                    <CustomDropdown
                        id="sat-bug-label"
                        name="label"
                        options={BUG_LABELS}
                        value={label}
                        onChange={(e) => setLabel(e.target.value)}
                        placeholder="-- Select a label (optional) --"
                        isComboBox={true}
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="sat-bug-estimation">Estimation</label>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                        <input
                            type="number"
                            id="sat-bug-estimation"
                            value={estimation}
                            onChange={(e) => setEstimation(e.target.value)}
                            placeholder="e.g., 4"
                            style={{ marginRight: '10px' }}
                            min="0"
                        />
                        <select id="estimation-unit" name="estimation-unit" value={estimationUnit} onChange={(e) => setEstimationUnit(e.target.value)}>
                            <option value="h">hours</option>
                            <option value="d">days</option>
                        </select>
                    </div>
                </div>
                <div className="modal-actions">
                    <button type="button" onClick={onClose} className="modal-button-cancel">Cancel</button>
                    <button type="button" onClick={handleSave} className="modal-button-save">Save</button>
                </div>
            </Modal>
            <LabelDescriptionModal 
                isOpen={isDescriptionModalOpen}
                onClose={() => setIsDescriptionModalOpen(false)}
                labels={BUG_LABELS}
            />
        </>
    );
};

export default SatBugModal;
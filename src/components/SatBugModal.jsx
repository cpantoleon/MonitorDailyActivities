import React, { useState, useEffect } from 'react';
import Modal from './ReleaseModal';

const SatBugModal = ({ isOpen, onClose, onSave, archiveId, bugToEdit, showMainMessage }) => {
    const [title, setTitle] = useState('');
    const [link, setLink] = useState('');

    useEffect(() => {
        if (bugToEdit) {
            setTitle(bugToEdit.title);
            setLink(bugToEdit.link);
        } else {
            setTitle('');
            setLink('');
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
                body: JSON.stringify({ title, link }),
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
            <div className="modal-actions">
                <button type="button" onClick={onClose} className="modal-button-cancel">Cancel</button>
                <button type="button" onClick={handleSave} className="modal-button-save">Save</button>
            </div>
        </Modal>
    );
};

export default SatBugModal;
import React, { useState, useEffect } from 'react';
import Modal from './ReleaseModal';
import ToggleSwitch from './ToggleSwitch';

const SettingsModal = ({ isOpen, onClose, showMessage }) => {
    const [isDefaultExpanded, setIsDefaultExpanded] = useState(true);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            fetch('/api/settings/default-expanded')
                .then(res => res.json())
                .then(data => setIsDefaultExpanded(data.isExpanded))
                .catch(err => console.error(err));
        }
    }, [isOpen]);

    const handleSave = async () => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/settings/default-expanded', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isExpanded: isDefaultExpanded })
            });
            if (!res.ok) throw new Error("Failed to save settings");
            showMessage("Settings saved successfully!", "success");
            onClose();
        } catch (error) {
            showMessage(error.message, "error");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="App Settings">
            <div className="form-group" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0' }}>
                <div>
                    <label style={{ margin: 0, fontSize: '1.1em', color: 'var(--text-primary)' }}>Default Card View</label>
                    <p style={{ margin: '5px 0 0 0', fontSize: '0.85em', color: 'var(--text-secondary)' }}>
                        Choose how new requirements will appear on the Sprint Board.
                    </p>
                </div>
                <ToggleSwitch
                    id="default-card-view-toggle"
                    checked={isDefaultExpanded}
                    onChange={(e) => setIsDefaultExpanded(e.target.checked)}
                    option1="Expanded"
                    option2="Collapsed"
                />
            </div>
            <div className="modal-actions">
                <button onClick={onClose} className="modal-button-cancel">Cancel</button>
                <button onClick={handleSave} className="modal-button-save" disabled={isLoading}>Save Settings</button>
            </div>
        </Modal>
    );
};

export default SettingsModal;
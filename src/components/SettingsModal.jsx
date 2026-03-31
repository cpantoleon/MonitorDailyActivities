// src/components/SettingsModal.jsx
import React, { useState, useEffect } from 'react';
import Modal from './ReleaseModal';
import ToggleSwitch from './ToggleSwitch';
import { useGlobal } from '../context/GlobalContext';

const LayoutIcon = ({ type, isActive }) => {
  const color = isActive ? 'var(--accent-color)' : 'var(--text-secondary)';
  
  if (type === 'layout-dense') {
    return (
      <svg width="40" height="30" viewBox="0 0 40 30" fill="none">
        <rect x="2" y="2" width="20" height="12" rx="2" stroke={color} strokeWidth="1.5" />
        <rect x="2" y="16" width="20" height="12" rx="2" stroke={color} strokeWidth="1.5" />
        <rect x="24" y="2" width="14" height="26" rx="2" stroke={color} strokeWidth="1.5" />
      </svg>
    );
  }
  if (type === 'layout-grid-2') {
    return (
      <svg width="40" height="30" viewBox="0 0 40 30" fill="none">
        <rect x="2" y="2" width="16" height="12" rx="2" stroke={color} strokeWidth="1.5" />
        <rect x="22" y="2" width="16" height="12" rx="2" stroke={color} strokeWidth="1.5" />
        <rect x="2" y="16" width="16" height="12" rx="2" stroke={color} strokeWidth="1.5" />
        <rect x="22" y="16" width="16" height="12" rx="2" stroke={color} strokeWidth="1.5" />
      </svg>
    );
  }
  if (type === 'layout-grid-3') {
    return (
      <svg width="40" height="30" viewBox="0 0 40 30" fill="none">
        <rect x="1" y="2" width="11" height="12" rx="2" stroke={color} strokeWidth="1.5" />
        <rect x="14" y="2" width="12" height="12" rx="2" stroke={color} strokeWidth="1.5" />
        <rect x="28" y="2" width="11" height="12" rx="2" stroke={color} strokeWidth="1.5" />
        <rect x="1" y="16" width="11" height="12" rx="2" stroke={color} strokeWidth="1.5" />
        <rect x="14" y="16" width="12" height="12" rx="2" stroke={color} strokeWidth="1.5" />
        <rect x="28" y="16" width="11" height="12" rx="2" stroke={color} strokeWidth="1.5" />
      </svg>
    );
  }
  if (type === 'layout-top-full-bottom-3') {
    return (
      <svg width="40" height="30" viewBox="0 0 40 30" fill="none">
        <rect x="2" y="2" width="36" height="10" rx="2" stroke={color} strokeWidth="1.5" />
        <rect x="2" y="15" width="10" height="13" rx="2" stroke={color} strokeWidth="1.5" />
        <rect x="15" y="15" width="10" height="13" rx="2" stroke={color} strokeWidth="1.5" />
        <rect x="28" y="15" width="10" height="13" rx="2" stroke={color} strokeWidth="1.5" />
      </svg>
    );
  }
  return null;
};

const SettingsModal = ({ isOpen, onClose, showMessage }) => {
    const { dashboardGridStyle, setDashboardGridStyle } = useGlobal();
    const [isDefaultExpanded, setIsDefaultExpanded] = useState(true);
    const [localGridStyle, setLocalGridStyle] = useState(dashboardGridStyle);
    const [isLoading, setIsLoading] = useState(false);

    const layoutOptions = [
      { id: 'layout-dense', name: 'Smart Layout' },
      { id: 'layout-grid-2', name: 'Grid 2x2' },
      { id: 'layout-grid-3', name: 'Grid 3x3' },
      { id: 'layout-top-full-bottom-3', name: 'Top Row + 3 Cols' }
    ];

    useEffect(() => {
        if (isOpen) {
            setLocalGridStyle(dashboardGridStyle);
            fetch('/api/settings/default-expanded')
                .then(res => res.json())
                .then(data => setIsDefaultExpanded(data.isExpanded))
                .catch(err => console.error(err));
        }
    }, [isOpen, dashboardGridStyle]);

    const handleSave = async () => {
        setIsLoading(true);
        try {
            setDashboardGridStyle(localGridStyle);
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
            <style>{`
                .layout-selector-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
                    gap: 15px;
                    margin-top: 15px;
                }
                .layout-option-card {
                    border: 2px solid var(--border-color);
                    border-radius: 8px;
                    padding: 15px 10px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 10px;
                    cursor: pointer;
                    background-color: var(--bg-primary);
                    transition: all 0.2s ease;
                }
                .layout-option-card:hover {
                    border-color: var(--text-secondary);
                    background-color: var(--bg-tertiary);
                }
                .layout-option-card.active {
                    border-color: var(--accent-color);
                    background-color: var(--bg-tertiary);
                }
                .layout-option-name {
                    font-size: 0.85em;
                    color: var(--text-primary);
                    font-weight: 500;
                    text-align: center;
                }
                .layout-option-card.active .layout-option-name {
                    color: var(--accent-color);
                    font-weight: 700;
                }
                .settings-section-divider {
                    height: 1px;
                    background-color: var(--border-color);
                    margin: 25px 0;
                }
            `}</style>

            <div className="form-group" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0' }}>
                <div>
                    <label style={{ margin: 0, fontSize: '1.1em', color: 'var(--text-primary)' }}>Default Card View</label>
                    <p style={{ margin: '5px 0 0 0', fontSize: '0.85em', color: 'var(--text-secondary)' }}>
                        Choose how new cards (Requirements & Defects) will appear by default on their respective boards.
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

            <div className="settings-section-divider"></div>

            <div className="form-group">
                <label style={{ margin: 0, fontSize: '1.1em', color: 'var(--text-primary)' }}>Dashboard Layout</label>
                <p style={{ margin: '5px 0 0 0', fontSize: '0.85em', color: 'var(--text-secondary)' }}>
                    Select the grid structure for your Global Overview dashboard.
                </p>
                <div className="layout-selector-grid">
                    {layoutOptions.map(layout => (
                        <div 
                            key={layout.id}
                            className={`layout-option-card ${localGridStyle === layout.id ? 'active' : ''}`}
                            onClick={() => setLocalGridStyle(layout.id)}
                        >
                            <LayoutIcon type={layout.id} isActive={localGridStyle === layout.id} />
                            <span className="layout-option-name">{layout.name}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="modal-actions">
                <button onClick={onClose} className="modal-button-cancel">Cancel</button>
                <button onClick={handleSave} className="modal-button-save" disabled={isLoading}>Save Settings</button>
            </div>
        </Modal>
    );
};

export default SettingsModal;
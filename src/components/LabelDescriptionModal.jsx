import React from 'react';
import Modal from './ReleaseModal';
import './LabelDescriptionModal.css';

const LabelDescriptionModal = ({ isOpen, onClose, labels }) => {
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Label Descriptions">
            <div className="label-descriptions-container">
                <table className="label-descriptions-table">
                    <thead>
                        <tr>
                            <th>Label</th>
                            <th>Description</th>
                        </tr>
                    </thead>
                    <tbody>
                        {labels.map(labelInfo => (
                            <tr key={labelInfo.value}>
                                <td>{labelInfo.label}</td>
                                <td>{labelInfo.description}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="modal-actions">
                <button type="button" onClick={onClose} className="modal-button-cancel">Close</button>
            </div>
        </Modal>
    );
};

export default LabelDescriptionModal;

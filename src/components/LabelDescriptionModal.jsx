import React from 'react';
import Modal from './ReleaseModal';
import './LabelDescriptionModal.css';

const LabelDescriptionModal = ({ isOpen, onClose, labels }) => {
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Label Descriptions">
            <div id="label-descriptions-container-id" className="label-descriptions-container">
                <table id="label-descriptions-table-id" className="label-descriptions-table">
                    <thead>
                        <tr>
                            <th>Label</th>
                            <th>Description</th>
                        </tr>
                    </thead>
                    <tbody>
                        {labels.map(labelInfo => (
                            <tr key={labelInfo.value} id={`label-row-${labelInfo.value.replace(/\s+/g, '-')}-id`}>
                                <td id={`label-cell-${labelInfo.value.replace(/\s+/g, '-')}-id`}>{labelInfo.label}</td>
                                <td id={`description-cell-${labelInfo.value.replace(/\s+/g, '-')}-id`}>{labelInfo.description}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div id="modal-actions-label-description-id" className="modal-actions">
                <button id="close-label-description-modal-button-id" type="button" onClick={onClose} className="modal-button-cancel">Close</button>
            </div>
        </Modal>
    );
};

export default LabelDescriptionModal;
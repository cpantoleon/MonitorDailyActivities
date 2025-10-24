import React, { useState, useEffect, useCallback } from 'react';
import ProjectSelector from '../components/ProjectSelector';
import RetrospectiveColumn from '../components/RetrospectiveColumn';
import RetrospectiveItemModal from '../components/RetrospectiveItemModal';
import ConfirmationModal from '../components/ConfirmationModal';
import './SprintAnalysisPage.css';
const API_BASE_URL = '/api';

const COLUMN_TYPES = [
  { value: 'well', label: 'What Went Well?' },
  { value: 'wrong', label: 'What Went Wrong?' },
  { value: 'improve', label: 'What Can We Improve?' },
];

const SprintAnalysisPage = ({ projects, showMessage }) => {
  const [selectedProject, setSelectedProject] = useState('');
  const [retrospectiveItems, setRetrospectiveItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  const [isConfirmDeleteModalOpen, setIsConfirmDeleteModalOpen] = useState(false);
  const [itemToDeleteId, setItemToDeleteId] = useState(null);
  const [isConfirmDeleteAllModalOpen, setIsConfirmDeleteAllModalOpen] = useState(false);


  useEffect(() => {
    const savedProject = sessionStorage.getItem('sprintAnalysisPageSelectedProject');
    if (savedProject) {
        setSelectedProject(savedProject);
    }
  }, []);

  useEffect(() => {
      if (selectedProject) {
          sessionStorage.setItem('sprintAnalysisPageSelectedProject', selectedProject);
      } else {
          sessionStorage.removeItem('sprintAnalysisPageSelectedProject');
      }
  }, [selectedProject]);

  const fetchRetrospectiveItems = useCallback(async (project) => {
    if (!project) {
      setRetrospectiveItems([]);
      return;
    }
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/retrospective/${project}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch retrospective items for ${project}`);
      }
      const result = await response.json();
      setRetrospectiveItems(result.data || []);
    } catch (error) {
      console.error("Error fetching retrospective items:", error);
      if (showMessage) showMessage(`Error: ${error.message}`, 'error');
      setRetrospectiveItems([]);
    } finally {
      setIsLoading(false);
    }
  }, [showMessage]);

  useEffect(() => {
    fetchRetrospectiveItems(selectedProject);
  }, [selectedProject, fetchRetrospectiveItems]);

  const handleOpenModal = (item = null) => {
    setEditingItem(item);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingItem(null);
  };

  const handleSubmitItem = async (formData) => {
    if (!selectedProject) {
      if (showMessage) showMessage("Please select a project first.", "error");
      return;
    }

    const payload = { ...formData, project: selectedProject };
    const url = editingItem
      ? `${API_BASE_URL}/retrospective/${editingItem.id}`
      : `${API_BASE_URL}/retrospective`;
    const method = editingItem ? 'PUT' : 'POST';

    try {
      const response = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || `Failed to ${editingItem ? 'update' : 'add'} item`);
      }
      if (showMessage) showMessage(`Retrospective item ${editingItem ? 'updated' : 'added'} successfully!`, 'success');
      fetchRetrospectiveItems(selectedProject);
      handleCloseModal();
    } catch (error) {
      console.error(`Error ${editingItem ? 'updating' : 'adding'} item:`, error);
      if (showMessage) showMessage(`Error: ${error.message}`, 'error');
    }
  };

  const handleDeleteRequest = (itemId) => {
    setItemToDeleteId(itemId);
    setIsConfirmDeleteModalOpen(true);
  };

  const confirmDeleteItem = async () => {
    if (!itemToDeleteId) return;
    try {
      const response = await fetch(`${API_BASE_URL}/retrospective/${itemToDeleteId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Failed to delete item');
      }
      if (showMessage) showMessage('Retrospective item deleted successfully!', 'success');
      fetchRetrospectiveItems(selectedProject);
    } catch (error) {
      console.error("Error deleting item:", error);
      if (showMessage) showMessage(`Error: ${error.message}`, 'error');
    } finally {
      setIsConfirmDeleteModalOpen(false);
      setItemToDeleteId(null);
    }
  };

  const confirmDeleteAllItems = async () => {
    if (!selectedProject) return;
    try {
      const response = await fetch(`${API_BASE_URL}/retrospective/project/${selectedProject}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Failed to delete all items');
      }
      if (showMessage) showMessage('All retrospective items deleted successfully!', 'success');
      fetchRetrospectiveItems(selectedProject);
    } catch (error) {
      console.error("Error deleting all items:", error);
      if (showMessage) showMessage(`Error: ${error.message}`, 'error');
    } finally {
      setIsConfirmDeleteAllModalOpen(false);
    }
  };

  const handleDragStart = (e, item) => {
    e.dataTransfer.setData("retroItemId", item.id);
  };

  const handleDrop = async (e, targetColumnType) => {
    const retroItemId = e.dataTransfer.getData("retroItemId");
    const draggedItem = retrospectiveItems.find(item => item.id.toString() === retroItemId);

    if (draggedItem && draggedItem.column_type !== targetColumnType) {
      const payload = { column_type: targetColumnType };
      try {
        const response = await fetch(`${API_BASE_URL}/retrospective/${draggedItem.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
          throw new Error('Failed to update column');
        }
        showMessage('Item moved successfully!', 'success');
        fetchRetrospectiveItems(selectedProject);
      } catch (error) {
        showMessage(`Error moving item: ${error.message}`, 'error');
      }
    }
  };

  const getItemsForColumn = (columnType) => {
    return retrospectiveItems.filter(item => item.column_type === columnType);
  };

  return (
    <div id="main-content-area-id" className="main-content-area">
      <div id="retrospective-controls-id" className="retrospective-controls">
        <div id="selection-group-container-id" className="selection-group-container">
          <ProjectSelector
            projects={projects || []}
            selectedProject={selectedProject}
            onSelectProject={setSelectedProject}
          />
        </div>
        <div id="page-actions-group-id" className="page-actions-group">
          <button
            id="add-retro-item-button-id"
            onClick={() => handleOpenModal()}
            className="add-retro-item-button"
            disabled={!selectedProject}
          >
            + Add Retrospective Item
          </button>
          <button
            id="delete-all-retro-items-button-id"
            onClick={() => setIsConfirmDeleteAllModalOpen(true)}
            className="delete-all-retro-items-button"
            disabled={!selectedProject || retrospectiveItems.length === 0}
          >
            Delete All
          </button>
        </div>
      </div>

      {isLoading && <p id="loading-message-retro-id" className="loading-message-retro">Loading items...</p>}
      {!isLoading && !selectedProject && <p id="select-project-prompt-retro-id" className="select-project-prompt-retro">Please select a project to view retrospective items.</p>}

      {!isLoading && selectedProject && (
        <div id="retrospective-board-id" className="retrospective-board">
          {COLUMN_TYPES.map(column => (
            <RetrospectiveColumn
              key={column.value}
              title={column.label}
              columnType={column.value}
              items={getItemsForColumn(column.value)}
              onEditItem={handleOpenModal}
              onDeleteItem={handleDeleteRequest}
              onDragStart={handleDragStart}
              onDrop={handleDrop}
            />
          ))}
        </div>
      )}

      <RetrospectiveItemModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSubmit={handleSubmitItem}
        item={editingItem}
        columnTypes={COLUMN_TYPES}
      />
      <ConfirmationModal
        isOpen={isConfirmDeleteModalOpen}
        onClose={() => setIsConfirmDeleteModalOpen(false)}
        onConfirm={confirmDeleteItem}
        title="Confirm Deletion"
        message="Are you sure you want to delete this retrospective item?"
      />
      <ConfirmationModal
        isOpen={isConfirmDeleteAllModalOpen}
        onClose={() => setIsConfirmDeleteAllModalOpen(false)}
        onConfirm={confirmDeleteAllItems}
        title="Confirm Delete All"
        message={`Are you sure you want to delete all items for project '${selectedProject}'? This action cannot be undone.`}
      />

    </div>
  );
};

export default SprintAnalysisPage;
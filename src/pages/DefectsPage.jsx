import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import ProjectSelector from '../components/ProjectSelector';
import DefectColumn from '../components/DefectColumn';
import DefectModal from '../components/DefectModal';
import ConfirmationModal from '../components/ConfirmationModal';
import DefectHistoryModal from '../components/DefectHistoryModal';
import SearchComponent from '../components/SearchComponent';
import UpdateStatusModal from '../components/UpdateStatusModal';
import ImportDefectsModal from '../components/ImportDefectsModal';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, Title, BarElement, CategoryScale, LinearScale } from 'chart.js';
import { Pie, Bar } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend, Title, BarElement, CategoryScale, LinearScale);

const API_BASE_URL = '/api';
const DEFECT_STATUS_COLUMNS = [
  { title: 'Assigned to Developer', status: 'Assigned to Developer' },
  { title: 'Assigned to Tester', status: 'Assigned to Tester' },
  { title: 'Done', status: 'Done' },
];

const DefectOptionsMenu = ({ onOpenAddModal, onOpenImportModal }) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleAddClick = () => {
    onOpenAddModal();
    setIsOpen(false);
  };
  
  const handleImportClick = () => {
    onOpenImportModal();
    setIsOpen(false);
  };

  return (
    <div className="options-menu-container" ref={menuRef}>
      <button onClick={() => setIsOpen(!isOpen)} className="options-menu-button" title="More options">
        ⋮
      </button>
      {isOpen && (
        <div className="options-menu-dropdown">
          <button onClick={handleAddClick} className="options-menu-item">
            + Add Defect
          </button>
          <button onClick={handleImportClick} className="options-menu-item">
            + Import Defects
          </button>
        </div>
      )}
    </div>
  );
};

const DefectsPage = ({ projects, allRequirements, showMessage, onDefectUpdate, selectedProject, onSelectProject }) => {
  const [allDefects, setAllDefects] = useState([]);
  const [activeDefects, setActiveDefects] = useState([]);
  const [closedDefects, setClosedDefects] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDefect, setEditingDefect] = useState(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [defectForHistory, setDefectForHistory] = useState(null);
  const [defectHistory, setDefectHistory] = useState([]);
  const [isDeleteConfirmModalOpen, setIsDeleteConfirmModalOpen] = useState(false);
  const [defectToDelete, setDefectToDelete] = useState(null);
  const [showAreaChart, setShowAreaChart] = useState(false);
  const [areaChartData, setAreaChartData] = useState(null);
  const [returnToDevChartData, setReturnToDevChartData] = useState(null);
  const [showClosedView, setShowClosedView] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [defectQuery, setDefectQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchSuggestions, setSearchSuggestions] = useState([]);
  const [isUpdateStatusModalOpen, setIsUpdateStatusModalOpen] = useState(false);
  const [statusUpdateInfo, setStatusUpdateInfo] = useState({ defect: null, newStatus: '' });

  const [isImportDefectsModalOpen, setIsImportDefectsModalOpen] = useState(false);
  const [isImportConfirmModalOpen, setIsImportConfirmModalOpen] = useState(false);
  const [importConfirmData, setImportConfirmData] = useState(null);

  const navigate = useNavigate();
  const location = useLocation();
  const hasFetched = useRef(false);

  const fetchAllDefects = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/defects/all`);
      if (!response.ok) throw new Error('Failed to fetch all defects');
      const result = await response.json();
      const defectData = result.data || [];
      setAllDefects(defectData);
      return defectData;
    } catch (error) {
      showMessage(`Error loading defect list: ${error.message}`, 'error');
      setAllDefects([]);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [showMessage]);

  useEffect(() => {
    if (!hasFetched.current) {
      fetchAllDefects();
      hasFetched.current = true;
    }
  }, [fetchAllDefects]);

  useEffect(() => {
    if (selectedProject) {
      const projectDefects = allDefects.filter(d => d.project === selectedProject);
      const currentClosedDefects = projectDefects.filter(d => d.status === 'Closed');
      setActiveDefects(projectDefects.filter(d => d.status !== 'Closed'));
      setClosedDefects(currentClosedDefects);

      if (showClosedView && currentClosedDefects.length === 0) {
        setShowClosedView(false);
      }
    } else {
      setActiveDefects([]);
      setClosedDefects([]);
    }
  }, [allDefects, selectedProject, showClosedView]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const projectParam = params.get('project');
    if (projectParam && projects.includes(projectParam)) {
        onSelectProject(projectParam);
        navigate('/defects', { replace: true });
    }
  }, [location.search, navigate, projects, onSelectProject]);

  const updateChartData = useCallback(async () => {
    if (!selectedProject) {
      setAreaChartData(null);
      setReturnToDevChartData(null);
      return;
    }

    const defectsForChart = showClosedView ? closedDefects : activeDefects;

    const defectsForAreaChart = defectsForChart.filter(
      defect => defect.area !== 'Imported'
    );

    if (defectsForAreaChart.length > 0) {
      const areaCounts = defectsForAreaChart.reduce((acc, defect) => {
        acc[defect.area] = (acc[defect.area] || 0) + 1;
        return acc;
      }, {});
      setAreaChartData({
        labels: Object.keys(areaCounts),
        datasets: [{
          label: '# of Defects', data: Object.values(areaCounts),
          backgroundColor: ['rgba(255, 99, 132, 0.7)','rgba(54, 162, 235, 0.7)','rgba(255, 206, 86, 0.7)','rgba(75, 192, 192, 0.7)','rgba(153, 102, 255, 0.7)','rgba(255, 159, 64, 0.7)','rgba(199, 199, 199, 0.7)','rgba(83, 102, 255, 0.7)','rgba(102, 255, 83, 0.7)','rgba(255, 83, 102, 0.7)'],
          borderColor: ['rgba(255,99,132,1)','rgba(54,162,235,1)','rgba(255,206,86,1)','rgba(75,192,192,1)','rgba(153,102,255,1)','rgba(255,159,64,1)','rgba(199,199,199,1)','rgba(83,102,255,1)','rgba(102,255,83,1)','rgba(255,83,102,1)'],
          borderWidth: 1,
        }],
      });
    } else {
      setAreaChartData(null);
    }

    if (selectedProject) {
      try {
        const statusType = showClosedView ? 'closed' : 'active';
        const response = await fetch(`${API_BASE_URL}/defects/${selectedProject}/return-counts?statusType=${statusType}`);
        if (!response.ok) throw new Error('Failed to fetch return to developer counts');
        const result = await response.json();
        if (result.data && result.data.length > 0) {
          const filteredData = result.data.filter(d => d.return_count >= 2);
          if (filteredData.length > 0) {
            setReturnToDevChartData({
              labels: filteredData.map(d => d.title),
              datasets: [{
                label: 'Times Returned to Developer',
                data: filteredData.map(d => d.return_count),
                backgroundColor: 'rgba(255, 159, 64, 0.7)',
                borderColor: 'rgba(255, 159, 64, 1)',
                borderWidth: 1,
              }]
            });
          } else {
            setReturnToDevChartData(null);
          }
        } else {
          setReturnToDevChartData(null);
        }
      } catch (error) {
        showMessage(`Could not load return counts chart: ${error.message}`, 'error');
        setReturnToDevChartData(null);
      }
    } else {
      setReturnToDevChartData(null);
    }
  }, [selectedProject, showClosedView, activeDefects, closedDefects, showMessage]);

  useEffect(() => {
    if (showAreaChart) {
      updateChartData();
    }
  }, [showAreaChart, updateChartData]);

  const handleToggleCharts = () => {
    setShowAreaChart(prev => !prev);
  };

  const handleOpenModal = (defect = null) => {
    setEditingDefect(defect); setIsModalOpen(true);
  };
  const handleCloseModal = () => {
    setIsModalOpen(false); setEditingDefect(null);
  };

  const handleSubmitDefect = async (formData) => {
    const projectForSubmit = formData.project || selectedProject;
    if (!projectForSubmit) {
        showMessage("Please select a project.", "error"); return;
    }
    const payload = { ...formData, project: projectForSubmit };
    const isEditing = !!editingDefect;
    const url = isEditing ? `${API_BASE_URL}/defects/${editingDefect.id}` : `${API_BASE_URL}/defects`;
    const method = isEditing ? 'PUT' : 'POST';
    
    try {
      const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || `Failed to ${isEditing ? 'update' : 'create'} defect`);
      
      showMessage(`Defect ${isEditing ? 'updated' : 'created'} successfully!`, 'success');
      await fetchAllDefects();
      if (onDefectUpdate) onDefectUpdate();
      handleCloseModal();
    } catch (error) {
      showMessage(`Error: ${error.message}`, 'error');
    }
  };

  const handleDeleteRequest = (defect) => {
    setDefectToDelete(defect); setIsDeleteConfirmModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!defectToDelete) return;
    try {
      const response = await fetch(`${API_BASE_URL}/defects/${defectToDelete.id}`, { method: 'DELETE' });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Failed to delete defect');
      }
      showMessage('Defect deleted successfully!', 'success');
      
      const freshDefects = await fetchAllDefects();
      
      if (isSearching) {
        const lowerCaseQuery = defectQuery.toLowerCase();
        const sourceData = freshDefects.filter(defect => showClosedView ? defect.status === 'Closed' : defect.status !== 'Closed');
        const newSearchResults = sourceData.filter(defect => defect.title.toLowerCase().includes(lowerCaseQuery));
        setSearchResults(newSearchResults);
      }

      if (onDefectUpdate) onDefectUpdate();
    } catch (error) {
      showMessage(`Error: ${error.message}`, 'error');
    } finally {
      setIsDeleteConfirmModalOpen(false);
      setDefectToDelete(null);
    }
  };

  const handleShowHistory = async (defect) => {
    setDefectForHistory(defect); setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/defects/${defect.id}/history`);
      if (!response.ok) throw new Error("Failed to fetch defect history.");
      const result = await response.json();
      setDefectHistory(result.data || []);
      setIsHistoryModalOpen(true);
    } catch (error) { showMessage(`Error: ${error.message}`, 'error'); }
    finally { setIsLoading(false); }
  };

  const handleNavigateToRequirement = useCallback((project, sprint) => {
    navigate(`/?project=${encodeURIComponent(project)}&sprint=${encodeURIComponent(sprint)}`);
  }, [navigate]);

  const handleOpenImportModal = useCallback(() => setIsImportDefectsModalOpen(true), []);
  const handleCloseImportModal = useCallback(() => {
    setIsImportDefectsModalOpen(false);
    setImportConfirmData(null);
  }, []);

  const executeDefectImport = useCallback(async (file, project, importMode = 'all') => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('project', project);
    formData.append('importMode', importMode);
    try {
        const response = await fetch(`${API_BASE_URL}/import/defects`, { method: 'POST', body: formData });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Failed to import defects.');
        showMessage(result.message, 'success');
        await fetchAllDefects();
        if (onDefectUpdate) onDefectUpdate();
        onSelectProject(project);
    } catch (error) {
        showMessage(`Import Error: ${error.message}`, 'error');
    } finally {
        handleCloseImportModal();
    }
  }, [fetchAllDefects, showMessage, handleCloseImportModal, onDefectUpdate, onSelectProject]);

  const handleValidateDefectImport = useCallback(async (file, project) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('project', project);
    try {
        const response = await fetch(`${API_BASE_URL}/import/defects/validate`, { method: 'POST', body: formData });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Validation failed');
        
        const { newCount, duplicateCount, skippedCount } = result.data;
        if (newCount === 0 && duplicateCount === 0) {
            let message = "Import finished. No valid defects found to import.";
            if (skippedCount > 0) message += ` Skipped items: ${skippedCount}.`;
            showMessage(message, 'info');
            handleCloseImportModal();
            return;
        }

        if (duplicateCount > 0) {
            setImportConfirmData({ file, project, ...result.data });
            setIsImportConfirmModalOpen(true);
        } else {
            executeDefectImport(file, project);
        }
    } catch (error) {
        showMessage(`Validation Error: ${error.message}`, 'error');
        handleCloseImportModal();
    }
  }, [executeDefectImport, showMessage, handleCloseImportModal]);

  const handleConfirmImportAll = () => {
    if (!importConfirmData) return;
    const { file, project } = importConfirmData;
    executeDefectImport(file, project, 'all');
    setIsImportConfirmModalOpen(false);
    setImportConfirmData(null);
  };

  const handleConfirmImportNewOnly = () => {
    if (!importConfirmData) return;
    const { file, project } = importConfirmData;
    executeDefectImport(file, project, 'new_only');
    setIsImportConfirmModalOpen(false);
    setImportConfirmData(null);
  };

  const handleDefectSearch = (query) => {
    const finalQuery = query || defectQuery;
    if (!finalQuery) {
      handleClearDefectSearch(); return;
    }
    setIsSearching(true);
    setSearchSuggestions([]);
    const lowerCaseQuery = finalQuery.toLowerCase();
    const sourceData = allDefects.filter(defect => showClosedView ? defect.status === 'Closed' : defect.status !== 'Closed');
    const results = sourceData.filter(defect => defect.title.toLowerCase().includes(lowerCaseQuery));
    setSearchResults(results);
    if (results.length > 0) {
      const uniqueProjects = [...new Set(results.map(d => d.project))];
      onSelectProject(uniqueProjects.length === 1 ? uniqueProjects[0] : '');
    } else {
      onSelectProject('');
    }
  };

  const handleClearDefectSearch = () => {
    setIsSearching(false);
    setDefectQuery('');
    setSearchResults([]);
    setSearchSuggestions([]);
    onSelectProject('');
  };

  const handleDefectQueryChange = (query) => {
    setDefectQuery(query);
    if (query.length < 3) {
      setSearchSuggestions([]); return;
    }
    const lowerCaseQuery = query.toLowerCase();
    let sourceData = allDefects;
    if (selectedProject) {
      sourceData = sourceData.filter(defect => defect.project === selectedProject);
    }
    sourceData = sourceData.filter(defect => showClosedView ? defect.status === 'Closed' : defect.status !== 'Closed');
    const suggestions = sourceData
      .filter(defect => defect.title.toLowerCase().includes(lowerCaseQuery))
      .map(defect => ({ id: defect.id, name: defect.title, context: defect.project }))
      .slice(0, 10);
    setSearchSuggestions(suggestions);
  };

  const handleDefectSuggestionSelect = (suggestion) => {
    setDefectQuery(suggestion.name);
    setSearchSuggestions([]);
    const selectedDefect = allDefects.find(d => d.id === suggestion.id);
    if (selectedDefect) {
      setSearchResults([selectedDefect]);
      onSelectProject(selectedDefect.project);
      setIsSearching(true);
    } else {
      handleDefectSearch(suggestion.name);
    }
  };

  const handleStatusUpdateRequest = (defect, newStatus) => {
    setStatusUpdateInfo({ defect, newStatus });
    setIsUpdateStatusModalOpen(true);
  };

  const handleCloseUpdateStatusModal = () => {
    setIsUpdateStatusModalOpen(false);
    setStatusUpdateInfo({ defect: null, newStatus: '' });
  };

  const handleConfirmDefectStatusUpdate = async (comment) => {
    const { defect, newStatus } = statusUpdateInfo;
    if (!defect) return;
    const payload = { ...defect, status: newStatus, comment };
    try {
      const response = await fetch(`${API_BASE_URL}/defects/${defect.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) throw new Error('Failed to update defect status.');
      showMessage('Defect status updated successfully!', 'success');
      await fetchAllDefects();
      if (onDefectUpdate) onDefectUpdate();
    } catch (error) {
      showMessage(`Error: ${error.message}`, 'error');
    } finally {
      handleCloseUpdateStatusModal();
    }
  };

  const handleDragStart = (e, defect) => {
    e.dataTransfer.setData("defectId", defect.id);
  };

  const handleDrop = (e, targetStatus) => {
    const defectId = e.dataTransfer.getData("defectId");
    const sourceData = isSearching ? searchResults : activeDefects;
    const draggedDefect = sourceData.find(d => d.id.toString() === defectId);
    if (draggedDefect && draggedDefect.status !== targetStatus) {
      handleStatusUpdateRequest(draggedDefect, targetStatus);
    }
  };

  const pieChartOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { position: 'right', labels: { boxWidth: 20, padding: 15 } },
      title: { display: true, text: `${showClosedView ? 'Closed' : 'Active'} Defect Distribution by Area for ${selectedProject || 'Project'}`, font: { size: 14 } },
      tooltip: { callbacks: { label: (c) => `${c.label}: ${c.parsed} (${((c.parsed / c.dataset.data.reduce((a, b) => a + b, 0)) * 100).toFixed(1)}%)` } }
    },
  };

  const returnToDevChartOptions = {
    indexAxis: 'y', responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: { display: true, text: `Defect "Back to Developer" Count for ${selectedProject || 'Project'}`, font: { size: 14 } }
    },
    scales: { x: { beginAtZero: true, ticks: { stepSize: 1 } } }
  };

  const renderBoard = (defectsToDisplay) => {
    if (showClosedView) {
      return (
        <div className="defects-board-container">
          <DefectColumn title="Closed" defects={defectsToDisplay} onEditDefect={handleOpenModal} onShowHistory={handleShowHistory} onDeleteRequest={handleDeleteRequest} onNavigate={handleNavigateToRequirement} />
        </div>
      );
    }
    return (
      <div className="defects-board-container">
        {DEFECT_STATUS_COLUMNS.map(column => (
          <DefectColumn key={column.status} title={column.title} defects={defectsToDisplay.filter(d => d.status === column.status)} onEditDefect={handleOpenModal} onShowHistory={handleShowHistory} onDeleteRequest={handleDeleteRequest} onNavigate={handleNavigateToRequirement} onDragStart={handleDragStart} onDrop={handleDrop} />
        ))}
      </div>
    );
  };

  const defectsForNormalView = showClosedView ? closedDefects : activeDefects;

  return (
    <div className="main-content-area">
       <style>{`
        .defect-charts-wrapper { display: flex; flex-direction: row; flex-wrap: wrap; justify-content: center; gap: 20px; margin-bottom: 20px; }
        .defect-charts-wrapper .defect-chart-container { flex: 1 1 45%; min-width: 400px; max-width: 600px; height: 320px; padding: 10px; border: 1px solid #ddd; border-radius: 8px; background-color: #fff; }
      `}</style>
      <h2>Defect Tracking</h2>
      <div className="selection-controls">
        <div className="selection-group-container">
            <ProjectSelector projects={projects || []} selectedProject={selectedProject} onSelectProject={onSelectProject} />
            <SearchComponent
              query={defectQuery}
              onQueryChange={handleDefectQueryChange}
              onSearch={handleDefectSearch}
              onClear={handleClearDefectSearch}
              onSuggestionSelect={handleDefectSuggestionSelect}
              suggestions={searchSuggestions}
              placeholder="Search defects by title..."
            />
        </div>
        <div className="page-actions-group">
            <button onClick={handleToggleCharts} className="defect-action-button" disabled={!selectedProject || defectsForNormalView.length === 0}>
                {showAreaChart ? 'Hide' : 'Show'} Charts
            </button>
            <button onClick={() => setShowClosedView(p => !p)} className="defect-action-button" disabled={isLoading || closedDefects.length === 0} style={{backgroundColor: '#E0D3B6', borderColor: '#C8BBA2'}}>
                {showClosedView ? 'Show Active Defects' : 'Show Closed Defects'}
            </button>
            <DefectOptionsMenu
                onOpenAddModal={() => handleOpenModal()}
                onOpenImportModal={handleOpenImportModal}
            />
        </div>
      </div>

      {isLoading && <p className="loading-message-defects">Loading defects...</p>}
      {!isLoading && !isSearching && !selectedProject && <p className="select-project-prompt-defects">Please select a project to view defects, or use the search bar for all projects.</p>}
      {showAreaChart && selectedProject && (
        <div className="defect-charts-wrapper">
          {areaChartData && <div className="defect-chart-container"><Pie data={areaChartData} options={pieChartOptions} /></div>}
          {returnToDevChartData && <div className="defect-chart-container"><Bar data={returnToDevChartData} options={returnToDevChartOptions} /></div>}
          {!areaChartData && !returnToDevChartData && !isLoading && <div className="defect-chart-container" style={{ flexBasis: '100%', height: 'auto' }}><p>No chart data available for the selected project.</p></div>}
        </div>
      )}

      {!isLoading && (isSearching ? (searchResults.length > 0 ? renderBoard(searchResults) : <div className="empty-column-message">No results found for your search.</div>) : (selectedProject ? renderBoard(defectsForNormalView) : null))}
      
      <UpdateStatusModal isOpen={isUpdateStatusModalOpen} onClose={handleCloseUpdateStatusModal} onSave={handleConfirmDefectStatusUpdate} requirement={statusUpdateInfo.defect ? { requirementUserIdentifier: statusUpdateInfo.defect.title } : null} newStatus={statusUpdateInfo.newStatus} />
      <DefectModal isOpen={isModalOpen} onClose={handleCloseModal} onSubmit={handleSubmitDefect} defect={editingDefect} projects={projects || []} currentSelectedProject={selectedProject} allRequirements={allRequirements} />
      {defectForHistory && <DefectHistoryModal isOpen={isHistoryModalOpen} onClose={() => { setIsHistoryModalOpen(false); setDefectForHistory(null); setDefectHistory([]);}} defect={defectForHistory} history={defectHistory} />}
      <ConfirmationModal isOpen={isDeleteConfirmModalOpen} onClose={() => setIsDeleteConfirmModalOpen(false)} onConfirm={handleConfirmDelete} title="Confirm Defect Deletion" message={`Are you sure you want to permanently delete the defect "${defectToDelete?.title}"? This action cannot be undone.`} />
      
      <ImportDefectsModal isOpen={isImportDefectsModalOpen} onClose={handleCloseImportModal} onImport={handleValidateDefectImport} projects={projects || []} currentProject={selectedProject} />
      
      {isImportConfirmModalOpen && importConfirmData && (
          <div className="confirmation-modal-overlay" onClick={() => setIsImportConfirmModalOpen(false)}>
              <div className="confirmation-modal-content" onClick={e => e.stopPropagation()}>
                  <h3>Confirm Defect Import</h3>
                  <p>
                      The file contains {importConfirmData.newCount} new defect(s) and {importConfirmData.duplicateCount} duplicate(s).
                      {importConfirmData.skippedCount > 0 && ` ${importConfirmData.skippedCount} row(s) were skipped due to invalid type.`}
                  </p>
                  <p>How would you like to proceed?</p>
                  <div className="modal-actions" style={{ justifyContent: 'center', gap: '12px' }}>
                      <button onClick={handleConfirmImportAll} className="modal-button-confirm" style={{ backgroundColor: '#c0392b' }}>
                          Import All
                      </button>
                      {importConfirmData.newCount > 0 && (
                          <button onClick={handleConfirmImportNewOnly} className="modal-button-confirm" style={{ backgroundColor: '#A0522D' }}>
                              Import New Only
                          </button>
                      )}
                      <button onClick={() => { setIsImportConfirmModalOpen(false); setImportConfirmData(null); }} className="modal-button-cancel">
                          Cancel
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default DefectsPage;
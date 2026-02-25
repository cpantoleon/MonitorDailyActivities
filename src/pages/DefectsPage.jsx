import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import ProjectSelector from '../components/ProjectSelector';
import DefectColumn from '../components/DefectColumn';
import DefectModal from '../components/DefectModal';
import ConfirmationModal from '../components/ConfirmationModal';
import DefectHistoryModal from '../components/DefectHistoryModal';
import SearchComponent from '../components/SearchComponent';
import UpdateStatusModal from '../components/UpdateStatusModal';
import ImportDefectsModal from '../components/ImportDefectsModal';
import JiraImportModal from '../components/JiraImportModal';
import Tooltip from '../components/Tooltip';
import FilterSidebar from '../components/FilterSidebar';
import { Chart as ChartJS, ArcElement, Tooltip as ChartTooltip, Legend, Title, BarElement, CategoryScale, LinearScale } from 'chart.js';
import { Pie, Bar } from 'react-chartjs-2';

ChartJS.register(ArcElement, ChartTooltip, Legend, Title, BarElement, CategoryScale, LinearScale);

const API_BASE_URL = '/api';
const DEFECT_STATUS_COLUMNS = [
  { title: 'Assigned to Developer', status: 'Assigned to Developer' },
  { title: 'Assigned to Tester', status: 'Assigned to Tester' },
  { title: 'Done', status: 'Done' },
];

const DefectOptionsMenu = ({ onOpenAddModal, onOpenImportModal, onOpenJiraImportModal }) => {
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

  const handleJiraImportClick = () => {
    onOpenJiraImportModal();
    setIsOpen(false);
  };

  return (
    <div id="defect-options-menu-container-id" className="options-menu-container" ref={menuRef}>
      <button onClick={() => setIsOpen(!isOpen)} className="options-menu-button" title="More options">
        ⋮
      </button>
      {isOpen && (
        <div id="defect-options-menu-dropdown-id" className="options-menu-dropdown">
          <button id="add-defect-menu-item-id" onClick={handleAddClick} className="options-menu-item">
            + Add Defect
          </button>
          <button id="import-defects-menu-item-id" onClick={handleImportClick} className="options-menu-item">
            + Import Defects
          </button>
          <button onClick={handleJiraImportClick} className="options-menu-item">
            + Import from Jira
          </button>
        </div>
      )}
    </div>
  );
};

const DefectsPage = ({ projects, allRequirements, showMessage, onDefectUpdate }) => {
  const [selectedProject, setSelectedProject] = useState('');
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
  const [doneNotDoneChartData, setDoneNotDoneChartData] = useState(null);
  const [showClosedView, setShowClosedView] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [defectQuery, setDefectQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchSuggestions, setSearchSuggestions] = useState([]);
  const [isUpdateStatusModalOpen, setIsUpdateStatusModalOpen] = useState(false);
  const [statusUpdateInfo, setStatusUpdateInfo] = useState({ defect: null, newStatus: '' });
  const [isImportDefectsModalOpen, setIsImportDefectsModalOpen] = useState(false);
  const [isJiraImportModalOpen, setIsJiraImportModalOpen] = useState(false);
  const [isImportConfirmModalOpen, setIsImportConfirmModalOpen] = useState(false);
  const [importConfirmData, setImportConfirmData] = useState(null);
  const [highlightedDefectId, setHighlightedDefectId] = useState(null);
  const [isMoveToClosedConfirmModalOpen, setIsMoveToClosedConfirmModalOpen] = useState(false);
  const [defectToMove, setDefectToMove] = useState(null);
  const [isChartTruncated, setIsChartTruncated] = useState(false);
  const [isFilterSidebarOpen, setIsFilterSidebarOpen] = useState(false);
  const [selectedReleases, setSelectedReleases] = useState([]);
  const [projectReleases, setProjectReleases] = useState([]);
  const [archivedReleases, setArchivedReleases] = useState([]);
  const [fatDefectFilter, setFatDefectFilter] = useState(null);
  const [filterOptions, setFilterOptions] = useState({
    enabledReleases: [],
    isFatDefectYesEnabled: false,
    isFatDefectNoEnabled: false,
  });

  const filterButtonRef = useRef(null);
  const sidebarWrapperRef = useRef(null);

  const navigate = useNavigate();
  const location = useLocation();
  const hasFetched = useRef(false);

  useEffect(() => {
    const chatbotContainer = document.getElementById('chatbot-container-id');
    if (chatbotContainer) {
      if (isFilterSidebarOpen) {
        chatbotContainer.classList.add('sidebar-open');
      } else {
        chatbotContainer.classList.remove('sidebar-open');
      }
    }
  }, [isFilterSidebarOpen]);

  useEffect(() => {
    const handleInteraction = (event) => {
      if (filterButtonRef.current && filterButtonRef.current.contains(event.target)) {
        setIsFilterSidebarOpen(prev => !prev);
        return;
      }
      if (
        isFilterSidebarOpen &&
        sidebarWrapperRef.current &&
        !sidebarWrapperRef.current.contains(event.target)
      ) {
        setIsFilterSidebarOpen(false);
      }
    };

    document.addEventListener('mousedown', handleInteraction);
    return () => {
      document.removeEventListener('mousedown', handleInteraction);
    };
  }, [isFilterSidebarOpen]);

  // Handle Manual Project Selection with URL Update
  const handleManualProjectSelect = useCallback((project) => {
      setSelectedProject(project);
      setIsSearching(false);
      setDefectQuery('');
      setSearchResults([]);
      setSearchSuggestions([]);
      setSelectedReleases([]);
      
      if (project) {
          navigate(`/defects?d_project=${encodeURIComponent(project)}${showClosedView ? '&view=closed' : ''}`, { replace: true });
      } else {
          navigate(`/defects${showClosedView ? '?view=closed' : ''}`, { replace: true });
      }
  }, [navigate, showClosedView]);
  useEffect(() => {
    if (selectedProject) {
      sessionStorage.setItem('defectsPageSelectedProject', selectedProject);
    }
  }, [selectedProject]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    
    // CHANGED: Read 'd_project' instead of 'project'
    let projectParam = params.get('d_project'); 
    const viewParam = params.get('view');
    const highlightId = params.get('highlight');
    let needsReplace = false;

    if (!projectParam) {
      const storedProject = sessionStorage.getItem('defectsPageSelectedProject');
      if (storedProject) {
        projectParam = storedProject;
        // CHANGED: Set 'd_project' instead of 'project'
        params.set('d_project', storedProject);
        needsReplace = true;
      }
    }

    if (projectParam && projectParam !== selectedProject) {
      setSelectedProject(projectParam);
    }
    
    if (viewParam === 'closed' && !showClosedView) {
        setShowClosedView(true);
    } else if (viewParam !== 'closed' && showClosedView) {
        setShowClosedView(false);
    }
    
    if (highlightId) {
      setHighlightedDefectId(highlightId);
      params.delete('highlight');
      needsReplace = true;
    }

    if (needsReplace) {
      const newSearch = params.toString() ? `?${params.toString()}` : '';
      navigate(`${location.pathname}${newSearch}`, { replace: true });
    }
  }, [location.search, navigate]);

  const defectChartTooltipContent = (
    <div id="defect-chart-tooltip-content-id">
      <strong>Defect Charts</strong>
      <p>These charts provide insights into the defects for the selected project.</p>
      <ul>
        <li><strong>Active Defect Status:</strong> A pie chart showing the proportion of active defects that are 'Done' versus 'Not Done'.</li>
        <li><strong>Distribution by Area:</strong> A pie chart showing the breakdown of defects based on their functional or system area.</li>
        <li><strong>"Back to Developer" Count:</strong> A bar chart highlighting defects that have been returned to the developer multiple times (2 or more), which can indicate complex issues or misunderstandings.</li>
      </ul>
    </div>
  );

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
  
  const fetchArchivedReleases = useCallback(async (project) => {
      if (!project) {
          setArchivedReleases([]);
          return;
      }
      try {
          const response = await fetch(`${API_BASE_URL}/archives/${project}`);
          if (!response.ok) throw new Error('Failed to fetch archived releases');
          const result = await response.json();
          setArchivedReleases(result.data || []);
      } catch (error) {
          showMessage(`Error loading archived releases: ${error.message}`, 'error');
          setArchivedReleases([]);
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
      fetchArchivedReleases(selectedProject);
      const projectDefects = allDefects.filter(d => d.project === selectedProject);
      const currentClosedDefects = projectDefects.filter(d => d.status === 'Closed');
      setActiveDefects(projectDefects.filter(d => d.status !== 'Closed'));
      setClosedDefects(currentClosedDefects);
    } else {
      setActiveDefects([]);
      setClosedDefects([]);
      setArchivedReleases([]);
    }
  }, [allDefects, selectedProject, fetchArchivedReleases]);

  useEffect(() => {
    if (highlightedDefectId && (activeDefects.length > 0 || closedDefects.length > 0)) {
      const timer = setTimeout(() => {
        const element = document.getElementById(`defect-card-${highlightedDefectId}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          element.classList.add('highlight-item');
          
          setTimeout(() => {
            element.classList.remove('highlight-item');
          }, 3000);
        }
        setHighlightedDefectId(null);
      }, 200);

      return () => clearTimeout(timer);
    }
  }, [highlightedDefectId, activeDefects, closedDefects, selectedProject]);

  const filteredDefects = useMemo(() => {
    let defectsToFilter = isSearching ? searchResults : (showClosedView ? closedDefects : activeDefects);

    if (fatDefectFilter) {
      defectsToFilter = defectsToFilter.filter(defect => {
        const isFat = defect.is_fat_defect === 1 || defect.is_fat_defect === true;
        if (fatDefectFilter === 'yes') return isFat;
        if (fatDefectFilter === 'no') return !isFat;
        return true;
      });
    }

    if (selectedReleases.length === 0) {
        return defectsToFilter;
    }

    const originalReleaseIdToArchiveIdMap = new Map(
        archivedReleases.map(ar => [ar.original_release_id, ar.id])
    );

    return defectsToFilter.filter(defect => {
        if (!defect.linkedRequirements || defect.linkedRequirements.length === 0) {
            return false;
        }
        
        const linkedReqsWithDetails = defect.linkedRequirements.map(lr => 
            allRequirements.find(ar => ar.id === lr.groupId)
        ).filter(Boolean);

        if (showClosedView) {
            return linkedReqsWithDetails.some(req => {
                const sprint = req.currentStatusDetails.sprint;
                if (sprint && sprint.startsWith('Archived_from_')) {
                    const releaseName = sprint.substring('Archived_from_'.length).replace(/_/g, ' ');
                    const matchingArchivedRelease = archivedReleases.find(ar => ar.name === releaseName);
                    if (matchingArchivedRelease && selectedReleases.includes(matchingArchivedRelease.id)) {
                        return true;
                    }
                } 
                
                if (req.currentStatusDetails.releaseId) {
                    const originalReleaseId = req.currentStatusDetails.releaseId;
                    const archiveId = originalReleaseIdToArchiveIdMap.get(originalReleaseId);
                    
                    if (archiveId && selectedReleases.includes(archiveId)) {
                        return true;
                    }
                    if (!archiveId && selectedReleases.includes(originalReleaseId)) {
                        return true;
                    }
                }
                return false;
            });
        } else {
            return linkedReqsWithDetails.some(req => 
                req.currentStatusDetails.releaseId && selectedReleases.includes(req.currentStatusDetails.releaseId)
            );
        }
    });
  }, [isSearching, searchResults, showClosedView, closedDefects, activeDefects, selectedReleases, allRequirements, archivedReleases, fatDefectFilter]);

  useEffect(() => {
    if (selectedProject) {
        const releases = allRequirements
            .filter(r => r.project === selectedProject && r.isActive && r.currentStatusDetails.releaseId && r.currentStatusDetails.releaseName)
            .map(r => ({
                id: r.currentStatusDetails.releaseId,
                name: r.currentStatusDetails.releaseName,
                is_current: false 
            }));
        const uniqueReleases = Array.from(new Map(releases.map(item => [item.id, item])).values())
            .sort((a, b) => a.name.localeCompare(b.name));
        setProjectReleases(uniqueReleases);
    } else {
        setProjectReleases([]);
    }
  }, [selectedProject, allRequirements]);

  useEffect(() => {
    if (!selectedProject) {
        setFilterOptions({ enabledReleases: [], isFatDefectYesEnabled: false, isFatDefectNoEnabled: false });
        return;
    }
    const baseItems = isSearching ? searchResults : (showClosedView ? closedDefects : activeDefects);
    
    const originalReleaseIdToArchiveIdMap = new Map(
        archivedReleases.map(ar => [ar.original_release_id, ar.id])
    );

    const relevantReleaseIds = new Set();
    if (showClosedView) {
        baseItems.forEach(defect => {
            const linkedReqs = (defect.linkedRequirements || []).map(lr => allRequirements.find(ar => ar.id === lr.groupId)).filter(Boolean);
            linkedReqs.forEach(req => {
                const sprint = req.currentStatusDetails.sprint;
                
                if (sprint && sprint.startsWith('Archived_from_')) {
                    const releaseName = sprint.substring('Archived_from_'.length).replace(/_/g, ' ');
                    const matchingArchive = archivedReleases.find(ar => ar.name === releaseName);
                    if (matchingArchive) {
                        relevantReleaseIds.add(matchingArchive.id);
                    }
                } else if (req.currentStatusDetails.releaseId) {
                    const originalReleaseId = req.currentStatusDetails.releaseId;
                    const archiveId = originalReleaseIdToArchiveIdMap.get(originalReleaseId);
                    
                    if (archiveId) {
                        relevantReleaseIds.add(archiveId);
                    } else {
                        relevantReleaseIds.add(originalReleaseId);
                    }
                }
            });
        });
    } else {
        baseItems.forEach(defect => {
            const linkedReqsWithDetails = (defect.linkedRequirements || []).map(lr => 
                allRequirements.find(ar => ar.id === lr.groupId)
            ).filter(Boolean);

            linkedReqsWithDetails.forEach(req => {
                if (req.currentStatusDetails.releaseId) {
                    relevantReleaseIds.add(req.currentStatusDetails.releaseId);
                }
            });
        });
    }

    const isFatDefectYesEnabled = baseItems.some(d => d.is_fat_defect);
    const isFatDefectNoEnabled = baseItems.some(d => !d.is_fat_defect);

    setFilterOptions({
      enabledReleases: Array.from(relevantReleaseIds),
      isFatDefectYesEnabled,
      isFatDefectNoEnabled,
    });
  }, [selectedProject, isSearching, searchResults, showClosedView, closedDefects, activeDefects, allRequirements, archivedReleases]);


  const updateChartData = useCallback(async (defectsForChart) => {
    if (!selectedProject) {
        setAreaChartData(null);
        setReturnToDevChartData(null);
        setDoneNotDoneChartData(null);
        setIsChartTruncated(false);
        return;
    }

    if (!showClosedView && defectsForChart.length > 0) {
        let doneCount = 0, notDoneCount = 0;
        defectsForChart.forEach(defect => {
            if (defect.status === 'Done') doneCount++;
            else notDoneCount++;
        });
        if (doneCount > 0 || notDoneCount > 0) {
            setDoneNotDoneChartData({
                labels: ['Done', 'Not Done'],
                datasets: [{
                    label: 'Defect Status',
                    data: [doneCount, notDoneCount],
                    backgroundColor: ['#151078', '#b84459'],
                    borderColor: ['#ffffff', '#ffffff'],
                    borderWidth: 1,
                }],
            });
        } else {
            setDoneNotDoneChartData(null);
        }
    } else {
        setDoneNotDoneChartData(null);
    }

    const defectsForAreaChart = defectsForChart.filter(defect => defect.area !== 'Imported');
    if (defectsForAreaChart.length > 0) {
        const areaCounts = defectsForAreaChart.reduce((acc, defect) => {
            acc[defect.area] = (acc[defect.area] || 0) + 1;
            return acc;
        }, {});
        setAreaChartData({
            labels: Object.keys(areaCounts),
            datasets: [{
                label: '# of Defects',
                data: Object.values(areaCounts),
                backgroundColor: ['rgba(255, 99, 132, 0.7)', 'rgba(54, 162, 235, 0.7)', 'rgba(255, 206, 86, 0.7)', 'rgba(75, 192, 192, 0.7)', 'rgba(153, 102, 255, 0.7)', 'rgba(255, 159, 64, 0.7)', 'rgba(199, 199, 199, 0.7)', 'rgba(83, 102, 255, 0.7)', 'rgba(102, 255, 83, 0.7)', 'rgba(143, 255, 193, 0.7)', 'rgba(255, 173, 191, 0.7)', 'rgba(221, 171, 255, 0.7)', 'rgba(43, 63, 63, 0.7)', 'rgba(65, 5, 23, 0.7)', 'rgba(224, 255, 51, 0.7)'],
                borderColor: ['rgba(255,99,132,1)', 'rgba(54,162,235,1)', 'rgba(255,206,86,1)', 'rgba(75,192,192,1)', 'rgba(153,102,255,1)', 'rgba(255,159,64,1)', 'rgba(199,199,199,1)', 'rgba(83,102,255,1)', 'rgba(102,255,83,1)', 'rgba(143, 255, 193, 1)', 'rgba(255, 173, 191, 1)', 'rgba(221, 171, 255, 1)', 'rgba(43, 63, 63, 1)', 'rgba(65, 5, 23, 1)', 'rgba(224, 255, 51, 1)'],
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
                const defectIdsInView = new Set(defectsForChart.map(d => d.id));
                let filteredData = result.data.filter(d => d.return_count >= 2 && defectIdsInView.has(d.id));
                if (filteredData.length > 5) {
                    setIsChartTruncated(true);
                    filteredData = filteredData.slice(-5);
                } else {
                    setIsChartTruncated(false);
                }

                if (filteredData.length > 0) {
                    const splitLabelIntoLines = (label, maxCharsPerLine = 35) => {
                        const words = label.split(' ');
                        let lines = [], currentLine = '';
                        for (const word of words) {
                            if ((currentLine + ' ' + word).length > maxCharsPerLine && currentLine.length > 0) {
                                lines.push(currentLine);
                                currentLine = word;
                            } else {
                                currentLine = currentLine ? `${currentLine} ${word}` : word;
                            }
                        }
                        if (currentLine) lines.push(currentLine);
                        return lines;
                    };
                    const fullLabels = filteredData.map(d => d.title);
                    const multilineLabels = fullLabels.map(label => splitLabelIntoLines(label));
                    setReturnToDevChartData({
                        labels: multilineLabels,
                        datasets: [{
                            label: 'Times Returned to Developer',
                            data: filteredData.map(d => d.return_count),
                            backgroundColor: 'rgba(255, 159, 64, 0.7)',
                            borderColor: 'rgba(255, 159, 64, 1)',
                            borderWidth: 1,
                            fullLabels: fullLabels,
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
  }, [selectedProject, showClosedView, showMessage]);

  useEffect(() => {
    if (showAreaChart) {
      updateChartData(filteredDefects);
    }
  }, [showAreaChart, updateChartData, filteredDefects]);

  const handleToggleCharts = () => setShowAreaChart(prev => !prev);
  const handleOpenModal = (defect = null) => { setEditingDefect(defect); setIsModalOpen(true); };
  const handleCloseModal = () => { setIsModalOpen(false); setEditingDefect(null); };

  const refreshDefectsState = useCallback(async () => {
    const freshDefects = await fetchAllDefects();
    if (isSearching) {
        const lowerCaseQuery = defectQuery.toLowerCase();
        const sourceData = freshDefects.filter(defect => 
            (showClosedView ? defect.status === 'Closed' : defect.status !== 'Closed') &&
            (selectedProject ? defect.project === selectedProject : true)
        );
        const newSearchResults = sourceData.filter(defect => defect.title.toLowerCase().includes(lowerCaseQuery));
        setSearchResults(newSearchResults);
    }
    if (onDefectUpdate) onDefectUpdate();
  }, [fetchAllDefects, isSearching, defectQuery, showClosedView, selectedProject, onDefectUpdate]);

  const handleSubmitDefect = async (formData) => {
    const projectForSubmit = formData.project || selectedProject;
    if (!projectForSubmit) { showMessage("Please select a project.", "error"); return; }
    const payload = { ...formData, project: projectForSubmit };
    const isEditing = !!editingDefect;
    const url = isEditing ? `${API_BASE_URL}/defects/${editingDefect.id}` : `${API_BASE_URL}/defects`;
    const method = isEditing ? 'PUT' : 'POST';

    try {
      const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || `Failed to ${isEditing ? 'update' : 'create'} defect`);
      
      showMessage(`Defect ${isEditing ? 'updated' : 'created'} successfully!`, 'success');
      await refreshDefectsState();
      handleManualProjectSelect(projectForSubmit);
      handleCloseModal();
    } catch (error) {
      showMessage(`Error: ${error.message}`, 'error');
    }
  };

  const handleDeleteRequest = (defect) => { setDefectToDelete(defect); setIsDeleteConfirmModalOpen(true); };

  const handleConfirmDelete = async () => {
    if (!defectToDelete) return;
    try {
      const response = await fetch(`${API_BASE_URL}/defects/${defectToDelete.id}`, { method: 'DELETE' });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Failed to delete defect');
      }
      showMessage('Defect deleted successfully!', 'success');
      await refreshDefectsState();
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

  const handleUpdateHistoryComment = async (historyId, newComment) => {
      try {
          const response = await fetch(`${API_BASE_URL}/defects/history/${historyId}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ comment: newComment })
          });
          
          if (!response.ok) throw new Error("Failed to update history comment.");
          
          showMessage("Comment updated successfully.", "success");
          
          if (defectForHistory) {
              const histResponse = await fetch(`${API_BASE_URL}/defects/${defectForHistory.id}/history`);
              const histResult = await histResponse.json();
              setDefectHistory(histResult.data || []);
          }

          await refreshDefectsState();
          
      } catch (error) {
          showMessage(`Error: ${error.message}`, 'error');
      }
  };

  const handleNavigateToRequirement = useCallback((project, sprint, requirementId) => {
    navigate(`/sprint-board?project=${encodeURIComponent(project)}&sprint=${encodeURIComponent(sprint)}&highlight=${requirementId}`);
  }, [navigate]);

  const handleOpenImportModal = useCallback(() => setIsImportDefectsModalOpen(true), []);
  const handleCloseImportModal = useCallback(() => { setIsImportDefectsModalOpen(false); setImportConfirmData(null); }, []);

  const handleOpenJiraImportModal = useCallback(() => setIsJiraImportModalOpen(true), []);
  const handleCloseJiraImportModal = useCallback(() => setIsJiraImportModalOpen(false), []);
  const handleJiraImportSuccess = useCallback(async (project) => {
      await refreshDefectsState();
      if (project) handleManualProjectSelect(project);
  }, [refreshDefectsState, handleManualProjectSelect]);

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
        await refreshDefectsState();
        handleManualProjectSelect(project);
    } catch (error) {
        showMessage(`Import Error: ${error.message}`, 'error');
    } finally {
        handleCloseImportModal();
    }
  }, [refreshDefectsState, showMessage, handleCloseImportModal, handleManualProjectSelect]);

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
    if (!finalQuery) { handleClearDefectSearch(); return; }
    setIsSearching(true);
    setSearchSuggestions([]);
    const lowerCaseQuery = finalQuery.toLowerCase();
    const sourceData = allDefects.filter(defect => showClosedView ? defect.status === 'Closed' : defect.status !== 'Closed');
    const results = sourceData.filter(defect => defect.title.toLowerCase().includes(lowerCaseQuery));
    setSearchResults(results);
    if (results.length > 0) {
      const uniqueProjects = [...new Set(results.map(d => d.project))];
      setSelectedProject(uniqueProjects.length === 1 ? uniqueProjects[0] : '');
    } else {
      setSelectedProject('');
    }
  };

  const handleClearDefectSearch = () => {
    setIsSearching(false);
    setDefectQuery('');
    setSearchResults([]);
    setSearchSuggestions([]);
    setSelectedProject('');
    handleClearFilters();
  };

  const handleDefectQueryChange = (query) => {
    setDefectQuery(query);
    if (query.length < 3) { setSearchSuggestions([]); return; }
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
      setSelectedProject(selectedDefect.project);
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
      await refreshDefectsState();
    } catch (error) {
      showMessage(`Error: ${error.message}`, 'error');
    } finally {
      handleCloseUpdateStatusModal();
    }
  };

  const handleDragStart = (e, defect) => { e.dataTransfer.setData("defectId", defect.id); };

  const handleDrop = (e, targetStatus) => {
    const defectId = e.dataTransfer.getData("defectId");
    const sourceData = isSearching ? searchResults : activeDefects;
    const draggedDefect = sourceData.find(d => d.id.toString() === defectId);
    if (draggedDefect && draggedDefect.status !== targetStatus) {
      handleStatusUpdateRequest(draggedDefect, targetStatus);
    }
  };

  const proceedWithMoveToClosed = async (defect) => {
    const payload = { ...defect, status: 'Closed', comment: 'Moved to closed' };
    try {
      const response = await fetch(`${API_BASE_URL}/defects/${defect.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) throw new Error('Failed to move defect to closed.');
      showMessage('Defect moved to closed successfully!', 'success');
      await refreshDefectsState();
    } catch (error) {
      showMessage(`Error: ${error.message}`, 'error');
    }
  };

  const handleMoveToClosed = (defect) => {
    if (defect.status !== 'Done') {
      setDefectToMove(defect);
      setIsMoveToClosedConfirmModalOpen(true);
    } else {
      proceedWithMoveToClosed(defect);
    }
  };

  const handleConfirmMoveToClosed = () => {
    if (defectToMove) {
      proceedWithMoveToClosed(defectToMove);
    }
    setIsMoveToClosedConfirmModalOpen(false);
    setDefectToMove(null);
  };

  const handleCancelMoveToClosed = () => {
    setIsMoveToClosedConfirmModalOpen(false);
    setDefectToMove(null);
  };

  const handleReleaseChange = (releaseId) => {
    setSelectedReleases(prev =>
        prev.includes(releaseId)
            ? prev.filter(id => id !== releaseId)
            : [...prev, releaseId]
    );
  };

  const handleFatDefectChange = (value) => {
    setFatDefectFilter(prev => (prev === value ? null : value));
  };

  const handleClearFilters = () => {
    setSelectedReleases([]);
    setFatDefectFilter(null);
  };

  const handleSaveFixedDate = async (defect, newDate) => {
      const payload = { fixed_date: newDate ? new Date(newDate).toISOString() : null };
      try {
          const response = await fetch(`${API_BASE_URL}/defects/${defect.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
          });
          if (!response.ok) throw new Error('Failed to update fixed date.');
          showMessage('Fixed date updated successfully!', 'success');
          await refreshDefectsState();
      } catch (error) {
          showMessage(`Error: ${error.message}`, 'error');
      }
  };

  const baseChartOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top' },
      title: { display: true, font: { size: 16 } },
      tooltip: { callbacks: { label: (c) => `${c.label}: ${c.parsed} (${((c.parsed / c.dataset.data.reduce((a, b) => a + b, 0)) * 100).toFixed(1)}%)` } }
    },
  };

  const pieChartOptions = {
    ...baseChartOptions,
    plugins: { ...baseChartOptions.plugins, title: { ...baseChartOptions.plugins.title, text: `${showClosedView ? 'Closed' : 'Active'} Defect Distribution by Area for ${selectedProject || 'Project'}` } }
  };
  const doneNotDonePieChartOptions = {
    ...baseChartOptions,
    plugins: { ...baseChartOptions.plugins, title: { ...baseChartOptions.plugins.title, text: `Active Defect Status for ${selectedProject || 'Project'}` } }
  };
  const returnToDevChartOptions = {
    ...baseChartOptions,
    indexAxis: 'y',
    layout: { padding: { left: 20 } },
    plugins: {
        ...baseChartOptions.plugins,
        legend: { display: false },
        title: { 
            ...baseChartOptions.plugins.title,
            text: `Defect "Back to Developer" Count for ${selectedProject || 'Project'}${isChartTruncated ? ' (Last 5 items)' : ''}`
        },
        tooltip: {
            callbacks: {
                title: function(context) { 
                    const dataIndex = context[0].dataIndex;
                    const fullLabel = context[0].dataset.fullLabels[dataIndex];
                    const maxCharsPerLine = 50;
                    const words = fullLabel.split(' ');
                    const lines = [];
                    let currentLine = '';
                    for (const word of words) {
                        if ((currentLine + ' ' + word).length > maxCharsPerLine && currentLine.length > 0) {
                            lines.push(currentLine);
                            currentLine = word;
                        } else {
                            currentLine = currentLine ? `${currentLine} ${word}` : word;
                        }
                    }
                    if (currentLine) {
                        lines.push(currentLine);
                    }
                    return lines;
                }, 
                label: function(context) { 
                    let label = context.dataset.label || ''; 
                    if (label) { 
                        label += ': '; 
                    } 
                    if (context.parsed.x !== null) { 
                        label += context.parsed.x; 
                    } 
                    return label; 
                },
                afterBody: function() {
                    if (isChartTruncated) {
                        return [
                            '',
                            'Note: Displaying only the last 5 items based on return count.',
                            'For the complete history and details, please visit the',
                            'release page and download the detailed Excel report.'
                        ];
                    }
                    return [];
                }
            }
        }
    },
    scales: { 
        x: { 
            beginAtZero: true, 
            ticks: { 
                stepSize: 1 
            } 
        }, 
        y: {
            ticks: {autoSkip: false}
        } 
    } 
  };

  const renderBoard = (defectsToDisplay) => {
    if (showClosedView) {
      return (
        <div className="defects-board-container">
          <DefectColumn 
            title="Closed" 
            defects={defectsToDisplay} 
            onEditDefect={handleOpenModal} 
            onShowHistory={handleShowHistory} 
            onDeleteRequest={handleDeleteRequest} 
            onNavigate={handleNavigateToRequirement}
            onUpdateFixedDate={handleSaveFixedDate}
          />
        </div>
      );
    }
    return (
      <div className="defects-board-container">
        {DEFECT_STATUS_COLUMNS.map(column => (
          <DefectColumn 
            key={column.status} 
            title={column.title} 
            defects={defectsToDisplay.filter(d => d.status === column.status)} 
            onEditDefect={handleOpenModal} 
            onShowHistory={handleShowHistory} 
            onDeleteRequest={handleDeleteRequest} 
            onNavigate={handleNavigateToRequirement} 
            onDragStart={handleDragStart} 
            onDrop={handleDrop} 
            onMoveToClosed={handleMoveToClosed}
            onUpdateFixedDate={handleSaveFixedDate}
          />
        ))}
      </div>
    );
  };
  
  const releasesForFilter = useMemo(() => {
      if (!showClosedView) {
          return projectReleases;
      }
      
      const archivedAsReleases = archivedReleases.map(ar => ({ 
          id: ar.id, 
          name: ar.name, 
          is_current: false 
      }));
      
      const combined = [...projectReleases, ...archivedAsReleases];
      
      return Array.from(new Map(combined.map(item => [item.name, item])).values())
          .sort((a, b) => a.name.localeCompare(b.name));

  }, [showClosedView, projectReleases, archivedReleases]);

  return (
    <div className="main-content-area">
      <div className="selection-controls">
        <div className="selection-group-container">
            <ProjectSelector projects={projects || []} selectedProject={selectedProject} onSelectProject={handleManualProjectSelect} />
            <SearchComponent
              query={defectQuery}
              onQueryChange={handleDefectQueryChange}
              onSearch={handleDefectSearch}
              onClear={handleClearDefectSearch}
              onSuggestionSelect={handleDefectSuggestionSelect}
              suggestions={searchSuggestions}
              placeholder="Search defects by title..."
            />
            <button
              ref={filterButtonRef}
              className="btn-primary filter-toggle-button"
              disabled={!selectedProject}
            >
                Filter
            </button>
        </div>
        <div className="page-actions-group">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                 <Tooltip content={defectChartTooltipContent} position="bottom" />
                <button onClick={handleToggleCharts} className="btn-primary" disabled={!selectedProject || filteredDefects.length === 0}>
                    {showAreaChart ? 'Hide' : 'Show'} Charts
                </button>
            </div>
            <button onClick={() => setShowClosedView(p => !p)} className="btn-primary btn-toggle-closed" disabled={isLoading || closedDefects.length === 0}>
                {showClosedView ? 'Show Active Defects' : 'Show Closed Defects'}
            </button>
            <DefectOptionsMenu
                onOpenAddModal={() => handleOpenModal()}
                onOpenImportModal={handleOpenImportModal}
                onOpenJiraImportModal={handleOpenJiraImportModal}
            />
        </div>
      </div>

      {isLoading && <p className="loading-message">Loading defects...</p>}
      {!isLoading && !isSearching && !selectedProject && <p className="empty-column-message">Please select a project to view defects, or use the search bar for all projects.</p>}
      
      {showAreaChart && selectedProject && (
        <div className="charts-wrapper">
          {doneNotDoneChartData && !showClosedView && (
            <div className="chart-container">
              <Pie data={doneNotDoneChartData} options={doneNotDonePieChartOptions} />
            </div>
          )}
          {areaChartData && <div className="chart-container"><Pie data={areaChartData} options={pieChartOptions} /></div>}
          {returnToDevChartData && <div className="chart-container"><Bar data={returnToDevChartData} options={returnToDevChartOptions} /></div>}
          {!areaChartData && !returnToDevChartData && (showClosedView || !doneNotDoneChartData) && !isLoading && (
            <div className="chart-container" style={{ flexBasis: '100%', height: 'auto' }}>
              <p>No chart data available for the selected project and filters.</p>
            </div>
          )}
        </div>
      )}

      {!isLoading && (isSearching ? (filteredDefects.length > 0 ? renderBoard(filteredDefects) : <div className="empty-column-message">No results found for your search.</div>) : (selectedProject ? renderBoard(filteredDefects) : null))}

      <UpdateStatusModal isOpen={isUpdateStatusModalOpen} onClose={handleCloseUpdateStatusModal} onSave={handleConfirmDefectStatusUpdate} requirement={statusUpdateInfo.defect ? { requirementUserIdentifier: statusUpdateInfo.defect.title } : null} newStatus={statusUpdateInfo.newStatus} />
      <DefectModal isOpen={isModalOpen} onClose={handleCloseModal} onSubmit={handleSubmitDefect} defect={editingDefect} projects={projects || []} currentSelectedProject={selectedProject} allRequirements={allRequirements} allDefects={allDefects} />
      {defectForHistory && <DefectHistoryModal isOpen={isHistoryModalOpen} onClose={() => { setIsHistoryModalOpen(false); setDefectForHistory(null); setDefectHistory([]);}} defect={defectForHistory} history={defectHistory} onSaveComment={handleUpdateHistoryComment} />}
      <ConfirmationModal isOpen={isDeleteConfirmModalOpen} onClose={() => setIsDeleteConfirmModalOpen(false)} onConfirm={handleConfirmDelete} title="Confirm Defect Deletion" message={`Are you sure you want to permanently delete the defect "${defectToDelete?.title}"? This action cannot be undone.`} />
      <ConfirmationModal isOpen={isMoveToClosedConfirmModalOpen} onClose={handleCancelMoveToClosed} onConfirm={handleConfirmMoveToClosed} title="Confirm Move to Closed" message={`The defect "${defectToMove?.title}" has not been completed. Are you sure you want to move it to closed?`} confirmText="Yes, Move to Closed" cancelText="No, Keep it Active" />
      <ImportDefectsModal isOpen={isImportDefectsModalOpen} onClose={handleCloseImportModal} onImport={handleValidateDefectImport} projects={projects || []} currentProject={selectedProject} />
      <JiraImportModal isOpen={isJiraImportModalOpen} onClose={handleCloseJiraImportModal} onImportSuccess={handleJiraImportSuccess} projects={projects || []} releases={projectReleases} currentProject={selectedProject} importType="defects" showMessage={showMessage} />
      
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
      <div ref={sidebarWrapperRef}>
        <FilterSidebar
          isOpen={isFilterSidebarOpen}
          onClose={() => setIsFilterSidebarOpen(false)}
          releases={releasesForFilter}
          selectedReleases={selectedReleases}
          onReleaseChange={handleReleaseChange}
          enabledReleases={filterOptions.enabledReleases}
          onClearFilters={handleClearFilters}
          fatDefectFilter={fatDefectFilter}
          onFatDefectChange={handleFatDefectChange}
          isFatDefectYesEnabled={filterOptions.isFatDefectYesEnabled}
          isFatDefectNoEnabled={filterOptions.isFatDefectNoEnabled}
        />
      </div>
    </div>
  );
};

export default DefectsPage;
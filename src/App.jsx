import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import './App.css';
import AppNavigationBar from './components/AppNavigationBar';
import ProjectSelector from './components/ProjectSelector';
import SprintSelector from './components/SprintSelector';
import KanbanBoard from './components/KanbanBoard';
import HistoryModal from './components/HistoryModal';
import AddNewRequirementModal from './components/AddNewRequirementModal';
import AddProjectModal from './components/AddProjectModal';
import EditRequirementModal from './components/EditRequirementModal';
import ImportRequirementsModal from './components/ImportRequirementsModal';
import JiraImportModal from './components/JiraImportModal';
import AddReleaseModal from './components/AddReleaseModal';
import EditReleaseModal from './components/EditReleaseModal';
import EditProjectModal from './components/EditProjectModal';
import NotesPage from './pages/NotesPage';
import DefectsPage from './pages/DefectsPage';
import SprintAnalysisPage from './pages/SprintAnalysisPage';
import ReleasesPage from './pages/ReleasesPage';
import { getUniqueProjects, getSprintsForProject } from './utils/dataHelpers';
import ConfirmationModal from './components/ConfirmationModal';
import Toast from './components/Toast';
import SearchComponent from './components/SearchComponent';
import UpdateStatusModal from './components/UpdateStatusModal';
import Tooltip from './components/Tooltip';
import { Chart as ChartJS, ArcElement, Tooltip as ChartTooltip, Legend, Title, BarElement, CategoryScale, LinearScale } from 'chart.js';
import { Pie, Bar } from 'react-chartjs-2';
import Chatbot from './components/Chatbot';
import FilterSidebar from './components/FilterSidebar';
import './components/FilterSidebar.css';

ChartJS.register(ArcElement, ChartTooltip, Legend, Title, BarElement, CategoryScale, LinearScale);

const API_BASE_URL = '/api';

const OptionsMenu = ({ onOpenAddProjectModal, onOpenAddModal, onOpenImportModal, onOpenJiraImportModal, onOpenAddReleaseModal, onOpenEditReleaseModal, onOpenEditProjectModal, hasProjects, hasAnyReleases }) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [menuRef]);

  const createHandler = (handler) => () => {
    if (handler) {
      handler();
    }
    setIsOpen(false);
  };

  return (
    <div id="options-menu-container-id" className="options-menu-container" ref={menuRef}>
      <button onClick={() => setIsOpen(!isOpen)} className="options-menu-button" title="More options">
        ⋮
      </button>
      {isOpen && (
        <div className="options-menu-dropdown">
          <button onClick={createHandler(onOpenAddProjectModal)} className="options-menu-item">
            + Add Project
          </button>
          <button onClick={createHandler(onOpenEditProjectModal)} className="options-menu-item" disabled={!hasProjects}>
            +/- Edit/Delete Project
          </button>
          <button onClick={createHandler(onOpenAddModal)} className="options-menu-item">
            + Add Requirement
          </button>
           <button onClick={createHandler(onOpenAddReleaseModal)} className="options-menu-item" disabled={!hasProjects}>
            + Add Release
          </button>
          <button onClick={createHandler(onOpenEditReleaseModal)} className="options-menu-item" disabled={!hasAnyReleases}>
            +/- Edit/Delete Release
          </button>
          <button onClick={createHandler(onOpenImportModal)} className="options-menu-item">
            + Import Data
          </button>
          <button onClick={createHandler(onOpenJiraImportModal)} className="options-menu-item">
            + Import from Jira
          </button>
        </div>
      )}
    </div>
  );
};


const SprintActivitiesPage = ({
  projects,
  selectedProject,
  onSelectProject,
  availableSprints,
  selectedSprint,
  onSelectSprint,
  requirementQuery,
  onQueryChange,
  onSearch,
  onClear,
  onSuggestionSelect,
  searchSuggestions,
  onOpenAddProjectModal,
  onOpenAddModal,
  onOpenImportModal,
  onOpenJiraImportModal,
  onOpenAddReleaseModal,
  onOpenEditReleaseModal,
  onOpenEditProjectModal,
  onToggleFilterSidebar,
  isSearching,
  displayableRequirements,
  onShowHistory,
  onEditRequirement,
  onDeleteRequirement,
  onStatusUpdateRequest,
  projectReleases,
  allProcessedRequirements,
  hasAnyReleases,
  showArchivedSprints,
  onSetShowArchived,
}) => {
  const [showCharts, setShowCharts] = useState(false);

  const sprintChartTooltipContent = (
    <div id="sprint-chart-tooltip-content-id">
      <strong>Sprint Activity Charts</strong>
      <p>These charts provide a visual summary of the current sprint and release progress.</p>
      <ul>
        <li><strong>Current Sprint:</strong> A pie chart showing the completion status ('Done' vs. 'To Be Tested') of requirements in the selected sprint.</li>
        <li><strong>Active Release:</strong> A pie chart showing the completion status of all requirements assigned to the active release for this project.</li>
        <li><strong>Scope Changes:</strong> A bar chart that highlights requirements within the current sprint that have undergone scope changes, showing how many times each has been modified.</li>
      </ul>
    </div>
  );

  const getChartData = (reqs) => {
    if (!reqs || reqs.length === 0) return null;
    let done = 0;
    let notDone = 0;
    reqs.forEach(req => {
      if (req.currentStatusDetails.status === 'Done') {
        done++;
      } else {
        notDone++;
      }
    });

    if (done === 0 && notDone === 0) return null;

    return {
      labels: ['Done', 'To Be Tested'],
      datasets: [{
        data: [done, notDone],
        backgroundColor: ['#151078', '#b84459'],
        borderColor: ['#ffffff', '#ffffff'],
        borderWidth: 1,
      }],
    };
  };

  const getChangeChartData = (reqs) => {
    const changedReqs = reqs.filter(r => r.changeCount && r.changeCount > 0);
    if (changedReqs.length === 0) return null;

    changedReqs.sort((a, b) => b.changeCount - a.changeCount);

    const splitLabelIntoLines = (label, maxCharsPerLine = 22) => {
        const words = label.split(' ');
        const lines = [];
        let currentLine = '';
        for (const word of words) {
            if ((currentLine + ' ' + word).length > maxCharsPerLine && currentLine.length > 0) {
                lines.push(currentLine);
                currentLine = word;
            } else {
                currentLine = currentLine ? currentLine + ' ' + word : word;
            }
        }
        if (currentLine) {
            lines.push(currentLine);
        }
        return lines;
    };

    const fullLabels = changedReqs.map(r => r.requirementUserIdentifier);
    const multilineLabels = fullLabels.map(label => splitLabelIntoLines(label));

    return {
        labels: multilineLabels,
        datasets: [{
            label: 'Number of Scope Changes',
            data: changedReqs.map(r => r.changeCount),
            backgroundColor: 'rgba(255, 99, 132, 0.5)',
            borderColor: 'rgba(255, 99, 132, 1)',
            borderWidth: 1,
            fullLabels: fullLabels,
        }],
    };
  };

  const baseChartOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top' },
      title: { display: true, font: { size: 16 } },
      tooltip: { callbacks: { label: (c) => `${c.label}: ${c.parsed} (${((c.parsed / c.dataset.data.reduce((a, b) => a + b, 0)) * 100).toFixed(1)}%)` } }
    },
  };

  const sprintChartData = getChartData(displayableRequirements);
  const sprintChartOptions = {
    ...baseChartOptions,
    plugins: { ...baseChartOptions.plugins, title: { ...baseChartOptions.plugins.title, text: `Current Sprint: ${selectedSprint}` } }
  };

  const activeRelease = projectReleases.find(r => r.is_current);
  const releaseRequirements = activeRelease
    ? allProcessedRequirements.filter(r => r.currentStatusDetails.releaseId === activeRelease.id)
    : [];
  const releaseChartData = getChartData(releaseRequirements);
  const releaseChartOptions = {
    ...baseChartOptions,
    plugins: { ...baseChartOptions.plugins, title: { ...baseChartOptions.plugins.title, text: `Active Release: ${activeRelease?.name || 'N/A'}` } }
  };

  const changeChartData = getChangeChartData(displayableRequirements);
  const changeChartOptions = {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: { display: false },
        title: {
            display: true,
            text: `Scope Changes in Sprint: ${selectedSprint}`,
            font: { size: 16 }
        },
        tooltip: {
            callbacks: {
                title: function(context) {
                    const dataIndex = context[0].dataIndex;
                    const fullLabel = context[0].dataset.fullLabels[dataIndex];
                    return fullLabel;
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
        }
    }
  };

  return (
    <div id="main-content-area-id" className="main-content-area">
      <div className="selection-controls">
        <div className="selection-group-container">
          <ProjectSelector projects={projects} selectedProject={selectedProject} onSelectProject={onSelectProject} />
          <SprintSelector sprints={availableSprints} selectedSprint={selectedSprint} onSelectSprint={onSelectSprint} disabled={!selectedProject || projects.length === 0} />
          <SearchComponent
            query={requirementQuery}
            onQueryChange={onQueryChange}
            onSearch={onSearch}
            onClear={onClear}
            onSuggestionSelect={onSuggestionSelect}
            suggestions={searchSuggestions}
            placeholder="Search requirements..."
          />
          <button onClick={onToggleFilterSidebar} className="defect-action-button filter-toggle-button" disabled={!selectedProject || !selectedSprint}>
            Filter
          </button>
          <div className="show-archived-container">
            <input
              type="checkbox"
              id="show-archived-sprints"
              checked={showArchivedSprints}
              onChange={(e) => onSetShowArchived(e.target.checked)}
              disabled={!selectedProject || projects.length === 0}
            />
            <label htmlFor="show-archived-sprints">Show Archived</label>
          </div>
        </div>
        <div className="page-actions-group">
           <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
               <Tooltip content={sprintChartTooltipContent} position="bottom" />
               <button onClick={() => setShowCharts(p => !p)} className="defect-action-button" disabled={!selectedProject || !selectedSprint}>
                   {showCharts ? 'Hide' : 'Show'} Charts
               </button>
           </div>
          <OptionsMenu
            onOpenAddProjectModal={onOpenAddProjectModal}
            onOpenAddModal={onOpenAddModal}
            onOpenImportModal={onOpenImportModal}
            onOpenJiraImportModal={onOpenJiraImportModal}
            onOpenAddReleaseModal={onOpenAddReleaseModal}
            onOpenEditReleaseModal={onOpenEditReleaseModal}
            onOpenEditProjectModal={onOpenEditProjectModal}
            selectedProject={selectedProject}
            hasProjects={projects.length > 0}
            hasAnyReleases={hasAnyReleases}
          />
        </div>
      </div>

      {showCharts && selectedProject && selectedSprint && (
        <div className="charts-wrapper">
          {sprintChartData && (
            <div className="chart-container">
              <Pie data={sprintChartData} options={sprintChartOptions} />
            </div>
          )}
          {releaseChartData && (
            <div className="chart-container">
              <Pie data={releaseChartData} options={releaseChartOptions} />
            </div>
          )}
          {changeChartData && (
            <div className="chart-container">
              <Bar data={changeChartData} options={changeChartOptions} />
            </div>
          )}
          {!sprintChartData && !releaseChartData && !changeChartData && (
            <div className="chart-container" style={{ flexBasis: '100%', height: 'auto' }}>
              <p>No data available for charts.</p>
            </div>
          )}
        </div>
      )}

      {isSearching && displayableRequirements.length === 0 && (
        <div className="empty-column-message">No results found for your search.</div>
      )}
      <KanbanBoard
        requirements={displayableRequirements}
        onShowHistory={onShowHistory}
        onEditRequirement={onEditRequirement}
        onDeleteRequirement={onDeleteRequirement}
        isSearching={isSearching}
        onStatusUpdateRequest={onStatusUpdateRequest}
      />
    </div>
  );
};


function App() {
  const [allProcessedRequirements, setAllProcessedRequirements] = useState([]);
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [availableSprints, setAvailableSprints] = useState([]);
  const [selectedSprint, setSelectedSprint] = useState('');
  const [displayableRequirements, setDisplayableRequirements] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [allReleases, setAllReleases] = useState([]);
  const [projectReleases, setProjectReleases] = useState([]);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [requirementForHistory, setRequirementForHistory] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingRequirement, setEditingRequirement] = useState(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newReqFormState, setNewReqFormState] = useState({
    project: '', requirementName: '', status: 'To Do', sprint: '1', comment: '', link: '', isBacklog: false, type: '', tags: '', release_id: ''
  });
  const [isAddProjectModalOpen, setIsAddProjectModalOpen] = useState(false);
  const [isEditProjectModalOpen, setIsEditProjectModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isJiraImportModalOpen, setIsJiraImportModalOpen] = useState(false);
  const [toastInfo, setToastInfo] = useState({ message: null, type: 'success', key: null });
  const [isDeleteConfirmModalOpen, setIsDeleteConfirmModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [deleteType, setDeleteType] = useState('');
  const [isAddReleaseModalOpen, setIsAddReleaseModalOpen] = useState(false);
  const [isEditReleaseModalOpen, setIsEditReleaseModalOpen] = useState(false);
  const [isImportConfirmModalOpen, setIsImportConfirmModalOpen] = useState(false);
  const [importConfirmData, setImportConfirmData] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [requirementQuery, setRequirementQuery] = useState('');
  const [searchSuggestions, setSearchSuggestions] = useState([]);
  const [isUpdateStatusModalOpen, setIsUpdateStatusModalOpen] = useState(false);
  const [statusUpdateInfo, setStatusUpdateInfo] = useState({ requirement: null, newStatus: '' });
  
  const [highlightedReqId, setHighlightedReqId] = useState(null);
  const [isFilterSidebarOpen, setIsFilterSidebarOpen] = useState(false);
  const [availableTypes, setAvailableTypes] = useState([]);

  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [selectedTypes, setSelectedTypes] = useState([]);
  const [linkedDefectsFilter, setLinkedDefectsFilter] = useState(null);
  const [selectedReleases, setSelectedReleases] = useState([]);
  const [showArchivedSprints, setShowArchivedSprints] = useState(false);

  const [filterOptions, setFilterOptions] = useState({
    enabledTypes: [],
    enabledReleases: [],
    isLinkedDefectsYesEnabled: false,
    isLinkedDefectsNoEnabled: false,
  });

  const hasFetched = useRef(false);
  const location = useLocation();
  const navigate = useNavigate();
  const prevSelectedProject = useRef();
  const isSearchUpdate = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const projectParam = params.get('project');
    const sprintParam = params.get('sprint');
    const highlightId = params.get('highlight');
    let urlWasChanged = false;

    if (sprintParam && sprintParam.startsWith('Archived_')) {
      setShowArchivedSprints(true);
    }

    if (projectParam) {
      setSelectedProject(projectParam);
      urlWasChanged = true;
    }
    if (sprintParam) {
      setSelectedSprint(sprintParam);
      urlWasChanged = true;
    }
    if (highlightId) {
      setHighlightedReqId(highlightId);
      urlWasChanged = true;
    }
    
    if (urlWasChanged) {
      navigate(location.pathname, { replace: true });
    }
  }, [location.search, navigate]);

  useEffect(() => {
    if (highlightedReqId && displayableRequirements.length > 0) {
        const timer = setTimeout(() => {
            const element = document.getElementById(`req-card-${highlightedReqId}`);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                element.classList.add('highlight-item');

                setTimeout(() => {
                    element.classList.remove('highlight-item');
                }, 3000);
            }
            setHighlightedReqId(null);
        }, 300);

        return () => clearTimeout(timer);
    }
}, [highlightedReqId, displayableRequirements, selectedProject, selectedSprint]);

  const showMainMessage = useCallback((text, type = 'success') => {
    setToastInfo({ message: text, type: type, key: Date.now() });
  }, []);

  const handleDismissToast = useCallback(() => {
    setToastInfo({ message: null, type: 'success', key: null });
  }, []);

  const fetchAllProjectData = useCallback(async () => {
    if (projects.length === 0) {
        setAllReleases([]);
        return;
    }
    try {
        const releasePromises = projects.map(p =>
            fetch(`${API_BASE_URL}/releases/${p}`).then(res => res.json())
        );
        const results = await Promise.all(releasePromises);
        const all = results.flatMap(result => result.data || []);
        setAllReleases(all);
    } catch (error) {
        showMainMessage('Could not load full release list.', 'error');
    }
  }, [projects, showMainMessage]);

  useEffect(() => {
    fetchAllProjectData();
  }, [fetchAllProjectData]);

  useEffect(() => {
      if (selectedProject) {
          setProjectReleases(allReleases.filter(r => r.project === selectedProject));
      } else {
          setProjectReleases([]);
      }
  }, [selectedProject, allReleases]);

  const fetchRequirementsOnly = useCallback(async () => {
    try {
      const requirementsResponse = await fetch(`${API_BASE_URL}/requirements`);
      if (!requirementsResponse.ok) throw new Error(`Requirements fetch failed: ${requirementsResponse.statusText}`);
      const requirementsResult = await requirementsResponse.json();

      if (requirementsResult.data && Array.isArray(requirementsResult.data)) {
        const reqsWithDates = requirementsResult.data.map(group => ({
            ...group,
            project: group.project ? String(group.project).trim() : '',
            requirementUserIdentifier: group.requirementUserIdentifier ? String(group.requirementUserIdentifier).trim() : 'Unnamed Requirement',
            history: group.history.map((hist, index) => ({
                ...hist,
                date: new Date(hist.date),
                createdAt: hist.createdAt ? new Date(hist.createdAt) : new Date(hist.date),
                id: `${group.id}_hist_${hist.activityId || `idx_${index}`}`,
                activityId: hist.activityId
            })),
            currentStatusDetails: group.currentStatusDetails ? {
                ...group.currentStatusDetails,
                date: new Date(group.currentStatusDetails.date),
                createdAt: group.currentStatusDetails.createdAt ? new Date(group.currentStatusDetails.createdAt) : new Date(group.currentStatusDetails.date),
                activityId: group.currentStatusDetails.activityId
            } : { status: 'N/A', sprint: 'N/A', comment: '', link: '', date: new Date(), createdAt: new Date(), activityId: null }
        }));
        setAllProcessedRequirements(reqsWithDates);
        return reqsWithDates;
      } else {
        showMainMessage("Could not refresh requirements: data format unexpected.", "error");
      }
    } catch(err) {
      showMainMessage(`Error refreshing requirements: ${err.message}`, "error");
    }
    return [];
  }, [showMainMessage]);

  const fetchData = useCallback(async () => {
    setIsLoading(true); setError(null);
    try {
      const projectsResponse = await fetch(`${API_BASE_URL}/projects`);
      if (!projectsResponse.ok) throw new Error(`Project fetch failed: ${projectsResponse.statusText}`);
      const projectsResult = await projectsResponse.json();
      const officialProjects = projectsResult.data || [];

      const freshRequirements = await fetchRequirementsOnly();
      const projectsFromData = getUniqueProjects(freshRequirements);
      const combinedProjects = Array.from(new Set([...officialProjects, ...projectsFromData])).sort();
      setProjects(combinedProjects);

    } catch (err) {
        setError(err.message || "Failed to fetch data.");
        setAllProcessedRequirements([]);
        setProjects([]);
    }
    finally { setIsLoading(false); }
  }, [fetchRequirementsOnly]);

  const handleDataRefresh = useCallback(async (newItemDetails) => {
      await fetchRequirementsOnly(); 
      showMainMessage(`Successfully created: "${newItemDetails.title}"`, 'success');
      if (newItemDetails.project) {
          setSelectedProject(newItemDetails.project);
      }
      if (newItemDetails.sprint) {
          setSelectedSprint(newItemDetails.sprint);
      }
  }, [fetchRequirementsOnly, showMainMessage]);

  useEffect(() => {
    if (!hasFetched.current) {
      fetchData();
      hasFetched.current = true;
    }
  }, [fetchData]);

  useEffect(() => {
    let sprintsForProject = [];
    if (selectedProject) {
        sprintsForProject = getSprintsForProject(allProcessedRequirements, selectedProject);
    }

    const visibleSprints = showArchivedSprints 
        ? sprintsForProject 
        : sprintsForProject.filter(s => !s.startsWith('Archived_'));
    
    setAvailableSprints(visibleSprints);

    const projectChanged = prevSelectedProject.current !== selectedProject;
    
    if (projectChanged) {
        const params = new URLSearchParams(location.search);
        const sprintParam = params.get('sprint');

        if (visibleSprints.length > 0) {
            if (sprintParam && visibleSprints.includes(sprintParam)) {
                setSelectedSprint(sprintParam);
            } else {
                const nonArchivedSprints = visibleSprints.filter(s => !s.startsWith('Archived_'));
                if (nonArchivedSprints.length > 0) {
                    setSelectedSprint(nonArchivedSprints[nonArchivedSprints.length - 1]);
                } else if (visibleSprints.length > 0) {
                    setSelectedSprint(visibleSprints[0]);
                } else {
                    setSelectedSprint('');
                }
            }
        } else {
            setSelectedSprint('');
        }
    } else {
        if (selectedSprint && !visibleSprints.includes(selectedSprint)) {
            if (visibleSprints.length > 0) {
                const nonArchivedSprints = visibleSprints.filter(s => !s.startsWith('Archived_'));
                if (nonArchivedSprints.length > 0) {
                    setSelectedSprint(nonArchivedSprints[nonArchivedSprints.length - 1]);
                } else {
                    setSelectedSprint(visibleSprints[0]);
                }
            } else {
                setSelectedSprint('');
            }
        }
    }

    prevSelectedProject.current = selectedProject;
  }, [selectedProject, allProcessedRequirements, location.search, showArchivedSprints, selectedSprint]);

  useEffect(() => {
    if (isSearching && !isSearchUpdate.current) {
      resetSearch();
    }
  }, [selectedProject, selectedSprint]);

  useEffect(() => {
    if (allProcessedRequirements.length > 0) {
      const types = [...new Set(allProcessedRequirements.map(req => req.currentStatusDetails?.type).filter(Boolean))].sort();
      setAvailableTypes(types);
    }
  }, [allProcessedRequirements]);

  useEffect(() => {
    if (isSearching) return;
    if (selectedProject && selectedSprint && allProcessedRequirements.length > 0) {
      let filteredRequirements = allProcessedRequirements.filter(req => req.project === selectedProject && req.currentStatusDetails?.sprint === selectedSprint);
      
      if (selectedTypes.length > 0) {
        filteredRequirements = filteredRequirements.filter(req => selectedTypes.includes(req.currentStatusDetails?.type));
      }

      if (linkedDefectsFilter) {
        if (linkedDefectsFilter === 'yes') {
          filteredRequirements = filteredRequirements.filter(req => Array.isArray(req.linkedDefects) && req.linkedDefects.length > 0);
        } else {
          filteredRequirements = filteredRequirements.filter(req => !Array.isArray(req.linkedDefects) || req.linkedDefects.length === 0);
        }
      }

      if (selectedReleases.length > 0) {
        filteredRequirements = filteredRequirements.filter(req => selectedReleases.includes(req.currentStatusDetails.releaseId));
      }

      if (dateFrom) {
        filteredRequirements = filteredRequirements.filter(req => {
          const lastUpdated = new Date(req.currentStatusDetails.date);
          const fromDate = new Date(dateFrom);
          return lastUpdated >= fromDate;
        });
      }

      if (dateTo) {
        filteredRequirements = filteredRequirements.filter(req => {
          const lastUpdated = new Date(req.currentStatusDetails.date);
          const toDate = new Date(dateTo);
          return lastUpdated <= toDate;
        });
      }

      setDisplayableRequirements(filteredRequirements);
    } else { setDisplayableRequirements([]); }
  }, [selectedProject, selectedSprint, allProcessedRequirements, isSearching, selectedTypes, linkedDefectsFilter, selectedReleases, dateFrom, dateTo]);

  useEffect(() => {
    if (!selectedProject || !selectedSprint) {
      setFilterOptions({ enabledTypes: [], enabledReleases: [], isLinkedDefectsYesEnabled: false, isLinkedDefectsNoEnabled: false });
      return;
    }

    const baseItems = allProcessedRequirements.filter(
      req => req.project === selectedProject && req.currentStatusDetails?.sprint === selectedSprint
    );

    const applyFilters = (items, filtersToSkip = []) => {
      let filtered = items;
      if (!filtersToSkip.includes('types') && selectedTypes.length > 0) {
        filtered = filtered.filter(req => selectedTypes.includes(req.currentStatusDetails?.type));
      }
      if (!filtersToSkip.includes('defects') && linkedDefectsFilter) {
        if (linkedDefectsFilter === 'yes') {
          filtered = filtered.filter(req => Array.isArray(req.linkedDefects) && req.linkedDefects.length > 0);
        } else {
          filtered = filtered.filter(req => !Array.isArray(req.linkedDefects) || req.linkedDefects.length === 0);
        }
      }
      if (!filtersToSkip.includes('releases') && selectedReleases.length > 0) {
        filtered = filtered.filter(req => selectedReleases.includes(req.currentStatusDetails.releaseId));
      }
      return filtered;
    };

    const typesItems = applyFilters(baseItems, ['types']);
    const enabledTypes = [...new Set(typesItems.map(req => req.currentStatusDetails?.type).filter(Boolean))];

    const defectsItems = applyFilters(baseItems, ['defects']);
    const isLinkedDefectsYesEnabled = defectsItems.some(req => Array.isArray(req.linkedDefects) && req.linkedDefects.length > 0);
    const isLinkedDefectsNoEnabled = defectsItems.some(req => !Array.isArray(req.linkedDefects) || req.linkedDefects.length === 0);

    const releasesItems = applyFilters(baseItems, ['releases']);
    const enabledReleases = [...new Set(releasesItems.map(req => req.currentStatusDetails.releaseId).filter(Boolean))];

    setFilterOptions({ enabledTypes, enabledReleases, isLinkedDefectsYesEnabled, isLinkedDefectsNoEnabled });

  }, [selectedProject, selectedSprint, allProcessedRequirements, selectedTypes, linkedDefectsFilter, selectedReleases]);


  const handleShowHistory = useCallback((requirementGroup) => {
    setRequirementForHistory(requirementGroup); setIsHistoryModalOpen(true);
  }, []);
  const handleCloseHistoryModal = useCallback(() => {
    setIsHistoryModalOpen(false); setRequirementForHistory(null);
  }, []);

  const handleOpenEditModal = useCallback((requirement) => {
    setEditingRequirement(requirement);
    setIsEditModalOpen(true);
  }, []);

  const handleCloseEditModal = useCallback(() => {
    setIsEditModalOpen(false);
    setEditingRequirement(null);
  }, []);

  const handleSaveRequirementEdit = useCallback(async (formData) => {
    if (!editingRequirement) return;

    const { id, project, requirementUserIdentifier, currentStatusDetails } = editingRequirement;
    const { name, comment, sprint, status, link, isBacklog, type, tags, release_id } = formData;

    const newSprintValue = isBacklog ? 'Backlog' : `Sprint ${sprint}`;

    let somethingChanged = false;
    try {
      if (name.trim() !== requirementUserIdentifier) {
        somethingChanged = true;
        const renameResponse = await fetch(`${API_BASE_URL}/requirements/${id}/rename`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ newRequirementName: name.trim() })
        });
        if (!renameResponse.ok) throw new Error('Failed to rename requirement.');
      }

      if (status !== currentStatusDetails.status || newSprintValue !== currentStatusDetails.sprint) {
        somethingChanged = true;
        const activityPayload = {
          project: project,
          requirementName: name.trim(),
          status: status,
          sprint: newSprintValue,
          comment: comment,
          link: link,
          type: type,
          tags: tags,
          release_id: release_id || null,
          statusDate: new Date().toISOString().split('T')[0],
          existingRequirementGroupId: id
        };
        const activityResponse = await fetch(`${API_BASE_URL}/activities`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(activityPayload)
        });
        if (!activityResponse.ok) throw new Error('Failed to update status/sprint.');

      } else if (comment !== currentStatusDetails.comment || link !== (currentStatusDetails.link || '') || type !== (currentStatusDetails.type || '') || tags !== (currentStatusDetails.tags || '') || (release_id || null) !== (currentStatusDetails.releaseId || null)) {
        somethingChanged = true;
        const updatePayload = {
          comment: comment,
          link: link,
          type: type,
          tags: tags,
          release_id: release_id || null
        };
        const updateResponse = await fetch(`${API_BASE_URL}/activities/${currentStatusDetails.activityId}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatePayload)
        });
        if (!updateResponse.ok) throw new Error('Failed to update details.');
      }

      if (somethingChanged) {
        showMainMessage("Requirement updated successfully!", 'success');
        if (isSearching) {
          setDisplayableRequirements(prev => {
            return prev.map(req => {
              if (req.id === editingRequirement.id) {
                const newSprintValue = formData.isBacklog ? 'Backlog' : `Sprint ${formData.sprint}`;
                return {
                  ...req,
                  requirementUserIdentifier: formData.name,
                  currentStatusDetails: {
                    ...req.currentStatusDetails,
                    status: formData.status,
                    sprint: newSprintValue,
                    comment: formData.comment,
                    link: formData.link,
                    type: formData.type,
                    tags: formData.tags,
                    releaseId: formData.release_id || null
                  }
                };
              }
              return req;
            });
          });
        }
        await fetchData();
      } else {
        showMainMessage("No changes were made.", 'info');
      }

    } catch (error) {
      showMainMessage(`Error: ${error.message}`, 'error');
    } finally {
      handleCloseEditModal();
    }
  }, [editingRequirement, fetchData, showMainMessage, handleCloseEditModal]);

  const handleLogChange = useCallback(async (requirementGroupId, reason) => {
    if (!requirementGroupId) {
        showMainMessage("Cannot log change: Requirement ID is missing.", "error");
        return false;
    }
    try {
        const response = await fetch(`${API_BASE_URL}/requirements/${requirementGroupId}/changes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason }),
        });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || "Failed to log scope change.");
        }
        showMainMessage("Scope change logged successfully!", "success");
        await fetchData();
        return true;
    } catch (error) {
        showMainMessage(`Error: ${error.message}`, 'error');
        return false;
    }
  }, [fetchData, showMainMessage]);

  const handleSaveHistoryEntry = useCallback(async (requirementGroupId, activityDbId, newDate, newComment) => {
    if (!activityDbId) { showMainMessage("Error: Cannot update history. Missing activity DB ID.", 'error'); return; }
    try {
      const res = await fetch(`${API_BASE_URL}/activities/${activityDbId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ comment: newComment, statusDate: newDate.toISOString().split('T')[0] }) });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || "Failed to save history"); }
      await fetchData(); showMainMessage("History updated!", 'success');
    } catch (e) { showMainMessage(`Error: ${e.message}`, 'error'); }
  }, [fetchData, showMainMessage]);

  const handleOpenAddModal = useCallback(() => {
    setNewReqFormState({
        project: selectedProject,
        requirementName: '', status: 'To Do', sprint: '1', comment: '', link: '', isBacklog: false, type: '', tags: '', release_id: ''
    });
    setIsAddModalOpen(true);
  }, [selectedProject]);

  const handleCloseAddModal = useCallback(() => setIsAddModalOpen(false), []);
  const handleNewReqFormChange = useCallback((e) => {
    const { name, value, type, checked } = e.target;
    const val = type === 'checkbox' ? checked : value;
    setNewReqFormState(prev => ({ ...prev, [name]: val }));
  }, []);

  const handleAddNewRequirement = useCallback(async () => {
    const { project, requirementName, status, sprint, comment, link, isBacklog, type, tags, release_id } = newReqFormState;
    if (!project.trim() || !requirementName.trim() || !status.trim()) {
      showMainMessage("Project, Requirement Name, and Status are mandatory.", 'error');
      return;
    }

    const sprintValue = isBacklog ? 'Backlog' : `Sprint ${sprint}`;

    const payload = {
      project: project.trim(),
      requirementName: requirementName.trim(),
      status: status.trim(),
      sprint: sprintValue,
      comment: comment ? comment.trim() : null,
      link: link ? link.trim() : null,
      type: type ? type.trim() : null,
      tags: tags ? tags.trim() : null,
      release_id: release_id || null,
      statusDate: new Date().toISOString().split('T')[0]
    };

    try {
      const res = await fetch(`${API_BASE_URL}/activities`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const errText = await res.text();
        try { const errJson = JSON.parse(errText); throw new Error(errJson.error || "Failed to add requirement"); }
        catch (e) { throw new Error(`Failed to add requirement: ${errText}`); }
      }
      await fetchData();
      setSelectedProject(payload.project);
      setSelectedSprint(payload.sprint);
      handleCloseAddModal();
      showMainMessage("New requirement added!", 'success');
    } catch (e) {
      showMainMessage(`Error: ${e.message}`, 'error');
    }
  }, [newReqFormState, fetchData, showMainMessage, handleCloseAddModal]);

  const handleOpenAddProjectModal = useCallback(() => setIsAddProjectModalOpen(true), []);
  const handleCloseAddProjectModal = useCallback(() => setIsAddProjectModalOpen(false), []);

  const handleAddNewProject = useCallback(async (newProjectName) => {
    try {
        const response = await fetch(`${API_BASE_URL}/projects`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newProjectName }),
        });
        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || "Failed to add project.");
        }
        showMainMessage(`Project "${newProjectName}" added successfully.`, 'success');
        handleCloseAddProjectModal();
        await fetchData();
    } catch (error) {
        showMainMessage(`Error: ${error.message}`, 'error');
    }
  }, [fetchData, showMainMessage, handleCloseAddProjectModal]);

  const handleEditProject = async ({ originalName, newName }) => {
    try {
        const response = await fetch(`${API_BASE_URL}/projects/${encodeURIComponent(originalName)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ newName }),
        });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Failed to rename project.');
        }
        showMainMessage('Project renamed successfully!', 'success');
        await fetchData();
        setSelectedProject(newName);
        setIsEditProjectModalOpen(false);
    } catch (error) {
        showMainMessage(`Error: ${error.message}`, 'error');
    }
  };

  const handleOpenImportModal = useCallback(() => setIsImportModalOpen(true), []);
  const handleCloseImportModal = useCallback(() => {
    setIsImportModalOpen(false);
    setImportConfirmData(null);
  }, []);

  const handleOpenJiraImportModal = useCallback(() => setIsJiraImportModalOpen(true), []);
  const handleCloseJiraImportModal = useCallback(() => setIsJiraImportModalOpen(false), []);
  const handleJiraImportSuccess = useCallback(async (project, sprint) => {
      await fetchData();
      if (project) setSelectedProject(project);
      if (sprint) setSelectedSprint(sprint);
  }, [fetchData]);

  const executeImport = useCallback(async (file, project, sprint, release_id, importMode = 'all') => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('project', project);
    formData.append('sprint', sprint);
    formData.append('importMode', importMode);
    if (release_id) {
      formData.append('release_id', release_id);
    }

    try {
        const response = await fetch(`${API_BASE_URL}/import/requirements`, {
            method: 'POST',
            body: formData,
        });
        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.error || 'Failed to import file.');
        }
        showMainMessage(result.message, 'success');
        await fetchData();
        setSelectedProject(project);
        setSelectedSprint(sprint);
    } catch (error) {
        showMainMessage(`Import Error: ${error.message}`, 'error');
    } finally {
        handleCloseImportModal();
    }
  }, [fetchData, showMainMessage, handleCloseImportModal]);

  const handleValidateImport = useCallback(async (file, project, sprint, release_id) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('project', project);

    try {
        const response = await fetch(`${API_BASE_URL}/import/validate`, {
            method: 'POST',
            body: formData,
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Validation failed');

        const { newCount, duplicateCount, skippedCount } = result.data;

        if (newCount === 0 && duplicateCount === 0) {
            let message = "Import finished. No valid items found to import.";
            if (skippedCount > 0) message += ` Skipped items: ${skippedCount}.`;
            showMainMessage(message, 'info');
            handleCloseImportModal();
            return;
        }

        if (duplicateCount > 0) {
            setImportConfirmData({ file, project, sprint, release_id, ...result.data });
            setIsImportConfirmModalOpen(true);
        } else {
            executeImport(file, project, sprint, release_id, 'all');
        }
    } catch (error) {
        showMainMessage(`Validation Error: ${error.message}`, 'error');
        handleCloseImportModal();
    }
  }, [executeImport, showMainMessage, handleCloseImportModal]);

  const handleConfirmImportAllRequirements = () => {
    if (!importConfirmData) return;
    const { file, project, sprint, release_id } = importConfirmData;
    executeImport(file, project, sprint, release_id, 'all');
    setIsImportConfirmModalOpen(false);
    setImportConfirmData(null);
  };

  const handleConfirmImportNewOnlyRequirements = () => {
    if (!importConfirmData) return;
    const { file, project, sprint, release_id } = importConfirmData;
    executeImport(file, project, sprint, release_id, 'new_only');
    setIsImportConfirmModalOpen(false);
    setImportConfirmData(null);
  };

  const handleDeleteRequest = useCallback((type, item) => {
    setDeleteType(type);
    setItemToDelete(item);
    setIsDeleteConfirmModalOpen(true);
  }, []);

  const handleCancelDelete = useCallback(() => {
    setIsDeleteConfirmModalOpen(false);
    setItemToDelete(null);
    setDeleteType('');
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!itemToDelete) return;

    const currentItem = itemToDelete;
    const currentType = deleteType;
    let originalReleases = null;

    setIsDeleteConfirmModalOpen(false);
    setItemToDelete(null);
    setDeleteType('');

    if (currentType === 'release') {
      setIsEditReleaseModalOpen(false);
      originalReleases = [...allReleases];
      setAllReleases(prevReleases => prevReleases.filter(r => r.id !== currentItem.id));
    } else if (currentType === 'project') {
      setIsEditProjectModalOpen(false);
    }

    let url, successMessage, errorMessage;
    switch (currentType) {
        case 'requirement':
            url = `${API_BASE_URL}/requirements/${encodeURIComponent(String(currentItem.id))}`;
            successMessage = `Requirement '${currentItem.name}' deleted successfully.`;
            errorMessage = `Failed to delete requirement ${currentItem.name}`;
            break;
        case 'project':
            url = `${API_BASE_URL}/projects/${encodeURIComponent(currentItem.name)}`;
            successMessage = `Project '${currentItem.name}' and all its data deleted successfully.`;
            errorMessage = `Failed to delete project '${currentItem.name}'`;
            break;
        case 'release':
            url = `${API_BASE_URL}/releases/${currentItem.id}`;
            successMessage = `Release '${currentItem.name}' deleted successfully.`;
            errorMessage = `Failed to delete release ${currentItem.name}`;
            break;
        case 'archived-release':
            url = `${API_BASE_URL}/archives/${currentItem.id}`;
            successMessage = `Archived release '${currentItem.name}' deleted successfully.`;
            errorMessage = `Failed to delete archived release ${currentItem.name}`;
            break;
        default:
            return;
    }

    try {
        const response = await fetch(url, { method: 'DELETE' });
        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || errorMessage);
        }

        showMainMessage(successMessage, 'success');

        if (currentType === 'project') {
            setSelectedProject('');
            await fetchData();
        } else if (currentType === 'requirement') {
            const freshRequirements = await fetchRequirementsOnly();
            if (isSearching) {
                const lowerCaseQuery = requirementQuery.toLowerCase();
                const newSearchResults = freshRequirements.filter(req =>
                    req.requirementUserIdentifier.toLowerCase().includes(lowerCaseQuery)
                );
                setDisplayableRequirements(newSearchResults);
            }
        } else if (currentType === 'release' || currentType === 'archived-release') {
            await fetchData();
        }

    } catch (error) {
        showMainMessage(`Error: ${error.message}`, 'error');
        if (currentType === 'release' && originalReleases) {
            setAllReleases(originalReleases);
        }
    }
  }, [itemToDelete, deleteType, allReleases, fetchData, showMainMessage, isSearching, requirementQuery, fetchRequirementsOnly]);

  const getDeleteConfirmationMessage = () => {
    if (!itemToDelete) return '';
    switch (deleteType) {
        case 'requirement':
            return `Are you sure you want to delete requirement "${itemToDelete.name}" (Project: ${itemToDelete.project}) and all its history? This action cannot be undone.`;
        case 'project':
            return `Are you sure you want to delete the project "${itemToDelete.name}"? This will also delete ALL associated requirements, releases, notes, defects, and retrospective items permanently. This action cannot be undone.`;
        case 'release':
            return `Are you sure you want to delete the release "${itemToDelete.name}"? This will not delete the requirements, but will unlink them from this release. This action cannot be undone.`;
        case 'archived-release':
            return `Are you sure you want to permanently delete the archived release "${itemToDelete.name}"? This action cannot be undone.`;
        default:
            return 'Are you sure?';
    }
  };

  const handleAddRelease = async (releaseData) => {
    try {
        const response = await fetch(`${API_BASE_URL}/releases`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(releaseData)
        });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Failed to add release.');
        }
        showMainMessage('Release added successfully!', 'success');
        await fetchAllProjectData();
        setIsAddReleaseModalOpen(false);
    } catch (error) {
        showMainMessage(`Error: ${error.message}`, 'error');
    }
  };

  const handleEditRelease = async (releaseData) => {
    try {
        const response = await fetch(`${API_BASE_URL}/releases/${releaseData.id}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(releaseData)
        });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Failed to update release.');
        }
        showMainMessage('Release updated successfully!', 'success');
        await fetchAllProjectData();
        await fetchData();
        setIsEditReleaseModalOpen(false);
    } catch (error) {
        showMainMessage(`Error: ${error.message}`, 'error');
    }
  };

  useEffect(() => {
    if (isHistoryModalOpen && requirementForHistory) {
      const updatedReq = allProcessedRequirements.find(rg => rg.id === requirementForHistory.id);
      if (updatedReq) {
        if (JSON.stringify(updatedReq.history) !== JSON.stringify(requirementForHistory.history)) {
          setRequirementForHistory({...updatedReq});
        }
      } else {
        setIsHistoryModalOpen(false);
        setRequirementForHistory(null);
      }
    }
  }, [allProcessedRequirements, isHistoryModalOpen, requirementForHistory]);

  const handleTypeChange = (type) => {
    setSelectedTypes(prevSelectedTypes =>
      prevSelectedTypes.includes(type)
        ? prevSelectedTypes.filter(t => t !== type)
        : [...prevSelectedTypes, type]
    );
  };

  const handleLinkedDefectsChange = (value) => {
    setLinkedDefectsFilter(prev => (prev === value ? null : value));
  };

  const handleReleaseChange = (releaseId) => {
    setSelectedReleases(prev =>
      prev.includes(releaseId)
        ? prev.filter(id => id !== releaseId)
        : [...prev, releaseId]
    );
  };

  const handleRequirementSearch = (query) => {
    const finalQuery = query || requirementQuery;
    if (!finalQuery) {
      handleClearRequirementSearch();
      return;
    }
    setIsSearching(true);
    setSearchSuggestions([]);
    const lowerCaseQuery = finalQuery.toLowerCase();
    const results = allProcessedRequirements.filter(req =>
      req.requirementUserIdentifier.toLowerCase().includes(lowerCaseQuery)
    );
    setDisplayableRequirements(results);

    isSearchUpdate.current = true;

    if (results.length > 0) {
      const uniqueProjects = [...new Set(results.map(r => r.project))];
      if (uniqueProjects.length === 1) {
        setSelectedProject(uniqueProjects[0]);
        const uniqueSprints = [...new Set(results.map(r => r.currentStatusDetails.sprint))];
        if (uniqueSprints.length === 1) {
          setSelectedSprint(uniqueSprints[0]);
        } else {
          setSelectedSprint('');
        }
      } else {
        setSelectedProject('');
        setSelectedSprint('');
      }
    } else {
      setSelectedProject('');
      setSelectedSprint('');
    }

    setTimeout(() => {
      isSearchUpdate.current = false;
    }, 0);
  };

  const handleClearRequirementSearch = () => {
    setIsSearching(false);
    setRequirementQuery('');
    setSearchSuggestions([]);
    setSelectedProject('');
    setSelectedSprint('');
    setDisplayableRequirements([]);
    setSelectedTypes([]);
    setLinkedDefectsFilter(null);
    setSelectedReleases([]);
    setDateFrom('');
    setDateTo('');
  };

  const resetSearch = () => {
    setIsSearching(false);
    setRequirementQuery('');
    setSearchSuggestions([]);
  };

  const handleClearFilters = () => {
    setSelectedTypes([]);
    setLinkedDefectsFilter(null);
    setSelectedReleases([]);
    setDateFrom('');
    setDateTo('');
  };

  const handleRequirementQueryChange = (query) => {
    setRequirementQuery(query);
    if (query.length < 3) {
      setSearchSuggestions([]);
      return;
    }
    const lowerCaseQuery = query.toLowerCase();

    let sourceData = allProcessedRequirements;
    if (selectedProject) {
      sourceData = sourceData.filter(req => req.project === selectedProject);
      if (selectedSprint) {
        sourceData = sourceData.filter(req => req.currentStatusDetails.sprint === selectedSprint);
      }
    }

    const suggestions = sourceData
      .filter(req => req.requirementUserIdentifier.toLowerCase().includes(lowerCaseQuery))
      .map(req => ({
        id: req.id,
        name: req.requirementUserIdentifier,
        context: `${req.project} / ${req.currentStatusDetails.sprint}`
      }))
      .slice(0, 10);
    setSearchSuggestions(suggestions);
  };

  const handleRequirementSuggestionSelect = (suggestion) => {
    setRequirementQuery(suggestion.name);
    setSearchSuggestions([]);

    isSearchUpdate.current = true;

    const selectedReq = allProcessedRequirements.find(req => req.id === suggestion.id);

    if (selectedReq) {
      setDisplayableRequirements([selectedReq]);
      setSelectedProject(selectedReq.project);
      setSelectedSprint(selectedReq.currentStatusDetails.sprint);
      setIsSearching(true);
    } else {
      handleRequirementSearch(suggestion.name);
    }

    setTimeout(() => {
      isSearchUpdate.current = false;
    }, 0);
  };

  const handleStatusUpdateRequest = (requirement, newStatus) => {
    setStatusUpdateInfo({ requirement, newStatus });
    setIsUpdateStatusModalOpen(true);
  };

  const handleCloseUpdateStatusModal = () => {
    setIsUpdateStatusModalOpen(false);
    setStatusUpdateInfo({ requirement: null, newStatus: '' });
  };

  const handleConfirmStatusUpdate = async (comment) => {
    const { requirement, newStatus } = statusUpdateInfo;
    if (!requirement) return;

    const payload = {
      project: requirement.project,
      requirementName: requirement.requirementUserIdentifier,
      status: newStatus,
      sprint: requirement.currentStatusDetails.sprint,
      comment: comment,
      link: requirement.currentStatusDetails.link,
      type: requirement.currentStatusDetails.type,
      tags: requirement.currentStatusDetails.tags,
      release_id: requirement.currentStatusDetails.releaseId,
      statusDate: new Date().toISOString().split('T')[0],
      existingRequirementGroupId: requirement.id
    };

    try {
      const response = await fetch(`${API_BASE_URL}/activities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        throw new Error('Failed to update status.');
      }
      showMainMessage('Status updated successfully!', 'success');

      if (isSearching) {
        setDisplayableRequirements(prev => {
          return prev.map(req => {
            if (req.id === requirement.id) {
              return {
                ...req,
                currentStatusDetails: {
                  ...req.currentStatusDetails,
                  status: newStatus
                }
              };
            }
            return req;
          });
        });
      }

      await fetchData();
    } catch (error) {
      showMainMessage(`Error: ${error.message}`, 'error');
    } finally {
      handleCloseUpdateStatusModal();
    }
  };

  const handleNavigateToRequirement = (req) => {
    if (!req || !req.project || !req.currentStatusDetails?.sprint || !req.id) {
      showMainMessage("Could not navigate. Requirement data is incomplete.", "error");
      return;
    }
    const targetPath = `/?project=${encodeURIComponent(req.project)}&sprint=${encodeURIComponent(req.currentStatusDetails.sprint)}&highlight=${req.id}`;
    navigate(targetPath);
  };

  const handleNavigateToDefect = (defect, isClosed = false) => {
    if (!defect || !defect.project || !defect.id) {
      showMainMessage("Could not navigate. Defect data is incomplete.", "error");
      return;
    }
    let targetPath = `/defects?project=${encodeURIComponent(defect.project)}&highlight=${defect.id}`;
    if (isClosed) {
      targetPath += '&view=closed';
    }
    navigate(targetPath);
  };

  if (isLoading) { return (<div id="app-container-loading-id" className="app-container"><AppNavigationBar /><div className="loading-message">Loading data...</div></div>); }
  if (error && !isLoading) { return (<div id="app-container-error-id" className="app-container"><AppNavigationBar /><div className="error-message-global full-page-error">{error} <button onClick={fetchData}>Try Again</button></div></div>); }

  return (
    <div id="app-container-main-id" className="app-container">
      <AppNavigationBar />
      <Toast key={toastInfo.key} message={toastInfo.message} type={toastInfo.type} onDismiss={handleDismissToast} />
      <Routes>
        <Route
          path="/"
          element={
            <SprintActivitiesPage
              projects={projects}
              selectedProject={selectedProject}
              onSelectProject={setSelectedProject}
              availableSprints={availableSprints}
              selectedSprint={selectedSprint}
              onSelectSprint={setSelectedSprint}
              requirementQuery={requirementQuery}
              onQueryChange={handleRequirementQueryChange}
              onSearch={handleRequirementSearch}
              onClear={handleClearRequirementSearch}
              onSuggestionSelect={handleRequirementSuggestionSelect}
              searchSuggestions={searchSuggestions}
              onOpenAddProjectModal={handleOpenAddProjectModal}
              onOpenAddModal={handleOpenAddModal}
              onOpenImportModal={handleOpenImportModal}
              onOpenJiraImportModal={handleOpenJiraImportModal}
              onOpenAddReleaseModal={() => setIsAddReleaseModalOpen(true)}
              onOpenEditReleaseModal={() => setIsEditReleaseModalOpen(true)}
              onOpenEditProjectModal={() => setIsEditProjectModalOpen(true)}
              onToggleFilterSidebar={() => setIsFilterSidebarOpen(prev => !prev)}
              isSearching={isSearching}
              displayableRequirements={displayableRequirements}
              onShowHistory={handleShowHistory}
              onEditRequirement={handleOpenEditModal}
              onDeleteRequirement={(id, project, name) => handleDeleteRequest('requirement', { id, project, name })}
              onStatusUpdateRequest={handleStatusUpdateRequest}
              projectReleases={projectReleases}
              allProcessedRequirements={allProcessedRequirements}
              hasAnyReleases={allReleases.length > 0}
              showArchivedSprints={showArchivedSprints}
              onSetShowArchived={setShowArchivedSprints}
            />
          }
        />
        <Route path="/defects" element={<DefectsPage projects={projects} allRequirements={allProcessedRequirements} showMessage={showMainMessage} onDefectUpdate={fetchRequirementsOnly} />} />
        <Route path="/sprint-analysis" element={<SprintAnalysisPage projects={projects} showMessage={showMainMessage} />} />
        <Route path="/notes" element={<NotesPage projects={projects} apiBaseUrl={API_BASE_URL} showMessage={showMainMessage} />} />
        <Route path="/releases" element={
          <ReleasesPage
            projects={projects}
            allProcessedRequirements={allProcessedRequirements}
            showMainMessage={showMainMessage}
            onNavigateToRequirement={handleNavigateToRequirement}
            onNavigateToDefect={handleNavigateToDefect}
            onEditRelease={handleEditRelease}
            onDeleteRelease={(release) => handleDeleteRequest('release', release)}
            onDeleteArchivedRelease={(release) => handleDeleteRequest('archived-release', release)}
            fetchData={fetchData}
          />
        } />
      </Routes>
      <HistoryModal requirement={requirementForHistory} isOpen={isHistoryModalOpen} onClose={handleCloseHistoryModal} onSaveHistoryEntry={handleSaveHistoryEntry} apiBaseUrl={API_BASE_URL} />
      <AddNewRequirementModal isOpen={isAddModalOpen} onClose={handleCloseAddModal} formData={newReqFormState} onFormChange={handleNewReqFormChange} onSubmit={handleAddNewRequirement} projects={projects} releases={allReleases} />
      <AddProjectModal isOpen={isAddProjectModalOpen} onClose={handleCloseAddProjectModal} onAddProject={handleAddNewProject} />
      <ImportRequirementsModal isOpen={isImportModalOpen} onClose={handleCloseImportModal} onImport={handleValidateImport} projects={projects} releases={allReleases} currentProject={selectedProject} />
      <JiraImportModal isOpen={isJiraImportModalOpen} onClose={handleCloseJiraImportModal} onImportSuccess={handleJiraImportSuccess} projects={projects} releases={allReleases} currentProject={selectedProject} importType="requirements" showMessage={showMainMessage} />
      <AddReleaseModal isOpen={isAddReleaseModalOpen} onClose={() => setIsAddReleaseModalOpen(false)} onAdd={handleAddRelease} projects={projects} currentProject={selectedProject} />
      <EditReleaseModal isOpen={isEditReleaseModalOpen} onClose={() => setIsEditReleaseModalOpen(false)} onSave={handleEditRelease} onDelete={(release) => handleDeleteRequest('release', release)} releases={allReleases} projects={projects} currentProject={selectedProject} />
      <EditProjectModal
        isOpen={isEditProjectModalOpen}
        onClose={() => setIsEditProjectModalOpen(false)}
        onSave={handleEditProject}
        onDelete={(project) => handleDeleteRequest('project', project)}
        projects={projects}
        currentProject={selectedProject}
      />
      {isImportConfirmModalOpen && importConfirmData && (
          <div className="confirmation-modal-overlay" onClick={() => setIsImportConfirmModalOpen(false)}>
              <div className="confirmation-modal-content" onClick={e => e.stopPropagation()}>
                  <h3>Confirm Requirement Import</h3>
                  <p>
                      The file contains {importConfirmData.newCount} new requirement(s) and {importConfirmData.duplicateCount} duplicate(s).
                      {importConfirmData.skippedCount > 0 && ` ${importConfirmData.skippedCount} row(s) were skipped due to invalid type.`}
                  </p>
                  <p>How would you like to proceed?</p>
                  <div className="modal-actions" style={{ justifyContent: 'center', gap: '12px' }}>
                      <button onClick={handleConfirmImportAllRequirements} className="modal-button-confirm" style={{ backgroundColor: '#c0392b' }}>
                          Import All
                      </button>
                      {importConfirmData.newCount > 0 && (
                          <button onClick={handleConfirmImportNewOnlyRequirements} className="modal-button-confirm" style={{ backgroundColor: '#A0522D' }}>
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
      <EditRequirementModal isOpen={isEditModalOpen} onClose={handleCloseEditModal} onSave={handleSaveRequirementEdit} requirement={editingRequirement} releases={projectReleases} onLogChange={handleLogChange} showMessage={showMainMessage} />
      <UpdateStatusModal isOpen={isUpdateStatusModalOpen} onClose={handleCloseUpdateStatusModal} onSave={handleConfirmStatusUpdate} requirement={statusUpdateInfo.requirement} newStatus={statusUpdateInfo.newStatus} showMessage={showMainMessage} />
      <ConfirmationModal isOpen={isDeleteConfirmModalOpen} onClose={handleCancelDelete} onConfirm={handleConfirmDelete} title={`Confirm ${deleteType.charAt(0).toUpperCase() + deleteType.slice(1)} Deletion`} message={getDeleteConfirmationMessage()} />
      <FilterSidebar
        isOpen={isFilterSidebarOpen}
        onClose={() => setIsFilterSidebarOpen(false)}
        types={availableTypes}
        selectedTypes={selectedTypes}
        onTypeChange={handleTypeChange}
        enabledTypes={filterOptions.enabledTypes}
        linkedDefectsFilter={linkedDefectsFilter}
        onLinkedDefectsChange={handleLinkedDefectsChange}
        isLinkedDefectsYesEnabled={filterOptions.isLinkedDefectsYesEnabled}
        isLinkedDefectsNoEnabled={filterOptions.isLinkedDefectsNoEnabled}
        releases={projectReleases}
        selectedReleases={selectedReleases}
        onReleaseChange={handleReleaseChange}
        enabledReleases={filterOptions.enabledReleases}
        dateFrom={dateFrom}
        dateTo={dateTo}
        onDateFromChange={setDateFrom}
        onDateToChange={setDateTo}
        onClearFilters={handleClearFilters}
      />
      <Chatbot 
        selectedProject={selectedProject} 
        onDataChange={handleDataRefresh} 
        firstProjectName={projects.length > 0 ? projects[0] : ''}
        className={isFilterSidebarOpen ? 'sidebar-open' : ''}
      />
    </div>
  );
}

export default App;
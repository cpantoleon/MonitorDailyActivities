import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import './App.css';
import './index.css';
import './pages/SprintBoardPage.css';
import { GlobalProvider } from './context/GlobalContext';
import Sidebar from './components/Sidebar';
import DashboardPage from './pages/DashboardPage';
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
import Chatbot from './components/Chatbot';
import FilterSidebar from './components/FilterSidebar';
import './components/FilterSidebar.css';
import SprintActivitiesPage from './pages/SprintBoardPage';

ChartJS.register(ArcElement, ChartTooltip, Legend, Title, BarElement, CategoryScale, LinearScale);

const API_BASE_URL = '/api';

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
  const [newReqFormState, setNewReqFormState] = useState({ project: '', requirementName: '', status: 'To Do', sprint: '1', comment: '', link: '', isBacklog: false, type: '', tags: '', release_id: '' });
  const [isAddProjectModalOpen, setIsAddProjectModalOpen] = useState(false);
  const [isEditProjectModalOpen, setIsEditProjectModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isJiraImportModalOpen, setIsJiraImportModalOpen] = useState(false);
  const [isAddReleaseModalOpen, setIsAddReleaseModalOpen] = useState(false);
  const [isEditReleaseModalOpen, setIsEditReleaseModalOpen] = useState(false);
  
  const [toastInfo, setToastInfo] = useState({ message: null, type: 'success', key: null });
  const [isDeleteConfirmModalOpen, setIsDeleteConfirmModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [deleteType, setDeleteType] = useState('');
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
  const [filterOptions, setFilterOptions] = useState({ enabledTypes: [], enabledReleases: [], isLinkedDefectsYesEnabled: false, isLinkedDefectsNoEnabled: false });

  const hasFetched = useRef(false);
  const location = useLocation();
  const navigate = useNavigate();
  const isSearchUpdate = useRef(false);

  // 1. Ενημέρωση state από το URL
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const projectParam = params.get('project');
    const sprintParam = params.get('sprint');
    const highlightId = params.get('highlight');
    let needsReplace = false;

    if (sprintParam && sprintParam.startsWith('Archived_')) {
      setShowArchivedSprints(true);
    }

    if (projectParam && projectParam !== selectedProject) {
      setSelectedProject(projectParam);
    }
    if (sprintParam && sprintParam !== selectedSprint) {
      setSelectedSprint(sprintParam);
    }
    
    if (highlightId) {
      setHighlightedReqId(highlightId);
      params.delete('highlight');
      needsReplace = true;
    }
    
    if (needsReplace) {
      const newSearch = params.toString() ? `?${params.toString()}` : '';
      navigate(`${location.pathname}${newSearch}`, { replace: true });
    }
  }, [location.search, navigate]);

  // 2. Υπολογισμός διαθέσιμων Sprints
  useEffect(() => {
    let sprintsForProject = [];
    if (selectedProject) {
        sprintsForProject = getSprintsForProject(allProcessedRequirements, selectedProject);
    }

    const visibleSprints = showArchivedSprints
        ? sprintsForProject
        : sprintsForProject.filter(s => !s.startsWith('Archived_'));

    setAvailableSprints(visibleSprints);

    // Fallback: Αν το επιλεγμένο sprint δεν υπάρχει (π.χ. απενεργοποίησε το show archived)
    if (selectedProject && selectedSprint && !visibleSprints.includes(selectedSprint)) {
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
  }, [selectedProject, allProcessedRequirements, showArchivedSprints]); 

  // --- MANUAL SELECTION HANDLERS ---
  
  // Όταν ο χρήστης αλλάζει χειροκίνητα Project, βρες το τελευταίο Sprint και φόρτωσε το
  const handleManualProjectSelect = useCallback((project) => {
    setSelectedProject(project);

    if (!project) {
        setSelectedSprint('');
        navigate(`/sprint-board`, { replace: true });
        return;
    }

    const sprintsForProject = getSprintsForProject(allProcessedRequirements, project);
    const visibleSprints = showArchivedSprints
        ? sprintsForProject
        : sprintsForProject.filter(s => !s.startsWith('Archived_'));

    let sprintToSelect = '';
    if (visibleSprints.length > 0) {
        const nonArchivedSprints = visibleSprints.filter(s => !s.startsWith('Archived_'));
        if (nonArchivedSprints.length > 0) {
            sprintToSelect = nonArchivedSprints[nonArchivedSprints.length - 1]; // Τελευταίο ενεργό
        } else {
            sprintToSelect = visibleSprints[0];
        }
    }

    setSelectedSprint(sprintToSelect);

    const newUrl = `/sprint-board?project=${encodeURIComponent(project)}&sprint=${encodeURIComponent(sprintToSelect)}`;
    navigate(newUrl, { replace: true });

  }, [allProcessedRequirements, showArchivedSprints, navigate]);

  // Όταν ο χρήστης αλλάζει χειροκίνητα Sprint
  const handleManualSprintSelect = useCallback((sprint) => {
    setSelectedSprint(sprint);
    if (selectedProject) {
        const newUrl = `/sprint-board?project=${encodeURIComponent(selectedProject)}&sprint=${encodeURIComponent(sprint)}`;
        navigate(newUrl, { replace: true });
    }
  }, [selectedProject, navigate]);


  // Effect για highlighting
  useEffect(() => {
    if (highlightedReqId && displayableRequirements.length > 0) {
        const timer = setTimeout(() => {
            const element = document.getElementById(`req-card-${highlightedReqId}`);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                element.classList.add('highlight-item');
                setTimeout(() => element.classList.remove('highlight-item'), 3000);
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
    if (projects.length === 0) { setAllReleases([]); return; }
    try {
        const releasePromises = projects.map(p => fetch(`${API_BASE_URL}/releases/${p}`).then(res => res.json()));
        const results = await Promise.all(releasePromises);
        const all = results.flatMap(result => result.data || []);
        setAllReleases(all);
    } catch (error) { showMainMessage('Could not load full release list.', 'error'); }
  }, [projects, showMainMessage]);

  useEffect(() => { fetchAllProjectData(); }, [fetchAllProjectData]);

  useEffect(() => {
      if (selectedProject) setProjectReleases(allReleases.filter(r => r.project === selectedProject));
      else setProjectReleases([]);
  }, [selectedProject, allReleases]);

  const fetchRequirementsOnly = useCallback(async () => {
    try {
      const requirementsResponse = await fetch(`${API_BASE_URL}/requirements`);
      if (!requirementsResponse.ok) throw new Error(`Requirements fetch failed`);
      const requirementsResult = await requirementsResponse.json();

      if (requirementsResult.data && Array.isArray(requirementsResult.data)) {
        const reqsWithDates = requirementsResult.data.map(group => ({
            ...group,
            project: group.project ? String(group.project).trim() : '',
            requirementUserIdentifier: group.requirementUserIdentifier ? String(group.requirementUserIdentifier).trim() : 'Unnamed',
            history: group.history.map((hist, index) => ({
                ...hist, date: new Date(hist.date), createdAt: hist.createdAt ? new Date(hist.createdAt) : new Date(hist.date), id: `${group.id}_hist_${hist.activityId || `idx_${index}`}`, activityId: hist.activityId
            })),
            currentStatusDetails: group.currentStatusDetails ? {
                ...group.currentStatusDetails, date: new Date(group.currentStatusDetails.date), createdAt: group.currentStatusDetails.createdAt ? new Date(group.currentStatusDetails.createdAt) : new Date(group.currentStatusDetails.date), activityId: group.currentStatusDetails.activityId
            } : { status: 'N/A', sprint: 'N/A', comment: '', link: '', date: new Date(), createdAt: new Date(), activityId: null }
        }));
        setAllProcessedRequirements(reqsWithDates);
        return reqsWithDates;
      }
    } catch(err) { showMainMessage(`Error refreshing requirements: ${err.message}`, "error"); }
    return [];
  }, [showMainMessage]);

  const fetchData = useCallback(async () => {
    setIsLoading(true); setError(null);
    try {
      const projectsResponse = await fetch(`${API_BASE_URL}/projects`);
      const projectsResult = await projectsResponse.json();
      const officialProjects = projectsResult.data || [];
      const freshRequirements = await fetchRequirementsOnly();
      const projectsFromData = getUniqueProjects(freshRequirements);
      const combinedProjects = Array.from(new Set([...officialProjects, ...projectsFromData])).sort();
      setProjects(combinedProjects);
    } catch (err) {
        setError(err.message || "Failed to fetch data.");
        setAllProcessedRequirements([]); setProjects([]);
    } finally { setIsLoading(false); }
  }, [fetchRequirementsOnly]);

  const handleDataRefresh = useCallback(async (newItemDetails) => {
      await fetchRequirementsOnly(); 
      showMainMessage(`Successfully created: "${newItemDetails.title}"`, 'success');
      
      if (newItemDetails.project && newItemDetails.sprint) {
         handleManualProjectSelect(newItemDetails.project); // Forces selection of project and latest sprint safely
      }
  }, [fetchRequirementsOnly, showMainMessage, handleManualProjectSelect]);

  useEffect(() => {
    if (!hasFetched.current) { fetchData(); hasFetched.current = true; }
  }, [fetchData]);

  useEffect(() => { if (isSearching && !isSearchUpdate.current) resetSearch(); }, [selectedProject, selectedSprint]);

  useEffect(() => {
    if (allProcessedRequirements.length > 0) {
      const types = [...new Set(allProcessedRequirements.map(req => req.currentStatusDetails?.type).filter(Boolean))].sort();
      setAvailableTypes(types);
    }
  }, [allProcessedRequirements]);

  useEffect(() => {
    if (selectedProject && selectedSprint && allProcessedRequirements.length > 0) {
      const baseReqs = allProcessedRequirements.filter(req => req.project === selectedProject && req.currentStatusDetails?.sprint === selectedSprint);
      const types = new Set();
      const releaseIds = new Set();
      let hasLinkedDefects = false;
      let hasNoLinkedDefects = false;
  
      baseReqs.forEach(req => {
        if (req.currentStatusDetails?.type) types.add(req.currentStatusDetails.type);
        if (req.currentStatusDetails?.releaseId) releaseIds.add(req.currentStatusDetails.releaseId);
        if (Array.isArray(req.linkedDefects) && req.linkedDefects.length > 0) hasLinkedDefects = true
        else hasNoLinkedDefects = true;
      });

      setFilterOptions({
        enabledTypes: Array.from(types),
        enabledReleases: Array.from(releaseIds),
        isLinkedDefectsYesEnabled: hasLinkedDefects,
        isLinkedDefectsNoEnabled: hasNoLinkedDefects
       });
      } else {
        setFilterOptions({ enabledTypes: [], enabledReleases: [], isLinkedDefectsYesEnabled: false, isLinkedDefectsNoEnabled: false });
      }
    }, [selectedProject, selectedSprint, allProcessedRequirements]);

  useEffect(() => {
    if (isSearching) return;
    if (selectedProject && selectedSprint && allProcessedRequirements.length > 0) {
      let filteredRequirements = allProcessedRequirements.filter(req => req.project === selectedProject && req.currentStatusDetails?.sprint === selectedSprint);
      if (selectedTypes.length > 0) filteredRequirements = filteredRequirements.filter(req => selectedTypes.includes(req.currentStatusDetails?.type));
      if (linkedDefectsFilter) {
        if (linkedDefectsFilter === 'yes') filteredRequirements = filteredRequirements.filter(req => Array.isArray(req.linkedDefects) && req.linkedDefects.length > 0);
        else filteredRequirements = filteredRequirements.filter(req => !Array.isArray(req.linkedDefects) || req.linkedDefects.length === 0);
      }
      if (selectedReleases.length > 0) filteredRequirements = filteredRequirements.filter(req => selectedReleases.includes(req.currentStatusDetails.releaseId));
      if (dateFrom) filteredRequirements = filteredRequirements.filter(req => new Date(req.currentStatusDetails.date) >= new Date(dateFrom));
      if (dateTo) filteredRequirements = filteredRequirements.filter(req => new Date(req.currentStatusDetails.date) <= new Date(dateTo));
      setDisplayableRequirements(filteredRequirements);
    } else { setDisplayableRequirements([]); }
  }, [selectedProject, selectedSprint, allProcessedRequirements, isSearching, selectedTypes, linkedDefectsFilter, selectedReleases, dateFrom, dateTo]);

  const handleTypeChange = (type) => { setSelectedTypes(prev => prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]); };
  const handleLinkedDefectsChange = (value) => { setLinkedDefectsFilter(prev => (prev === value ? null : value)); };
  const handleReleaseChange = (releaseId) => { setSelectedReleases(prev => prev.includes(releaseId) ? prev.filter(id => id !== releaseId) : [...prev, releaseId]); };
  
  const handleRequirementSearch = (query) => {
    const finalQuery = query || requirementQuery;
    if (!finalQuery) { handleClearRequirementSearch(); return; }
    setIsSearching(true); setSearchSuggestions([]);
    const results = allProcessedRequirements.filter(req => req.requirementUserIdentifier.toLowerCase().includes(finalQuery.toLowerCase()));
    setDisplayableRequirements(results);
    isSearchUpdate.current = true;
    if (results.length > 0) {
      const uniqueProjects = [...new Set(results.map(r => r.project))];
      if (uniqueProjects.length === 1) {
        setSelectedProject(uniqueProjects[0]);
        const uniqueSprints = [...new Set(results.map(r => r.currentStatusDetails.sprint))];
        if (uniqueSprints.length === 1) setSelectedSprint(uniqueSprints[0]);
        else setSelectedSprint('');
      } else { setSelectedProject(''); setSelectedSprint(''); }
    } else { setSelectedProject(''); setSelectedSprint(''); }
    setTimeout(() => { isSearchUpdate.current = false; }, 0);
  };

  const handleClearRequirementSearch = () => { setIsSearching(false); setRequirementQuery(''); setSearchSuggestions([]); setSelectedProject(''); setSelectedSprint(''); setDisplayableRequirements([]); setSelectedTypes([]); setLinkedDefectsFilter(null); setSelectedReleases([]); setDateFrom(''); setDateTo(''); };
  const resetSearch = () => { setIsSearching(false); setRequirementQuery(''); setSearchSuggestions([]); };
  const handleClearFilters = () => { setSelectedTypes([]); setLinkedDefectsFilter(null); setSelectedReleases([]); setDateFrom(''); setDateTo(''); };
  
  const handleRequirementQueryChange = (query) => {
    setRequirementQuery(query);
    if (query.length < 3) { setSearchSuggestions([]); return; }
    let sourceData = allProcessedRequirements;
    if (selectedProject) {
      sourceData = sourceData.filter(req => req.project === selectedProject);
      if (selectedSprint) sourceData = sourceData.filter(req => req.currentStatusDetails.sprint === selectedSprint);
    }
    setSearchSuggestions(sourceData.filter(req => req.requirementUserIdentifier.toLowerCase().includes(query.toLowerCase())).map(req => ({ id: req.id, name: req.requirementUserIdentifier, context: `${req.project} / ${req.currentStatusDetails.sprint}` })).slice(0, 10));
  };

  const handleRequirementSuggestionSelect = (suggestion) => {
    setRequirementQuery(suggestion.name); setSearchSuggestions([]); isSearchUpdate.current = true;
    const selectedReq = allProcessedRequirements.find(req => req.id === suggestion.id);
    if (selectedReq) { setDisplayableRequirements([selectedReq]); setSelectedProject(selectedReq.project); setSelectedSprint(selectedReq.currentStatusDetails.sprint); setIsSearching(true); } 
    else { handleRequirementSearch(suggestion.name); }
    setTimeout(() => { isSearchUpdate.current = false; }, 0);
  };

  const handleShowHistory = useCallback((req) => { setRequirementForHistory(req); setIsHistoryModalOpen(true); }, []);
  const handleCloseHistoryModal = useCallback(() => { setIsHistoryModalOpen(false); setRequirementForHistory(null); }, []);
  const handleOpenEditModal = useCallback((req) => { setEditingRequirement(req); setIsEditModalOpen(true); }, []);
  const handleCloseEditModal = useCallback(() => { setIsEditModalOpen(false); setEditingRequirement(null); }, []);
  
  const handleOpenAddModal = useCallback(() => {
    setNewReqFormState({
      project: selectedProject || '', requirementName: '', status: 'To Do', sprint: '1', comment: '', link: '', isBacklog: false, type: '', tags: '', release_id: ''
    });
    setIsAddModalOpen(true);
  }, [selectedProject]);

  const handleCloseAddModal = useCallback(() => {
    setIsAddModalOpen(false);
    setNewReqFormState({ project: '', requirementName: '', status: 'To Do', sprint: '1', comment: '', link: '', isBacklog: false, type: '', tags: '', release_id: '' });
  }, []);
  
  const handleNewReqFormChange = useCallback((e) => { 
    const { name, value, type, checked } = e.target; 
    setNewReqFormState(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value })); 
  }, []);
  
  const handleOpenAddProjectModal = useCallback(() => setIsAddProjectModalOpen(true), []);
  const handleCloseAddProjectModal = useCallback(() => setIsAddProjectModalOpen(false), []);
  
  const handleOpenImportModal = useCallback(() => setIsImportModalOpen(true), []);
  const handleCloseImportModal = useCallback(() => { setIsImportModalOpen(false); setImportConfirmData(null); }, []);
  
  const handleOpenJiraImportModal = useCallback(() => setIsJiraImportModalOpen(true), []);
  const handleCloseJiraImportModal = useCallback(() => setIsJiraImportModalOpen(false), []);
  
  const handleDeleteRequest = useCallback((type, item) => { setDeleteType(type); setItemToDelete(item); setIsDeleteConfirmModalOpen(true); }, []);
  const handleCancelDelete = useCallback(() => { setIsDeleteConfirmModalOpen(false); setItemToDelete(null); setDeleteType(''); }, []);
  
  const handleStatusUpdateRequest = (requirement, newStatus) => { setStatusUpdateInfo({ requirement, newStatus }); setIsUpdateStatusModalOpen(true); };
  const handleCloseUpdateStatusModal = () => { setIsUpdateStatusModalOpen(false); setStatusUpdateInfo({ requirement: null, newStatus: '' }); };

  const handleNavigateToRequirement = (req) => { navigate(`/sprint-board?project=${encodeURIComponent(req.project)}&sprint=${encodeURIComponent(req.currentStatusDetails.sprint)}&highlight=${req.id}`); };
  const handleNavigateToDefect = (defect, isClosed = false) => { navigate(`/defects?project=${encodeURIComponent(defect.project)}&highlight=${defect.id}${isClosed ? '&view=closed' : ''}`); };

  const handleConfirmStatusUpdate = async (comment) => {
    const { requirement, newStatus } = statusUpdateInfo;
    if (!requirement) return;
    const payload = { project: requirement.project, requirementName: requirement.requirementUserIdentifier, status: newStatus, sprint: requirement.currentStatusDetails.sprint, comment: comment, link: requirement.currentStatusDetails.link, type: requirement.currentStatusDetails.type, tags: requirement.currentStatusDetails.tags, release_id: requirement.currentStatusDetails.releaseId, statusDate: new Date().toISOString().split('T')[0], existingRequirementGroupId: requirement.id };
    try {
      const response = await fetch(`${API_BASE_URL}/activities`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!response.ok) throw new Error('Failed to update status.');
      showMainMessage('Status updated successfully!', 'success');
      if (isSearching) { setDisplayableRequirements(prev => prev.map(req => req.id === requirement.id ? { ...req, currentStatusDetails: { ...req.currentStatusDetails, status: newStatus } } : req)); }
      await fetchData();
    } catch (error) { showMainMessage(`Error: ${error.message}`, 'error'); } 
    finally { handleCloseUpdateStatusModal(); }
  };

  const handleSaveRequirementEdit = useCallback(async (formData) => {
    try {
      if (formData.name !== editingRequirement.requirementUserIdentifier) {
        await fetch(`${API_BASE_URL}/requirements/${editingRequirement.id}/rename`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ newRequirementName: formData.name })
        });
      }
      const newSprint = formData.isBacklog ? 'Backlog' : (formData.sprint.startsWith('Sprint') ? formData.sprint : `Sprint ${formData.sprint}`);
      const payload = {
        project: editingRequirement.project, requirementName: formData.name, status: formData.status,
        sprint: newSprint, comment: formData.comment, link: formData.link, type: formData.type,
        tags: formData.tags, release_id: formData.release_id, statusDate: new Date().toISOString().split('T')[0],
        existingRequirementGroupId: editingRequirement.id
      };
      const response = await fetch(`${API_BASE_URL}/activities`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to update requirement');
      
      showMainMessage('Requirement updated successfully!', 'success');
      fetchData();
    } catch (error) {
       showMainMessage(`Error: ${error.message}`, 'error');
    } finally {
      handleCloseEditModal();
    }
  }, [editingRequirement, fetchData, handleCloseEditModal, showMainMessage]);

  const handleLogChange = useCallback(async (requirementGroupId, reason) => {
    if (!requirementGroupId) {
        showMainMessage("Cannot log change: Requirement ID is missing.", "error");
        return false;
    }
    try {
        const response = await fetch(`${API_BASE_URL}/requirements/${requirementGroupId}/changes`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason }),
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

  const handleSaveHistoryEntry = useCallback(async (id, dbId, date, comment) => {
    if (!activityDbId) { showMainMessage("Error: Cannot update history. Missing activity DB ID.", 'error'); return; }
    try {
      const formattedDate = new Date(date).toISOString().split('T')[0];
      const res = await fetch(`${API_BASE_URL}/activities/${dbId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ comment, statusDate: formattedDate }) });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || "Failed to save history"); }
      await fetchData(); showMainMessage("History updated!", 'success');
    } catch (e) { showMainMessage(`Error: ${e.message}`, 'error'); }
  }, [fetchData, showMainMessage]);

  const handleAddNewRequirement = useCallback(async () => {
    const targetProject = newReqFormState.project;
    const targetSprint = newReqFormState.isBacklog ? 'Backlog' : `Sprint ${newReqFormState.sprint}`;

    try {
      const response = await fetch(`${API_BASE_URL}/activities`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project: targetProject, requirementName: newReqFormState.requirementName, status: newReqFormState.status,
          sprint: targetSprint, comment: newReqFormState.comment, link: newReqFormState.link, type: newReqFormState.type,
          tags: newReqFormState.tags, release_id: newReqFormState.release_id, statusDate: new Date().toISOString().split('T')[0]
        }),
      });
      
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to add requirement');
      
      showMainMessage('Requirement added successfully!', 'success');
      
      await fetchRequirementsOnly();
      
      // Navigate to the precise board
      navigate(`/sprint-board?project=${encodeURIComponent(targetProject)}&sprint=${encodeURIComponent(targetSprint)}`, { replace: true });

    } catch (error) {
      showMainMessage(`Error: ${error.message}`, 'error');
    } finally {
      handleCloseAddModal();
    }
  }, [newReqFormState, fetchRequirementsOnly, handleCloseAddModal, showMainMessage, navigate]);

  const handleAddNewProject = useCallback(async (name) => {
    try {
      const response = await fetch(`${API_BASE_URL}/projects`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to add project');
      showMainMessage('Project added successfully!', 'success');
      fetchData();
    } catch (error) {
      showMainMessage(`Error: ${error.message}`, 'error');
    } finally {
      handleCloseAddProjectModal();
    }
  }, [fetchData, handleCloseAddProjectModal, showMainMessage]);

  const handleEditProject = async ({ originalName, newName }) => {
    try {
      const response = await fetch(`${API_BASE_URL}/projects/${encodeURIComponent(originalName)}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ newName }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to edit project');
      showMainMessage('Project updated successfully!', 'success');
      fetchData();
    } catch (error) {
      showMainMessage(`Error: ${error.message}`, 'error');
    } finally {
      setIsEditProjectModalOpen(false);
    }
  };

  const executeImport = useCallback(async (file, project, sprint, release_id, importMode = 'all') => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('project', project);
    formData.append('sprint', sprint);
    if (release_id) formData.append('release_id', release_id);
    formData.append('importMode', importMode);
    
    try {
      const response = await fetch(`${API_BASE_URL}/import/requirements`, { method: 'POST', body: formData });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Import failed');
      showMainMessage(result.message, 'success');
      fetchData();
      
      navigate(`/sprint-board?project=${encodeURIComponent(project)}&sprint=${encodeURIComponent(sprint)}`, { replace: true });
    } catch (error) {
      showMainMessage(`Import Error: ${error.message}`, 'error');
    } finally {
      setIsImportModalOpen(false);
      setIsImportConfirmModalOpen(false);
      setImportConfirmData(null);
    }
  }, [fetchData, showMainMessage, navigate]);

  const handleValidateImport = useCallback(async (file, project, sprint, release_id) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('project', project);
    try {
      const response = await fetch(`${API_BASE_URL}/import/validate`, { method: 'POST', body: formData });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Validation failed');
      
      setImportConfirmData({ file, project, sprint, release_id, ...result.data });
      
      if (result.data.newCount === 0 && result.data.duplicateCount === 0) {
        showMainMessage(`No valid requirements found to import. Skipped: ${result.data.skippedCount}`, "info");
        setIsImportModalOpen(false);
        return;
      }
      
      if (result.data.duplicateCount > 0) {
        setIsImportConfirmModalOpen(true);
      } else {
        executeImport(file, project, sprint, release_id, 'all');
      }
    } catch (error) {
      showMainMessage(`Validation Error: ${error.message}`, 'error');
    }
  }, [executeImport, showMainMessage]);

  const handleConfirmDelete = useCallback(async () => {
    setIsDeleteConfirmModalOpen(false);
    if (!itemToDelete) return;
    try {
      let url = '';
      if (deleteType === 'project') url = `${API_BASE_URL}/projects/${encodeURIComponent(itemToDelete.name)}`;
      else if (deleteType === 'requirement') url = `${API_BASE_URL}/requirements/${itemToDelete.id}`;
      else if (deleteType === 'release') url = `${API_BASE_URL}/releases/${itemToDelete.id}`;
      else if (deleteType === 'archived-release') url = `${API_BASE_URL}/archives/${itemToDelete.id}`;

      const response = await fetch(url, { method: 'DELETE' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || `Failed to delete ${deleteType}`);
      showMainMessage(`${deleteType.charAt(0).toUpperCase() + deleteType.slice(1).replace('-', ' ')} deleted successfully!`, 'success');
      fetchData();
      if(deleteType === 'release' || deleteType === 'archived-release') fetchAllProjectData();
    } catch (error) {
      showMainMessage(`Error: ${error.message}`, 'error');
    } finally {
      setItemToDelete(null);
      setDeleteType('');
    }
  }, [itemToDelete, deleteType, fetchData, fetchAllProjectData, showMainMessage]);

  const handleAddRelease = async (releaseData) => {
    try {
      const response = await fetch(`${API_BASE_URL}/releases`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(releaseData),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to add release');
      showMainMessage('Release added successfully!', 'success');
      fetchAllProjectData();
    } catch (error) {
      showMainMessage(`Error: ${error.message}`, 'error');
    } finally {
      setIsAddReleaseModalOpen(false);
    }
  };

  const handleEditRelease = async (releaseData) => {
    try {
      const response = await fetch(`${API_BASE_URL}/releases/${releaseData.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(releaseData),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to edit release');
      showMainMessage('Release updated successfully!', 'success');
      fetchAllProjectData();
      fetchData();
    } catch (error) {
      showMainMessage(`Error: ${error.message}`, 'error');
    } finally {
      setIsEditReleaseModalOpen(false);
    }
  };

  const handleJiraImportSuccess = useCallback(async (project, sprint) => { 
      await fetchData(); 
      if(project && sprint) {
        navigate(`/sprint-board?project=${encodeURIComponent(project)}&sprint=${encodeURIComponent(sprint)}`, { replace: true });
      }
  }, [fetchData, navigate]);

  const getDeleteConfirmationMessage = () => {
    if (!itemToDelete) return '';
    switch (deleteType) {
        case 'requirement': return `Are you sure you want to delete requirement "${itemToDelete.name}" (Project: ${itemToDelete.project}) and all its history? This action cannot be undone.`;
        case 'project': return `Are you sure you want to delete the project "${itemToDelete.name}"? This will also delete ALL associated requirements, releases, notes, defects, and retrospective items permanently. This action cannot be undone.`;
        case 'release': return `Are you sure you want to delete the release "${itemToDelete.name}"? This will not delete the requirements, but will unlink them from this release. This action cannot be undone.`;
        case 'archived-release': return `Are you sure you want to permanently delete the archived release "${itemToDelete.name}"? This action cannot be undone.`;
        default: return 'Are you sure?';
    }
  };

if (isLoading) { 
    return (
      <GlobalProvider>
        <div id="app-container-loading-id" style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg-primary)' }}>
          <Sidebar />
          <div className="main-layout-content">
            <div className="loading-message">Loading data...</div>
          </div>
        </div>
      </GlobalProvider>
    ); 
  }

  if (error && !isLoading) { 
    return (
      <GlobalProvider>
        <div id="app-container-error-id" style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg-primary)' }}>
          <Sidebar />
          <div className="main-layout-content">
            <div className="error-message-global full-page-error">
              {error} <button onClick={fetchData}>Try Again</button>
            </div>
          </div>
        </div>
      </GlobalProvider>
    ); 
  }
  
  return (
    <GlobalProvider>
      <div id="app-wrapper" style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg-primary)' }}>
        
        <Sidebar />

        <div className="main-layout-content">
          <Toast key={toastInfo.key} message={toastInfo.message} type={toastInfo.type} onDismiss={handleDismissToast} />
          
          <Routes>
            <Route path="/" element={
              <DashboardPage 
                projects={projects} 
                allReleases={allReleases} 
                allProcessedRequirements={allProcessedRequirements} 
                onNavigateToRequirement={handleNavigateToRequirement}
                onNavigateToDefect={handleNavigateToDefect}
              />
            } />
            
            <Route path="/sprint-board" element={
              <SprintActivitiesPage
                projects={projects} 
                selectedProject={selectedProject} 
                onSelectProject={handleManualProjectSelect} // <-- ΕΝΗΜΕΡΩΜΕΝΟ HANDLER
                availableSprints={availableSprints} 
                selectedSprint={selectedSprint} 
                onSelectSprint={handleManualSprintSelect} // <-- ΕΝΗΜΕΡΩΜΕΝΟ HANDLER
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
            } />
            
            <Route path="/defects" element={<DefectsPage projects={projects} allRequirements={allProcessedRequirements} showMessage={showMainMessage} onDefectUpdate={fetchRequirementsOnly} />} />
            <Route path="/sprint-analysis" element={<SprintAnalysisPage projects={projects} showMessage={showMainMessage} />} />
            <Route path="/notes" element={<NotesPage projects={projects} apiBaseUrl={API_BASE_URL} showMessage={showMainMessage} />} />
            <Route path="/releases" element={<ReleasesPage projects={projects} allProcessedRequirements={allProcessedRequirements} showMessage={showMainMessage} onNavigateToRequirement={handleNavigateToRequirement} onNavigateToDefect={handleNavigateToDefect} onEditRelease={handleEditRelease} onDeleteRelease={(release) => handleDeleteRequest('release', release)} onDeleteArchivedRelease={(release) => handleDeleteRequest('archived-release', release)} fetchData={fetchData} />} />
            
            <Route path="/:projectName" element={
              <DashboardPage 
                projects={projects} 
                allReleases={allReleases} 
                allProcessedRequirements={allProcessedRequirements} 
                onNavigateToRequirement={handleNavigateToRequirement}
                onNavigateToDefect={handleNavigateToDefect}
              />
            } />
          </Routes>
        </div>

        <HistoryModal requirement={requirementForHistory} isOpen={isHistoryModalOpen} onClose={handleCloseHistoryModal} onSaveHistoryEntry={handleSaveHistoryEntry} apiBaseUrl={API_BASE_URL} />
        <AddNewRequirementModal isOpen={isAddModalOpen} onClose={handleCloseAddModal} formData={newReqFormState} onFormChange={handleNewReqFormChange} onSubmit={handleAddNewRequirement} projects={projects} releases={allReleases} />
        <AddProjectModal isOpen={isAddProjectModalOpen} onClose={handleCloseAddProjectModal} onAddProject={handleAddNewProject} />
        <ImportRequirementsModal isOpen={isImportModalOpen} onClose={handleCloseImportModal} onImport={handleValidateImport} projects={projects} releases={allReleases} currentProject={selectedProject} />
        <JiraImportModal isOpen={isJiraImportModalOpen} onClose={handleCloseJiraImportModal} onImportSuccess={handleJiraImportSuccess} projects={projects} releases={allReleases} currentProject={selectedProject} importType="requirements" showMessage={showMainMessage} />
        <AddReleaseModal isOpen={isAddReleaseModalOpen} onClose={() => setIsAddReleaseModalOpen(false)} onAdd={handleAddRelease} projects={projects} currentProject={selectedProject} />
        <EditReleaseModal isOpen={isEditReleaseModalOpen} onClose={() => setIsEditReleaseModalOpen(false)} onSave={handleEditRelease} onDelete={(release) => handleDeleteRequest('release', release)} releases={allReleases} projects={projects} currentProject={selectedProject} />
        <EditProjectModal isOpen={isEditProjectModalOpen} onClose={() => setIsEditProjectModalOpen(false)} onSave={handleEditProject} onDelete={(project) => handleDeleteRequest('project', project)} projects={projects} currentProject={selectedProject} />
        <EditRequirementModal isOpen={isEditModalOpen} onClose={handleCloseEditModal} onSave={handleSaveRequirementEdit} requirement={editingRequirement} releases={projectReleases} onLogChange={handleLogChange} showMessage={showMainMessage} />
        <UpdateStatusModal isOpen={isUpdateStatusModalOpen} onClose={handleCloseUpdateStatusModal} onSave={handleConfirmStatusUpdate} requirement={statusUpdateInfo.requirement} newStatus={statusUpdateInfo.newStatus} showMessage={showMainMessage} />
        <FilterSidebar isOpen={isFilterSidebarOpen} onClose={() => setIsFilterSidebarOpen(false)} types={availableTypes} selectedTypes={selectedTypes} onTypeChange={handleTypeChange} enabledTypes={filterOptions.enabledTypes} linkedDefectsFilter={linkedDefectsFilter} onLinkedDefectsChange={handleLinkedDefectsChange} isLinkedDefectsYesEnabled={filterOptions.isLinkedDefectsYesEnabled} isLinkedDefectsNoEnabled={filterOptions.isLinkedDefectsNoEnabled} releases={projectReleases} selectedReleases={selectedReleases} onReleaseChange={handleReleaseChange} enabledReleases={filterOptions.enabledReleases} dateFrom={dateFrom} dateTo={dateTo} onDateFromChange={setDateFrom} onDateToChange={setDateTo} onClearFilters={handleClearFilters} />
        
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
                      <button onClick={() => { executeImport(importConfirmData.file, importConfirmData.project, importConfirmData.sprint, importConfirmData.release_id, 'all'); }} className="modal-button-confirm" style={{ backgroundColor: '#c0392b' }}>
                          Import All (Rename Duplicates)
                      </button>
                      {importConfirmData.newCount > 0 && (
                          <button onClick={() => { executeImport(importConfirmData.file, importConfirmData.project, importConfirmData.sprint, importConfirmData.release_id, 'new_only'); }} className="modal-button-confirm" style={{ backgroundColor: '#A0522D' }}>
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

        <ConfirmationModal isOpen={isDeleteConfirmModalOpen} onClose={handleCancelDelete} onConfirm={handleConfirmDelete} title={`Confirm ${deleteType.charAt(0).toUpperCase() + deleteType.slice(1)} Deletion`} message={getDeleteConfirmationMessage()} />
        <Chatbot selectedProject={selectedProject} onDataChange={handleDataRefresh} firstProjectName={projects.length > 0 ? projects[0] : ''} className={isFilterSidebarOpen ? 'sidebar-open' : ''} />
      </div>
    </GlobalProvider>
  );
}

export default App;
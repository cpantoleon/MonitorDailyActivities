import React, { useState, useEffect, useRef } from 'react';
import '../App.css';
import './SprintBoardPage.css';
import ProjectSelector from '../components/ProjectSelector';
import SprintSelector from '../components/SprintSelector';
import KanbanBoard from '../components/KanbanBoard';
import SearchComponent from '../components/SearchComponent';
import Tooltip from '../components/Tooltip';
import { Chart as ChartJS, ArcElement, Tooltip as ChartTooltip, Legend, Title, BarElement, CategoryScale, LinearScale } from 'chart.js';
import { Pie, Bar } from 'react-chartjs-2';
import FilterSidebar from '../components/FilterSidebar';
import '../components/FilterSidebar.css';

ChartJS.register(ArcElement, ChartTooltip, Legend, Title, BarElement, CategoryScale, LinearScale);

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
  projects, selectedProject, onSelectProject, availableSprints, selectedSprint, onSelectSprint,
  requirementQuery, onQueryChange, onSearch, onClear, onSuggestionSelect, searchSuggestions,
  onOpenAddProjectModal, onOpenAddModal, onOpenImportModal, onOpenJiraImportModal, onOpenAddReleaseModal,
  onOpenEditReleaseModal, onOpenEditProjectModal, onToggleFilterSidebar, isSearching, displayableRequirements,
  onShowHistory, onEditRequirement, onDeleteRequirement, onStatusUpdateRequest, projectReleases,
  allProcessedRequirements, hasAnyReleases, showArchivedSprints, onSetShowArchived,
}) => {
  const [showCharts, setShowCharts] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Detect theme changes for Chart.js colors
  useEffect(() => {
    const checkTheme = () => {
      const theme = document.documentElement.getAttribute('data-theme');
      setIsDarkMode(theme === 'dark');
    };
    checkTheme(); // Initial check
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  // Dynamic Chart Colors based on Theme
  const chartColors = isDarkMode ? {
    done: '#68D391',       // Light Green
    todo: '#FC8181',       // Light Red
    text: '#E2E8F0',       // Light Gray text
    scopeBar: 'rgba(251, 146, 60, 0.8)',   // Orange
    scopeBorder: 'rgba(251, 146, 60, 1)',
    grid: '#4A5568'        // Dark grid lines
  } : {
    done: '#151078',       // Dark Blue
    todo: '#b84459',       // Dark Red
    text: '#2D3748',       // Dark Gray text
    scopeBar: 'rgba(255, 99, 132, 0.7)',   // Pink/Red
    scopeBorder: 'rgba(255, 99, 132, 1)',
    grid: '#E2E8F0'        // Light grid lines
  };

  const sprintChartTooltipContent = (
    <div id="sprint-chart-tooltip-content-id">
      <strong>Sprint Activity Charts</strong>
      <p>These charts provide a visual summary of the current sprint and release progress.</p>
      <ul>
        <li><strong>Current Sprint:</strong> A pie chart showing the completion status ('Done' vs. 'To Be Tested') of requirements in the selected sprint.</li>
        <li><strong>Active Release:</strong> A pie chart showing the completion status of all requirements assigned to the active release for this project.</li>
        <li><strong>Scope Changes:</strong> A bar chart that highlights requirements within the current sprint that have undergone scope changes.</li>
      </ul>
    </div>
  );

  // 1. Helper for Pie Charts
  const getChartData = (reqs) => {
    if (!reqs || reqs.length === 0) return null;
    let done = 0; let notDone = 0;
    reqs.forEach(req => { if (req.currentStatusDetails?.status === 'Done') { done++; } else { notDone++; } });
    if (done === 0 && notDone === 0) return null;
    return {
      labels: ['Done', 'To Be Tested'],
      datasets: [{ data: [done, notDone], backgroundColor: [chartColors.done, chartColors.todo], borderColor: isDarkMode ? 'rgba(0,0,0,0)' : '#ffffff', borderWidth: 2 }],
    };
  };

  // 2. Helper to aggressively find the change count from the API
  const getChangeCount = (r) => {
    // Check direct properties (handles number or array of changes)
    const propsToCheck = ['changeCount', 'change_count', 'scopeChanges', 'scope_changes'];
    for (const prop of propsToCheck) {
        const val = r[prop] || (r.currentStatusDetails ? r.currentStatusDetails[prop] : undefined);
        if (val !== undefined && val !== null) {
            if (Array.isArray(val)) return val.length;
            if (!isNaN(val) && Number(val) > 0) return Number(val);
        }
    }

    // Fallback: Check history for "scope change" activities if no direct count exists
    if (r.history && Array.isArray(r.history)) {
        return r.history.filter(h => 
            (h.activity_type && h.activity_type.toLowerCase().includes('scope')) || 
            (h.type && h.type.toLowerCase().includes('scope')) || 
            (h.comment && String(h.comment).toLowerCase().includes('scope change'))
        ).length;
    }
    return 0;
  };

  // 3. Helper for Bar Chart 
  const getChangeChartData = (reqs) => {
    const changedReqs = reqs.filter(r => getChangeCount(r) > 0);
    if (changedReqs.length === 0) return null;

    changedReqs.sort((a, b) => getChangeCount(b) - getChangeCount(a));

    const splitLabelIntoLines = (label, maxCharsPerLine = 22) => {
        const words = label.split(' ');
        const lines = [];
        let currentLine = '';
        for (const word of words) {
            if ((currentLine + ' ' + word).length > maxCharsPerLine && currentLine.length > 0) {
                lines.push(currentLine); currentLine = word;
            } else {
                currentLine = currentLine ? currentLine + ' ' + word : word;
            }
        }
        if (currentLine) lines.push(currentLine);
        return lines;
    };

    const fullLabels = changedReqs.map(r => r.requirementUserIdentifier);
    const multilineLabels = fullLabels.map(label => splitLabelIntoLines(label));

    return {
        labels: multilineLabels,
        datasets: [{
            label: 'Number of Scope Changes',
            data: changedReqs.map(r => getChangeCount(r)),
            backgroundColor: chartColors.scopeBar,
            borderColor: chartColors.scopeBorder,
            borderWidth: 1,
            fullLabels: fullLabels,
        }],
    };
  };

  const baseChartOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top', labels: { color: chartColors.text } },
      title: { display: true, font: { size: 16 }, color: chartColors.text },
      tooltip: { callbacks: { label: (c) => `${c.label}: ${c.parsed} (${((c.parsed / c.dataset.data.reduce((a, b) => a + b, 0)) * 100).toFixed(1)}%)` } }
    },
  };

  // --- DATA CALCULATIONS ---
  const sprintChartData = getChartData(displayableRequirements);
  const sprintChartOptions = { ...baseChartOptions, plugins: { ...baseChartOptions.plugins, title: { ...baseChartOptions.plugins.title, text: `Current Sprint: ${selectedSprint}` } } };

  // Aggressive check to find which release is active (checks true, 1, "true", "Active")
  const activeRelease = projectReleases.find(r => 
      String(r.is_current) === 'true' || r.is_current === 1 || 
      String(r.isCurrent) === 'true' || r.isCurrent === 1 ||
      String(r.status).toLowerCase() === 'active'
  );
  
  // Aggressive match to link requirements to the active release ID or Name
  const releaseRequirements = activeRelease
    ? allProcessedRequirements.filter(r => {
        const det = r.currentStatusDetails || {};
        const rId = det.releaseId || det.release_id || r.releaseId || r.release_id;
        const rName = det.releaseName || det.release_name || r.releaseName || r.release_name;
        
        return (rId && String(rId) === String(activeRelease.id)) || 
               (rName && rName === activeRelease.name);
      })
    : [];
  
  const releaseChartData = getChartData(releaseRequirements);
  const releaseChartOptions = { ...baseChartOptions, plugins: { ...baseChartOptions.plugins, title: { ...baseChartOptions.plugins.title, text: `Active Release: ${activeRelease?.name || 'N/A'}` } } };

  const changeChartData = getChangeChartData(displayableRequirements);
  const changeChartOptions = {
    indexAxis: 'y', responsive: true, maintainAspectRatio: false,
    plugins: {
        legend: { display: false, labels: { color: chartColors.text } },
        title: { display: true, text: `Scope Changes in Sprint: ${selectedSprint}`, font: { size: 16 }, color: chartColors.text },
        tooltip: { callbacks: {
                title: function(context) { return context[0].dataset.fullLabels[context[0].dataIndex]; },
                label: function(context) { return (context.dataset.label || '') + ': ' + context.parsed.x; }
            }
        }
    },
    scales: { x: { beginAtZero: true, ticks: { stepSize: 1, color: chartColors.text }, grid: { color: chartColors.grid } }, y: { ticks: { color: chartColors.text }, grid: { display: false } } }
  };

  // --- DEBUGGER ---
  // Open your browser console (F12) to see why data might be missing!
  useEffect(() => {
      if (showCharts) {
          console.log("📊 CHART DEBUGGER:");
          console.log("1. Project Releases from DB:", projectReleases);
          console.log("2. Did we find an Active Release?", activeRelease ? "YES: " + activeRelease.name : "NO (Check if 'is_current' is set in DB)");
          console.log("3. Requirements inside Active Release:", releaseRequirements.length);
          console.log("4. Scope Changes per requirement:", displayableRequirements.map(req => ({ name: req.requirementUserIdentifier, changeCount: getChangeCount(req) })));
      }
  }, [showCharts, projectReleases, activeRelease, releaseRequirements, displayableRequirements]);

  return (
    <div id="main-content-area-id" className="main-content-area">
      <style>{`
        /* Defect Tags in Kanban Board */
        .linked-item-tag.defect {
          border: 1px solid var(--border-color);
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 0.85em;
          cursor: pointer;
          transition: all 0.2s;
        }

        /* Open (Not Done) - Red */
        .linked-item-tag.defect.open {
          background-color: #FED7D7;
          color: #C53030;
          border-color: #FEB2B2;
        }
        .linked-item-tag.defect.open:hover {
          background-color: #C53030;
          color: #FFFFFF;
        }

        /* Done - Green */
        .linked-item-tag.defect.done {
          background-color: #C6F6D5;
          color: #2F855A;
          border-color: #9AE6B4;
        }
        .linked-item-tag.defect.done:hover {
          background-color: #2F855A;
          color: #FFFFFF;
        }

        /* Closed - White with Strikethrough */
        .linked-item-tag.defect.closed {
          background-color: #FFFFFF;
          color: #718096;
          border-color: #E2E8F0;
          text-decoration: line-through;
        }
        .linked-item-tag.defect.closed:hover {
          background-color: #E2E8F0;
          text-decoration: none;
        }
      `}</style>
      <div className="selection-controls">
        <div className="selection-group-container">
          <ProjectSelector projects={projects} selectedProject={selectedProject} onSelectProject={onSelectProject} />
          <SprintSelector sprints={availableSprints} selectedSprint={selectedSprint} onSelectSprint={onSelectSprint} disabled={!selectedProject || projects.length === 0} />
          <SearchComponent
            query={requirementQuery} onQueryChange={onQueryChange} onSearch={onSearch}
            onClear={onClear} onSuggestionSelect={onSuggestionSelect} suggestions={searchSuggestions}
            placeholder="Search requirements..."
          />
          <button onClick={onToggleFilterSidebar} className="btn-primary filter-toggle-button" disabled={!selectedProject || !selectedSprint}>Filter</button>
          <div className="show-archived-container">
            <input type="checkbox" id="show-archived-sprints" checked={showArchivedSprints} onChange={(e) => onSetShowArchived(e.target.checked)} disabled={!selectedProject || projects.length === 0} />
            <label htmlFor="show-archived-sprints">Show Archived</label>
          </div>
        </div>
        <div className="page-actions-group">
           <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
               <Tooltip content={sprintChartTooltipContent} position="bottom" />
               <button onClick={() => setShowCharts(p => !p)} className="btn-primary" disabled={!selectedProject || !selectedSprint}>
                   {showCharts ? 'Hide' : 'Show'} Charts
               </button>
           </div>
          <OptionsMenu
            onOpenAddProjectModal={onOpenAddProjectModal} onOpenAddModal={onOpenAddModal} onOpenImportModal={onOpenImportModal}
            onOpenJiraImportModal={onOpenJiraImportModal} onOpenAddReleaseModal={onOpenAddReleaseModal} onOpenEditReleaseModal={onOpenEditReleaseModal}
            onOpenEditProjectModal={onOpenEditProjectModal} selectedProject={selectedProject} hasProjects={projects.length > 0} hasAnyReleases={hasAnyReleases}
          />
        </div>
      </div>

      {showCharts && selectedProject && selectedSprint && (
        <div id="sprint-charts-wrapper-id" className="charts-wrapper">
          {sprintChartData && (
            <div id="sprint-chart-container-id" className="chart-container">
              <div className="chart-canvas-wrapper" style={{ position: 'relative', height: '100%', width: '100%' }}>
                <Pie data={sprintChartData} options={sprintChartOptions} />
              </div>
            </div>
          )}
          {releaseChartData && (
            <div id="release-chart-container-id" className="chart-container">
              <div className="chart-canvas-wrapper" style={{ position: 'relative', height: '100%', width: '100%' }}>
                <Pie data={releaseChartData} options={releaseChartOptions} />
              </div>
            </div>
          )}
          {changeChartData && (
            <div id="change-chart-container-id" className="chart-container">
              <div className="chart-canvas-wrapper" style={{ position: 'relative', height: '100%', width: '100%' }}>
                <Bar data={changeChartData} options={changeChartOptions} />
              </div>
            </div>
          )}
          {!sprintChartData && !releaseChartData && !changeChartData && (
            <div id="no-sprint-chart-data-container-id" className="chart-container" style={{ flexBasis: '100%', height: 'auto' }}>
              <p>No chart data available for the selected sprint.</p>
            </div>
          )}
        </div>
      )}

      {isSearching && displayableRequirements.length === 0 && (
        <div className="empty-column-message">No results found for your search.</div>
      )}
      
      <KanbanBoard requirements={displayableRequirements} onShowHistory={onShowHistory} onEditRequirement={onEditRequirement} onDeleteRequirement={onDeleteRequirement} isSearching={isSearching} onStatusUpdateRequest={onStatusUpdateRequest} />
    </div>
  );
};

export default SprintActivitiesPage;
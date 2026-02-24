import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useGlobal } from '../context/GlobalContext';
import ProjectSelector from '../components/ProjectSelector';
import WeatherWidget from '../components/WeatherWidget';
import DailyInfoWidget from '../components/DailyInfoWidget';
import './DashboardPage.css';
import { Chart as ChartJS, ArcElement, Tooltip as ChartTooltip, Legend } from 'chart.js';
import { Pie } from 'react-chartjs-2';

ChartJS.register(ArcElement, ChartTooltip, Legend);

const API_BASE_URL = '/api';

const DashboardPage = ({ projects, allReleases, allProcessedRequirements, onNavigateToRequirement, onNavigateToDefect }) => {
  const { globalProject, setGlobalProject } = useGlobal();
  const { projectName } = useParams();
  const navigate = useNavigate();
  const [allDefects, setAllDefects] = useState([]);
  const [isDarkMode, setIsDarkMode] = useState(false);
  
  // NEW: State to track which chart segment is clicked for filtering
  const [chartFilter, setChartFilter] = useState(null); // null defaults to 'Pending'

  useEffect(() => {
    const checkTheme = () => {
      const theme = document.documentElement.getAttribute('data-theme');
      setIsDarkMode(theme === 'dark');
    };
    checkTheme();
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  const chartTextColor = isDarkMode ? '#E2E8F0' : '#2D3748';
  const chartBorderColor = isDarkMode ? '#1E1E1E' : '#FFFFFF';

  useEffect(() => {
    fetch(`${API_BASE_URL}/defects/all`)
      .then(res => res.json())
      .then(data => setAllDefects(data.data || []))
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (projectName) {
        const decoded = decodeURIComponent(projectName);
        if (decoded !== globalProject) {
            setGlobalProject(decoded);
        }
    } else {
        if (globalProject !== '') {
            setGlobalProject('');
        }
    }
  }, [projectName, globalProject, setGlobalProject]); 

  // NEW: Reset the chart filter back to default when switching projects
  useEffect(() => {
    setChartFilter(null);
  }, [globalProject]);

  const handleProjectSelect = (projName) => {
      if (projName) {
          navigate(`/${encodeURIComponent(projName)}`);
      } else {
          navigate(`/`);
      }
  };

  const activeDefectsAll = useMemo(() => {
    return allDefects.filter(d => d.status !== 'Done' && d.status !== 'Closed');
  }, [allDefects]);

  const currentProjectDefectList = useMemo(() => {
    if (!globalProject) return [];
    return activeDefectsAll.filter(d => d.project === globalProject);
  }, [activeDefectsAll, globalProject]);

  const currentProjectActiveRelease = useMemo(() => {
    if (!globalProject) return null;
    return allReleases.find(r => r.project === globalProject && r.is_current);
  }, [allReleases, globalProject]);

  // UPDATED: Now filters based on the chart selection (Done vs Pending)
  const currentProjectFilteredReqsList = useMemo(() => {
    if (!globalProject || !currentProjectActiveRelease || !allProcessedRequirements) return [];
    return allProcessedRequirements.filter(r => {
      if (r.project !== globalProject) return false;
      if (r.currentStatusDetails?.releaseId !== currentProjectActiveRelease.id) return false;
      
      const isDone = r.currentStatusDetails?.status === 'Done';
      
      if (chartFilter === 'Done') {
        return isDone;
      } else {
        // null or 'Not Done' -> show pending
        return !isDone;
      }
    });
  }, [globalProject, currentProjectActiveRelease, allProcessedRequirements, chartFilter]);

  const projectSummaries = useMemo(() => {
    return projects.map(proj => {
      const activeDefs = activeDefectsAll.filter(d => d.project === proj).length;
      const projReleases = allReleases.filter(r => r.project === proj && r.is_current);
      const activeRel = projReleases.length > 0 ? projReleases[0] : null;
      let pendingReqs = 0;
      if (activeRel && allProcessedRequirements) {
        pendingReqs = allProcessedRequirements.filter(r => 
          r.project === proj && 
          r.currentStatusDetails?.releaseId === activeRel.id && 
          r.currentStatusDetails?.status !== 'Done'
        ).length;
      }
      return {
        name: proj,
        activeDefects: activeDefs,
        pendingReqs: pendingReqs,
        totalIssues: activeDefs + pendingReqs 
      };
    }).sort((a, b) => b.totalIssues - a.totalIssues);
  }, [projects, activeDefectsAll, allReleases, allProcessedRequirements]);

  const upcomingRoadmaps = useMemo(() => {
    const filteredReleases = globalProject
      ? allReleases.filter(r => r.project === globalProject && r.is_current)
      : allReleases.filter(r => r.is_current);
    return filteredReleases.sort((a, b) => new Date(a.release_date) - new Date(b.release_date)).slice(0, 5);
  }, [allReleases, globalProject]);

  const activeReleaseChartData = useMemo(() => {
    if (!globalProject || !currentProjectActiveRelease || !allProcessedRequirements) return null;

    const releaseReqs = allProcessedRequirements.filter(r => 
      r.project === globalProject && 
      r.currentStatusDetails?.releaseId === currentProjectActiveRelease.id
    );

    if (releaseReqs.length === 0) return null;

    let done = 0;
    let notDone = 0;
    releaseReqs.forEach(req => {
      if (req.currentStatusDetails?.status === 'Done') done++;
      else notDone++;
    });

    if (done === 0 && notDone === 0) return null;

    return {
      labels: ['Done', 'To Be Tested'],
      datasets: [{
        data: [done, notDone],
        backgroundColor: ['#28a745', '#dc3545'],
        borderColor: chartBorderColor,
        borderWidth: 2
      }]
    };
  }, [globalProject, currentProjectActiveRelease, allProcessedRequirements, chartBorderColor]);

  const getStatusBadgeStyle = (status) => {
    const isDone = status === 'Done' || status === 'Closed';
    return {
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: '12px',
        fontSize: '0.75rem',
        fontWeight: '600',
        backgroundColor: isDone ? 'var(--success-color, #C6F6D5)' : 'var(--warning-color, #FEEBC8)',
        color: isDone ? '#22543D' : '#7B341E',
    };
  };

  // NEW: Handle clicks on the pie chart to toggle filters
  const handleChartClick = (event, elements) => {
    if (elements.length > 0) {
      const elementIndex = elements[0].index;
      // Index 0 is 'Done', Index 1 is 'To Be Tested' (Not Done) based on activeReleaseChartData
      const selectedLabel = elementIndex === 0 ? 'Done' : 'Not Done';
      
      // Toggle off if already selected
      setChartFilter(prev => prev === selectedLabel ? null : selectedLabel);
    }
  };

  return (
    <div className="dashboard-container">
      <div className="dashboard-header-toolbar">
        <div className="header-left-section">
            {globalProject && (
                <button className="back-nav-btn" onClick={() => handleProjectSelect('')} title="Back to Global Overview">
                    ←
                </button>
            )}
            <h2 className="dashboard-title">
            {globalProject ? `Project Hub: ${globalProject}` : 'Global Overview'}
            </h2>
        </div>
        
        <div className="header-project-selector">
          <ProjectSelector
            projects={projects}
            selectedProject={globalProject}
            onSelectProject={handleProjectSelect}
          />
        </div>
      </div>

      <div className={`bento-grid ${globalProject ? 'project-focused' : 'global-view'}`}>
        
        <div className="grid-main-area">
          <div className="card">
            <h3>{globalProject ? 'Current Status' : 'Project Overview'}</h3>
            
            {globalProject ? (
              <div className="project-detail-view">
                  <div className="stats-row">
                    <div className="stat-box">
                      <span className="stat-label">Active Defects</span>
                      <span className="stat-number text-danger" style={{ fontSize: 'clamp(2rem, 4vw, 3.5rem)' }}>{currentProjectDefectList.length}</span>
                    </div>
                    <div className="stat-box">
                      {/* UPDATED: Dynamic Stat Label based on Chart Filter */}
                      <span className="stat-label">
                        {chartFilter === 'Done' ? 'Completed Requirements' : 'Pending Requirements'}
                      </span>
                      {currentProjectActiveRelease ? (
                        <span 
                          className="stat-number" 
                          style={{ 
                            fontSize: 'clamp(2rem, 4vw, 3.5rem)', 
                            color: chartFilter === 'Done' ? '#28a745' : 'var(--accent-color)' 
                          }}
                        >
                          {currentProjectFilteredReqsList.length}
                        </span>
                      ) : (
                        <span className="stat-empty">No Active Release</span>
                      )}
                    </div>
                  </div>

                  <div className="status-details-grid">
                      <div className="detail-column">
                          <h4>Active Defects</h4>
                          {currentProjectDefectList.length > 0 ? (
                              <ul className="detail-list defect-list-dash">
                                  {currentProjectDefectList.map(d => (
                                      <li key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                          <button 
                                              type="button" 
                                              className="link-button item-title" 
                                              onClick={() => onNavigateToDefect(d, false)}
                                              title={`Go to ${d.title} on the Defects Board`}
                                          >
                                              {d.title}
                                          </button>
                                          <span className="item-status" style={getStatusBadgeStyle(d.status)}>{d.status}</span>
                                      </li>
                                  ))}
                              </ul>
                          ) : (
                            <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)', opacity: 0.7 }}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                                <p style={{ marginTop: '10px' }}>No active defects.</p>
                            </div>
                          )}
                      </div>
                      
                      <div className="detail-column">
                          {/* UPDATED: Dynamic Title and Clear Filter Button */}
                          <h4 style={{ display: 'flex', alignItems: 'center' }}>
                              {chartFilter === 'Done' ? 'Completed Requirements' : 'Pending Requirements'}
                              {chartFilter && (
                                  <button 
                                      onClick={() => setChartFilter(null)}
                                      title="Clear filter"
                                      style={{ 
                                          marginLeft: '10px', 
                                          fontSize: '0.75rem', 
                                          cursor: 'pointer', 
                                          background: 'none', 
                                          border: 'none', 
                                          color: 'var(--accent-color)', 
                                          textDecoration: 'underline',
                                          padding: 0
                                      }}
                                  >
                                      (Clear)
                                  </button>
                              )}
                          </h4>
                          {currentProjectFilteredReqsList.length > 0 ? (
                              <ul className="detail-list req-list-dash">
                                  {currentProjectFilteredReqsList.map(r => (
                                      <li key={r.id}>
                                          <button 
                                              type="button" 
                                              className="link-button item-title" 
                                              onClick={() => onNavigateToRequirement(r)}
                                              title={`Go to ${r.requirementUserIdentifier} on the Sprint Board`}
                                          >
                                              {r.requirementUserIdentifier}
                                          </button>
                                          <span className="item-status" style={getStatusBadgeStyle(r.currentStatusDetails?.status)}>{r.currentStatusDetails?.status}</span>
                                      </li>
                                  ))}
                              </ul>
                          ) : (
                            <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)', opacity: 0.7 }}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                                <p style={{ marginTop: '10px' }}>
                                  {chartFilter === 'Done' ? 'No completed requirements.' : 'No pending requirements.'}
                                </p>
                            </div>
                          )}
                      </div>
                  </div>
              </div>
            ) : (
              <div className="project-overview-wrapper">
                {projectSummaries.length > 0 ? (
                  <ul className="project-overview-list">
                    {projectSummaries.map(p => (
                      <li key={p.name} onClick={() => handleProjectSelect(p.name)} style={{ transition: 'all 0.2s ease', cursor: 'pointer' }} onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)'; }} onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}>
                        <span className="proj-name">{p.name}</span>
                        <div className="proj-stats-pills">
                           {p.activeDefects > 0 && (
                             <span className="pill defect-pill">{p.activeDefects} Defects</span>
                           )}
                           {p.pendingReqs > 0 && (
                             <span className="pill req-pill">{p.pendingReqs} Reqs</span>
                           )}
                           {p.activeDefects === 0 && p.pendingReqs === 0 && (
                             <span className="pill clear-pill">Clear</span>
                           )}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="placeholder-text">No projects available.</p>
                )}
              </div>
            )}
          </div>

          <div className="card timeline-card">
            <h3>Upcoming Roadmaps</h3>
            {upcomingRoadmaps.length > 0 ? (
              <ul className="dashboard-release-list">
                {upcomingRoadmaps.map(r => (
                  <li key={r.id}>
                    <div className="release-info-basic">
                      <strong>{r.name}</strong>
                      {!globalProject && <small className="project-tag">{r.project}</small>}
                    </div>
                    <span className="due-badge">
                      {new Date(r.release_date).toLocaleDateString(undefined, {month: 'short', day: 'numeric'})}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="placeholder-text">No active releases upcoming.</p>
            )}

            {globalProject && activeReleaseChartData && (
              <div className="dashboard-release-chart-wrapper">
                <h4 className="dashboard-release-chart-title">Current Release Progress</h4>
                <div className="dashboard-release-chart-container">
                  <Pie 
                    data={activeReleaseChartData} 
                    options={{ 
                      responsive: true, 
                      maintainAspectRatio: false, 
                      onClick: handleChartClick, // NEW: Bind the click event
                      onHover: (event, chartElement) => { // NEW: Add pointer cursor on hover
                        event.native.target.style.cursor = chartElement[0] ? 'pointer' : 'default';
                      },
                      plugins: { 
                        legend: { 
                          position: 'right',
                          labels: { 
                            color: chartTextColor,
                            font: { size: 12 }, 
                            boxWidth: 12,
                            padding: 15
                          }
                        },
                        tooltip: {
                          callbacks: {
                            label: (c) => ` ${c.label}: ${c.parsed} (${((c.parsed / c.dataset.data.reduce((a, b) => a + b, 0)) * 100).toFixed(1)}%)`
                          }
                        }
                      } 
                    }} 
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {!globalProject && (
          <div className="grid-sidebar-area">
            <div className="card widget-card">
              <h3>Local Weather</h3>
              <WeatherWidget showMessage={() => {}} /> 
            </div>

            <div className="card widget-card eortologio-wrapper">
               <h3>Celebrations Today</h3>
               <div className="iframe-box">
                 <DailyInfoWidget />
               </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default DashboardPage;
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import * as XLSX from 'xlsx';
import ProjectSelector from '../components/ProjectSelector';
import FinalizeReleaseModal from '../components/FinalizeReleaseModal';
import EditReleaseModal from '../components/EditReleaseModal';
import ConfirmationModal from '../components/ConfirmationModal';
import Tooltip from '../components/Tooltip'; // <-- IMPORTED TOOLTIP
import { Chart as ChartJS, ArcElement, Tooltip as ChartTooltip, Legend, Title } from 'chart.js';
import { Pie } from 'react-chartjs-2';
import '../App.css';
import './ReleasesPage.css';

ChartJS.register(ArcElement, ChartTooltip, Legend, Title);

const API_BASE_URL = '/api';

const SprintFilter = ({ availableSprints, selectedSprints, onChange }) => {
    const handleCheckboxChange = (sprint) => {
        if (sprint === 'All') {
            onChange(['All']);
            return;
        }

        const newSelection = selectedSprints.includes('All')
            ? [sprint]
            : selectedSprints.includes(sprint)
                ? selectedSprints.filter(s => s !== sprint)
                : [...selectedSprints, sprint];

        if (newSelection.length === 0 || newSelection.length === availableSprints.length - 1) {
            onChange(['All']);
        } else {
            onChange(newSelection);
        }
    };

    if (availableSprints.length <= 2) {
        return null;
    }

    return (
        <div className="sprint-filter-options-container">
            {availableSprints.map(sprint => (
                <label key={sprint} className="sprint-filter-label">
                    <input
                        type="checkbox"
                        checked={selectedSprints.includes(sprint)}
                        onChange={() => handleCheckboxChange(sprint)}
                    />
                    {sprint}
                </label>
            ))}
        </div>
    );
};


const ActiveReleaseCardWrapper = ({ release, allProcessedRequirements, onNavigateToRequirement, onNavigateToDefect, onFinalize, onEdit, handleExportRelease }) => {
    const [selectedSprints, setSelectedSprints] = useState(['All']);
    const [isDefectsCardOpen, setIsDefectsCardOpen] = useState(false);
    const [isFilterVisible, setIsFilterVisible] = useState(false);

    const releaseRequirements = useMemo(() => 
        allProcessedRequirements.filter(r => r.currentStatusDetails.releaseId === release.id),
        [allProcessedRequirements, release.id]
    );

    const availableSprints = useMemo(() => {
        const sprints = new Set(releaseRequirements.map(r => r.currentStatusDetails.sprint).filter(Boolean));
        return ['All', ...Array.from(sprints).sort()];
    }, [releaseRequirements]);

    const filteredRequirements = useMemo(() => {
        if (selectedSprints.includes('All')) {
            return releaseRequirements;
        }
        return releaseRequirements.filter(r => selectedSprints.includes(r.currentStatusDetails.sprint));
    }, [releaseRequirements, selectedSprints]);

    const filteredDefects = useMemo(() => 
        filteredRequirements.flatMap(r => r.linkedDefects || []),
        [filteredRequirements]
    );

    const uniqueFilteredDefects = useMemo(() => 
        Array.from(new Map(filteredDefects.map(d => [d.id, d])).values()),
        [filteredDefects]
    );

    const defectCount = uniqueFilteredDefects.length;

    const handleSprintChange = (newSelection) => {
        setSelectedSprints(newSelection);
    };

    const handleDefectClick = () => {
        setIsDefectsCardOpen(prev => !prev);
    };
    
    const sprintFilterElement = isFilterVisible ? (
        <SprintFilter
            availableSprints={availableSprints}
            selectedSprints={selectedSprints}
            onChange={handleSprintChange}
        />
    ) : null;

    const releaseCard = (
        <ReleaseCard 
            key={release.id} 
            release={release} 
            requirements={filteredRequirements} 
            defectCount={defectCount}
            onNavigate={onNavigateToRequirement}
            onFinalize={() => onFinalize(release)}
            onEdit={() => onEdit(release)}
            onDefectClick={handleDefectClick}
            onExport={() => handleExportRelease(release, filteredRequirements, uniqueFilteredDefects)}
            sprintFilter={sprintFilterElement}
            onToggleFilter={() => setIsFilterVisible(prev => !prev)}
            showFilterToggle={availableSprints.length > 2}
        />
    );
    
    if (isDefectsCardOpen) {
        return (
            <>
                {releaseCard}
                <DefectDetailsCard
                    key={`defect-details-${release.id}`}
                    release={release}
                    defects={uniqueFilteredDefects}
                    onClose={() => setIsDefectsCardOpen(false)}
                    onNavigate={onNavigateToDefect}
                />
            </>
        );
    }

    return releaseCard;
};


const ReleaseCountdown = ({ activeReleases }) => {
    const currentRelease = activeReleases.find(r => r.is_current);

    if (!currentRelease) {
        return null;
    }

    const calculateDaysLeft = () => {
        const releaseDate = new Date(currentRelease.release_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0); 
        releaseDate.setHours(0, 0, 0, 0);

        const differenceInTime = releaseDate.getTime() - today.getTime();
        const differenceInDays = Math.ceil(differenceInTime / (1000 * 3600 * 24));
        return differenceInDays;
    };

    const daysLeft = calculateDaysLeft();

    if (daysLeft < 0) {
        return <span className="countdown-timer overdue">Current release overdue by {-daysLeft} days</span>;
    } else if (daysLeft === 0) {
        return <span className="countdown-timer">Current release is due today</span>;
    } else {
        return <span className="countdown-timer">{daysLeft} days until current release</span>;
    }
};

const LoadingSpinner = () => <div className="loading-spinner"></div>;

const DefectDetailsCard = ({ release, defects, onClose, onNavigate }) => {
    const getDefectChartData = () => {
        if (!defects || defects.length === 0) return null;

        let done = 0;
        let notDone = 0;
        let closed = 0;

        defects.forEach(defect => {
            if (defect.status === 'Done') {
                done++;
            } else if (defect.status === 'Closed') {
                closed++;
            } else {
                notDone++;
            }
        });

        if (done === 0 && notDone === 0 && closed === 0) return null;

        return {
            labels: ['Done', 'Not Done', 'Closed'],
            datasets: [{
                data: [done, notDone, closed],
                backgroundColor: ['#4CAF50', '#F44336', '#808080'],
                borderColor: ['#ffffff', '#ffffff', '#ffffff'],
                borderWidth: 1,
            }],
        };
    };

    const chartData = getDefectChartData();

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            title: { display: true, text: `Defect Status (${defects.length} items)`, font: { size: 14 } },
            tooltip: { callbacks: { label: (c) => `${c.label}: ${c.parsed} (${((c.parsed / (c.dataset.data.reduce((a, b) => a + b, 0) || 1)) * 100).toFixed(1)}%)` } }
        },
    };

    const chartAriaLabel = chartData
        ? `Pie chart showing defect status for release ${release.name}. ${chartData.datasets[0].data[0]} defects are done, ${chartData.datasets[0].data[1]} are not done, and ${chartData.datasets[0].data[2]} are closed.`
        : 'No defect data to display in a chart.';

    return (
        <div className="defect-details-card">
            <div className="defect-details-card-header">
                <h3>Defects for {release.name}</h3>
                <button type="button" onClick={onClose} className="close-button">X</button>
            </div>
            <div className="defect-details-card-body">
                <div className="defect-charts">
                    {chartData ? (
                        <Pie data={chartData} options={chartOptions} aria-label={chartAriaLabel} />
                    ) : (
                        <div className="empty-chart-placeholder">No defects for this release</div>
                    )}
                </div>
                <div className="defect-list">
                    <h4>Defects ({defects.length})</h4>
                    <ul>
                        {defects.length > 0 ? defects.map(defect => (
                            <li key={defect.id}>
                                <button type="button" onClick={() => onNavigate(defect, defect.status === 'Closed')} className="link-button">
                                    {defect.title}
                                </button>
                            </li>
                        )) : <li>No defects in this release.</li>}
                    </ul>
                </div>
            </div>
        </div>
    );
};

const ReleaseCard = ({ release, requirements, defectCount, onNavigate, onFinalize, onEdit, onDefectClick, onExport, sprintFilter, onToggleFilter, showFilterToggle }) => {

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
            labels: ['Done', 'Not Done'],
            datasets: [{
                data: [done, notDone],
                backgroundColor: ['#4CAF50', '#F44336'],
                borderColor: ['#ffffff', '#ffffff'],
                borderWidth: 1,
            }],
        };
    };

    const chartData = getChartData(requirements);

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            title: { display: true, text: `Progress (${requirements.length} items)`, font: { size: 14 } },
            tooltip: { callbacks: { label: (c) => `${c.label}: ${c.parsed} (${((c.parsed / (c.dataset.data.reduce((a, b) => a + b, 0) || 1)) * 100).toFixed(1)}%)` } }
        },
    };

    const chartAriaLabel = chartData
        ? `Pie chart showing requirement progress for release ${release.name}. ${chartData.datasets[0].data[0]} items are done and ${chartData.datasets[0].data[1]} items are not done.`
        : 'No requirement data to display in a chart.';

    return (
        <div className="release-card">
            <div className="release-card-header">
                <h3>{release.name}{release.is_current ? <span className="current-tag">Current</span> : ''}</h3>
                <div className="release-card-header-details">
                    <span className="due-date">Due: {new Date(release.release_date).toLocaleDateString()}</span>
                    <button type="button" onClick={onDefectClick} className="defect-count-button">
                        Defects: {defectCount}
                    </button>
                </div>
            </div>
            
            <div className="release-card-body">
                <div className="release-charts">
                    {chartData ? (
                        <Pie data={chartData} options={chartOptions} aria-label={chartAriaLabel} />
                    ) : (
                        <div className="empty-chart-placeholder">No requirements assigned</div>
                    )}
                </div>
                <div className="release-requirements">
                    <h4>Requirements ({requirements.length})</h4>
                    <ul className="requirement-list">
                        {requirements.length > 0 ? requirements.map(req => (
                            <li key={req.id}>
                                <button type="button" onClick={() => onNavigate(req)} className="link-button">
                                    {req.requirementUserIdentifier}
                                </button>
                            </li>
                        )) : <li>No requirements in this release.</li>}
                    </ul>
                </div>
            </div>
            
            <div className="release-card-footer">
                {sprintFilter && (
                    <div className="sprint-filter-controls">
                        {sprintFilter}
                    </div>
                )}
                
                <div className="release-card-actions">
                    {showFilterToggle && (
                        <button type="button" onClick={onToggleFilter} className="button-filter">Filter Sprints</button>
                    )}
                    <button type="button" onClick={onExport} className="button-export">&#128229; Export</button>
                    <button type="button" onClick={onEdit} className="button-edit">&#9998; Edit</button>
                    <button type="button" onClick={onFinalize} className="button-finalize">&#10004; Finalize</button>
                </div>
            </div>
        </div>
    );
};

const ArchivedDefectList = ({ defects, onNavigate }) => {
    return (
        <div className="defect-list" style={{ borderLeft: '1px solid #eee', paddingLeft: '20px', flexGrow: 1 }}>
            <h4>Defects ({defects.length})</h4>
            <ul className="requirement-list">
                {defects.length > 0 ? defects.map(defect => (
                    <li key={defect.id}>
                        <button type="button" onClick={() => onNavigate(defect, defect.status === 'Closed')} className="link-button">
                            {defect.title}
                        </button>
                    </li>
                )) : <li>No defects in this release.</li>}
            </ul>
        </div>
    );
};

const ArchivedReleaseDetails = ({ archive, onBack, onNavigateToRequirement, onNavigateToDefect, allProcessedRequirements }) => {
    const [items, setItems] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [defects, setDefects] = useState([]);

    useEffect(() => {
        setIsLoading(true);
        fetch(`${API_BASE_URL}/archives/details/${archive.id}`)
            .then(res => res.json())
            .then(data => {
                setItems(data.data || []);
                setIsLoading(false);
            })
            .catch(err => {
                console.error(err);
                setIsLoading(false);
            });
    }, [archive.id]);

    useEffect(() => {
        if (items.length > 0 && allProcessedRequirements.length > 0) {
            const releaseDefects = items.flatMap(item => {
                const requirement = allProcessedRequirements.find(req => req.id === item.requirement_group_id);
                return requirement ? (requirement.linkedDefects || []) : [];
            });
            const uniqueDefects = Array.from(new Map(releaseDefects.map(defect => [defect.id, defect])).values());
            setDefects(uniqueDefects);
        }
    }, [items, allProcessedRequirements]);

    const handleRequirementClick = (item) => {
        const requirement = allProcessedRequirements.find(req => req.id === item.requirement_group_id);
        if (requirement) {
            onNavigateToRequirement(requirement);
        } else {
            console.error("Could not find requirement details for navigation.");
        }
    };

    const chartData = {
        labels: ['Done', 'Not Done'],
        datasets: [{
            data: [archive.metrics.doneCount, archive.metrics.notDoneCount],
            backgroundColor: ['#4CAF50', '#F44336'],
            borderColor: '#fff',
            borderWidth: 2,
        }],
    };
    
    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { 
                position: 'bottom',
                labels: {
                    boxWidth: 12,
                    padding: 20,
                }
            },
            title: { display: false },
        },
    };

    const chartAriaLabel = `Pie chart showing final metrics for archived release ${archive.name}. ${archive.metrics.doneCount} items were done and ${archive.metrics.notDoneCount} were not done.`;

    return (
        <div className="archived-details-view">
            <div className="details-header">
                <button type="button" onClick={onBack} className="back-button">&#8592; Back to Archives</button>
                <h2>Archived Release Details</h2>
            </div>
            <div className="release-card">
                <div className="release-card-header">
                    <h3>{archive.name}</h3>
                    <div className="release-card-header-details">
                        <span className="due-date">Closed: {new Date(archive.closed_at).toLocaleString()}</span>
                    </div>
                </div>
                <div className="release-card-body">
                    <div className="release-charts">
                        <Pie data={chartData} options={chartOptions} aria-label={chartAriaLabel} />
                    </div>
                    <div className="release-requirements">
                        <h4>Frozen Requirements ({items.length})</h4>
                        <div className="requirements-list-wrapper">
                            {isLoading ? <LoadingSpinner /> : (
                                <ul className="requirement-list frozen">
                                    {items.length > 0 ? items.map(item => (
                                        <li key={item.id}>
                                            <button type="button" onClick={() => handleRequirementClick(item)} className="link-button">
                                                {item.requirement_title}
                                            </button>
                                            <span className={`status-badge status-${item.final_status.toLowerCase().replace(/\s+/g, '-')}`}>{item.final_status}</span>
                                        </li>
                                    )) : <li>No requirements were in this release.</li>}
                                </ul>
                            )}
                        </div>
                    </div>
                    <ArchivedDefectList defects={defects} onNavigate={onNavigateToDefect} />
                </div>
            </div>
        </div>
    );
};

const ReleasesPage = ({ projects, allProcessedRequirements, showMainMessage, onNavigateToRequirement, onNavigateToDefect, onEditRelease, onDeleteRelease, onDeleteArchivedRelease, fetchData }) => {
    const [selectedProject, setSelectedProject] = useState('');
    const [view, setView] = useState('active');
    const [activeReleases, setActiveReleases] = useState([]);
    const [archivedReleases, setArchivedReleases] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedArchive, setSelectedArchive] = useState(null);
    const [isFinalizeModalOpen, setIsFinalizeModalOpen] = useState(false);
    const [releaseToFinalize, setReleaseToFinalize] = useState(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [releaseToEdit, setReleaseToEdit] = useState(null);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

    // ======================= NEW TOOLTIP CONTENT =======================
    const releasesPageTooltipContent = (
        <>
            <strong>Releases Page Guide</strong>
            <p>This page shows all active and archived releases for the selected project.</p>
            <ul>
                <li><strong>Active Releases:</strong> View real-time progress of ongoing releases. You can filter by sprint, export details, edit, or finalize them.</li>
                <li><strong>Archived Releases:</strong> View a permanent snapshot of finalized releases.</li>
                <li><strong>Defects Count:</strong> This number represents unique defects linked to the requirements currently displayed for the release.</li>
            </ul>
        </>
    );
    // ====================================================================

    useEffect(() => {
        const savedProject = sessionStorage.getItem('releasePageSelectedProject');
        if (savedProject) {
            setSelectedProject(savedProject);
        }
    }, []);

    useEffect(() => {
        if (selectedProject) {
            sessionStorage.setItem('releasePageSelectedProject', selectedProject);
        } else {
            sessionStorage.removeItem('releasePageSelectedProject');
        }
    }, [selectedProject]);

    const onSelectProject = (project) => {
        setSelectedProject(project);
    };
    
    const fetchActiveReleases = useCallback(async () => {
        if (!selectedProject) return;
        setIsLoading(true);
        try {
            const response = await fetch(`${API_BASE_URL}/releases/${selectedProject}`);
            if (!response.ok) throw new Error('Failed to fetch active releases.');
            const result = await response.json();
            setActiveReleases(result.data || []);
        } catch (error) {
            showMainMessage(error.message, 'error');
        } finally {
            setIsLoading(false);
        }
    }, [selectedProject, showMainMessage]);

    const fetchArchivedReleases = useCallback(async () => {
        if (!selectedProject) return;
        setIsLoading(true);
        try {
            const response = await fetch(`${API_BASE_URL}/archives/${selectedProject}`);
            if (!response.ok) throw new Error('Failed to fetch archived releases.');
            const result = await response.json();
            setArchivedReleases(result.data || []);
        } catch (error) {
            showMainMessage(error.message, 'error');
        } finally {
            setIsLoading(false);
        }
    }, [selectedProject, showMainMessage]);

    useEffect(() => {
        if (selectedProject) {
            fetchActiveReleases();
            if (view === 'archived') {
                fetchArchivedReleases();
            }
        }
    }, [view, selectedProject, fetchActiveReleases, fetchArchivedReleases]);

    const handleOpenFinalizeModal = (release) => {
        setReleaseToFinalize(release);
        setIsFinalizeModalOpen(true);
    };

    const handleConfirmFinalize = async (closeAction) => {
        if (!releaseToFinalize) return;
        try {
            const response = await fetch(`${API_BASE_URL}/releases/${releaseToFinalize.id}/close`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ closeAction })
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Failed to finalize release.');
            showMainMessage(result.message, 'success');
            fetchData();
            if (view === 'active') {
                fetchActiveReleases();
            } else {
                fetchArchivedReleases();
            }
        } catch (error) {
            showMainMessage(error.message, 'error');
        } finally {
            setIsFinalizeModalOpen(false);
            setReleaseToFinalize(null);
        }
    };

    const handleOpenEditModal = (release) => {
        setReleaseToEdit(release);
        setIsEditModalOpen(true);
    };

    const handleSaveEdit = (data) => {
        onEditRelease(data);
        setIsEditModalOpen(false);
    };

    const handleDeleteRequest = () => {
        setIsDeleteConfirmOpen(true);
    };

    const handleConfirmDelete = () => {
        onDeleteRelease(releaseToEdit);
        setIsDeleteConfirmOpen(false);
        setIsEditModalOpen(false);
    };

    const handleExportRelease = async (release, requirements, defects) => {
        const returnCountsMap = new Map();

        try {
            const project = release.project;
            if (project) {
                const [activeRes, closedRes] = await Promise.all([
                    fetch(`${API_BASE_URL}/defects/${project}/return-counts?statusType=active`),
                    fetch(`${API_BASE_URL}/defects/${project}/return-counts?statusType=closed`)
                ]);

                if (activeRes.ok) {
                    const activeData = await activeRes.json();
                    (activeData.data || []).forEach(item => returnCountsMap.set(item.id, item.return_count));
                }
                if (closedRes.ok) {
                    const closedData = await closedRes.json();
                    (closedData.data || []).forEach(item => returnCountsMap.set(item.id, item.return_count));
                }
            }
        } catch (error) {
            console.error("Could not fetch defect return counts for export:", error);
            showMainMessage("Could not fetch return-to-dev counts for the export, they will be omitted.", "warning");
        }

        const MAX_WIDTH = 70;
        const borderStyle = { style: "thin", color: { auto: 1 } };
        const border = { top: borderStyle, bottom: borderStyle, left: borderStyle, right: borderStyle };

        const headerStyle = {
            font: { bold: true },
            fill: { fgColor: { rgb: "E9E9E9" } },
            border: border,
            alignment: { vertical: 'center', horizontal: 'center' }
        };
        
        const cellStyle = {
            border: border,
            alignment: { wrapText: true, vertical: 'top' }
        };

        const linkStyle = {
            font: { color: { rgb: "0000FF" }, underline: true },
            border: border,
            alignment: { wrapText: true, vertical: 'top' }
        };

        const fitToColumn = (arrayOfArrays) => {
            if (!arrayOfArrays || arrayOfArrays.length === 0) return [];
            const colWidths = [];
            arrayOfArrays.forEach(row => {
                row.forEach((cell, i) => {
                    const cellValue = cell ? cell.toString() : '';
                    const lines = cellValue.split('\n');
                    const maxLength = Math.max(...lines.map(line => line.length));
                    if (!colWidths[i] || colWidths[i].wch < maxLength) {
                        colWidths[i] = { wch: maxLength };
                    }
                });
            });
            colWidths.forEach(col => { col.wch = Math.min(col.wch + 2, MAX_WIDTH); });
            return colWidths;
        };

        const processSheet = (data, headers) => {
            const dataAsArray = [headers, ...data.map(row => headers.map(header => row[header]))];
            
            const ws = XLSX.utils.aoa_to_sheet(dataAsArray);
            ws['!cols'] = fitToColumn(dataAsArray);

            const range = XLSX.utils.decode_range(ws['!ref']);
            for (let R = range.s.r; R <= range.e.r; ++R) {
                for (let C = range.s.c; C <= range.e.c; ++C) {
                    const cell_ref = XLSX.utils.encode_cell({ c: C, r: R });
                    let cell = ws[cell_ref];
                    if (!cell) continue;

                    if (R === 0) {
                        cell.s = headerStyle;
                    } else {
                        const headerName = headers[C];
                        if ((headerName === 'Requirement Link' || headerName === 'Defect Link') && cell.v) {
                            cell.l = { Target: cell.v, Tooltip: `Click to open link` };
                            cell.s = linkStyle;
                        } else {
                            cell.s = cellStyle;
                        }
                    }
                }
            }
            return ws;
        };

        const reqHeaders = ['Release Name', 'Requirement Name', 'Requirement Link', 'Sprint', 'Linked Defects', 'Status'];
        const requirementsData = requirements.map(req => ({
            'Release Name': release.name,
            'Requirement Name': req.requirementUserIdentifier,
            'Requirement Link': req.currentStatusDetails.link || '',
            'Sprint': req.currentStatusDetails.sprint || '',
            'Linked Defects': (req.linkedDefects || []).map(d => d.title).join('\n'),
            'Status': req.currentStatusDetails.status
        }));

        const uniqueDefects = Array.from(new Map(defects.map(d => [d.id, d])).values());
        const defectHeaders = ['Defect Name', 'Defect Link', 'Linked Requirements', 'Sprints', 'Status', 'Return to Dev Count'];
        const defectsData = uniqueDefects.map(defect => {
            const linkedRequirements = allProcessedRequirements
                .filter(req => req.linkedDefects && req.linkedDefects.some(d => d.id === defect.id));
            const linkedRequirementsNames = linkedRequirements.map(req => req.requirementUserIdentifier);
            const linkedSprints = new Set(linkedRequirements.map(req => req.currentStatusDetails.sprint).filter(Boolean));
            return {
                'Defect Name': defect.title,
                'Defect Link': defect.link || '',
                'Linked Requirements': linkedRequirementsNames.join('\n'),
                'Sprints': Array.from(linkedSprints).sort().join(', '),
                'Status': defect.status,
                'Return to Dev Count': returnCountsMap.get(defect.id) || 0
            };
        });

        const reqDefectHeaders = ['Requirement Name', 'Defect Name', 'Sprint', 'Return to Dev Count'];
        const reqDefectData = [];
        requirements.forEach(req => {
            if (req.linkedDefects && req.linkedDefects.length > 0) {
                req.linkedDefects.forEach(defect => {
                    reqDefectData.push({
                        'Requirement Name': req.requirementUserIdentifier,
                        'Requirement Link': req.currentStatusDetails.link,
                        'Defect Name': defect.title,
                        'Defect Link': defect.link,
                        'Sprint': req.currentStatusDetails.sprint || '',
                        'Return to Dev Count': returnCountsMap.get(defect.id) || 0
                    });
                });
            }
        });

        const wb = XLSX.utils.book_new();

        if (requirementsData.length > 0) {
            const wsReqs = processSheet(requirementsData, reqHeaders);
            XLSX.utils.book_append_sheet(wb, wsReqs, 'Requirements');
        }
        
        if (reqDefectData.length > 0) {
            const reqDefectDataAsArray = [
                reqDefectHeaders,
                ...reqDefectData.map(row => [
                    row['Requirement Name'],
                    row['Defect Name'],
                    row['Sprint'],
                    row['Return to Dev Count']
                ])
            ];

            const wsReqDefects = XLSX.utils.aoa_to_sheet(reqDefectDataAsArray);
            wsReqDefects['!cols'] = fitToColumn(reqDefectDataAsArray);

            const range = XLSX.utils.decode_range(wsReqDefects['!ref']);
            for (let R = 1; R <= range.e.r; ++R) { 
                const rowData = reqDefectData[R - 1];

                for (let C = 0; C <= range.e.c; C++) {
                    const cellRef = XLSX.utils.encode_cell({ c: C, r: R });
                    if (wsReqDefects[cellRef]) wsReqDefects[cellRef].s = cellStyle;
                }

                if (rowData['Requirement Link']) {
                    const reqNameCellRef = XLSX.utils.encode_cell({ c: 0, r: R });
                    if (wsReqDefects[reqNameCellRef]) {
                        wsReqDefects[reqNameCellRef].l = { Target: rowData['Requirement Link'], Tooltip: 'Click to open requirement' };
                        wsReqDefects[reqNameCellRef].s = linkStyle;
                    }
                }

                if (rowData['Defect Link']) {
                    const defNameCellRef = XLSX.utils.encode_cell({ c: 1, r: R });
                    if (wsReqDefects[defNameCellRef]) {
                        wsReqDefects[defNameCellRef].l = { Target: rowData['Defect Link'], Tooltip: 'Click to open defect' };
                        wsReqDefects[defNameCellRef].s = linkStyle;
                    }
                }
            }

            for (let C = 0; C < reqDefectHeaders.length; C++) {
                const cellRef = XLSX.utils.encode_cell({c: C, r: 0});
                if (wsReqDefects[cellRef]) wsReqDefects[cellRef].s = headerStyle;
            }

            XLSX.utils.book_append_sheet(wb, wsReqDefects, 'Requirements with Defects');
        }

        if (defectsData.length > 0) {
            const wsDefects = processSheet(defectsData, defectHeaders);
            XLSX.utils.book_append_sheet(wb, wsDefects, 'Defects');
        }

        XLSX.writeFile(wb, `${release.name}_Details.xlsx`);
    };

    const renderActiveView = () => {
        if (isLoading) return <LoadingSpinner />;
        if (activeReleases.length === 0) return <div className="empty-column-message">No active releases found for this project.</div>;

        return (
            <div className="releases-container">
                {activeReleases.map(release => (
                    <ActiveReleaseCardWrapper
                        key={release.id}
                        release={release}
                        allProcessedRequirements={allProcessedRequirements}
                        onNavigateToRequirement={onNavigateToRequirement}
                        onNavigateToDefect={onNavigateToDefect}
                        onFinalize={handleOpenFinalizeModal}
                        onEdit={handleOpenEditModal}
                        handleExportRelease={handleExportRelease}
                    />
                ))}
            </div>
        );
    };

    const renderArchivedView = () => {
        if (selectedArchive) {
            return <ArchivedReleaseDetails archive={selectedArchive} onBack={() => setSelectedArchive(null)} onNavigateToRequirement={onNavigateToRequirement} onNavigateToDefect={onNavigateToDefect} allProcessedRequirements={allProcessedRequirements} />;
        }

        if (isLoading) return <LoadingSpinner />;
        if (archivedReleases.length === 0) return <div className="empty-column-message">No archived releases found for this project.</div>;

        return (
            <div className="releases-container archived">
                {archivedReleases.map(archive => (
                    <div key={archive.id} className="release-card archived-card">
                        <div className="release-card-header">
                            <h3>{archive.name}</h3>
                            <span className="due-date">Closed: {new Date(archive.closed_at).toLocaleDateString()}</span>
                        </div>
                        <div className="archived-card-body">
                            <h4>Final Metrics</h4>
                            <div className="archived-metrics">
                                <span className="metric-item done">&#10004; Done: {archive.metrics.doneCount}</span>
                                <span className="metric-item not-done">&#10008; Not Done: {archive.metrics.notDoneCount}</span>
                            </div>
                        </div>
                        <div className="release-card-actions">
                            <button type="button" onClick={() => setSelectedArchive(archive)} className="button-view-details">View Details</button>
                            <button type="button" onClick={() => onDeleteArchivedRelease(archive)} className="button-delete">&#128465; Delete</button>
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div className="main-content-area">
            <div className="selection-controls">
                <ProjectSelector projects={projects} selectedProject={selectedProject} onSelectProject={onSelectProject} />
                {selectedProject && (
                    <div className="view-toggle-buttons">
                        {/* ======================= TOOLTIP ADDED HERE ======================= */}
                        <Tooltip content={releasesPageTooltipContent} position="bottom" />
                        <ReleaseCountdown activeReleases={activeReleases} />
                        <button type="button" onClick={() => setView('active')} className={view === 'active' ? 'active' : ''}>Active</button>
                        <button type="button" onClick={() => setView('archived')} className={view === 'archived' ? 'active' : ''}>Archived</button>
                    </div>
                )}
            </div>
            {selectedProject ? (view === 'active' ? renderActiveView() : renderArchivedView()) : (
                <div className="empty-column-message">Please select a project to view releases.</div>
            )}

            <FinalizeReleaseModal 
                isOpen={isFinalizeModalOpen}
                onClose={() => setIsFinalizeModalOpen(false)}
                onConfirm={handleConfirmFinalize}
                releaseName={releaseToFinalize?.name}
            />

            {releaseToEdit && (
                <EditReleaseModal 
                    isOpen={isEditModalOpen}
                    onClose={() => setIsEditModalOpen(false)}
                    onSave={handleSaveEdit}
                    onDelete={handleDeleteRequest}
                    releases={[releaseToEdit]}
                    projects={projects}
                    currentProject={selectedProject}
                    isEditing={true}
                    initialReleaseId={releaseToEdit.id}
                />
            )}

            <ConfirmationModal 
                isOpen={isDeleteConfirmOpen}
                onClose={() => setIsDeleteConfirmOpen(false)}
                onConfirm={handleConfirmDelete}
                title="Confirm Delete Release"
                message={`Are you sure you want to delete the release "${releaseToEdit?.name}"? This action is permanent.`}
            />
        </div>
    );
};

export default ReleasesPage;
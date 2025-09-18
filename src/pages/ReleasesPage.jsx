import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import ProjectSelector from '../components/ProjectSelector';
import FinalizeReleaseModal from '../components/FinalizeReleaseModal';
import EditReleaseModal from '../components/EditReleaseModal';
import ConfirmationModal from '../components/ConfirmationModal';
import Modal from '../components/ReleaseModal';
import SatBugModal from '../components/SatBugModal';
import Tooltip from '../components/Tooltip';
import { Chart as ChartJS, ArcElement, Tooltip as ChartTooltip, Legend, Title } from 'chart.js';
import { Pie } from 'react-chartjs-2';
import '../App.css';
import './ReleasesPage.css';

ChartJS.register(ArcElement, ChartTooltip, Legend, Title);

const API_BASE_URL = '/api';

const getSatChartConfig = (sat_report) => {
    if (!sat_report) return { data: null, legendItems: [] };

    const allLabels = ['Passed', 'Failed', 'Blocked', 'Pending', 'Executing', 'Aborted'];
    const allColors = ['#28a745', '#dc3545', '#ffc107', '#6c757d', '#17a2b8', '#fd7e14'];

    const data = [];
    const labels = [];
    const backgroundColor = [];
    const legendItems = [];

    allLabels.forEach((label, index) => {
        const key = label.toLowerCase();
        const value = sat_report[key];
        if (value > 0) {
            data.push(value);
            labels.push(label);
            backgroundColor.push(allColors[index]);
            legendItems.push({ text: label, color: allColors[index] });
        }
    });

    if (data.length === 0) return { data: null, legendItems: [] };

    return {
        data: {
            labels,
            datasets: [{ data, backgroundColor, borderColor: '#FFFAF0', borderWidth: 2 }]
        },
        legendItems
    };
};

const ChartLegend = ({ items }) => {
    if (!items || items.length === 0) return null;
    return (
        <ul className="chart-legend">
            {items.map(item => (
                <li key={item.text} className="legend-item">
                    <span className="legend-color-box" style={{ backgroundColor: item.color }}></span>
                    {item.text}
                </li>
            ))}
        </ul>
    );
};

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


const ActiveReleaseCardWrapper = ({ release, allProcessedRequirements, onNavigateToRequirement, onNavigateToDefect, onFinalize, onEdit, handleExportReleaseToExcel, onExportToPdf }) => {
    const [selectedSprints, setSelectedSprints] = useState(['All']);
    const [isDefectsCardOpen, setIsDefectsCardOpen] = useState(false);
    const [isFilterVisible, setIsFilterVisible] = useState(false);
    const [isPdfExporting, setIsPdfExporting] = useState(false);

    const reqChartRef = useRef(null);
    const defectChartRef = useRef(null);

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

    const reqChartData = useMemo(() => {
        if (!filteredRequirements || filteredRequirements.length === 0) return null;
        let done = 0;
        let notDone = 0;
        filteredRequirements.forEach(req => {
            if (req.currentStatusDetails.status === 'Done') done++;
            else notDone++;
        });
        if (done === 0 && notDone === 0) return null;
        return {
            labels: ['Done', 'Not Done'],
            datasets: [{ data: [done, notDone], backgroundColor: ['#4CAF50', '#F44336'], borderColor: ['#ffffff'], borderWidth: 1 }],
        };
    }, [filteredRequirements]);

    const defectChartData = useMemo(() => {
        if (!uniqueFilteredDefects || uniqueFilteredDefects.length === 0) return null;
        let done = 0, notDone = 0, closed = 0;
        uniqueFilteredDefects.forEach(defect => {
            if (defect.status === 'Done') done++;
            else if (defect.status === 'Closed') closed++;
            else notDone++;
        });
        if (done === 0 && notDone === 0 && closed === 0) return null;
        return {
            labels: ['Done', 'Not Done', 'Closed'],
            datasets: [{ data: [done, notDone, closed], backgroundColor: ['#4CAF50', '#F44336', '#808080'], borderColor: ['#ffffff'], borderWidth: 1 }],
        };
    }, [uniqueFilteredDefects]);

    const handlePdfExport = async () => {
        if (!reqChartRef.current) {
            console.error("Requirements chart reference is not available for PDF export.");
            return;
        }
        setIsPdfExporting(true);
        await onExportToPdf(release, filteredRequirements, uniqueFilteredDefects, {
            reqChart: reqChartRef.current,
            defectChart: defectChartRef.current,
        }, { selectedSprints, availableSprints });
        setIsPdfExporting(false);
    };

    const handleSprintChange = (newSelection) => setSelectedSprints(newSelection);
    const handleDefectClick = () => setIsDefectsCardOpen(prev => !prev);
    
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
            onExportExcel={() => handleExportReleaseToExcel(release, filteredRequirements, uniqueFilteredDefects)}
            onExportPdf={handlePdfExport}
            isPdfExporting={isPdfExporting}
            sprintFilter={sprintFilterElement}
            onToggleFilter={() => setIsFilterVisible(prev => !prev)}
            showFilterToggle={availableSprints.length > 2}
            chartData={reqChartData}
            chartRef={reqChartRef}
        />
    );
    
    const defectDetailsCard = isDefectsCardOpen ? (
        <DefectDetailsCard
            key={`defect-details-${release.id}`}
            release={release}
            defects={uniqueFilteredDefects}
            onClose={() => setIsDefectsCardOpen(false)}
            onNavigate={onNavigateToDefect}
            chartData={defectChartData}
        />
    ) : null;

    return (
        <>
            {releaseCard}
            {defectDetailsCard}
            <div style={{ position: 'absolute', left: '-9999px', width: '300px', height: '300px' }}>
                {defectChartData && <Pie ref={defectChartRef} data={defectChartData} options={{ animation: false, plugins: { legend: { display: false } } }} />}
            </div>
        </>
    );
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

const DefectDetailsCard = ({ release, defects, onClose, onNavigate, chartData }) => {
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

const ReleaseCard = ({ release, requirements, defectCount, onNavigate, onFinalize, onEdit, onDefectClick, onExportExcel, onExportPdf, isPdfExporting, sprintFilter, onToggleFilter, showFilterToggle, chartData, chartRef }) => {
    const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
    const exportContainerRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (exportContainerRef.current && !exportContainerRef.current.contains(event.target)) {
                setIsExportMenuOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

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
                        <Pie ref={chartRef} data={chartData} options={chartOptions} aria-label={chartAriaLabel} />
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
                    <div className="export-button-container" ref={exportContainerRef}>
                        <button type="button" onClick={() => setIsExportMenuOpen(prev => !prev)} className="button-export">
                            Export
                        </button>
                        {isExportMenuOpen && (
                            <div className="export-dropdown-menu">
                                <button type="button" onClick={() => { onExportExcel(); setIsExportMenuOpen(false); }}>as Excel</button>
                                <button type="button" onClick={() => { onExportPdf(); setIsExportMenuOpen(false); }} disabled={isPdfExporting}>
                                    {isPdfExporting ? 'Exporting...' : 'as PDF'}
                                </button>
                            </div>
                        )}
                    </div>
                    <button type="button" onClick={onEdit} className="button-edit">Edit</button>
                    <button type="button" onClick={onFinalize} className="button-finalize">Finalize</button>
                </div>
            </div>
        </div>
    );
};

const ArchivedDefectList = ({ defects, onNavigate }) => {
    return (
        <div className="defect-list">
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

const ArchivedReleaseDetails = ({ archive, onBack, onNavigateToRequirement, onNavigateToDefect, allProcessedRequirements, onAddSatReport, onCompleteRelease, onExportToExcel, onExportToPdf, showMainMessage }) => {
    const [items, setItems] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [defects, setDefects] = useState([]);
    const [isPdfExporting, setIsPdfExporting] = useState(false);
    const [isExcelExporting, setIsExcelExporting] = useState(false);
    const [satBugs, setSatBugs] = useState([]);
    const [isSatBugModalOpen, setIsSatBugModalOpen] = useState(false);
    const [bugToEdit, setBugToEdit] = useState(null);
    const [bugToDelete, setBugToDelete] = useState(null);

    const metricsChartRef = useRef(null);
    const satChartRef = useRef(null);
    const bugLabelsChartRef = useRef(null);

    const fetchSatBugs = useCallback(async () => {
        if (!archive.id) return;
        try {
            const response = await fetch(`${API_BASE_URL}/archives/${archive.id}/sat-bugs`);
            if (!response.ok) throw new Error('Failed to fetch SAT bugs.');
            const data = await response.json();
            setSatBugs(data.data || []);
        } catch (err) {
            console.error(err);
        }
    }, [archive.id]);

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
        fetchSatBugs();
    }, [archive.id, fetchSatBugs]);

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

    const handlePdfExport = async () => {
        setIsPdfExporting(true);
        await onExportToPdf(archive, items, defects, satBugs, {
            metricsChart: metricsChartRef.current,
            satChart: satChartRef.current,
            bugLabelsChart: bugLabelsChartRef.current
        });
        setIsPdfExporting(false);
    };

    const handleExcelExport = async () => {
        setIsExcelExporting(true);
        await onExportToExcel(archive, items, defects, satBugs);
        setIsExcelExporting(false);
    };

    const handleOpenSatBugModal = (bug = null) => {
        setBugToEdit(bug);
        setIsSatBugModalOpen(true);
    };

    const handleSaveSatBug = () => {
        setIsSatBugModalOpen(false);
        setBugToEdit(null);
        fetchSatBugs();
    };

    const handleDeleteSatBugRequest = (bug) => {
        setBugToDelete(bug);
    };

    const handleConfirmDeleteSatBug = async () => {
        if (!bugToDelete) return;
        try {
            const response = await fetch(`${API_BASE_URL}/archives/sat-bugs/${bugToDelete.id}`, {
                method: 'DELETE',
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Failed to delete bug.');
            showMainMessage(result.message, 'success');
            fetchSatBugs();
        } catch (error) {
            showMainMessage(error.message, 'error');
        } finally {
            setBugToDelete(null);
        }
    };

    const ourMetricsChartData = {
        labels: ['Done', 'Not Done'],
        datasets: [{
            data: [archive.metrics.doneCount, archive.metrics.notDoneCount],
            backgroundColor: ['#28a745', '#dc3545'],
            borderColor: '#FFFAF0',
            borderWidth: 2,
        }],
    };

    const ourMetricsLegendItems = [];
    if (archive.metrics.doneCount > 0) {
        ourMetricsLegendItems.push({ text: 'Done', color: '#28a745' });
    }
    if (archive.metrics.notDoneCount > 0) {
        ourMetricsLegendItems.push({ text: 'Not Done', color: '#dc3545' });
    }

    const { data: satChartData, legendItems: satLegendItems } = getSatChartConfig(archive.sat_report);
    
    const getBugLabelsChartConfig = (bugs) => {
        if (!bugs || bugs.length === 0) return { data: null, legendItems: [] };
    
        const labeledBugs = bugs.filter(bug => bug.label);
    
        if (labeledBugs.length === 0) {
            return { data: null, legendItems: [] };
        }
    
        const labelCounts = labeledBugs.reduce((acc, bug) => {
            acc[bug.label] = (acc[bug.label] || 0) + 1;
            return acc;
        }, {});
    
        const labels = Object.keys(labelCounts);
        const data = Object.values(labelCounts);
    
        const colorPalette = ['#4e73df', '#1cc88a', '#36b9cc', '#f6c23e', '#e74a3b', '#858796', '#5a5c69', '#f8f9fc', '#5e72e4', '#ffd600', '#2dce89', '#fb6340'];
        const labelColorMap = {};
        let colorIndex = 0;
        
        const backgroundColor = labels.map(label => {
            if (!labelColorMap[label]) {
                labelColorMap[label] = colorPalette[colorIndex % colorPalette.length];
                colorIndex++;
            }
            return labelColorMap[label];
        });
    
        const legendItems = labels.map(label => ({
            text: `${label} (${labelCounts[label]})`,
            color: labelColorMap[label]
        }));
    
        return {
            data: {
                labels,
                datasets: [{ data, backgroundColor, borderColor: '#FFFAF0', borderWidth: 2 }]
            },
            legendItems
        };
    };

    const { data: bugLabelsChartData, legendItems: bugLabelsLegendItems } = getBugLabelsChartConfig(satBugs);

    // --- MODIFICATION START ---
    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            title: { display: false },
            tooltip: {
                callbacks: {
                    label: function(context) {
                        let label = context.label || '';
                        if (label.length > 30) { // Truncate labels longer than 30 chars
                            label = label.substring(0, 30) + '...';
                        }
                        const value = context.formattedValue || '';
                        return `${label}: ${value}`;
                    }
                }
            }
        },
        animation: false
    };
    // --- MODIFICATION END ---

    return (
        <div className="archived-details-view">
            {isPdfExporting && (
                <div className="pdf-export-overlay">
                    <div className="loading-spinner"></div>
                    <p>Generating PDF, please wait...</p>
                </div>
            )}
            <div className="details-header">
                <button type="button" onClick={onBack} className="back-button">Back to Archives</button>
                <h2>Archived Release Details</h2>
            </div>
            <div className="release-card">
                <div className="release-card-header">
                    <h3>{archive.name}</h3>
                    <div className="release-card-header-details">
                        <span className="due-date">Closed: {new Date(archive.closed_at).toLocaleString()}</span>
                    </div>
                </div>

                <div className="release-card-body archived-details-body">
                    
                    <div className="archived-details-column archived-charts-column">
                        <div className="archived-details-chart-wrapper">
                            <h4>Our Final Metrics</h4>
                            <div className="archived-details-chart">
                                <Pie data={ourMetricsChartData} options={chartOptions} ref={metricsChartRef} />
                            </div>
                            <ChartLegend items={ourMetricsLegendItems} />
                        </div>

                        {satChartData && (
                            <div className="archived-details-chart-wrapper">
                                <h4>SAT Report</h4>
                                <div className="archived-details-chart">
                                    <Pie data={satChartData} options={chartOptions} ref={satChartRef} />
                                </div>
                                <ChartLegend items={satLegendItems} />
                            </div>
                        )}

                        {bugLabelsChartData && (
                            <div className="archived-details-chart-wrapper">
                                <h4>SAT Bug Labels</h4>
                                <div className="archived-details-chart">
                                    <Pie data={bugLabelsChartData} options={chartOptions} ref={bugLabelsChartRef} />
                                </div>
                                <ChartLegend items={bugLabelsLegendItems} />
                            </div>
                        )}
                    </div>

                    {archive.sat_report && (
                        <div className="archived-details-column sat-bugs-column">
                            <div className="sat-bugs-container">
                                <div className="sat-bugs-header">
                                    <h4>SAT Bugs ({satBugs.length})</h4>
                                    <button onClick={() => handleOpenSatBugModal(null)} className="add-sat-bug-button">+</button>
                                </div>
                                <ul className="sat-bugs-list">
                                    {satBugs.length > 0 ? satBugs.map(bug => (
                                        <li key={bug.id}>
                                            <a href={bug.link} target="_blank" rel="noopener noreferrer" title={bug.title}>{bug.title}</a>
                                            <div className="bug-actions">
                                                <button onClick={() => handleOpenSatBugModal(bug)} className="bug-edit-btn">Edit</button>
                                                <button onClick={() => handleDeleteSatBugRequest(bug)} className="bug-delete-btn">X</button>
                                            </div>
                                        </li>
                                    )) : <li className="no-bugs-message">No SAT bugs added yet.</li>}
                                </ul>
                            </div>
                        </div>
                    )}

                    <div className="archived-details-column requirements-column">
                        <div className="release-requirements">
                             <h4>Requirements ({items.length})</h4>
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
                    </div>

                    <div className="archived-details-column defects-column">
                        <ArchivedDefectList defects={defects} onNavigate={onNavigateToDefect} />
                    </div>

                </div>
                <div className="release-card-footer">
                    <div className="release-card-actions">
                        {archive.close_action === 'archive_only' && (
                            <button type="button" onClick={() => onCompleteRelease(archive)} className="button-complete">Complete Release</button>
                        )}
                        <button type="button" onClick={handleExcelExport} className="button-export" disabled={isExcelExporting}>
                            {isExcelExporting ? 'Exporting...' : 'Export to Excel'}
                        </button>
                        <button type="button" onClick={handlePdfExport} className="button-export" disabled={isPdfExporting}>
                            {isPdfExporting ? 'Exporting...' : 'Export to PDF'}
                        </button>
                        <button type="button" onClick={() => onAddSatReport(archive)} className="button-edit">
                            {archive.sat_report ? 'Update SAT Results' : 'Add SAT Results'}
                        </button>
                    </div>
                </div>
            </div>
            <SatBugModal
                isOpen={isSatBugModalOpen}
                onClose={() => setIsSatBugModalOpen(false)}
                onSave={handleSaveSatBug}
                archiveId={archive.id}
                bugToEdit={bugToEdit}
                showMainMessage={showMainMessage}
            />
            <ConfirmationModal
                isOpen={!!bugToDelete}
                onClose={() => setBugToDelete(null)}
                onConfirm={handleConfirmDeleteSatBug}
                title="Confirm Delete"
                message={`Are you sure you want to delete the SAT bug "${bugToDelete?.title}"?`}
            />
        </div>
    );
};

const AddSatReportModal = ({ isOpen, onClose, onSave, archive, showMainMessage }) => {
    const initialData = {
        passed: archive?.sat_report?.passed || 0,
        failed: archive?.sat_report?.failed || 0,
        blocked: archive?.sat_report?.blocked || 0,
        pending: archive?.sat_report?.pending || 0,
        executing: archive?.sat_report?.executing || 0,
        aborted: archive?.sat_report?.aborted || 0,
    };
    const [satData, setSatData] = useState(initialData);

    useEffect(() => {
        setSatData(initialData);
    }, [archive]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setSatData(prev => ({ ...prev, [name]: value === '' ? 0 : parseInt(value, 10) }));
    };

    const handleReset = () => {
        setSatData({ passed: 0, failed: 0, blocked: 0, pending: 0, executing: 0, aborted: 0 });
    };

    const total = useMemo(() => Object.values(satData).reduce((sum, val) => sum + (val || 0), 0), [satData]);
    const isTotalValid = useMemo(() => total === 100 || total === 0, [total]);

    const handleSave = async () => {
        if (total !== 100 && total !== 0) {
            showMainMessage('Total must be exactly 100% or 0% to clear the report.', 'error');
            return;
        }
        try {
            const response = await fetch(`${API_BASE_URL}/archives/${archive.id}/sat-report`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(satData),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Failed to save SAT report.');
            showMainMessage(result.message, 'success');
            onSave();
        } catch (error) {
            showMainMessage(error.message, 'error');
        }
    };

    const fields = ['passed', 'failed', 'blocked', 'pending', 'executing', 'aborted'];

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`SAT Results for ${archive?.name}`}>
            <div className="sat-modal-grid">
                {fields.map(field => (
                    <div className="form-group" key={field}>
                        <label htmlFor={field}>{field.charAt(0).toUpperCase() + field.slice(1)} (%)</label>
                        <input
                            type="number"
                            id={field}
                            name={field}
                            value={satData[field]}
                            onChange={handleChange}
                            onFocus={e => e.target.select()}
                            min="0"
                            max="100"
                        />
                    </div>
                ))}
            </div>
            <div className={`sat-total-summary ${isTotalValid ? 'ok' : 'error'}`}>
                Total: {total}%
                {!isTotalValid && <div style={{fontSize: '0.8em', marginTop: '5px'}}>Total must be 100% to save, or 0% to clear.</div>}
            </div>
            <div className="modal-actions">
                <button type="button" onClick={onClose} className="modal-button-cancel">Cancel</button>
                <button type="button" onClick={handleReset} className="modal-button-reset">Reset</button>
                <button type="button" onClick={handleSave} disabled={!isTotalValid} className="modal-button-save">Save Report</button>
            </div>
        </Modal>
    );
};

const ComparisonView = ({ archives, onBack, allProcessedRequirements, showMainMessage }) => {
    const [detailedArchives, setDetailedArchives] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isPdfExporting, setIsPdfExporting] = useState(false);
    
    const chartRefs = useRef({});

    useEffect(() => {
        if (archives.length === 0) {
            setIsLoading(false);
            return;
        }

        const fetchAllDetails = async () => {
            try {
                const promises = archives.map(archive =>
                    fetch(`${API_BASE_URL}/archives/details/${archive.id}`).then(res => res.json())
                );
                const results = await Promise.all(promises);
                const enrichedArchives = archives.map((archive, index) => {
                    const details = results[index].data || [];
                    const requirementsWithDefects = details.map(item => {
                        const requirement = allProcessedRequirements.find(req => req.id === item.requirement_group_id);
                        return {
                            ...item,
                            linkedDefects: requirement ? requirement.linkedDefects : [],
                            link: requirement ? requirement.currentStatusDetails.link : ''
                        };
                    });
                    return { ...archive, requirements: requirementsWithDefects };
                });
                setDetailedArchives(enrichedArchives);
            } catch (error)
            {
                showMainMessage('Failed to load detailed data for comparison.', 'error');
            } finally {
                setIsLoading(false);
            }
        };
        fetchAllDetails();
    }, [archives, allProcessedRequirements, showMainMessage]);

    const handleExportToPdf = async () => {
        setIsPdfExporting(true);

        const pdf = new jsPDF('p', 'mm', 'a4');
        let yPos = 15;
        const pageHeight = pdf.internal.pageSize.height;
        const leftMargin = 15;
        
        try {
            for (const archive of detailedArchives) {
                if (yPos > pageHeight - 120) {
                    pdf.addPage();
                    yPos = 15;
                }

                const allDefects = archive.requirements.flatMap(req => req.linkedDefects);
                const uniqueDefects = Array.from(new Map(allDefects.map(d => [d.id, d])).values());
                const defectCount = uniqueDefects.length;

                pdf.setFontSize(16);
                pdf.text(archive.name, leftMargin, yPos);
                yPos += 8;

                pdf.setFontSize(10);
                pdf.text(`Closed: ${new Date(archive.closed_at).toLocaleDateString()}`, leftMargin, yPos);
                yPos += 5;
                pdf.text(`Total Requirements: ${archive.metrics.doneCount + archive.metrics.notDoneCount}`, leftMargin, yPos);
                yPos += 5;
                pdf.text(`Total Defects: ${defectCount}`, leftMargin, yPos);
                yPos += 10;

                const chartStartY = yPos;
                const chartWidth = 45;
                const chartHeight = 45;

                const metricsChart = chartRefs.current[`metrics-${archive.id}`];
                const satChart = chartRefs.current[`sat-${archive.id}`];
                
                let finalMetricsLegendY = chartStartY + chartHeight + 5;
                let finalSatLegendY = chartStartY + chartHeight + 5;

                const metricsChartX = leftMargin + 15;
                pdf.setFontSize(12);
                pdf.text('Our Final Metrics', metricsChartX, yPos);
                yPos += 5;
                if (metricsChart) {
                    metricsChart.resize(300, 300);
                    const metricsImg = metricsChart.toBase64Image();
                    metricsChart.resize();

                    pdf.addImage(metricsImg, 'PNG', metricsChartX, yPos, chartWidth, chartHeight);

                    const metricsLegend = [{text: 'Done', color: '#28a745'}, {text: 'Not Done', color: '#dc3545'}];
                    let legendY = yPos + chartHeight + 5;
                    pdf.setFontSize(9);
                    metricsLegend.forEach(item => {
                        pdf.setFillColor(item.color);
                        pdf.rect(metricsChartX, legendY, 3, 3, 'F');
                        pdf.text(item.text, metricsChartX + 5, legendY + 2.5);
                        legendY += 5;
                    });
                    finalMetricsLegendY = legendY;
                }
                
                const satChartX = leftMargin + chartWidth + 45;
                yPos = chartStartY;
                pdf.setFontSize(12);
                pdf.text('SAT Report', satChartX, yPos);
                yPos += 5;
                const { legendItems: satLegendItems } = getSatChartConfig(archive.sat_report);
                if (satChart && satLegendItems.length > 0) {
                    satChart.resize(300, 300);
                    const satImg = satChart.toBase64Image();
                    satChart.resize();

                    pdf.addImage(satImg, 'PNG', satChartX, yPos, chartWidth, chartHeight);

                    let legendY = yPos + chartHeight + 5;
                    pdf.setFontSize(9);
                    satLegendItems.forEach(item => {
                        pdf.setFillColor(item.color);
                        pdf.rect(satChartX, legendY, 3, 3, 'F');
                        pdf.text(item.text, satChartX + 5, legendY + 2.5);
                        legendY += 5;
                    });
                    finalSatLegendY = legendY;
                } else {
                    pdf.setDrawColor(220, 220, 220);
                    pdf.setFillColor(250, 250, 250);
                    pdf.rect(satChartX, yPos, chartWidth, chartHeight, 'FD');
                    pdf.setTextColor(150, 150, 150);
                    pdf.text('No SAT Report', satChartX + chartWidth / 2, yPos + chartHeight / 2, { align: 'center', baseline: 'middle' });
                    pdf.setTextColor(0, 0, 0);
                }
                
                yPos = Math.max(finalMetricsLegendY, finalSatLegendY) + 10;

                if (archive.requirements && archive.requirements.length > 0) {
                    if (yPos > pageHeight - 60) {
                        pdf.addPage();
                        yPos = 15;
                    }

                    pdf.setFontSize(12);
                    pdf.text('Requirements', leftMargin, yPos);
                    yPos += 8;

                    const tableBody = archive.requirements.flatMap(req => {
                        const mainRow = [
                            { content: req.requirement_title, data: { url: req.link } },
                            (req.linkedDefects && req.linkedDefects.length > 0)
                                ? { content: req.linkedDefects[0].title, data: { url: req.linkedDefects[0].link } }
                                : 'None'
                        ];
                        const additionalDefectRows = (req.linkedDefects || []).slice(1).map(defect => [
                            '',
                            { content: defect.title, data: { url: defect.link } }
                        ]);
                        return [mainRow, ...additionalDefectRows];
                    });

                    autoTable(pdf, {
                        startY: yPos,
                        head: [['Requirement', 'Linked Defect']],
                        body: tableBody,
                        theme: 'grid',
                        headStyles: { fillColor: [76, 56, 48] },
                        styles: { fontSize: 8, cellPadding: 2 },
                        columnStyles: { 0: { cellWidth: 'auto' }, 1: { cellWidth: 'auto' } },
                        didParseCell: function (data) {
                            if (data.cell.raw?.data?.url) {
                                data.cell.styles.textColor = [0, 0, 255];
                            }
                        },
                        didDrawCell: function (data) {
                            if (data.cell.raw?.data?.url && data.section === 'body') {
                                pdf.link(data.cell.x, data.cell.y, data.cell.width, data.cell.height, { url: data.cell.raw.data.url });
                            }
                        }
                    });
                    yPos = pdf.lastAutoTable.finalY + 15;
                }
            }
            pdf.save('release-comparison.pdf');
            showMainMessage('PDF exported successfully!', 'success');
        } catch (error) {
            console.error("PDF Export Error:", error);
            showMainMessage('Failed to export PDF. See console for details.', 'error');
        } finally {
            setIsPdfExporting(false);
        }
    };

    const onScreenChartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: {
            legend: { display: false },
            title: { display: false },
        },
    };

    if (isLoading) return <LoadingSpinner />;

    return (
        <div className="comparison-view">
            {isPdfExporting && (
                <div className="pdf-export-overlay">
                    <div className="loading-spinner"></div>
                    <p>Generating PDF, please wait...</p>
                </div>
            )}

            <div className="comparison-header">
                <button type="button" onClick={onBack} className="back-button">&#8592; Back to Archives</button>
                <h2>Compare Archived Releases</h2>
                <button type="button" onClick={handleExportToPdf} className="button-export" disabled={isPdfExporting}>
                    {isPdfExporting ? 'Exporting...' : 'Export to PDF'}
                </button>
            </div>
            <div className="comparison-container">
                {detailedArchives.map(archive => {
                    const { data: satChartData, legendItems: satLegendItems } = getSatChartConfig(archive.sat_report);
                    const totalRequirements = archive.metrics.doneCount + archive.metrics.notDoneCount;
                    return (
                        <div key={archive.id} className="comparison-column">
                            <h3>{archive.name}</h3>
                            <div className="comparison-metrics">
                                <div className="metric-item">
                                    <span className="metric-label">Closed Date:</span>
                                    <span className="metric-value">{new Date(archive.closed_at).toLocaleDateString()}</span>
                                </div>
                                <div className="metric-item">
                                    <span className="metric-label">Total Requirements:</span>
                                    <span className="metric-value">{totalRequirements}</span>
                                </div>
                            </div>
                            <div className="comparison-charts">
                                <div className="comparison-chart-wrapper">
                                    <h4>Our Final Metrics</h4>
                                    <div className="chart-container">
                                        <Pie
                                            ref={el => (chartRefs.current[`metrics-${archive.id}`] = el)}
                                            data={{
                                                labels: ['Done', 'Not Done'],
                                                datasets: [{
                                                    data: [archive.metrics.doneCount, archive.metrics.notDoneCount],
                                                    backgroundColor: ['#28a745', '#dc3545'],
                                                    borderColor: '#FFFAF0',
                                                    borderWidth: 2,
                                                }],
                                            }}
                                            options={onScreenChartOptions}
                                        />
                                    </div>
                                    <div className="legend-wrapper">
                                        <ChartLegend items={[{text: 'Done', color: '#28a745'}, {text: 'Not Done', color: '#dc3545'}]} />
                                    </div>
                                </div>
                                <div className="comparison-chart-wrapper">
                                    <h4>SAT Report</h4>
                                    <div className="chart-container">
                                        {satChartData ? (
                                            <Pie
                                                ref={el => (chartRefs.current[`sat-${archive.id}`] = el)}
                                                data={satChartData}
                                                options={onScreenChartOptions}
                                            />
                                        ) : (
                                            <div className="empty-chart-placeholder">No SAT Report</div>
                                        )}
                                    </div>
                                    <div className="legend-wrapper">
                                        <ChartLegend items={satLegendItems} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
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
    const [isSatModalOpen, setIsSatModalOpen] = useState(false);
    const [archiveForSat, setArchiveForSat] = useState(null);
    const [comparisonList, setComparisonList] = useState([]);
    const [isComparing, setIsComparing] = useState(false);

    const handleCompleteRelease = async (archive) => {
        try {
            const response = await fetch(`${API_BASE_URL}/archives/${archive.id}/complete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Failed to complete release.');
            showMainMessage(result.message, 'success');
            fetchData();
            fetchArchivedReleases();
            setSelectedArchive(null);
        } catch (error) {
            showMainMessage(error.message, 'error');
        }
    };

const releasesPageTooltipContent = (
    <>
        <strong>Release Dashboard Guide</strong>
        <p>Manage your project's release lifecycle. Switch between Active and Archived views to see current progress or historical data.</p>
        
        <strong style={{ marginTop: '10px', display: 'block' }}>Active Releases</strong>
        <ul style={{ paddingLeft: '20px', margin: '5px 0' }}>
            <li>Track real-time progress with live charts.</li>
            <li>Filter requirements by sprint to focus your view.</li>
            <li>Export detailed reports in Excel or PDF format.</li>
            <li>Finalize a release to create a permanent record in the archives.</li>
        </ul>

        <strong style={{ marginTop: '10px', display: 'block' }}>Archived Releases</strong>
        <ul style={{ paddingLeft: '20px', margin: '5px 0' }}>
            <li>Review final metrics and frozen requirement lists.</li>
            <li>Add SAT results and log specific SAT Bugs found during testing.</li>
            <li>Check the boxes on multiple archives and click 'Compare Selected' for a side-by-side analysis!</li>
        </ul>
    </>
);

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
        setComparisonList([]);
        setIsComparing(false);
        setSelectedArchive(null);
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
            const data = result.data || [];
            setArchivedReleases(data);
            return data;
        } catch (error) {
            showMainMessage(error.message, 'error');
            setArchivedReleases([]);
            return [];
        } finally {
            setIsLoading(false);
        }
    }, [selectedProject, showMainMessage]);

    useEffect(() => {
        if (selectedProject) {
            if (view === 'active') {
                fetchActiveReleases();
            } else {
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
            fetchActiveReleases();
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

    const handleOpenSatModal = (archive) => {
        setArchiveForSat(archive);
        setIsSatModalOpen(true);
    };

    const handleSaveSatReport = async () => {
        setIsSatModalOpen(false);
        const updatedReleases = await fetchArchivedReleases();
        if (selectedArchive) {
            const updatedArchive = updatedReleases.find(ar => ar.id === selectedArchive.id);
            setSelectedArchive(updatedArchive || null);
        }
    };
    
    const handleToggleComparison = (archiveId) => {
        setComparisonList(prev =>
            prev.includes(archiveId)
                ? prev.filter(id => id !== archiveId)
                : [...prev, archiveId]
        );
    };

    const handleExportReleaseToExcel = async (release, requirements, defects) => {
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
                        if ((headerName === 'Requirement Link' || headerName === 'Defect Link' || headerName === 'Link') && cell.v) {
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

        const reqHeaders = ['Release Name', 'Requirement Name', 'Requirement Link', 'Type', 'Sprint', 'Linked Defects', 'Status'];
        const requirementsData = requirements.map(req => ({
            'Release Name': release.name,
            'Requirement Name': req.requirementUserIdentifier,
            'Requirement Link': req.currentStatusDetails.link || '',
            'Type': req.currentStatusDetails.type || '',
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

        const reqDefectHeaders = ['Requirement Name', 'Type', 'Defect Name', 'Sprint', 'Return to Dev Count'];
        const reqDefectData = [];
        requirements.forEach(req => {
            if (req.linkedDefects && req.linkedDefects.length > 0) {
                req.linkedDefects.forEach(defect => {
                    reqDefectData.push({
                        'Requirement Name': req.requirementUserIdentifier,
                        'Type': req.currentStatusDetails.type || '',
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
                    row['Type'],
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

    const handleExportActiveReleaseToPdf = async (release, requirements, defects, chartRefs, sprintInfo) => {
        const { reqChart, defectChart } = chartRefs;
        const reqChartData = reqChart?.data;
        const defectChartData = defectChart?.data;
    
        if (!reqChartData) {
            showMainMessage('Could not generate PDF. Requirements chart data is not available.', 'error');
            return;
        }
    
        const pdf = new jsPDF('p', 'mm', 'a4');
        let yPos = 15;
        const leftMargin = 15;
    
        const generateChartImage = (data) => {
            if (!data) return null;
            
            const canvas = document.createElement('canvas');
            canvas.width = 800;
            canvas.height = 800;
            const ctx = canvas.getContext('2d');
    
            const tempChart = new ChartJS(ctx, {
                type: 'pie',
                data: data,
                options: {
                    responsive: false,
                    animation: { duration: 0 },
                    plugins: {
                        legend: { display: false },
                        title: { display: false },
                    },
                },
            });
    
            const imageData = tempChart.toBase64Image('image/png', 1.0);
            tempChart.destroy();
    
            return imageData;
        };
    
        const drawLegend = (pdfDoc, x, y, items) => {
            const itemHeight = 5;
            const boxSize = 3;
            pdfDoc.setFontSize(9);
            items.forEach((item, index) => {
                const currentY = y + (index * itemHeight);
                pdfDoc.setFillColor(item.color);
                pdfDoc.rect(x, currentY, boxSize, boxSize, 'F');
                pdfDoc.text(item.text, x + boxSize + 2, currentY + boxSize - 0.5);
            });
            return y + (items.length * itemHeight);
        };
    
        try {
            const { selectedSprints, availableSprints } = sprintInfo || {};

            let sprintTitle = '';
            if (selectedSprints && availableSprints && selectedSprints.length > 0 && selectedSprints.length < availableSprints.length) {
                const sprintNumbers = selectedSprints.filter(s => s !== 'All').join(', ');
                if (sprintNumbers) {
                    sprintTitle = ` - ${selectedSprints.length > 1 ? '' : ''} ${sprintNumbers}`;
                }
            }

            pdf.setFontSize(18);
            pdf.text(release.name + sprintTitle, leftMargin, yPos);
            yPos += 8;
            pdf.setFontSize(12);
            pdf.text(`Due: ${new Date(release.release_date).toLocaleDateString()}`, leftMargin, yPos);
            yPos += 5;
            pdf.text(`Total Requirements: ${requirements.length}`, leftMargin, yPos);
            yPos += 5;
            pdf.text(`Total Defects: ${defects.length}`, leftMargin, yPos);
            yPos += 10;
    
            const chartStartY = yPos;
            const chartWidth = 60;
            const chartHeight = 60;
    
            const reqChartX = leftMargin + 10;
            pdf.setFontSize(14);
            pdf.text('Requirements Progress', reqChartX, yPos);
            yPos += 5;
    
            const reqImg = generateChartImage(reqChartData);
            if (reqImg) {
                pdf.addImage(reqImg, 'PNG', reqChartX, yPos, chartWidth, chartHeight);
            }
            let reqLegendY = yPos + chartHeight + 5;
    
            let reqDone = 0;
            requirements.forEach(r => { if (r.currentStatusDetails.status === 'Done') reqDone++; });
            const reqNotDone = requirements.length - reqDone;
            const reqLegendItems = [
                { text: `Done (${reqDone})`, color: '#4CAF50' },
                { text: `Not Done (${reqNotDone})`, color: '#F44336' }
            ];
            const finalReqY = drawLegend(pdf, reqChartX + 15, reqLegendY, reqLegendItems);
    
            yPos = chartStartY;
            const defectChartX = leftMargin + chartWidth + 30;
            pdf.setFontSize(14);
            pdf.text('Defect Status', defectChartX, yPos);
            yPos += 5;
    
            let finalDefectY = yPos + chartHeight + 5;
    
            if (defects.length > 0 && defectChartData) {
                const defectImg = generateChartImage(defectChartData);
                if (defectImg) {
                    pdf.addImage(defectImg, 'PNG', defectChartX, yPos, chartWidth, chartHeight);
                }
                let defectLegendY = yPos + chartHeight + 5;
    
                let defDone = 0, defNotDone = 0, defClosed = 0;
                defects.forEach(d => {
                    if (d.status === 'Done') defDone++;
                    else if (d.status === 'Closed') defClosed++;
                    else defNotDone++;
                });
                const defectLegendItems = [
                    { text: `Done (${defDone})`, color: '#4CAF50' },
                    { text: `Not Done (${defNotDone})`, color: '#F44336' },
                    { text: `Closed (${defClosed})`, color: '#808080' }
                ].filter(item => parseInt(item.text.match(/\((\d+)\)/)[1], 10) > 0);
                
                finalDefectY = drawLegend(pdf, defectChartX + 15, defectLegendY, defectLegendItems);
            } else {
                pdf.setDrawColor(220, 220, 220);
                pdf.setFillColor(250, 250, 250);
                pdf.rect(defectChartX, yPos, chartWidth, chartHeight, 'FD');
                pdf.setTextColor(150, 150, 150);
                pdf.text('No Defects', defectChartX + chartWidth / 2, yPos + chartHeight / 2, { align: 'center', baseline: 'middle' });
                pdf.setTextColor(0, 0, 0);
            }
            
            yPos = Math.max(finalReqY, finalDefectY) + 10;
    
            if (requirements.length > 0) {
                if (yPos > 260) { pdf.addPage(); yPos = 15; }
                pdf.setFontSize(14);
                pdf.text('Requirements', leftMargin, yPos);
                yPos += 8;
                const body = requirements.map(r => [
                    { content: r.requirementUserIdentifier, data: { url: r.currentStatusDetails.link || '' } },
                    r.currentStatusDetails.sprint || 'N/A',
                    r.currentStatusDetails.status
                ]);
                autoTable(pdf, {
                    startY: yPos,
                    head: [['Requirement', 'Sprint', 'Status']],
                    body: body,
                    theme: 'grid',
                    headStyles: { fillColor: [76, 56, 48] },
                    columnStyles: { 1: { cellWidth: 25 } },
                    didParseCell: function (data) {
                        if (data.cell.raw?.data?.url) {
                            data.cell.styles.textColor = [0, 0, 255];
                        }
                    },
                    didDrawCell: function (data) {
                        if (data.column.index === 0 && data.cell.raw?.data?.url && data.section === 'body') {
                            pdf.link(data.cell.x, data.cell.y, data.cell.width, data.cell.height, { url: data.cell.raw.data.url });
                        }
                    }
                });
                yPos = pdf.lastAutoTable.finalY + 10;
            }
    
            if (defects.length > 0) {
                if (yPos > 260) { pdf.addPage(); yPos = 15; }
                pdf.setFontSize(14);
                pdf.text('Defects', leftMargin, yPos);
                yPos += 8;
                const body = defects.map(d => [
                    { content: d.title, data: { url: d.link || '' } },
                    d.status
                ]);
                autoTable(pdf, {
                    startY: yPos,
                    head: [['Defect', 'Status']],
                    body: body,
                    theme: 'grid',
                    headStyles: { fillColor: [76, 56, 48] },
                    didParseCell: function (data) {
                        if (data.cell.raw?.data?.url) {
                            data.cell.styles.textColor = [0, 0, 255];
                        }
                    },
                    didDrawCell: function (data) {
                        if (data.column.index === 0 && data.cell.raw?.data?.url && data.section === 'body') {
                            pdf.link(data.cell.x, data.cell.y, data.cell.width, data.cell.height, { url: data.cell.raw.data.url });
                        }
                    }
                });
            }
    
            pdf.save(`${release.name}${sprintTitle}_Details.pdf`);
            showMainMessage('PDF exported successfully!', 'success');
        } catch (error) {
            console.error("Active Release PDF Export Error:", error);
            showMainMessage('Failed to export PDF. See console for details.', 'error');
        }
    };

    const handleExportArchivedReleaseToExcel = async (archive, items, defects, satBugs) => {
        const returnCountsMap = new Map();

        try {
            const project = archive.project;
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
                        if ((headerName === 'Requirement Link' || headerName === 'Defect Link' || headerName === 'Link') && cell.v) {
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

        const wb = XLSX.utils.book_new();

        const reqHeaders = ['Release Name', 'Requirement Name', 'Requirement Link', 'Type', 'Linked Defects', 'Final Status'];
        const requirementsData = items.map(item => {
            const requirement = allProcessedRequirements.find(req => req.id === item.requirement_group_id);
            return {
                'Release Name': archive.name,
                'Requirement Name': item.requirement_title,
                'Requirement Link': requirement ? requirement.currentStatusDetails.link : '',
                'Type': requirement ? requirement.currentStatusDetails.type : '',
                'Linked Defects': requirement ? (requirement.linkedDefects || []).map(d => d.title).join('\n') : '',
                'Final Status': item.final_status
            };
        });

        if (requirementsData.length > 0) {
            const wsReqs = processSheet(requirementsData, reqHeaders);
            XLSX.utils.book_append_sheet(wb, wsReqs, 'Requirements');
        }

        const reqDefectHeaders = ['Requirement Name', 'Requirement Link', 'Type', 'Defect Name', 'Defect Link', 'Return to Dev Count'];
        const reqDefectData = [];
        items.forEach(item => {
            const requirement = allProcessedRequirements.find(req => req.id === item.requirement_group_id);
            if (requirement && requirement.linkedDefects && requirement.linkedDefects.length > 0) {
                requirement.linkedDefects.forEach(defect => {
                    reqDefectData.push({
                        'Requirement Name': item.requirement_title,
                        'Requirement Link': requirement.currentStatusDetails.link,
                        'Type': requirement.currentStatusDetails.type || '',
                        'Defect Name': defect.title,
                        'Defect Link': defect.link,
                        'Return to Dev Count': returnCountsMap.get(defect.id) || 0
                    });
                });
            }
        });

        if (reqDefectData.length > 0) {
            const wsReqDefects = processSheet(reqDefectData, reqDefectHeaders);
            XLSX.utils.book_append_sheet(wb, wsReqDefects, 'Requirements with Defects');
        }

        const uniqueDefects = Array.from(new Map(defects.map(d => [d.id, d])).values());
        const defectHeaders = ['Defect Name', 'Defect Link', 'Linked Requirements', 'Status', 'Return to Dev Count'];
        const defectsData = uniqueDefects.map(defect => {
            const linkedRequirements = allProcessedRequirements
                .filter(req => req.linkedDefects && req.linkedDefects.some(d => d.id === defect.id));
            const linkedRequirementsNames = linkedRequirements.map(req => req.requirementUserIdentifier);
            return {
                'Defect Name': defect.title,
                'Defect Link': defect.link || '',
                'Linked Requirements': linkedRequirementsNames.join('\n'),
                'Status': defect.status,
                'Return to Dev Count': returnCountsMap.get(defect.id) || 0
            };
        });

        if (defectsData.length > 0) {
            const wsDefects = processSheet(defectsData, defectHeaders);
            XLSX.utils.book_append_sheet(wb, wsDefects, 'Defects');
        }

        if (satBugs && satBugs.length > 0) {
            const satBugsHeaders = ['Title', 'Link', 'Estimation (h)', 'Label'];
            let totalEstimationInHours = 0;

            const satBugsData = satBugs.map(bug => {
                const estimationInHours = bug.estimation || 0;
                totalEstimationInHours += estimationInHours;
                return {
                    'Title': bug.title,
                    'Link': bug.link,
                    'Estimation (h)': estimationInHours,
                    'Label': bug.label || ''
                };
            });

            const totalDays = Math.floor(totalEstimationInHours / 8);
            const remainingHours = totalEstimationInHours % 8;
            const totalEstimationFormatted = `${totalDays}d ${remainingHours}h`;

            const totalRow = {
                'Title': 'Total Estimation',
                'Link': '',
                'Estimation (h)': totalEstimationFormatted,
                'Label': ''
            };

            satBugsData.push(totalRow);

            const wsSatBugs = processSheet(satBugsData, satBugsHeaders);
            XLSX.utils.book_append_sheet(wb, wsSatBugs, 'SAT Bugs');
        }
        
        XLSX.writeFile(wb, `${archive.name}_Archive_Details.xlsx`);
    };

    const handleExportArchivedReleaseToPdf = async (archive, items, defects, satBugs, chartRefs) => {
        if (!chartRefs || !chartRefs.metricsChart) {
            showMainMessage('Could not generate PDF. Chart data is not available.', 'error');
            return;
        }
    
        try {
            const pdf = new jsPDF('p', 'mm', 'a4');
            let yPos = 15;
            const leftMargin = 15;
    
            pdf.setFontSize(18);
            pdf.text(archive.name, leftMargin, yPos);
            yPos += 8;
            pdf.setFontSize(12);
            pdf.text(`Closed: ${new Date(archive.closed_at).toLocaleString()}`, leftMargin, yPos);
            yPos += 5;
            pdf.text(`Total Requirements: ${archive.metrics.doneCount + archive.metrics.notDoneCount}`, leftMargin, yPos);
            yPos += 5;
            pdf.text(`Total Defects: ${defects.length}`, leftMargin, yPos);
            yPos += 10;
    
            const chartStartY = yPos;
            const chartWidth = 45;
            const chartHeight = 45;
            const chartSpacing = 15;
            const metricsChart = chartRefs.metricsChart;
            const satChart = chartRefs.satChart;
            const bugLabelsChart = chartRefs.bugLabelsChart;
            
            let currentX = leftMargin;
            const finalYPositions = [];

            // --- 1. Our Final Metrics Chart (Always drawn) ---
            pdf.setFontSize(12);
            pdf.text('Our Final Metrics', currentX, chartStartY);
            let currentChartY = chartStartY + 5;
            
            metricsChart.resize(300, 300);
            const metricsImg = metricsChart.toBase64Image();
            metricsChart.resize();
            pdf.addImage(metricsImg, 'PNG', currentX, currentChartY, chartWidth, chartHeight);
            
            const metricsLegend = [];
            if (archive.metrics.doneCount > 0) metricsLegend.push({ text: 'Done', color: '#28a745' });
            if (archive.metrics.notDoneCount > 0) metricsLegend.push({ text: 'Not Done', color: '#dc3545' });
            
            let legendY = currentChartY + chartHeight + 5;
            pdf.setFontSize(9);
            metricsLegend.forEach(item => {
                pdf.setFillColor(item.color);
                pdf.rect(currentX, legendY, 3, 3, 'F');
                pdf.text(item.text, currentX + 5, legendY + 2.5);
                legendY += 5;
            });
            finalYPositions.push(legendY);
            currentX += chartWidth + chartSpacing; // Prepare for the next chart

            // --- 2. SAT Report Chart (Conditional) ---
            const { legendItems: satLegendItems } = getSatChartConfig(archive.sat_report);
            if (satChart && satLegendItems.length > 0) {
                pdf.setFontSize(12);
                pdf.text('SAT Report', currentX, chartStartY);
                currentChartY = chartStartY + 5;

                satChart.resize(300, 300);
                const satImg = satChart.toBase64Image();
                satChart.resize();
                pdf.addImage(satImg, 'PNG', currentX, currentChartY, chartWidth, chartHeight);

                let satLegendY = currentChartY + chartHeight + 5;
                pdf.setFontSize(9);
                satLegendItems.forEach(item => {
                    pdf.setFillColor(item.color);
                    pdf.rect(currentX, satLegendY, 3, 3, 'F');
                    pdf.text(item.text, currentX + 5, satLegendY + 2.5);
                    satLegendY += 5;
                });
                finalYPositions.push(satLegendY);
                currentX += chartWidth + chartSpacing; // Prepare for the next chart
            }

            // --- 3. SAT Bug Labels Chart (Conditional) ---
            if (bugLabelsChart && bugLabelsChart.data.labels && bugLabelsChart.data.labels.length > 0) {
                pdf.setFontSize(12);
                pdf.text('SAT Bug Labels', currentX, chartStartY);
                currentChartY = chartStartY + 5;

                bugLabelsChart.resize(300, 300);
                const bugLabelsImg = bugLabelsChart.toBase64Image();
                bugLabelsChart.resize();
                pdf.addImage(bugLabelsImg, 'PNG', currentX, currentChartY, chartWidth, chartHeight);
                
                const bugLabelCounts = satBugs.reduce((acc, bug) => {
                    if (bug.label) {
                        acc[bug.label] = (acc[bug.label] || 0) + 1;
                    }
                    return acc;
                }, {});
    
                const bugLabelsLegendItems = bugLabelsChart.data.labels.map((label, index) => ({
                    text: `${label} (${bugLabelCounts[label] || 0})`,
                    color: bugLabelsChart.data.datasets[0].backgroundColor[index]
                }));
    
                let bugLabelsLegendY = currentChartY + chartHeight + 5;
                pdf.setFontSize(8);
                bugLabelsLegendItems.forEach(item => {
                    pdf.setFillColor(item.color);
                    pdf.rect(currentX, bugLabelsLegendY, 3, 3, 'F');
                    pdf.text(item.text, currentX + 5, bugLabelsLegendY + 2.5);
                    bugLabelsLegendY += 5;
                });
                finalYPositions.push(bugLabelsLegendY);
            }
    
            // Set yPos to start after the tallest chart + legend
            yPos = (finalYPositions.length > 0 ? Math.max(...finalYPositions) : chartStartY + chartHeight + 5) + 10;
    
            if (items.length > 0) {
                const body = items.map(item => {
                    const req = allProcessedRequirements.find(r => r.id === item.requirement_group_id);
                    return [
                        { content: item.requirement_title, data: { url: req ? req.currentStatusDetails.link : '' } },
                        item.final_status
                    ];
                });
    
                autoTable(pdf, {
                    startY: yPos,
                    head: [['Requirement', 'Final Status']],
                    body: body,
                    theme: 'grid',
                    headStyles: { fillColor: [76, 56, 48] },
                    didParseCell: function (data) {
                        if (data.cell.raw?.data?.url) {
                            data.cell.styles.textColor = [0, 0, 255];
                        }
                    },
                    didDrawCell: function (data) {
                        if (data.column.index === 0 && data.cell.raw?.data?.url && data.section === 'body') {
                            pdf.link(data.cell.x, data.cell.y, data.cell.width, data.cell.height, { url: data.cell.raw.data.url });
                        }
                    }
                });
                yPos = pdf.lastAutoTable.finalY + 10;
            }
    
            if (defects.length > 0) {
                const body = defects.map(d => [
                    { content: d.title, data: { url: d.link || '' } },
                    d.status
                ]);
    
                autoTable(pdf, {
                    startY: yPos,
                    head: [['Defect', 'Status']],
                    body: body,
                    theme: 'grid',
                    headStyles: { fillColor: [76, 56, 48] },
                    didParseCell: function (data) {
                        if (data.cell.raw?.data?.url) {
                            data.cell.styles.textColor = [0, 0, 255];
                        }
                    },
                    didDrawCell: function (data) {
                        if (data.column.index === 0 && data.cell.raw?.data?.url && data.section === 'body') {
                            pdf.link(data.cell.x, data.cell.y, data.cell.width, data.cell.height, { url: data.cell.raw.data.url });
                        }
                    }
                });
                yPos = pdf.lastAutoTable.finalY + 10;
            }
    
            if (satBugs && satBugs.length > 0) {
                const body = satBugs.map(bug => [
                    { content: bug.title, data: { url: bug.link } },
                    bug.label || 'N/A'
                ]);
                pdf.setFontSize(12);
                pdf.text('SAT Bugs', leftMargin, yPos);
                yPos += 6;
                autoTable(pdf, {
                    startY: yPos,
                    head: [['Title', 'Label']],
                    body: body,
                    theme: 'grid',
                    headStyles: { fillColor: [76, 56, 48] },
                    didParseCell: function (data) {
                        if (data.column.index === 0 && data.cell.raw?.data?.url) {
                            data.cell.styles.textColor = [0, 0, 255];
                        }
                    },
                    didDrawCell: function (data) {
                        if (data.column.index === 0 && data.cell.raw?.data?.url && data.section === 'body') {
                            pdf.link(data.cell.x, data.cell.y, data.cell.width, data.cell.height, { url: data.cell.raw.data.url });
                        }
                    }
                });
            }
    
            pdf.save(`${archive.name}_Archive_Details.pdf`);
            showMainMessage('PDF exported successfully!', 'success');
        } catch (error) {
            console.error("PDF Export Error:", error);
            showMainMessage('Failed to export PDF. See console for details.', 'error');
        }
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
                        handleExportReleaseToExcel={handleExportReleaseToExcel}
                        onExportToPdf={handleExportActiveReleaseToPdf}
                    />
                ))}
            </div>
        );
    };

    const renderArchivedView = () => {
        const archivesToCompare = archivedReleases.filter(ar => comparisonList.includes(ar.id));

        if (isComparing) {
            return <ComparisonView 
                        archives={archivesToCompare} 
                        onBack={() => setIsComparing(false)} 
                        allProcessedRequirements={allProcessedRequirements}
                        showMainMessage={showMainMessage} 
                    />;
        }
        
        if (selectedArchive) {
            return <ArchivedReleaseDetails 
                archive={selectedArchive} 
                onBack={() => setSelectedArchive(null)} 
                onNavigateToRequirement={onNavigateToRequirement} 
                onNavigateToDefect={onNavigateToDefect} 
                allProcessedRequirements={allProcessedRequirements}
                onAddSatReport={handleOpenSatModal}
                onCompleteRelease={handleCompleteRelease}
                onExportToExcel={handleExportArchivedReleaseToExcel}
                onExportToPdf={handleExportArchivedReleaseToPdf}
                showMainMessage={showMainMessage}
            />;
        }

        if (isLoading) return <LoadingSpinner />;
        if (archivedReleases.length === 0) return <div className="empty-column-message">No archived releases found for this project.</div>;

        return (
            <>
                <div className="archive-controls">
                    <button type="button" onClick={() => setIsComparing(true)} disabled={comparisonList.length < 2}>
                        Compare Selected ({comparisonList.length})
                    </button>
                </div>
                <div className="releases-container archived">
                    {archivedReleases.map(archive => (
                        <div key={archive.id} className="release-card archived-card">
                            <div className="release-card-header archived-card-header">
                                <input 
                                    type="checkbox" 
                                    checked={comparisonList.includes(archive.id)} 
                                    onChange={() => handleToggleComparison(archive.id)}
                                    aria-label={`Select ${archive.name} for comparison`}
                                />
                                <h3>{archive.name}</h3>
                                <span className="due-date">Closed: {new Date(archive.closed_at).toLocaleDateString()}</span>
                            </div>
                            <div className="archived-card-body">
                                <h4>Final Metrics</h4>
                                <div className="archived-metrics">
                                    <span className="metric-item done">Done: {archive.metrics.doneCount}</span>
                                    <span className="metric-item not-done">Not Done: {archive.metrics.notDoneCount}</span>
                                </div>
                            </div>
                            <div className="release-card-actions">
                                <button type="button" onClick={() => setSelectedArchive(archive)} className="button-view-details">View Details</button>
                                <button type="button" onClick={() => onDeleteArchivedRelease(archive)} className="button-delete">Delete</button>
                            </div>
                        </div>
                    ))}
                </div>
            </>
        );
    };

    return (
        <div className="main-content-area">
            <div className="selection-controls">
                <ProjectSelector projects={projects} selectedProject={selectedProject} onSelectProject={onSelectProject} />
                {selectedProject && (
                    <div className="view-toggle-buttons">
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
                    releases={activeReleases}
                    projects={projects}
                    currentProject={selectedProject}
                    initialReleaseId={releaseToEdit.id}
                />
            )}

            <AddSatReportModal
                isOpen={isSatModalOpen}
                onClose={() => setIsSatModalOpen(false)}
                onSave={handleSaveSatReport}
                archive={archiveForSat}
                showMainMessage={showMainMessage}
            />

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
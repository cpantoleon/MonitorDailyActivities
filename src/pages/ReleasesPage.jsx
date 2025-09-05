import React, { useState, useEffect, useCallback } from 'react';
import ProjectSelector from '../components/ProjectSelector';
import FinalizeReleaseModal from '../components/FinalizeReleaseModal';
import EditReleaseModal from '../components/EditReleaseModal';
import ConfirmationModal from '../components/ConfirmationModal';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, Title } from 'chart.js';
import { Pie } from 'react-chartjs-2';
import '../App.css';
import './ReleasesPage.css';

ChartJS.register(ArcElement, Tooltip, Legend, Title);

const API_BASE_URL = '/api';

const LoadingSpinner = () => <div className="loading-spinner"></div>;

const ReleaseCard = ({ release, requirements, defectCount, onNavigate, onFinalize, onEdit }) => {

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

    return (
        <div className="release-card">
            <div className="release-card-header">
                <h3>{release.name}{release.is_current ? <span className="current-tag">Current</span> : ''}</h3>
                <div className="release-card-header-details">
                    <span className="due-date">Due: {new Date(release.release_date).toLocaleDateString()}</span>
                    <span className="defect-count">Defects: {defectCount}</span>
                </div>
            </div>
            <div className="release-card-body">
                <div className="release-charts">
                    {chartData ? (
                        <Pie data={chartData} options={chartOptions} />
                    ) : (
                        <div className="empty-chart-placeholder">No requirements assigned</div>
                    )}
                </div>
                <div className="release-requirements">
                    <h4>Requirements ({requirements.length})</h4>
                    <ul className="requirement-list">
                        {requirements.length > 0 ? requirements.map(req => (
                            <li key={req.id}>
                                <button onClick={() => onNavigate(req)} className="link-button">
                                    {req.requirementUserIdentifier}
                                </button>
                            </li>
                        )) : <li>No requirements in this release.</li>}
                    </ul>
                </div>
            </div>
            <div className="release-card-actions">
                <button onClick={() => onEdit(release)} className="button-edit">&#9998; Edit</button>
                <button onClick={() => onFinalize(release)} className="button-finalize">&#10004; Finalize</button>
            </div>
        </div>
    );
};

const ArchivedReleaseDetails = ({ archive, onBack }) => {
    const [items, setItems] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

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

    return (
        <div className="archived-details-view">
            <div className="details-header">
                <button onClick={onBack} className="back-button">&#8592; Back to Archives</button>
                <h2>Archived Release: {archive.name}</h2>
            </div>
            <div className="release-card detailed-view">
                <div className="release-card-header">
                    <h3>Final Snapshot</h3>
                    <span className="due-date">Closed: {new Date(archive.closed_at).toLocaleString()}</span>
                </div>
                <div className="release-card-body">
                    <div className="release-snapshot-metrics">
                        <h4>Final Metrics</h4>
                        <div className="chart-container">
                            <Pie data={chartData} options={chartOptions} />
                        </div>
                    </div>
                    <div className="release-requirements frozen-list-container">
                        <h4>Frozen Requirements ({items.length})</h4>
                        {isLoading ? <LoadingSpinner /> : (
                            <ul className="requirement-list frozen">
                                {items.length > 0 ? items.map(item => (
                                    <li key={item.id}>
                                        <span>{item.requirement_title}</span> 
                                        <span className={`status-badge status-${item.final_status.toLowerCase().replace(/\s+/g, '-')}`}>{item.final_status}</span>
                                    </li>
                                )) : <li>No requirements were in this release.</li>}
                            </ul>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

const ReleasesPage = ({ projects, selectedProject, onSelectProject, allProcessedRequirements, showMainMessage, onNavigateToRequirement, onEditRelease, onDeleteRelease, fetchData }) => {
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

    const refreshData = useCallback(() => {
        if (view === 'active') {
            fetchActiveReleases();
        } else {
            fetchArchivedReleases();
        }
    }, [view, fetchActiveReleases, fetchArchivedReleases]);

    useEffect(() => {
        if (selectedProject) {
            refreshData();
        }
    }, [view, selectedProject, refreshData]);

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
            refreshData();
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

    const renderActiveView = () => {
        if (isLoading) return <LoadingSpinner />;
        if (activeReleases.length === 0) return <div className="empty-column-message">No active releases found for this project.</div>;

        return (
            <div className="releases-container">
                {activeReleases.map(release => {
                    const requirements = allProcessedRequirements.filter(r => r.currentStatusDetails.releaseId === release.id);
                    const defectCount = requirements.reduce((acc, req) => acc + (req.linkedDefects ? req.linkedDefects.length : 0), 0);
                    return (
                        <ReleaseCard 
                            key={release.id} 
                            release={release} 
                            requirements={requirements} 
                            defectCount={defectCount}
                            onNavigate={onNavigateToRequirement}
                            onFinalize={handleOpenFinalizeModal}
                            onEdit={handleOpenEditModal}
                        />
                    );
                })}
            </div>
        );
    };

    const renderArchivedView = () => {
        if (selectedArchive) {
            return <ArchivedReleaseDetails archive={selectedArchive} onBack={() => setSelectedArchive(null)} />;
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
                            <button onClick={() => setSelectedArchive(archive)} className="button-view-details">View Details</button>
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
                        <button onClick={() => setView('active')} className={view === 'active' ? 'active' : ''}>Active</button>
                        <button onClick={() => setView('archived')} className={view === 'archived' ? 'active' : ''}>Archived</button>
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
                    onDelete={handleDeleteRequest} // Opens confirmation
                    releases={[releaseToEdit]} // Pass only the specific release
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
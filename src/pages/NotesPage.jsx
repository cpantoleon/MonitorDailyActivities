import React, { useState, useEffect, useCallback } from 'react';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import ConfirmationModal from '../components/ConfirmationModal';
import { CKEditor } from '@ckeditor/ckeditor5-react';
import ClassicEditor from '@ckeditor/ckeditor5-build-classic';
import DailyInfoWidget from '../components/DailyInfoWidget';
import WeatherWidget from '../components/WeatherWidget';
import '../components/DailyInfoWidget.css';
import CustomDropdown from '../components/CustomDropdown';
import ToggleSwitch from '../components/ToggleSwitch';

const KEYWORD_CONFIG = [
  { keyword: 'release date', type: 'release', label: 'Release Date' },
  { keyword: 'project', type: 'project', label: 'PROJECT' },
  { keyword: 'FAT', type: 'fat', label: 'FAT' },
  { keyword: 'regression', type: 'regression', label: 'Regression' },
  { keyword: 'security', type: 'security', label: 'Security' },
  { keyword: 'demo', type: 'demo', label: 'Demo' },
  { keyword: 'event', type: 'event', label: 'Event' },
  { keyword: 'call', type: 'call', label: 'Call' },
];
const DEFAULT_NOTE_TYPE = 'default';
const DEFAULT_NOTE_LABEL = 'General Note';

const getNoteType = (noteText) => {
  if (!noteText || noteText.trim() === "") {
    return null;
  }

  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = noteText;
  const plainText = tempDiv.textContent || tempDiv.innerText || "";

  const lowerPlainText = plainText.toLowerCase();
  for (const config of KEYWORD_CONFIG) {
    if (lowerPlainText.includes(config.keyword.toLowerCase())) {
      return config.type;
    }
  }
  return DEFAULT_NOTE_TYPE;
};

function MyUploadAdapterPlugin(editor) {
  editor.plugins.get('FileRepository').createUploadAdapter = (loader) => {
    return {
      upload: () => {
        return loader.file.then(file => new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            resolve({ default: reader.result });
          };
          reader.onerror = err => {
            reject(err);
          };
          reader.readAsDataURL(file);
        }));
      }
    };
  };
}

const NotesPage = ({ projects, apiBaseUrl, showMessage }) => {
  const [selectedProject, setSelectedProject] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [noteText, setNoteText] = useState('');
  const [projectNotesMap, setProjectNotesMap] = useState({});
  const [isLoadingNotes, setIsLoadingNotes] = useState(false);
  const [datesToHighlight, setDatesToHighlight] = useState([]);
  const [isLegendOpen, setIsLegendOpen] = useState(false);
  const [isConfirmClearOpen, setIsConfirmClearOpen] = useState(false);
  const [editorInstance, setEditorInstance] = useState(null);
  const [isGeneralMode, setIsGeneralMode] = useState(false);
  const [dateSelectionMode, setDateSelectionMode] = useState('month');

  useEffect(() => {
    const savedProject = sessionStorage.getItem('notesPageSelectedProject');
    if (savedProject) {
        setSelectedProject(savedProject);
        if (savedProject === 'General') {
            setIsGeneralMode(true);
        }
    }
  }, []);

  useEffect(() => {
      if (selectedProject) {
          sessionStorage.setItem('notesPageSelectedProject', selectedProject);
      } else {
          sessionStorage.removeItem('notesPageSelectedProject');
      }
  }, [selectedProject]);

  const isToday = (someDate) => {
    const today = new Date();
    return someDate.getDate() === today.getDate() &&
           someDate.getMonth() === today.getMonth() &&
           someDate.getFullYear() === today.getFullYear();
  };

  const formatDateKey = (date) => {
    if (!(date instanceof Date) || isNaN(date.getTime())) return '';
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatMonthKey = (date) => {
    if (!(date instanceof Date) || isNaN(date.getTime())) return '';
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    return `${year}-${month}`;
  };

  const handleSaveNote = useCallback(async (textToSave) => {
    if (!selectedProject) {
      if (showMessage) showMessage('Please select a project.', 'error');
      return;
    }
    const dateKey = isGeneralMode ? (dateSelectionMode === 'month' ? formatMonthKey(selectedDate) : formatDateKey(selectedDate)) : formatDateKey(selectedDate);
    if (!dateKey) {
      if (showMessage) showMessage('Invalid date selected for note.', 'error');
      return;
    }
    setIsLoadingNotes(true);
    
    try {
      const response = await fetch(`${apiBaseUrl}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project: selectedProject, noteDate: dateKey, noteText: textToSave }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || `Failed to process note: ${response.statusText}`);
      }
      const newNoteType = getNoteType(textToSave.trim());
      if (result.action === "deleted" || (result.action === "none" && textToSave.trim() === "")) {
        setNoteText('');
        setProjectNotesMap(prev => {
          const newMap = { ...prev };
          delete newMap[dateKey];
          return newMap;
        });
        setDatesToHighlight(prev => prev.filter(d => formatDateKey(d.date) !== dateKey));
        if (showMessage) showMessage(result.action === "deleted" ? "Note deleted successfully!" : "Note cleared!", 'success');
      } else if (result.action === "saved") {
        setProjectNotesMap(prev => ({ ...prev, [dateKey]: result.data.noteText }));
        setDatesToHighlight(prev => {
          const existingIndex = prev.findIndex(d => formatDateKey(d.date) === dateKey);
          const highlightType = isGeneralMode ? DEFAULT_NOTE_TYPE : newNoteType;
          const newHighlight = { date: selectedDate, type: highlightType };
          if (existingIndex > -1) {
            const updated = [...prev];
            updated[existingIndex] = newHighlight;
            return updated;
          }
          return [...prev, newHighlight];
        });
        if (showMessage) showMessage('Note saved successfully!', 'success');
      } else {
        if (showMessage) showMessage(result.message || 'Note processed.', 'success');
      }
    } catch (error) {
      console.error("Error saving/deleting note:", error);
      if (showMessage) showMessage(`Error: ${error.message}`, 'error');
    } finally {
      setIsLoadingNotes(false);
    }
  }, [selectedProject, selectedDate, apiBaseUrl, showMessage, isGeneralMode, dateSelectionMode]);
  
  useEffect(() => {
    const handleKeyDown = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        if (selectedProject && editorInstance) {
          const currentData = editorInstance.getData();
          handleSaveNote(currentData);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [editorInstance, handleSaveNote, selectedProject]);

  const fetchNotesForProject = useCallback(async (project) => {
    if (!project) {
      setProjectNotesMap({});
      setNoteText('');
      setDatesToHighlight([]);
      return;
    }
    setIsLoadingNotes(true);
    try {
      const response = await fetch(`${apiBaseUrl}/notes/${project}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch notes for ${project}: ${response.statusText}`);
      }
      const result = await response.json();
      const notesData = result.data || {};
      setProjectNotesMap(notesData);

      const highlights = Object.entries(notesData)
        .map(([dateKey, text]) => {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
            return null;
          }

          const noteType = isGeneralMode ? (text.trim() ? DEFAULT_NOTE_TYPE : null) : getNoteType(text);
          
          if (noteType) {
            const [year, month, day] = dateKey.split('-').map(Number);
            return { date: new Date(year, month - 1, day), type: noteType };
          }
          return null;
        })
        .filter(item => item !== null);
      setDatesToHighlight(highlights);

      const currentDataDateKey = isGeneralMode ? (dateSelectionMode === 'month' ? formatMonthKey(selectedDate) : formatDateKey(selectedDate)) : formatDateKey(selectedDate);
      setNoteText(notesData[currentDataDateKey] || '');
    } catch (error) {
      console.error("Error fetching notes:", error);
      if (showMessage) showMessage(`Error fetching notes: ${error.message}`, 'error');
      setProjectNotesMap({});
      setDatesToHighlight([]);
    } finally {
      setIsLoadingNotes(false);
    }
  }, [apiBaseUrl, selectedDate, showMessage, isGeneralMode, dateSelectionMode]);

  useEffect(() => {
    fetchNotesForProject(selectedProject);
  }, [selectedProject, fetchNotesForProject]);

  useEffect(() => {
    const dateKey = isGeneralMode ? (dateSelectionMode === 'month' ? formatMonthKey(selectedDate) : formatDateKey(selectedDate)) : formatDateKey(selectedDate);
    if (selectedProject) {
        setNoteText(projectNotesMap[dateKey] || '');
    } else {
        setNoteText('');
    }
  }, [selectedDate, projectNotesMap, selectedProject, isGeneralMode, dateSelectionMode]);


  const handleClearRequest = () => {
    const dateKey = isGeneralMode ? (dateSelectionMode === 'month' ? formatMonthKey(selectedDate) : formatDateKey(selectedDate)) : formatDateKey(selectedDate);
    if (projectNotesMap[dateKey] && projectNotesMap[dateKey].trim()) {
      setIsConfirmClearOpen(true);
    }
  };

  const handleCancelClear = () => {
    setIsConfirmClearOpen(false);
  };

  const handleConfirmClear = async () => {
    handleCancelClear();
    await handleSaveNote('');
  };

  const renderDayContents = (dayOfMonth, date) => {
    const noteInfo = datesToHighlight.find(
      (d) =>
        d.date.getFullYear() === date.getFullYear() &&
        d.date.getMonth() === date.getMonth() &&
        d.date.getDate() === date.getDate()
    );
    let dotClassName = "note-dot";
    if (noteInfo) {
      if (noteInfo.type && noteInfo.type !== DEFAULT_NOTE_TYPE) {
        dotClassName += ` note-dot-${noteInfo.type}`;
      }
    }
    return (
      <div id={`day-content-${formatDateKey(date)}-id`} style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {dayOfMonth}
        {noteInfo && <span id={`note-dot-${formatDateKey(date)}-id`} className={dotClassName}></span>}
      </div>
    );
  };

  const toggleLegend = () => setIsLegendOpen(!isLegendOpen);

  const hasSavedNoteForSelectedDate = !!(projectNotesMap[isGeneralMode ? (dateSelectionMode === 'month' ? formatMonthKey(selectedDate) : formatDateKey(selectedDate)) : formatDateKey(selectedDate)] && projectNotesMap[isGeneralMode ? (dateSelectionMode === 'month' ? formatMonthKey(selectedDate) : formatDateKey(selectedDate)) : formatDateKey(selectedDate)].trim());

  const editorConfiguration = {
    extraPlugins: [MyUploadAdapterPlugin],
  };

  const handleProjectChange = (e) => {
    const project = e.target.value;
    setSelectedProject(project);
    setIsGeneralMode(project === 'General');
  };

  const projectOptions = [{ value: 'General', label: 'General' }, ...projects.map(p => ({ value: p, label: p }))];

  return (
    <div id="notes-page-container-id" className="notes-page-container with-sidebar">
      <div id="notes-main-column-id" className="notes-main-column">
        <style>{`
          .ck-editor__editable_inline {
              min-height: 250px;
              max-height: 350px;
              overflow-y: auto;
          }
          .ck-content .image {
              max-width: 200px;
              height: auto;
          }
          .ck-content .image-inline {
              max-width: 200px;
              height: auto;
          }
          .today-button {
            padding: 8px 12px;
            border: 1px solid #DEB887;
            border-radius: 4px;
            background-color: #F5DEB3;
            cursor: pointer;
            font-size: 0.9em;
            color: #5C4033;
            font-weight: 500;
          }

          .today-button:disabled {
            background-color: #E9ECEF;
            color: #6C757D;
            cursor: not-allowed;
            opacity: 0.7;
          }
        `}</style>
        <h2 id="daily-notes-title-id">Daily Notes</h2>
        <div id="notes-controls-id" className="notes-controls">
          <div id="notes-project-selector-container-id">
            <label id="note-project-label" htmlFor="note-project-button">Project:</label>
            <CustomDropdown
              id="note-project"
              name="noteProject"
              value={selectedProject}
              onChange={handleProjectChange}
              options={projectOptions}
              placeholder="-- Select Project --"
              disabled={projectOptions.length === 0}
            />
          </div>
          <div id="notes-date-selector-container-id">
          <label htmlFor="note-date">{isGeneralMode ? (dateSelectionMode === 'month' ? 'Month:' : 'Date:') : 'Date:'}</label>
            <div id="notes-datepicker-wrapper-id" style={{ position: 'relative', display: 'inline-block' }}>
              <DatePicker
                id="note-date"
                name="noteDate"
                selected={selectedDate}
                onChange={(date) => setSelectedDate(date)}
                dateFormat={isGeneralMode ? (dateSelectionMode === 'month' ? "MM/yyyy" : "MM/dd/yyyy") : "MM/dd/yyyy"}
                showMonthYearPicker={isGeneralMode && dateSelectionMode === 'month'}
                className="notes-datepicker"
                renderDayContents={renderDayContents}
              />
              {isGeneralMode ? (
                <div id="general-mode-controls-id" style={{ position: 'absolute', left: '100%', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', marginLeft: '10px' }}>
                  <ToggleSwitch
                    id="date-selection-mode"
                    checked={dateSelectionMode === 'month'}
                    onChange={(e) => setDateSelectionMode(e.target.checked ? 'month' : 'date')}
                    option1="Month"
                    option2="Date"
                    title="Toggle between month and date selection"
                  />
                  {dateSelectionMode === 'date' && (
                    <button 
                      id="today-button-general-mode-id"
                      onClick={() => setSelectedDate(new Date())} 
                      disabled={isToday(selectedDate)}
                      className="today-button"
                      style={{ marginLeft: '10px' }}
                    >
                      Today
                    </button>
                  )}
                </div>
              ) : (
                <button 
                  id="today-button-project-mode-id"
                  onClick={() => setSelectedDate(new Date())} 
                  disabled={isToday(selectedDate)}
                  className="today-button"
                  style={{ position: 'absolute', right: '-85px', top: '50%', transform: 'translateY(-50%)' }}
                >
                  Today
                </button>
              )}
            </div>
          </div>
        </div>

        <div id="notes-legend-id" className="notes-legend">
          <div id="legend-title-id" className="legend-title clickable" onClick={toggleLegend}>
            Calendar Dot Legend {isLegendOpen ? '▼' : '►'}
          </div>
          {isLegendOpen && (
            <div id="legend-content-id" className="legend-content">
              <div id="legend-item-default-id" className="legend-item">
                <span className="note-dot"></span>
                <span>{DEFAULT_NOTE_LABEL}</span>
              </div>
              {KEYWORD_CONFIG.map(config => (
                <div key={config.type} id={`legend-item-${config.type}-id`} className="legend-item">
                  <span className={`note-dot note-dot-${config.type}`}></span>
                  <span>{config.label} (note contains "{config.keyword}")</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {selectedProject ? (
          <div id="notes-editor-area-id" className="notes-editor-area">
            <h3 id="notes-editor-label">
              Notes for {selectedProject} on {isGeneralMode ? (dateSelectionMode === 'month' ? formatMonthKey(selectedDate) : selectedDate.toLocaleDateString()) : selectedDate.toLocaleDateString()}
            </h3>
            <div id="editor-wrapper-id" className="editor-wrapper">
              <CKEditor
                  editor={ ClassicEditor }
                  data={noteText}
                  config={editorConfiguration}
                  onReady={editor => {
                    setEditorInstance(editor);
                    
                    const editableElement = editor.ui.getEditableElement();
                    if (editableElement && editableElement.parentElement) {
                        editableElement.parentElement.setAttribute('aria-labelledby', 'notes-editor-label');
                    }

                    const fileUploadButton = editor.ui.view.toolbar.element.querySelector('.ck-file-dialog-button');
                    if (fileUploadButton) {
                      fileUploadButton.setAttribute('aria-label', 'Upload file');
                    }
                    
                    setTimeout(() => {
                        const fileInput = document.querySelector('input.ck-hidden[type="file"]');
                        if (fileInput && !fileInput.hasAttribute('title')) {
                            fileInput.setAttribute('title', 'Upload image file');
                        }
                    }, 500);
                  }}
                  onChange={ ( event, editor ) => {
                      const data = editor.getData();
                      setNoteText(data);
                  } }
                  disabled={!selectedProject}
              />
            </div>
            <div id="notes-actions-container-id" className="notes-actions-container">
              <button
                id="save-note-button-id"
                onClick={() => handleSaveNote(noteText)}
                className="save-note-button"
                disabled={isLoadingNotes || !selectedProject}
              >
                {isLoadingNotes ? 'Saving...' : 'Save Note'}
              </button>
              <button
                id="clear-note-button-id"
                onClick={handleClearRequest}
                className="clear-note-button"
                disabled={isLoadingNotes || !selectedProject || !hasSavedNoteForSelectedDate}
              >
                Clear Note
              </button>
            </div>
          </div>
        ) : (
          <p id="select-project-prompt-id" className="select-project-prompt">Please select a project to view or add notes.</p>
        )}
      </div>

      <div id="notes-sidebar-column-id" className="notes-sidebar-column">
        <WeatherWidget showMessage={showMessage} />
        <DailyInfoWidget />
      </div>

      <ConfirmationModal
        isOpen={isConfirmClearOpen}
        onClose={handleCancelClear}
        onConfirm={handleConfirmClear}
        title="Confirm Clear Note"
        message={`Are you sure you want to permanently delete the note for ${isGeneralMode ? (dateSelectionMode === 'month' ? formatMonthKey(selectedDate) : selectedDate.toLocaleDateString()) : selectedDate.toLocaleDateString()}? This action cannot be undone.`}
      />
    </div>
  );
};

export default NotesPage;
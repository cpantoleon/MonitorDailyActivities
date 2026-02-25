import React, { useState, useEffect, useCallback } from 'react';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import ConfirmationModal from '../components/ConfirmationModal';
import { CKEditor } from '@ckeditor/ckeditor5-react';
import ClassicEditor from '@ckeditor/ckeditor5-build-classic';
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
      <div className="calendar-day-container" id={`day-content-${formatDateKey(date)}-id`} style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
    <div id="notes-page-main-content-id" className="main-content-area">
        <style>{`
          .ck-editor__editable_inline {
              min-height: 400px;
              max-height: 600px;
              overflow-y: auto;
          }
          /* CKEditor Theme Overrides */
          .ck.ck-editor__main > .ck-editor__editable {
              background: var(--bg-primary) !important;
              color: var(--text-primary) !important;
          }
          .ck.ck-toolbar {
              background: var(--bg-secondary) !important;
              border: 1px solid var(--border-color) !important;
              border-bottom: none !important;
              border-top-left-radius: 12px !important;
              border-top-right-radius: 12px !important;
          }
          .ck.ck-button {
              color: var(--text-primary) !important;
              cursor: pointer !important;
          }
          .ck.ck-button:hover {
              background: var(--bg-tertiary) !important;
          }
          .ck.ck-button.ck-on {
              background: var(--accent-color) !important;
              color: #fff !important;
          }

          .today-button {
            padding: 0 16px;
            height: 42px;
            border: 1px solid var(--border-color);
            border-radius: 6px;
            background-color: var(--bg-tertiary);
            cursor: pointer;
            font-size: 0.9rem;
            color: var(--text-primary);
            font-weight: 600;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .today-button:hover:not(:disabled) {
            background-color: var(--accent-color);
            color: #ffffff;
            border-color: var(--accent-color);
          }

          .today-button:disabled {
            background-color: var(--bg-primary);
            color: var(--text-secondary);
            cursor: not-allowed;
            opacity: 0.6;
          }

          /* DatePicker overrides */
          .react-datepicker-wrapper { width: 100%; }
          .react-datepicker__input-container input {
              background-color: var(--bg-primary);
              color: var(--text-primary);
              border: 1px solid var(--border-color);
              border-radius: 6px;
              padding: 0 12px;
              height: 42px;
              width: 100%;
              font-size: 0.95rem;
          }

          /* Calendar Dots */
          .note-dot {
            height: 10px;
            width: 10px;
            background-color: var(--text-secondary, #ccc);
            border-radius: 50%;
            display: inline-block;
            flex-shrink: 0;
          }

          /* Specific styling for dots inside the calendar cells */
          .calendar-day-container .note-dot {
            height: 6px;
            width: 6px;
            position: absolute;
            bottom: 2px;
            left: 50%;
            transform: translateX(-50%);
          }

          .note-dot-release { background-color: #e53e3e !important; }
          .note-dot-project { background-color: #3182ce !important; }
          .note-dot-fat { background-color: #d69e2e !important; }
          .note-dot-regression { background-color: #805ad5 !important; }
          .note-dot-security { background-color: #38a169 !important; }
          .note-dot-demo { background-color: #00b5d8 !important; }
          .note-dot-event { background-color: #d53f8c !important; }
          .note-dot-call { background-color: #dd6b20 !important; }

          .legend-item {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 4px;
            font-size: 0.9rem;
            color: var(--text-primary);
          }

          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          .spinner {
            border: 2px solid rgba(255,255,255,0.3);
            border-radius: 50%;
            border-top: 2px solid #fff;
            width: 14px;
            height: 14px;
            animation: spin 1s linear infinite;
            display: inline-block;
            margin-right: 8px;
          }
        `}</style>

        <div className="selection-controls">
          <div className="selection-group-container">
            <div className="selection-group">
            <label className="dropdown-label" htmlFor="note-project">Project</label>
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

            <div className="selection-group" style={{ minWidth: '300px' }}>
              <label className="dropdown-label" htmlFor="note-date">
                {isGeneralMode ? (dateSelectionMode === 'month' ? 'Month' : 'Date') : 'Date'}
              </label>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', width: '100%' }}>
              <div style={{ flexGrow: 1 }}>
              <DatePicker
                id="note-date"
                name="noteDate"
                selected={selectedDate}
                onChange={(date) => setSelectedDate(date)}
                dateFormat={isGeneralMode ? (dateSelectionMode === 'month' ? "MM/yyyy" : "MM/dd/yyyy") : "MM/dd/yyyy"}
                showMonthYearPicker={isGeneralMode && dateSelectionMode === 'month'}
                className="notes-datepicker"
                renderDayContents={renderDayContents}
                wrapperClassName="date-picker-wrapper"
                popperPlacement="bottom-start"
                portalId="root"
                popperProps={{
                   strategy: "fixed" 
                }}
                autoComplete="off"
              />
              </div>
              {isGeneralMode ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
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
                      onClick={() => setSelectedDate(new Date())} 
                      disabled={isToday(selectedDate)}
                      className="today-button"
                    >
                      Today
                    </button>
                  )}
                </div>
              ) : (
                <button 
                  onClick={() => setSelectedDate(new Date())} 
                  disabled={isToday(selectedDate)}
                  className="today-button"
                >
                  Today
                </button>
              )}
              </div>
            </div>
          </div>
        </div>

        <div id="notes-legend-id" className="notes-legend" style={{ 
            marginBottom: '20px', 
            backgroundColor: 'var(--bg-secondary)', 
            border: '1px solid var(--border-color)', 
            borderRadius: '8px', 
            padding: '10px 15px' 
        }}>
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
          <div id="notes-editor-area-id" className="notes-editor-area" style={{
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: '12px',
              padding: '20px',
              boxShadow: 'var(--card-shadow)'
          }}>
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
            <div id="notes-actions-container-id" className="notes-actions-container" style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                id="save-note-button-id"
                onClick={() => handleSaveNote(noteText)}
                className="btn-primary"
                disabled={isLoadingNotes || !selectedProject}
              >
                {isLoadingNotes ? (
                  <>
                    <span className="spinner"></span> Saving...
                  </>
                ) : (
                  'Save Note'
                )}
              </button>
              <button
                id="clear-note-button-id"
                onClick={handleClearRequest}
                className="delete-card-button"
                style={{ height: '42px', display: 'flex', alignItems: 'center' }}
                disabled={isLoadingNotes || !selectedProject || !hasSavedNoteForSelectedDate}
              >
                Clear Note
              </button>
            </div>
          </div>
        ) : (
          <div id="select-project-prompt-id" className="empty-column-message">Please select a project to view or add notes.</div>
        )}

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
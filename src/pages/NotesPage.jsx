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

const KEYWORD_CONFIG = [
  { keyword: 'release date', type: 'release', label: 'Release Date' },
  { keyword: 'euipo', type: 'euipo', label: 'EUIPO' },
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
  // State to hold the editor instance for adding event listeners
  const [editorInstance, setEditorInstance] = useState(null);

  const formatDateKey = (date) => {
    if (!(date instanceof Date) || isNaN(date.getTime())) return '';
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handleSaveNote = useCallback(async (textToSave) => {
    if (!selectedProject) {
      if (showMessage) showMessage('Please select a project.', 'error');
      return;
    }
    const dateKey = formatDateKey(selectedDate);
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
          const newHighlight = { date: selectedDate, type: newNoteType };
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
  }, [selectedProject, selectedDate, apiBaseUrl, showMessage]);
  
  // NEW: useEffect to handle the Ctrl+S keyboard shortcut
  useEffect(() => {
    if (!editorInstance) return;

    const editableElement = editorInstance.ui.getEditableElement();
    if (!editableElement) return;

    const handleKeyDown = (event) => {
      // Check for Ctrl+S or Cmd+S
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault(); // Prevent the browser's save dialog
        
        // Get the latest data directly from the editor and save
        const currentData = editorInstance.getData();
        handleSaveNote(currentData);
      }
    };

    editableElement.addEventListener('keydown', handleKeyDown);

    // Cleanup function to remove the event listener when the component unmounts
    return () => {
      editableElement.removeEventListener('keydown', handleKeyDown);
    };
  }, [editorInstance, handleSaveNote]); // Rerun if the editor or save function changes

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
          const noteType = getNoteType(text);
          if (noteType) {
            const [year, month, day] = dateKey.split('-').map(Number);
            return { date: new Date(year, month - 1, day), type: noteType };
          }
          return null;
        })
        .filter(item => item !== null);
      setDatesToHighlight(highlights);
      const currentDataDateKey = formatDateKey(selectedDate);
      setNoteText(notesData[currentDataDateKey] || '');
    } catch (error) {
      console.error("Error fetching notes:", error);
      if (showMessage) showMessage(`Error fetching notes: ${error.message}`, 'error');
      setProjectNotesMap({});
      setDatesToHighlight([]);
    } finally {
      setIsLoadingNotes(false);
    }
  }, [apiBaseUrl, selectedDate, showMessage]);

  useEffect(() => {
    fetchNotesForProject(selectedProject);
  }, [selectedProject, fetchNotesForProject]);

  useEffect(() => {
    const dateKey = formatDateKey(selectedDate);
    if (selectedProject) {
        setNoteText(projectNotesMap[dateKey] || '');
    } else {
        setNoteText('');
    }
  }, [selectedDate, projectNotesMap, selectedProject]);


  const handleClearRequest = () => {
    const dateKey = formatDateKey(selectedDate);
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
      <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {dayOfMonth}
        {noteInfo && <span className={dotClassName}></span>}
      </div>
    );
  };

  const toggleLegend = () => setIsLegendOpen(!isLegendOpen);

  const hasSavedNoteForSelectedDate = !!(projectNotesMap[formatDateKey(selectedDate)] && projectNotesMap[formatDateKey(selectedDate)].trim());

  const editorConfiguration = {
    extraPlugins: [MyUploadAdapterPlugin],
  };

  const handleProjectChange = (e) => {
    setSelectedProject(e.target.value);
  };

  const projectOptions = projects.map(p => ({ value: p, label: p }));

  return (
    <div className="notes-page-container with-sidebar">
      <div className="notes-main-column">
        <style>{`
          .ck-editor__editable_inline {
              min-height: 250px;
          }
          .ck-content .image {
              max-width: 200px;
              height: auto;
          }
          .ck-content .image-inline {
              max-width: 200px;
              height: auto;
          }
        `}</style>
        <h2>Daily Notes</h2>
        <div className="notes-controls">
          <div>
            <label id="note-project-label" htmlFor="note-project-button">Project:</label>
            <CustomDropdown
              id="note-project"
              name="noteProject"
              value={selectedProject}
              onChange={handleProjectChange}
              options={projectOptions}
              placeholder="-- Select Project --"
              disabled={!projects || projects.length === 0}
            />
          </div>
          <div>
            <label htmlFor="note-date">Date:</label>
            <DatePicker
              id="note-date"
              name="noteDate"
              selected={selectedDate}
              onChange={(date) => setSelectedDate(date)}
              dateFormat="MM/dd/yyyy"
              className="notes-datepicker"
              renderDayContents={renderDayContents}
            />
          </div>
        </div>

        <div className="notes-legend">
          <div className="legend-title clickable" onClick={toggleLegend}>
            Calendar Dot Legend {isLegendOpen ? '▼' : '►'}
          </div>
          {isLegendOpen && (
            <div className="legend-content">
              <div className="legend-item">
                <span className="note-dot"></span>
                <span>{DEFAULT_NOTE_LABEL}</span>
              </div>
              {KEYWORD_CONFIG.map(config => (
                <div key={config.type} className="legend-item">
                  <span className={`note-dot note-dot-${config.type}`}></span>
                  <span>{config.label} (note contains "{config.keyword}")</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* {isLoadingNotes && selectedProject && <p style={{textAlign: 'center', marginBottom: '10px'}}>Loading/Saving notes for {selectedProject}...</p>} */}

        {selectedProject ? (
          <div className="notes-editor-area">
            <h3 id="notes-editor-label">Notes for {selectedProject} on {selectedDate.toLocaleDateString()}</h3>
            <div className="editor-wrapper">
              <CKEditor
                  editor={ ClassicEditor }
                  data={noteText}
                  config={editorConfiguration}
                  onReady={editor => {
                    // Save the editor instance to state
                    setEditorInstance(editor);
                    
                    const editableElement = editor.ui.getEditableElement();
                    if (editableElement && editableElement.parentElement) {
                        editableElement.parentElement.setAttribute('aria-labelledby', 'notes-editor-label');
                    }
                  }}
                  onChange={ ( event, editor ) => {
                      const data = editor.getData();
                      setNoteText(data);
                  } }
                  disabled={!selectedProject}
              />
            </div>
            <div className="notes-actions-container">
              <button
                onClick={() => handleSaveNote(noteText)}
                className="save-note-button"
                disabled={isLoadingNotes || !selectedProject}
              >
                {isLoadingNotes ? 'Saving...' : 'Save Note'}
              </button>
              <button
                onClick={handleClearRequest}
                className="clear-note-button"
                disabled={isLoadingNotes || !selectedProject || !hasSavedNoteForSelectedDate}
              >
                Clear Note
              </button>
            </div>
          </div>
        ) : (
          <p className="select-project-prompt">Please select a project to view or add notes.</p>
        )}
      </div>

      <div className="notes-sidebar-column">
        <WeatherWidget showMessage={showMessage} />
        <DailyInfoWidget />
      </div>

      <ConfirmationModal
        isOpen={isConfirmClearOpen}
        onClose={handleCancelClear}
        onConfirm={handleConfirmClear}
        title="Confirm Clear Note"
        message={`Are you sure you want to permanently delete the note for ${selectedDate.toLocaleDateString()}? This action cannot be undone.`}
      />
    </div>
  );
};

export default NotesPage;
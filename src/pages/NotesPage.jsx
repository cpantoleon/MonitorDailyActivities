import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import ConfirmationModal from '../components/ConfirmationModal';
import { CKEditor } from '@ckeditor/ckeditor5-react';
import ClassicEditor from '@ckeditor/ckeditor5-build-classic';
import CustomDropdown from '../components/CustomDropdown';
import ToggleSwitch from '../components/ToggleSwitch';
import SearchComponent from '../components/SearchComponent';

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
  const navigate = useNavigate();
  const [selectedProject, setSelectedProject] = useState('');
  const [showAllProjects, setShowAllProjects] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  
  // States for single project mode
  const [noteText, setNoteText] = useState('');
  const [editorInstance, setEditorInstance] = useState(null);

  // States for All Projects mode
  const [allProjectsTextMap, setAllProjectsTextMap] = useState({});
  const [savingProject, setSavingProject] = useState(null);
  const [projectToClear, setProjectToClear] = useState(null);

  const [projectNotesMap, setProjectNotesMap] = useState({});
  const [isLoadingNotes, setIsLoadingNotes] = useState(false);
  const [datesToHighlight, setDatesToHighlight] = useState([]);
  const [isLegendOpen, setIsLegendOpen] = useState(false);
  const [isConfirmClearOpen, setIsConfirmClearOpen] = useState(false);
  const [isGeneralMode, setIsGeneralMode] = useState(false);
  const [dateSelectionMode, setDateSelectionMode] = useState('month');

  // Unsaved Changes State
  const [isUnsavedModalOpen, setIsUnsavedModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);

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

  // --- NEW: Fetch default setting for "All Projects" on mount ---
  useEffect(() => {
    fetch(`${apiBaseUrl}/settings/notes-all-projects`)
      .then(res => res.json())
      .then(data => {
        if (data.isEnabled) {
          setShowAllProjects(true);
        }
      })
      .catch(err => console.error("Error fetching notes default setting:", err));
  }, [apiBaseUrl]);

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

  const getCurrentDateKey = useCallback(() => {
    if (showAllProjects) return formatDateKey(selectedDate);
    return isGeneralMode ? (dateSelectionMode === 'month' ? formatMonthKey(selectedDate) : formatDateKey(selectedDate)) : formatDateKey(selectedDate);
  }, [showAllProjects, selectedDate, isGeneralMode, dateSelectionMode]);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchSuggestions, setSearchSuggestions] = useState([]);

  const stripHtml = (html) => {
    const tmp = document.createElement("DIV");
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || "";
  };

  const handleQueryChange = (q) => {
    setSearchQuery(q);
    if (q.length < 3 || (!selectedProject && !showAllProjects)) {
        setSearchSuggestions([]);
        return;
    }
    const lowerQ = q.toLowerCase();
    const suggestions = [];
    
    Object.entries(projectNotesMap).forEach(([dateKey, data]) => {
        let plainText = "";
        if (typeof data === 'object' && data !== null) {
            plainText = stripHtml(Object.values(data).join(' ')).toLowerCase();
        } else if (typeof data === 'string') {
            plainText = stripHtml(data).toLowerCase();
        }
        
        if (plainText.includes(lowerQ)) {
            suggestions.push({ 
                id: dateKey, 
                name: dateKey,
                context: plainText.substring(0, 40) + '...'
            });
        }
    });
    setSearchSuggestions(suggestions.slice(0, 10));
  };

  const handleSearch = (q) => { handleQueryChange(q); };
  const handleClearSearch = () => { setSearchQuery(''); setSearchSuggestions([]); };

  const handleSuggestionSelect = (suggestion) => {
    const parts = suggestion.id.split('-');
    let newDate;
    if (parts.length === 2) {
        newDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, 1);
        setDateSelectionMode('month');
    } else {
        newDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        setDateSelectionMode('date');
    }
    
    executeWithUnsavedCheck(() => {
        setSelectedDate(newDate);
        handleClearSearch();
    });
  };

  // --- Determine if there are unsaved changes ---
  const checkUnsavedChanges = useCallback(() => {
    const dateKey = getCurrentDateKey();
    if (showAllProjects) {
        const originalMap = projectNotesMap[dateKey];
        const safeOriginalMap = (originalMap && typeof originalMap === 'object') ? originalMap : {};
        
        for (const proj of Object.keys(allProjectsTextMap)) {
            if (typeof allProjectsTextMap[proj] !== 'string') continue;
            const cleanCurrent = (allProjectsTextMap[proj] || '').replace(/^<p>(?:&nbsp;|<br\s*\/?>)?<\/p>$/i, '').trim();
            const cleanOrig = (safeOriginalMap[proj] || '').replace(/^<p>(?:&nbsp;|<br\s*\/?>)?<\/p>$/i, '').trim();
            if (cleanCurrent !== cleanOrig) return true;
        }
        return false;
    } else {
        const originalNoteText = projectNotesMap[dateKey];
        const safeOriginalText = (typeof originalNoteText === 'string') ? originalNoteText : '';
        const cleanNoteText = (noteText || '').replace(/^<p>(?:&nbsp;|<br\s*\/?>)?<\/p>$/i, '').trim();
        const cleanOriginalText = (safeOriginalText || '').replace(/^<p>(?:&nbsp;|<br\s*\/?>)?<\/p>$/i, '').trim();
        return cleanNoteText !== cleanOriginalText;
    }
  }, [showAllProjects, getCurrentDateKey, projectNotesMap, allProjectsTextMap, noteText]);

  const executeWithUnsavedCheck = (action) => {
    if (checkUnsavedChanges()) {
      setPendingAction(() => action);
      setIsUnsavedModalOpen(true);
    } else {
      action();
    }
  };

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (checkUnsavedChanges()) {
        e.preventDefault();
        e.returnValue = ''; 
      }
    };

    const handleNavigationClick = (e) => {
      if (!checkUnsavedChanges()) return;
      const target = e.target.closest('a');
      if (target && target.tagName === 'A') {
        const href = target.getAttribute('href');
        if (href && !href.startsWith('http') && !href.includes('/notes')) {
          e.preventDefault();
          e.stopPropagation();
          setPendingAction(() => () => navigate(href));
          setIsUnsavedModalOpen(true);
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('click', handleNavigationClick, true);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('click', handleNavigationClick, true);
    };
  }, [checkUnsavedChanges, navigate]);

  const handlePrevDate = () => {
    executeWithUnsavedCheck(() => {
      setSelectedDate(prev => {
        const newDate = new Date(prev);
        if (isGeneralMode && dateSelectionMode === 'month' && !showAllProjects) {
          newDate.setMonth(newDate.getMonth() - 1);
        } else {
          newDate.setDate(newDate.getDate() - 1);
        }
        return newDate;
      });
    });
  };

  const handleNextDate = () => {
    executeWithUnsavedCheck(() => {
      setSelectedDate(prev => {
        const newDate = new Date(prev);
        if (isGeneralMode && dateSelectionMode === 'month' && !showAllProjects) {
          newDate.setMonth(newDate.getMonth() + 1);
        } else {
          newDate.setDate(newDate.getDate() + 1);
        }
        return newDate;
      });
    });
  };

  const handleSaveNote = useCallback(async (textToSave, targetProject = null) => {
    const proj = targetProject || selectedProject;
    if (!proj) {
      if (showMessage) showMessage('Please select a project.', 'error');
      return;
    }
    const dateKey = getCurrentDateKey();
    if (!dateKey) return;

    setSavingProject(proj);
    if (!showAllProjects) setIsLoadingNotes(true);

    try {
      const response = await fetch(`${apiBaseUrl}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project: proj, noteDate: dateKey, noteText: textToSave }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);

      let updatedMap;
      setProjectNotesMap(prev => {
        updatedMap = { ...prev };
        if (showAllProjects) {
          if (!updatedMap[dateKey] || typeof updatedMap[dateKey] !== 'object') updatedMap[dateKey] = {};
          if (result.action === "deleted" || (result.action === "none" && textToSave.trim() === "")) {
            delete updatedMap[dateKey][proj];
            if (Object.keys(updatedMap[dateKey]).length === 0) delete updatedMap[dateKey];
          } else {
            updatedMap[dateKey][proj] = result.data.noteText;
          }
        } else {
          if (result.action === "deleted" || (result.action === "none" && textToSave.trim() === "")) {
            delete updatedMap[dateKey];
          } else {
            updatedMap[dateKey] = result.data.noteText;
          }
        }
        return updatedMap;
      });

      if (showAllProjects) {
          setAllProjectsTextMap(prev => {
              const newMap = { ...prev };
              if (result.action === "deleted" || (result.action === "none" && textToSave.trim() === "")) {
                  delete newMap[proj];
              } else {
                  newMap[proj] = result.data.noteText;
              }
              return newMap;
          });
      } else {
          if (result.action === "deleted" || (result.action === "none" && textToSave.trim() === "")) {
              setNoteText('');
          }
      }

      setDatesToHighlight(prev => {
        const existingIndex = prev.findIndex(d => formatDateKey(d.date) === dateKey);
        let newHighlight = null;
        
        if (showAllProjects) {
            const notesForDate = updatedMap[dateKey];
            if (notesForDate && typeof notesForDate === 'object' && Object.keys(notesForDate).length > 0) {
                const combinedText = Object.values(notesForDate).join(' ');
                const noteType = getNoteType(combinedText) || DEFAULT_NOTE_TYPE;
                newHighlight = { date: selectedDate, type: noteType };
            }
        } else {
            if (result.action === "saved") {
                const noteType = isGeneralMode ? DEFAULT_NOTE_TYPE : getNoteType(textToSave);
                newHighlight = { date: selectedDate, type: noteType };
            }
        }

        if (newHighlight) {
            if (existingIndex > -1) {
                const updated = [...prev];
                updated[existingIndex] = newHighlight;
                return updated;
            }
            return [...prev, newHighlight];
        } else {
            return prev.filter(d => formatDateKey(d.date) !== dateKey);
        }
      });

      if (showMessage) {
          showMessage(result.action === "deleted" ? "Note deleted successfully!" : (result.action === "saved" ? "Note saved successfully!" : "Note cleared!"), 'success');
      }
    } catch (error) {
      console.error("Error saving/deleting note:", error);
      if (showMessage) showMessage(`Error: ${error.message}`, 'error');
    } finally {
      setSavingProject(null);
      if (!showAllProjects) setIsLoadingNotes(false);
    }
  }, [selectedProject, selectedDate, apiBaseUrl, showMessage, isGeneralMode, showAllProjects, getCurrentDateKey]);

  const handleSaveAllChangedNotes = async () => {
      const dateKey = getCurrentDateKey();
      const originalMap = projectNotesMap[dateKey];
      const safeOriginalMap = (originalMap && typeof originalMap === 'object') ? originalMap : {};
      
      const promises = [];
      for (const proj of Object.keys(allProjectsTextMap)) {
          if (typeof allProjectsTextMap[proj] !== 'string') continue;
          const cleanCurrent = (allProjectsTextMap[proj] || '').replace(/^<p>(?:&nbsp;|<br\s*\/?>)?<\/p>$/i, '').trim();
          const cleanOrig = (safeOriginalMap[proj] || '').replace(/^<p>(?:&nbsp;|<br\s*\/?>)?<\/p>$/i, '').trim();
          if (cleanCurrent !== cleanOrig) {
              promises.push(handleSaveNote(allProjectsTextMap[proj], proj));
          }
      }
      await Promise.all(promises);
  };

  useEffect(() => {
    const handleKeyDown = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        if (showAllProjects) {
           handleSaveAllChangedNotes();
        } else if (selectedProject && editorInstance) {
           const currentData = editorInstance.getData();
           handleSaveNote(currentData);
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [editorInstance, handleSaveNote, selectedProject, showAllProjects, allProjectsTextMap, projectNotesMap]);

  const fetchNotesForProject = useCallback(async (project, fetchAll = false) => {
    if (!project && !fetchAll) {
      setProjectNotesMap({});
      setNoteText('');
      setAllProjectsTextMap({});
      setDatesToHighlight([]);
      return;
    }
    setIsLoadingNotes(true);
    try {
      const endpoint = fetchAll ? 'all' : project;
      const response = await fetch(`${apiBaseUrl}/notes/${endpoint}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch notes: ${response.statusText}`);
      }
      const result = await response.json();
      const notesData = result.data || {};
      setProjectNotesMap(notesData);

      const highlights = Object.entries(notesData)
        .map(([dateKey, textOrObj]) => {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null;
          
          if (fetchAll) {
              if (typeof textOrObj === 'object' && textOrObj !== null) {
                  const combinedText = Object.values(textOrObj).join(' ');
                  if (!combinedText.trim()) return null;
                  const noteType = getNoteType(combinedText) || DEFAULT_NOTE_TYPE;
                  const [year, month, day] = dateKey.split('-').map(Number);
                  return { date: new Date(year, month - 1, day), type: noteType };
              }
          } else {
              if (typeof textOrObj === 'string') {
                  const noteType = isGeneralMode ? (textOrObj.trim() ? DEFAULT_NOTE_TYPE : null) : getNoteType(textOrObj);
                  if (noteType) {
                    const [year, month, day] = dateKey.split('-').map(Number);
                    return { date: new Date(year, month - 1, day), type: noteType };
                  }
              }
          }
          return null;
        })
        .filter(item => item !== null);
      setDatesToHighlight(highlights);

      const currentDataDateKey = fetchAll ? formatDateKey(selectedDate) : (isGeneralMode ? (dateSelectionMode === 'month' ? formatMonthKey(selectedDate) : formatDateKey(selectedDate)) : formatDateKey(selectedDate));
      
      const dataForDate = notesData[currentDataDateKey];
      
      if (fetchAll) {
          setAllProjectsTextMap((dataForDate && typeof dataForDate === 'object') ? dataForDate : {});
          setNoteText('');
      } else {
          setNoteText((dataForDate && typeof dataForDate === 'string') ? dataForDate : '');
          setAllProjectsTextMap({});
      }
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
    fetchNotesForProject(selectedProject, showAllProjects);
  }, [selectedProject, showAllProjects, fetchNotesForProject]);

  useEffect(() => {
    const dateKey = getCurrentDateKey();
    const dataForDate = projectNotesMap[dateKey];

    if (showAllProjects) {
      setAllProjectsTextMap((dataForDate && typeof dataForDate === 'object') ? dataForDate : {});
    } else if (selectedProject) {
      setNoteText((dataForDate && typeof dataForDate === 'string') ? dataForDate : '');
    } else {
      setNoteText('');
    }
  }, [selectedDate, projectNotesMap, selectedProject, showAllProjects, getCurrentDateKey]);

  const handleAllProjectsTextChange = (proj, text) => {
      setAllProjectsTextMap(prev => ({ ...prev, [proj]: text }));
  };

  const handleClearRequest = (proj = null) => {
    const dateKey = getCurrentDateKey();
    const dataForDate = projectNotesMap[dateKey];

    if (showAllProjects && proj) {
       if (dataForDate && typeof dataForDate === 'object' && dataForDate[proj] && dataForDate[proj].trim()) {
           setProjectToClear(proj);
           setIsConfirmClearOpen(true);
       }
    } else {
       if (dataForDate && typeof dataForDate === 'string' && dataForDate.trim()) {
           setProjectToClear(null);
           setIsConfirmClearOpen(true);
       }
    }
  };

  const handleCancelClear = () => {
      setIsConfirmClearOpen(false);
      setProjectToClear(null);
  };

  const handleConfirmClear = async () => {
    handleCancelClear();
    if (showAllProjects && projectToClear) {
        await handleSaveNote('', projectToClear);
    } else {
        await handleSaveNote('');
    }
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

  let hasSavedNoteForSelectedDate = false;
  const currentData = projectNotesMap[getCurrentDateKey()];
  if (showAllProjects) {
      hasSavedNoteForSelectedDate = currentData && typeof currentData === 'object' && Object.keys(currentData).length > 0;
  } else {
      hasSavedNoteForSelectedDate = currentData && typeof currentData === 'string' && currentData.trim().length > 0;
  }

  const editorConfiguration = {
    extraPlugins: [MyUploadAdapterPlugin],
  };

  const handleProjectChange = (e) => {
    const project = e.target.value;
    executeWithUnsavedCheck(() => {
      setSelectedProject(project);
      setIsGeneralMode(project === 'General');
    });
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

          /* CKEditor Dropdown Panel Styling (for table insert row/column) */
          .ck.ck-dropdown__panel {
              background: var(--bg-secondary) !important;
              border: 1px solid var(--border-color) !important;
              box-shadow: var(--card-shadow) !important;
          }
          .ck.ck-dropdown__panel .ck-list {
              background: var(--bg-secondary) !important;
          }
          .ck.ck-dropdown__panel .ck-list__item {
              color: var(--text-primary) !important;
          }
          .ck.ck-dropdown__panel .ck-list__item:hover {
              background: var(--bg-tertiary) !important;
          }
          .ck.ck-dropdown__panel .ck-list__item .ck-button {
              color: var(--text-primary) !important;
          }
          .ck.ck-dropdown__panel .ck-list__item .ck-button:hover {
              background: var(--bg-tertiary) !important;
          }
          .ck.ck-dropdown__panel .ck-list__item.ck-on .ck-button {
              background: var(--accent-color) !important;
              color: #fff !important;
          }
          .ck.ck-tooltip {
              background: var(--bg-tertiary) !important;
              color: var(--text-primary) !important;
              border: 1px solid var(--border-color) !important;
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

          .date-nav-btn {
            height: 42px;
            width: 42px;
            border: 1px solid var(--border-color);
            background-color: var(--bg-tertiary);
            color: var(--text-primary);
            border-radius: 6px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.2rem;
            transition: all 0.2s;
            flex-shrink: 0;
          }
          
          .date-nav-btn:hover {
            background-color: var(--accent-color);
            color: white;
            border-color: var(--accent-color);
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

      <div className="selection-controls" style={{ flexWrap: 'wrap' }}>
        <div className="selection-group-container" style={{ width: '100%', alignItems: 'center' }}>
          
          {/* --- GROUP: Project Dropdown & All Projects Checkbox --- */}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '20px' }}>
            
            {/* 1. Project Dropdown */}
            <div className="selection-group" style={{ minWidth: '200px', marginBottom: 0 }}>
              <label className="dropdown-label" htmlFor="note-project">Project</label>
              <CustomDropdown
                id="note-project"
                name="noteProject"
                value={selectedProject}
                onChange={handleProjectChange}
                options={projectOptions}
                placeholder="-- Select Project --"
                disabled={projectOptions.length === 0 || showAllProjects}
              />
            </div>

            {/* NEW: All Projects Checkbox */}
            <div style={{ height: '42px', display: 'flex', alignItems: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: '8px', fontWeight: '600', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                <input 
                  type="checkbox" 
                  checked={showAllProjects}
                  onChange={(e) => {
                      const checked = e.target.checked;
                      executeWithUnsavedCheck(() => setShowAllProjects(checked));
                  }}
                  style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--accent-color)', margin: 0 }}
                />
                All Projects
              </label>
            </div>

          </div>

          {/* 2. Search Component */}
          <div className="selection-group search-container" style={{ flexGrow: 1, minWidth: '250px' }}>
             <label className="dropdown-label">Search in {showAllProjects ? 'All Projects' : (selectedProject || 'Project')}</label>
             <SearchComponent
                query={searchQuery}
                onQueryChange={handleQueryChange}
                onSearch={handleSearch}
                onClear={handleClearSearch}
                onSuggestionSelect={handleSuggestionSelect}
                suggestions={searchSuggestions}
                placeholder="Search notes content..."
             />
          </div>

          {/* 3. Date Selection & Toggles */}
          <div className="selection-group" style={{ minWidth: (isGeneralMode && !showAllProjects) ? '380px' : '280px', flex: 'none' }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', width: '100%' }}>

              <button type="button" className="date-nav-btn" onClick={handlePrevDate} title="Previous">
                 &lt;
              </button>

              <div style={{ flexGrow: 1, minWidth: '130px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label className="dropdown-label" htmlFor="note-date">
                  {(isGeneralMode && !showAllProjects) ? (dateSelectionMode === 'month' ? 'Month' : 'Date') : 'Date'}
                </label>
                <DatePicker
                  id="note-date"
                  name="noteDate"
                  selected={selectedDate}
                  onChange={(date) => executeWithUnsavedCheck(() => setSelectedDate(date))}
                  dateFormat={(isGeneralMode && !showAllProjects) ? (dateSelectionMode === 'month' ? "MM/yyyy" : "MM/dd/yyyy") : "MM/dd/yyyy"}
                  showMonthYearPicker={(isGeneralMode && !showAllProjects) && dateSelectionMode === 'month'}
                  className="notes-datepicker"
                  renderDayContents={renderDayContents}
                  wrapperClassName="date-picker-wrapper"
                  popperPlacement="bottom-start"
                  portalId="root"
                  popperProps={{ strategy: "fixed" }}
                  autoComplete="off"
                />
              </div>

              <button type="button" className="date-nav-btn" onClick={handleNextDate} title="Next">
                 &gt;
              </button>

              {(isGeneralMode && !showAllProjects) ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginLeft: '5px' }}>
                  <ToggleSwitch
                    id="date-selection-mode"
                    checked={dateSelectionMode === 'month'}
                    onChange={(e) => {
                      const isMonth = e.target.checked;
                      executeWithUnsavedCheck(() => setDateSelectionMode(isMonth ? 'month' : 'date'));
                    }}
                    option1="Month"
                    option2="Date"
                    title="Toggle between month and date selection"
                  />
                  {dateSelectionMode === 'date' && (
                    <button onClick={() => executeWithUnsavedCheck(() => setSelectedDate(new Date()))} disabled={isToday(selectedDate)} className="today-button">
                      Today
                    </button>
                  )}
                </div>
              ) : (
                <button onClick={() => executeWithUnsavedCheck(() => setSelectedDate(new Date()))} disabled={isToday(selectedDate)} className="today-button" style={{ marginLeft: '5px' }}>
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

      {/* --- RENDER LOGIC --- */}
      {showAllProjects ? (
          Object.keys(allProjectsTextMap).length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {Object.entries(allProjectsTextMap).map(([projName, text]) => {
                      const isSaving = savingProject === projName;
                      const hasSavedNote = !!(projectNotesMap[getCurrentDateKey()] && typeof projectNotesMap[getCurrentDateKey()] === 'object' && projectNotesMap[getCurrentDateKey()][projName]);
                      
                      return (
                          <div key={projName} className="notes-editor-area" style={{
                              backgroundColor: 'var(--bg-secondary)',
                              border: '1px solid var(--border-color)',
                              borderRadius: '12px',
                              padding: '20px',
                              boxShadow: 'var(--card-shadow)'
                          }}>
                              <h3 style={{ marginTop: 0, borderBottom: '2px solid var(--border-color)', paddingBottom: '10px', color: 'var(--accent-color)' }}>
                                  {projName}
                              </h3>
                              <div className="editor-wrapper">
                                  <CKEditor
                                      editor={ClassicEditor}
                                      data={text}
                                      config={editorConfiguration}
                                      onChange={(event, editor) => handleAllProjectsTextChange(projName, editor.getData())}
                                  />
                              </div>
                              <div className="notes-actions-container" style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                                  <button
                                      onClick={() => handleSaveNote(allProjectsTextMap[projName], projName)}
                                      className="btn-primary"
                                      disabled={isSaving}
                                  >
                                      {isSaving ? <><span className="spinner"></span> Saving...</> : 'Save Note'}
                                  </button>
                                  <button
                                      onClick={() => handleClearRequest(projName)}
                                      className="delete-card-button"
                                      style={{ height: '42px', display: 'flex', alignItems: 'center' }}
                                      disabled={isSaving || !hasSavedNote}
                                  >
                                      Clear Note
                                  </button>
                              </div>
                          </div>
                      );
                  })}
              </div>
          ) : (
              <div className="empty-column-message">No notes found for any project on this date.</div>
          )
      ) : selectedProject ? (
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
              editor={ClassicEditor}
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
              onChange={(event, editor) => {
                const data = editor.getData();
                setNoteText(data);
              }}
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
              onClick={() => handleClearRequest()}
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
        message={`Are you sure you want to permanently delete the note for ${projectToClear ? projectToClear + ' on ' : ''}${isGeneralMode && !showAllProjects ? (dateSelectionMode === 'month' ? formatMonthKey(selectedDate) : selectedDate.toLocaleDateString()) : selectedDate.toLocaleDateString()}? This action cannot be undone.`}
      />

      <ConfirmationModal
        isOpen={isUnsavedModalOpen}
        onClose={() => {
          setIsUnsavedModalOpen(false);
          setPendingAction(null);
        }}
        onSecondaryConfirm={async () => {
          setIsUnsavedModalOpen(false);
          if (showAllProjects) {
              await handleSaveAllChangedNotes();
          } else {
              const currentData = editorInstance ? editorInstance.getData() : noteText;
              await handleSaveNote(currentData);
          }
          if (pendingAction) pendingAction();
          setPendingAction(null);
        }}
        onConfirm={() => {
          setIsUnsavedModalOpen(false);
          if (pendingAction) pendingAction();
          setPendingAction(null);
        }}
        title="Unsaved Changes"
        message="You have unsaved changes in your note. Are you sure you want to leave without saving?"
        secondaryConfirmText="Save and Leave"
        confirmText="Don't Save and Leave"
        cancelText="Cancel"
      />
    </div>
  );
};

export default NotesPage;
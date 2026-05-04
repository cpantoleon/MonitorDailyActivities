import React, { useState, useEffect, useMemo, useRef } from 'react';
import './SnippetsPage.css';
import { CKEditor } from '@ckeditor/ckeditor5-react';
import ClassicEditor from '@ckeditor/ckeditor5-build-classic';
import ConfirmationModal from '../components/ConfirmationModal';
import SearchComponent from '../components/SearchComponent';

function MyUploadAdapterPlugin(editor) {
    editor.plugins.get('FileRepository').createUploadAdapter = (loader) => {
        return {
            upload: () => loader.file.then(file => new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve({ default: reader.result });
                reader.onerror = err => reject(err);
                reader.readAsDataURL(file);
            }))
        };
    };
}

const stripHtml = (html) => {
    const tmp = document.createElement("DIV");
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || "";
};

const SnippetsPage = ({ apiBaseUrl, showMessage }) => {
    const [notes, setNotes] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    
    // Search State
    const [searchQuery, setSearchQuery] = useState('');
    const [searchSuggestions, setSearchSuggestions] = useState([]);
    const [filteredNotes, setFilteredNotes] = useState([]);
    
    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingNote, setEditingNote] = useState(null);
    const [formData, setFormData] = useState({ title: '', content: '', color: 'yellow', category: 'General' });
    
    // Custom ComboBox State & Ref
    const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
    const categoryDropdownRef = useRef(null);

    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [noteToDelete, setNoteToDelete] = useState(null);

    // Collapsed Categories State (Saved in LocalStorage)
    const [collapsedCats, setCollapsedCats] = useState(() => {
        const saved = localStorage.getItem('snippetsCollapsedCats');
        return saved ? JSON.parse(saved) : [];
    });

    // Close Category Dropdown on Click Outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target)) {
                setIsCategoryDropdownOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const toggleCategory = (cat) => {
        const newCollapsed = collapsedCats.includes(cat)
            ? collapsedCats.filter(c => c !== cat)
            : [...collapsedCats, cat];
        setCollapsedCats(newCollapsed);
        localStorage.setItem('snippetsCollapsedCats', JSON.stringify(newCollapsed));
    };

    const fetchNotes = async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`${apiBaseUrl}/stickynotes`);
            const json = await res.json();
            if (res.ok) {
                setNotes(json.data || []);
                setFilteredNotes(json.data || []);
            } else throw new Error(json.error);
        } catch (err) {
            showMessage(`Failed to load snippets: ${err.message}`, 'error');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchNotes();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Extract unique categories for the datalist (dropdown in form)
    const existingCategories = useMemo(() => {
        return [...new Set(notes.map(n => n.category || 'General'))].sort();
    }, [notes]);

    // Group filtered notes by category
    const groupedNotes = useMemo(() => {
        const groups = {};
        filteredNotes.forEach(n => {
            const cat = n.category || 'General';
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push(n);
        });
        return groups;
    }, [filteredNotes]);

    // --- Search Logic ---
    const handleQueryChange = (query) => {
        setSearchQuery(query);
        if (query.length < 3) {
            setSearchSuggestions([]);
            setFilteredNotes(notes); 
            return;
        }

        const lowerQ = query.toLowerCase();
        const results = notes.filter(n => 
            n.title.toLowerCase().includes(lowerQ) || 
            (n.content && n.content.toLowerCase().includes(lowerQ)) ||
            (n.category && n.category.toLowerCase().includes(lowerQ))
        );
        
        setFilteredNotes(results);

        const suggestions = results.map(n => ({
            id: n.id,
            name: n.title,
            context: stripHtml(n.content).substring(0, 40) + '...'
        })).slice(0, 10);
        
        setSearchSuggestions(suggestions);
    };

    const handleSearch = (query) => { handleQueryChange(query); };
    const handleClearSearch = () => { setSearchQuery(''); setSearchSuggestions([]); setFilteredNotes(notes); };

    const handleSuggestionSelect = (suggestion) => {
        const selected = notes.find(n => n.id === suggestion.id);
        if (selected) {
            setFilteredNotes([selected]);
            setSearchQuery(selected.title);
            setSearchSuggestions([]);
            
            // Expand the category if it was collapsed, so the user can see what they searched for
            if (collapsedCats.includes(selected.category)) {
                toggleCategory(selected.category);
            }
        }
    };

    // --- Modal Actions ---
    const handleOpenModal = (note = null) => {
        if (note) {
            setEditingNote(note);
            setFormData({ title: note.title, content: note.content || '', color: note.color || 'yellow', category: note.category || 'General' });
        } else {
            setEditingNote(null);
            setFormData({ title: '', content: '', color: 'yellow', category: 'General' });
        }
        setIsCategoryDropdownOpen(false);
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (!formData.title.trim()) {
            showMessage('Title is required!', 'error');
            return;
        }

        const url = editingNote ? `${apiBaseUrl}/stickynotes/${editingNote.id}` : `${apiBaseUrl}/stickynotes`;
        const method = editingNote ? 'PUT' : 'POST';

        try {
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error);
            
            showMessage(`Snippet ${editingNote ? 'updated' : 'created'}!`, 'success');
            setIsModalOpen(false);
            fetchNotes();
            handleClearSearch(); 
        } catch (err) {
            showMessage(err.message, 'error');
        }
    };

    const handleDelete = async () => {
        if (!noteToDelete) return;
        try {
            const res = await fetch(`${apiBaseUrl}/stickynotes/${noteToDelete.id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Failed to delete');
            showMessage('Snippet deleted!', 'success');
            fetchNotes();
            handleClearSearch();
        } catch (err) {
            showMessage(err.message, 'error');
        } finally {
            setIsDeleteConfirmOpen(false);
            setNoteToDelete(null);
        }
    };

    return (
        <div className="main-content-area snippets-container">
            <div className="snippets-toolbar">
                <div className="snippets-search-wrapper">
                    <SearchComponent
                        query={searchQuery}
                        onQueryChange={handleQueryChange}
                        onSearch={handleSearch}
                        onClear={handleClearSearch}
                        onSuggestionSelect={handleSuggestionSelect}
                        suggestions={searchSuggestions}
                        placeholder="Search snippets by title or content..."
                    />
                </div>
                <button className="btn-primary" onClick={() => handleOpenModal()}>+ New Snippet</button>
            </div>

            {isLoading ? (
                <div className="loading-message">Loading snippets...</div>
            ) : filteredNotes.length === 0 ? (
                <div className="empty-column-message">No snippets found. Click "+ New Snippet" to create one!</div>
            ) : (
                <div className="snippets-group-wrapper">
                    {Object.keys(groupedNotes).sort().map(category => {
                        const isCollapsed = collapsedCats.includes(category);
                        const categoryNotes = groupedNotes[category];

                        return (
                            <div key={category} className="snippet-category-section">
                                <h2 className="snippet-category-header" onClick={() => toggleCategory(category)}>
                                    <span className="category-arrow">{isCollapsed ? '▶' : '▼'}</span>
                                    {category} 
                                    <span className="category-count">{categoryNotes.length}</span>
                                </h2>
                                
                                {!isCollapsed && (
                                    <div className="snippets-grid">
                                        {categoryNotes.map(note => (
                                            <div 
                                                key={note.id} 
                                                className={`snippet-card snippet-color-${note.color}`}
                                                onClick={() => handleOpenModal(note)}
                                                title="Click to Edit"
                                            >
                                                <h3 className="snippet-title">{note.title}</h3>
                                                <div className="snippet-preview">
                                                    {stripHtml(note.content)}
                                                </div>
                                                <div className="snippet-footer">
                                                    <span className="snippet-date">{new Date(note.updated_at).toLocaleDateString()}</span>
                                                    <div className="snippet-actions">
                                                        <button 
                                                            className="snippet-action-btn"
                                                            onClick={(e) => { e.stopPropagation(); handleOpenModal(note); }}
                                                        >
                                                            Edit
                                                        </button>
                                                        <button 
                                                            className="snippet-action-btn delete" 
                                                            onClick={(e) => { e.stopPropagation(); setNoteToDelete(note); setIsDeleteConfirmOpen(true); }}
                                                        >
                                                            Delete
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Editor Modal */}
            {isModalOpen && (
                <div className="add-new-modal-overlay" onClick={() => setIsModalOpen(false)}>
                    <div id="snippet-modal-content-id" className="add-new-modal-content" style={{ maxWidth: '800px' }} onClick={e => e.stopPropagation()}>
                        <h2>{editingNote ? 'Edit Snippet' : 'New Snippet'}</h2>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                            <div className="form-group">
                                <label>Title</label>
                                <input 
                                    type="text" 
                                    value={formData.title} 
                                    onChange={e => setFormData({...formData, title: e.target.value})}
                                    placeholder="e.g., EUIPO Passwords..."
                                    autoFocus
                                />
                            </div>
                            
                            {/* Custom ComboBox for Categories */}
                            <div className="form-group" ref={categoryDropdownRef}>
                                <label>List / Folder</label>
                                <div className="category-combobox-wrapper">
                                    <input 
                                        type="text" 
                                        value={formData.category} 
                                        onChange={e => {
                                            setFormData({...formData, category: e.target.value});
                                            setIsCategoryDropdownOpen(true);
                                        }}
                                        onClick={() => setIsCategoryDropdownOpen(true)}
                                        placeholder="e.g., General, Credentials, Guides..."
                                        autoComplete="off"
                                        style={{ paddingRight: '35px' }}
                                    />
                                    <span 
                                        className="category-combobox-arrow"
                                        onClick={() => setIsCategoryDropdownOpen(!isCategoryDropdownOpen)}
                                    >
                                        ▼
                                    </span>
                                    
                                    {isCategoryDropdownOpen && existingCategories.length > 0 && (
                                        <ul className="category-dropdown-list">
                                            {existingCategories.map(cat => (
                                                <li 
                                                    key={cat} 
                                                    className="category-dropdown-item"
                                                    onClick={() => {
                                                        setFormData({...formData, category: cat});
                                                        setIsCategoryDropdownOpen(false);
                                                    }}
                                                >
                                                    {cat}
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="form-group">
                            <label>Card Color</label>
                            <div className="color-picker">
                                {['yellow', 'blue', 'green', 'pink'].map(c => (
                                    <div 
                                        key={c}
                                        className={`color-dot bg-${c} ${formData.color === c ? 'selected' : ''}`}
                                        onClick={() => setFormData({...formData, color: c})}
                                    />
                                ))}
                            </div>
                        </div>

                        <div className="form-group">
                            <label>Content</label>
                            <CKEditor
                                editor={ClassicEditor}
                                data={formData.content}
                                config={{ extraPlugins: [MyUploadAdapterPlugin] }}
                                onChange={(event, editor) => setFormData({...formData, content: editor.getData()})}
                            />
                        </div>

                        <div className="modal-actions">
                            <button className="modal-button-cancel" onClick={() => setIsModalOpen(false)}>Cancel</button>
                            <button className="modal-button-save" onClick={handleSave}>Save Snippet</button>
                        </div>
                    </div>
                </div>
            )}

            <ConfirmationModal 
                isOpen={isDeleteConfirmOpen} 
                onClose={() => setIsDeleteConfirmOpen(false)} 
                onConfirm={handleDelete} 
                title="Delete Snippet" 
                message={`Are you sure you want to delete "${noteToDelete?.title}"?`} 
            />
        </div>
    );
};

export default SnippetsPage;
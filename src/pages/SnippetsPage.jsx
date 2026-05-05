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
    const [categoryOrder, setCategoryOrder] = useState([]); // Το νέο State για τη σειρά
    const [isLoading, setIsLoading] = useState(true);
    
    // Search State
    const [searchQuery, setSearchQuery] = useState('');
    const [searchSuggestions, setSearchSuggestions] = useState([]);
    const [filteredNotes, setFilteredNotes] = useState([]);
    
    // Editor Modal
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingNote, setEditingNote] = useState(null);
    const [formData, setFormData] = useState({ title: '', content: '', color: 'yellow', category: 'General' });
    
    // View Modal
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    const [viewingNote, setViewingNote] = useState(null);

    // Custom ComboBox
    const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
    const categoryDropdownRef = useRef(null);

    // Delete Modal
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [noteToDelete, setNoteToDelete] = useState(null);

    // Drag & Drop States for Notes
    const [draggedNoteId, setDraggedNoteId] = useState(null);
    const [dragOverCategory, setDragOverCategory] = useState(null);
    const [dropIndicator, setDropIndicator] = useState({ id: null, position: null });

    // Drag & Drop States for Categories
    const [draggedCatName, setDraggedCatName] = useState(null);
    const [catDropIndicator, setCatDropIndicator] = useState({ name: null, position: null });

    // Collapsed Categories State
    const [collapsedCats, setCollapsedCats] = useState(() => {
        const saved = localStorage.getItem('snippetsCollapsedCats');
        return saved ? JSON.parse(saved) : [];
    });

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
        const newCollapsed = collapsedCats.includes(cat) ? collapsedCats.filter(c => c !== cat) : [...collapsedCats, cat];
        setCollapsedCats(newCollapsed);
        localStorage.setItem('snippetsCollapsedCats', JSON.stringify(newCollapsed));
    };

    const fetchData = async () => {
        setIsLoading(true);
        try {
            // Fetch Notes
            const resNotes = await fetch(`${apiBaseUrl}/stickynotes`);
            const jsonNotes = await resNotes.json();
            if (resNotes.ok) {
                setNotes(jsonNotes.data || []);
                setFilteredNotes(jsonNotes.data || []);
            } else throw new Error(jsonNotes.error);

            // Fetch Category Order
            const resOrder = await fetch(`${apiBaseUrl}/settings/snippet-category-order`);
            const jsonOrder = await resOrder.json();
            if (resOrder.ok && jsonOrder.order) {
                setCategoryOrder(jsonOrder.order);
            }
        } catch (err) {
            showMessage(`Failed to load snippets: ${err.message}`, 'error');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    const existingCategories = useMemo(() => [...new Set(notes.map(n => n.category || 'General'))].sort(), [notes]);

    const groupedNotes = useMemo(() => {
        const groups = {};
        filteredNotes.forEach(n => {
            const cat = n.category || 'General';
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push(n);
        });
        Object.keys(groups).forEach(cat => {
            groups[cat].sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
        });
        return groups;
    }, [filteredNotes]);

    // Sorting Categories based on saved Order array
    const sortedCategoryKeys = useMemo(() => {
        return Object.keys(groupedNotes).sort((a, b) => {
            const idxA = categoryOrder.indexOf(a);
            const idxB = categoryOrder.indexOf(b);
            if (idxA !== -1 && idxB !== -1) return idxA - idxB;
            if (idxA !== -1) return -1;
            if (idxB !== -1) return 1;
            return a.localeCompare(b);
        });
    }, [groupedNotes, categoryOrder]);

    // --- Search Logic ---
    const handleQueryChange = (query) => {
        setSearchQuery(query);
        if (query.length < 3) { 
            setSearchSuggestions([]); 
            setFilteredNotes(notes);
            return; 
        }
        const lowerQ = query.toLowerCase();
        const results = notes.filter(n => n.title.toLowerCase().includes(lowerQ) || (n.content && n.content.toLowerCase().includes(lowerQ)) || (n.category && n.category.toLowerCase().includes(lowerQ)));
        setFilteredNotes(results);
        setSearchSuggestions(results.map(n => ({ id: n.id, name: n.title, context: stripHtml(n.content).substring(0, 40) + '...' })).slice(0, 10));
    };

    const handleSearch = (query) => { handleQueryChange(query); };
    const handleClearSearch = () => { setSearchQuery(''); setSearchSuggestions([]); setFilteredNotes(notes); };

    const handleSuggestionSelect = (suggestion) => {
        const selected = notes.find(n => n.id === suggestion.id);
        if (selected) {
            setFilteredNotes([selected]);
            setSearchQuery(selected.title);
            setSearchSuggestions([]);
            if (collapsedCats.includes(selected.category)) toggleCategory(selected.category);
        }
    };

    // --- Actions ---
    const handleCardClick = (e, note) => {
        if (e.target.tagName.toLowerCase() === 'a' || e.target.closest('a')) return; 
        setViewingNote(note);
        setIsViewModalOpen(true);
    };

    const handleOpenEditModal = (e, note = null) => {
        if (e) e.stopPropagation();
        if (note) {
            setEditingNote(note);
            setFormData({ title: note.title, content: note.content || '', color: note.color || 'yellow', category: note.category || 'General' });
        } else {
            setEditingNote(null);
            setFormData({ title: '', content: '', color: 'yellow', category: 'General' });
        }
        setIsCategoryDropdownOpen(false);
        setIsEditModalOpen(true);
        setIsViewModalOpen(false); 
    };

    const handleSave = async () => {
        if (!formData.title.trim()) { showMessage('Title is required!', 'error'); return; }
        const url = editingNote ? `${apiBaseUrl}/stickynotes/${editingNote.id}` : `${apiBaseUrl}/stickynotes`;
        const method = editingNote ? 'PUT' : 'POST';
        try {
            const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData) });
            if (!res.ok) throw new Error((await res.json()).error);
            showMessage(`Snippet ${editingNote ? 'updated' : 'created'}!`, 'success');
            setIsEditModalOpen(false);
            fetchData();
            handleClearSearch();
        } catch (err) { showMessage(err.message, 'error'); }
    };

    const handleDelete = async () => {
        if (!noteToDelete) return;
        try {
            const res = await fetch(`${apiBaseUrl}/stickynotes/${noteToDelete.id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Failed to delete');
            showMessage('Snippet deleted!', 'success');
            setIsViewModalOpen(false);
            fetchData();
            handleClearSearch();
        } catch (err) { showMessage(err.message, 'error'); } 
        finally { setIsDeleteConfirmOpen(false); setNoteToDelete(null); }
    };

    // --- Drag & Drop for NOTES ---
    const handleNoteDragStart = (e, note) => {
        e.stopPropagation();
        setDraggedNoteId(note.id);
        e.dataTransfer.setData("noteId", note.id);
        setTimeout(() => e.target.classList.add('dragging'), 0);
    };

    const handleNoteDragEnd = (e) => {
        e.stopPropagation();
        e.target.classList.remove('dragging');
        setDraggedNoteId(null);
        setDragOverCategory(null);
        setDropIndicator({ id: null, position: null });
    };

    const handleNoteDragOver = (e, targetNoteId, category) => {
        e.preventDefault();
        if (draggedCatName) return; // Prevent conflicts if dragging a category
        setDragOverCategory(category);

        const targetCard = e.target.closest('.snippet-card-wrapper');
        if (targetCard && !targetCard.querySelector('.snippet-card').classList.contains('dragging')) {
            const rect = targetCard.getBoundingClientRect();
            const midPoint = rect.left + rect.width / 2;
            const position = e.clientX < midPoint ? 'before' : 'after';
            if (dropIndicator.id !== targetNoteId || dropIndicator.position !== position) {
                setDropIndicator({ id: targetNoteId, position });
            }
        } else {
            setDropIndicator({ id: null, position: null });
        }
    };

    const handleNoteDrop = async (e, targetCategory) => {
        e.preventDefault();
        e.stopPropagation();
        const draggedId = e.dataTransfer.getData("noteId");
        
        const finalIndicator = { ...dropIndicator };
        setDropIndicator({ id: null, position: null });
        setDragOverCategory(null);

        if (!draggedId) return; // It wasn't a note

        const draggedNote = notes.find(n => String(n.id) === draggedId);
        if (!draggedNote) return;

        let newCategoryNotes = [...(groupedNotes[targetCategory] || [])];
        if (draggedNote.category === targetCategory) {
            newCategoryNotes = newCategoryNotes.filter(n => String(n.id) !== draggedId);
        }

        if (finalIndicator.id) {
            let targetIdx = newCategoryNotes.findIndex(n => String(n.id) === String(finalIndicator.id));
            if (finalIndicator.position === 'after') targetIdx += 1;
            newCategoryNotes.splice(targetIdx, 0, { ...draggedNote, category: targetCategory });
        } else {
            newCategoryNotes.push({ ...draggedNote, category: targetCategory });
        }

        const updates = newCategoryNotes.map((n, index) => ({
            id: n.id,
            category: targetCategory,
            display_order: index
        }));

        const updatedNotes = notes.map(n => {
            if (String(n.id) === draggedId) return { ...n, category: targetCategory };
            return n;
        });
        setNotes(updatedNotes);

        try {
            const res = await fetch(`${apiBaseUrl}/stickynotes/reorder`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ updates })
            });
            if (!res.ok) throw new Error('Reorder failed');
            fetchData(); 
        } catch (err) {
            showMessage(err.message, 'error');
            fetchData(); 
        }
    };

    // --- Drag & Drop for CATEGORIES ---
    const handleCategoryDragStart = (e, cat) => {
        e.stopPropagation();
        setDraggedCatName(cat);
        e.dataTransfer.setData("catName", cat);
        setTimeout(() => e.target.classList.add('dragging'), 0);
    };

    const handleCategoryDragEnd = (e) => {
        e.stopPropagation();
        e.target.classList.remove('dragging');
        setDraggedCatName(null);
        setCatDropIndicator({ name: null, position: null });
    };

    const handleCategoryDragOver = (e, targetCat) => {
        e.preventDefault();
        if (!draggedCatName || draggedCatName === targetCat) return; // Only process if dragging a category
        
        const rect = e.currentTarget.getBoundingClientRect();
        const midPoint = rect.top + rect.height / 2;
        const position = e.clientY < midPoint ? 'before' : 'after';

        if (catDropIndicator.name !== targetCat || catDropIndicator.position !== position) {
            setCatDropIndicator({ name: targetCat, position });
        }
    };

    const handleCategoryDrop = async (e, targetCat) => {
        e.preventDefault();
        const catName = e.dataTransfer.getData("catName");
        
        const finalIndicator = { ...catDropIndicator };
        setCatDropIndicator({ name: null, position: null });

        if (!catName || !draggedCatName || catName === targetCat) return;

        let newOrder = [...sortedCategoryKeys];
        const draggedIdx = newOrder.indexOf(catName);
        newOrder.splice(draggedIdx, 1); // remove

        let targetIdx = newOrder.indexOf(targetCat);
        if (finalIndicator.position === 'after') {
            targetIdx += 1;
        }
        
        newOrder.splice(targetIdx, 0, catName); // insert
        setCategoryOrder(newOrder); // Optimistic UI

        try {
            const res = await fetch(`${apiBaseUrl}/settings/snippet-category-order`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ order: newOrder })
            });
            if (!res.ok) throw new Error('Failed to save order');
        } catch(err) {
            showMessage(err.message, "error");
            fetchData(); // Revert
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
                <button className="btn-primary" onClick={(e) => handleOpenEditModal(e)}>+ New Snippet</button>
            </div>

            {isLoading ? (
                <div className="loading-message">Loading snippets...</div>
            ) : filteredNotes.length === 0 ? (
                <div className="empty-column-message">No snippets found. Click "+ New Snippet" to create one!</div>
            ) : (
                <div className="snippets-group-wrapper">
                    {sortedCategoryKeys.map(category => {
                        const isCollapsed = collapsedCats.includes(category);
                        const categoryNotes = groupedNotes[category];
                        
                        let sectionClasses = `snippet-category-section ${dragOverCategory === category && !draggedCatName ? 'drag-over' : ''}`;
                        if (catDropIndicator.name === category) {
                            sectionClasses += catDropIndicator.position === 'before' ? ' cat-drop-before' : ' cat-drop-after';
                        }

                        return (
                            <div 
                                key={category} 
                                className={sectionClasses}
                                onDragOver={(e) => handleCategoryDragOver(e, category)}
                                onDrop={(e) => {
                                    if (draggedCatName) handleCategoryDrop(e, category);
                                    else handleNoteDrop(e, category); // If it's a note dropped in empty space
                                }}
                            >
                                <h2 
                                    className="snippet-category-header" 
                                    draggable
                                    onDragStart={(e) => handleCategoryDragStart(e, category)}
                                    onDragEnd={handleCategoryDragEnd}
                                >
                                    <span className="category-drag-handle" title="Drag to reorder folder">⋮⋮</span>
                                    <span 
                                        className="category-arrow" 
                                        onClick={(e) => { e.stopPropagation(); toggleCategory(category); }}
                                    >
                                        {isCollapsed ? '▶' : '▼'}
                                    </span>
                                    <span onClick={(e) => { e.stopPropagation(); toggleCategory(category); }}>
                                        {category}
                                    </span>
                                    <span className="category-count">{categoryNotes.length}</span>
                                </h2>
                                
                                {!isCollapsed && (
                                    <div className="snippets-grid">
                                        {categoryNotes.length === 0 && <p style={{opacity: 0.5, fontStyle: 'italic', paddingLeft: '10px'}}>Empty folder. Drop notes here.</p>}
                                        {categoryNotes.map(note => {
                                            const isDropTarget = dropIndicator.id === note.id;
                                            let wrapperStyle = { };

                                            if (isDropTarget) {
                                                const indicator = '4px solid var(--accent-color)';
                                                if (dropIndicator.position === 'before') {
                                                    wrapperStyle.borderLeft = indicator;
                                                    wrapperStyle.paddingLeft = '8px';
                                                    wrapperStyle.marginLeft = '-8px';
                                                } else {
                                                    wrapperStyle.borderRight = indicator;
                                                    wrapperStyle.paddingRight = '8px';
                                                    wrapperStyle.marginRight = '-8px';
                                                }
                                            }

                                            return (
                                                <div key={note.id} className="snippet-card-wrapper" style={wrapperStyle}>
                                                    <div 
                                                        className={`snippet-card snippet-color-${note.color}`}
                                                        onClick={(e) => handleCardClick(e, note)}
                                                        draggable
                                                        onDragStart={(e) => handleNoteDragStart(e, note)}
                                                        onDragEnd={handleNoteDragEnd}
                                                        onDragOver={(e) => handleNoteDragOver(e, note.id, category)}
                                                        onDrop={(e) => {
                                                            if (!draggedCatName) handleNoteDrop(e, category);
                                                        }}
                                                    >
                                                        <h3 className="snippet-title">{note.title}</h3>
                                                        <div 
                                                            className="snippet-preview"
                                                            dangerouslySetInnerHTML={{ __html: note.content }}
                                                        />
                                                        <div className="snippet-footer">
                                                            <span className="snippet-date">{new Date(note.updated_at).toLocaleDateString()}</span>
                                                            <div className="snippet-actions">
                                                                <button 
                                                                    className="snippet-action-btn"
                                                                    onClick={(e) => handleOpenEditModal(e, note)}
                                                                >
                                                                    Edit
                                                                </button>
                                                                <button 
                                                                    className="snippet-action-btn delete" 
                                                                    onClick={(e) => { e.stopPropagation(); setNoteToDelete(note); setIsDeleteConfirmOpen(true); }}
                                                                >
                                                                    Trash
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* View Modal (Blurred Overlay) */}
            {isViewModalOpen && viewingNote && (
                <div className="snippet-view-overlay" onClick={() => setIsViewModalOpen(false)}>
                    <div className="snippet-view-content" onClick={e => e.stopPropagation()}>
                        <div className="snippet-view-header">
                            <h2>{viewingNote.title}</h2>
                            <button className="snippet-view-close-btn" onClick={() => setIsViewModalOpen(false)}>✕</button>
                        </div>
                        <div className="snippet-view-body" dangerouslySetInnerHTML={{ __html: viewingNote.content }} />
                        <div className="snippet-view-footer">
                            <span style={{marginRight: 'auto', alignSelf: 'center', opacity: 0.6, fontSize: '0.85rem'}}>Folder: {viewingNote.category}</span>
                            <button className="modal-button-cancel" onClick={() => setIsViewModalOpen(false)}>Close</button>
                            <button className="modal-button-save" onClick={(e) => handleOpenEditModal(e, viewingNote)}>Edit</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Editor Modal */}
            {isEditModalOpen && (
                <div className="add-new-modal-overlay" onClick={() => setIsEditModalOpen(false)}>
                    <div id="snippet-modal-content-id" className="add-new-modal-content" style={{ maxWidth: '800px', zIndex: 1061 }} onClick={e => e.stopPropagation()}>
                        <h2>{editingNote ? 'Edit Snippet' : 'New Snippet'}</h2>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                            <div className="form-group">
                                <label>Title <span style={{color: 'var(--danger-color)'}}>*</span></label>
                                <input 
                                    type="text" 
                                    value={formData.title} 
                                    onChange={e => setFormData({...formData, title: e.target.value})}
                                    placeholder="e.g., EUIPO Passwords..."
                                    autoFocus
                                />
                            </div>
                            
                            <div className="form-group" ref={categoryDropdownRef}>
                                <label>List / Folder <span style={{color: 'var(--danger-color)'}}>*</span></label>
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
                            <button className="modal-button-cancel" onClick={() => setIsEditModalOpen(false)}>Cancel</button>
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
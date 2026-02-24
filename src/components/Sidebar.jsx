import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useGlobal } from '../context/GlobalContext';
import './Sidebar.css';

const Sidebar = () => {
  const { theme, toggleTheme, globalProject, sidebarCollapsed, toggleSidebar } = useGlobal();
  const location = useLocation();

  const menuItems = [
    { path: '/sprint-board', label: 'Sprint Board', icon: '📋' },
    { path: '/defects', label: 'Defects', icon: '🐞' },
    { path: '/releases', label: 'Releases', icon: '🚀' },
    { path: '/sprint-analysis', label: 'Analysis', icon: '📈' },
    { path: '/notes', label: 'Notes', icon: '📝' },
  ];

  const getActiveStyle = ({ isActive }) => {
    return isActive ? {
      borderLeft: '4px solid var(--accent-color, #3182ce)',
      backgroundColor: 'var(--bg-secondary)',
      color: 'var(--text-primary)', 
    } : {};
  };

  return (
    <div className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        <div className="logo-icon">CP</div>
        {!sidebarCollapsed && <span className="logo-text">Cpantoleon</span>}
        <button className="collapse-btn" onClick={toggleSidebar} title={sidebarCollapsed ? "Expand" : "Collapse"}>
          {sidebarCollapsed ? '»' : '«'}
        </button>
      </div>

      {/* Main navigation list */}
      <nav className="sidebar-nav" style={{ marginTop: '20px' }}>
        
        {/* Custom Dashboard Link logic to handle the dynamic /:project route */}
        <NavLink 
          to="/"
          className={() => (location.pathname === '/' || (globalProject && location.pathname === `/${encodeURIComponent(globalProject)}`)) ? "nav-item active" : "nav-item"}
          style={({ isActive }) => (location.pathname === '/' || (globalProject && location.pathname === `/${encodeURIComponent(globalProject)}`)) ? getActiveStyle({ isActive: true }) : {}}
        >
          <span className="icon">🏠</span>
          {!sidebarCollapsed && <span className="label">Dashboard</span>}
        </NavLink>

        {/* Map through the rest of the standard routes */}
        {menuItems.map((item) => (
          <NavLink 
            key={item.path} 
            to={item.path}
            className={({ isActive }) => isActive ? "nav-item active" : "nav-item"}
            style={getActiveStyle}
          >
            <span className="icon">{item.icon}</span>
            {!sidebarCollapsed && <span className="label">{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <button onClick={toggleTheme} className="theme-toggle" title="Toggle Theme">
          {sidebarCollapsed ? (theme === 'light' ? '🌙' : '☀️') : (theme === 'light' ? '🌙 Dark Mode' : '☀️ Light Mode')}
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
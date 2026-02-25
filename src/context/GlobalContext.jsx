import React, { createContext, useState, useContext, useEffect } from 'react';

const GlobalContext = createContext();

export const GlobalProvider = ({ children }) => {
  // UI Settings (Theme/Sidebar) -> Keep in localStorage (Persist forever)
  const [theme, setTheme] = useState(() => localStorage.getItem('appTheme') || 'light');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem('sidebarCollapsed') === 'true');

  // Global Project Selection -> Change to sessionStorage (Clear on browser close)
  const [globalProject, setGlobalProject] = useState(() => sessionStorage.getItem('globalProject') || '');

  // Apply theme to document body automatically
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('appTheme', theme);
  }, [theme]);

  // Handle Sidebar Collapse State
  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', sidebarCollapsed);
    const width = sidebarCollapsed ? '80px' : '260px';
    document.documentElement.style.setProperty('--sidebar-width', width);
  }, [sidebarCollapsed]);

  // Persist project selection to Session Storage (Clears when browser closes)
  useEffect(() => {
    if (globalProject) {
      sessionStorage.setItem('globalProject', globalProject);
    } else {
      sessionStorage.removeItem('globalProject');
    }
  }, [globalProject]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  };

  const toggleSidebar = () => {
    setSidebarCollapsed(prev => !prev);
  };

  return (
    <GlobalContext.Provider value={{ theme, toggleTheme, globalProject, setGlobalProject, sidebarCollapsed, toggleSidebar }}>
      {children}
    </GlobalContext.Provider>
  );
};

export const useGlobal = () => useContext(GlobalContext);
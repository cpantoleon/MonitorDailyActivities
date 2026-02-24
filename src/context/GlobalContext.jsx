import React, { createContext, useState, useContext, useEffect } from 'react';

const GlobalContext = createContext();

export const GlobalProvider = ({ children }) => {
  // Use localStorage to remember settings forever (acts like a cookie)
  const [theme, setTheme] = useState(() => localStorage.getItem('appTheme') || 'light');
  const [globalProject, setGlobalProject] = useState(() => localStorage.getItem('globalProject') || '');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem('sidebarCollapsed') === 'true');

  // Apply theme to document body automatically
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('appTheme', theme);
  }, [theme]);

  // Persist project selection
  useEffect(() => {
    localStorage.setItem('globalProject', globalProject);
  }, [globalProject]);

  // Handle Sidebar Collapse State
  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', sidebarCollapsed);
    const width = sidebarCollapsed ? '80px' : '260px';
    document.documentElement.style.setProperty('--sidebar-width', width);
  }, [sidebarCollapsed]);

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
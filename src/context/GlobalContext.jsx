// src/context/GlobalContext.jsx
import React, { createContext, useState, useContext, useEffect } from 'react';

const GlobalContext = createContext();

export const GlobalProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => localStorage.getItem('appTheme') || 'light');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem('sidebarCollapsed') === 'true');
  const [globalProject, setGlobalProject] = useState(() => sessionStorage.getItem('globalProject') || '');

  const defaultLayout = ['overview', 'weather', 'timeline', 'calendar', 'meetings', 'celebrations'];
  const [dashboardLayout, setDashboardLayout] = useState(() => {
    const saved = localStorage.getItem('dashboardLayout');
    return saved ? JSON.parse(saved) : defaultLayout;
  });

  const [dashboardGridStyle, setDashboardGridStyle] = useState(() => {
    return localStorage.getItem('dashboardGridStyle') || 'layout-dense';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('appTheme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', sidebarCollapsed);
    const width = sidebarCollapsed ? '80px' : '260px';
    document.documentElement.style.setProperty('--sidebar-width', width);
  }, [sidebarCollapsed]);

  useEffect(() => {
    if (globalProject) {
      sessionStorage.setItem('globalProject', globalProject);
    } else {
      sessionStorage.removeItem('globalProject');
    }
  }, [globalProject]);

  useEffect(() => {
    localStorage.setItem('dashboardLayout', JSON.stringify(dashboardLayout));
  }, [dashboardLayout]);

  useEffect(() => {
    localStorage.setItem('dashboardGridStyle', dashboardGridStyle);
  }, [dashboardGridStyle]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  };

  const toggleSidebar = () => {
    setSidebarCollapsed(prev => !prev);
  };

  return (
    <GlobalContext.Provider value={{ 
      theme, 
      toggleTheme, 
      globalProject, 
      setGlobalProject, 
      sidebarCollapsed, 
      toggleSidebar,
      dashboardLayout, 
      setDashboardLayout,
      dashboardGridStyle,
      setDashboardGridStyle
    }}>
      {children}
    </GlobalContext.Provider>
  );
};

export const useGlobal = () => useContext(GlobalContext);
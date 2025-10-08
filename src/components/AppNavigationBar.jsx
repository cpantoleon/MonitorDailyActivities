import React from 'react';
import { NavLink } from 'react-router-dom';
import './AppNavigationBar.css';

const AppNavigationBar = () => {
  return (
    <nav className="app-navigation">
      <NavLink to="/" end className={({ isActive }) => isActive ? "nav-tab active" : "nav-tab"}>
        Sprint Activities
      </NavLink>
      <NavLink to="/defects" className={({ isActive }) => isActive ? "nav-tab active" : "nav-tab"}>
        Defects
      </NavLink>
      <NavLink to="/releases" className={({ isActive }) => isActive ? "nav-tab active" : "nav-tab"}>
        Releases
      </NavLink>
      <NavLink to="/sprint-analysis" className={({ isActive }) => isActive ? "nav-tab active" : "nav-tab"}>
        Key Findings
      </NavLink>
      <NavLink to="/notes" className={({ isActive }) => isActive ? "nav-tab active" : "nav-tab"}>
        Notes
      </NavLink>
    </nav>
  );
};

export default AppNavigationBar;
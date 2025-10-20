import React from 'react';
import { NavLink } from 'react-router-dom';
import './AppNavigationBar.css';
import logo from '/logo.svg';

const AppNavigationBar = () => {
  return (
    <nav className="app-navigation">
      <div style={{ display: 'flex', alignItems: 'center', paddingLeft: '20px' }}>
        <img src={logo} alt="Logo" style={{ width: '40px', marginRight: '10px' }} />
        <span style={{ color: '#5C4033', fontWeight: 'bold' }}>cp project</span>
      </div>
      <div>
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
      </div>
      <div></div>
    </nav>
  );
};

export default AppNavigationBar;
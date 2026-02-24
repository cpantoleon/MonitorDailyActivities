import React from 'react';
import { useGlobal } from '../context/GlobalContext';
import './DailyInfoWidget.css';

const DailyInfoWidget = () => {
  const { theme } = useGlobal();

  // Define colors based on the active theme
  const params = theme === 'dark'
    ? "color=E2E8F0&color2=D69E2E&bgcolor=1A202C" // Dark Mode colors
    : "color=555555&color2=feca54&bgcolor=f8f9db"; // Light Mode colors

  const iframeSrc = `https://www.eortologio.net/widget.php?${params}&width=250&height=440`;

  return (
    <div id="daily-info-widget-id" className="daily-info-widget">
      <div className="nameday-section">
        <div className="iframe-container">
          <iframe 
            src={iframeSrc}
            width="250" 
            height="440" 
            scrolling="no" 
            marginWidth="0" 
            marginHeight="0" 
            frameBorder="0"
            title="Eortologio Widget"
          ></iframe>
        </div>
      </div>
    </div>
  );
};

export default DailyInfoWidget;
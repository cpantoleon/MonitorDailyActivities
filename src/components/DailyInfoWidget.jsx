import React from 'react';
import './DailyInfoWidget.css';

const DailyInfoWidget = () => {
  return (
    <div id="daily-info-widget-id" className="daily-info-widget">
      <div className="nameday-section">
        <div className="iframe-container">
          <iframe 
            src="https://www.eortologio.net/widget.php?color=555555&color2=feca54&bgcolor=f8f9db&width=250&height=440"	
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
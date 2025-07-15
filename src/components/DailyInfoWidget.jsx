import React from 'react';
import './DailyInfoWidget.css';

const DailyInfoWidget = () => {
  return (
    <div className="daily-info-widget">
      <div className="nameday-section">
        {/* The H4 header has been removed */}
        <div className="iframe-container">
          <iframe 
            // The bgcolor is now the same as the header color
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
import React, { useState, useMemo } from 'react';
import './DashboardCalendarWidget.css';

const DashboardCalendarWidget = ({ allReleases = [] }) => {
  const [currentDate, setCurrentDate] = useState(new Date());

  // Vibrant color palette for project dots
  const colorPalette = ['#e53e3e', '#3182ce', '#38a169', '#d69e2e', '#805ad5', '#00b5d8', '#ed64a6', '#dd6b20', '#4a5568', '#2d3748', '#cbd5e0', '#f6ad55', '#68d391', '#63b3ed', '#f56565', '#ed8936', '#48bb78', '#4299e1', '#9f7aea', '#ed64a6', '#4fd1c5'];
  
  const projectColors = useMemo(() => {
    const uniqueProjects = [...new Set(allReleases.map(r => r.project))].sort();
    const map = {};
    uniqueProjects.forEach((proj, idx) => {
      map[proj] = colorPalette[idx % colorPalette.length];
    });
    return map;
  }, [allReleases]);

  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const goToToday = () => setCurrentDate(new Date());

  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const startDate = new Date(year, month, 1);
    // Rewind to Sunday
    startDate.setDate(startDate.getDate() - startDate.getDay());

    const days = [];
    const todayStr = new Date().toDateString();

    // 35 cells = 5 weeks (covers all possible month layouts)
    for (let i = 0; i < 35; i++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);

      const dYear = d.getFullYear();
      const dMonth = d.getMonth();
      const dDate = d.getDate();

      // Format YYYY-MM-DD to match the release_date from the database
      const dateStr = `${dYear}-${String(dMonth + 1).padStart(2, '0')}-${String(dDate).padStart(2, '0')}`;
      
      const isToday = todayStr === d.toDateString();
      const isOtherMonth = dMonth !== month;

      // Find if there are any releases on this day
      const dayReleases = allReleases.filter(r => r.release_date === dateStr);

      days.push({
        dateNumber: dDate,
        isOtherMonth,
        isToday,
        releases: dayReleases
      });
    }

    return days;
  }, [currentDate, allReleases]);

  // Extract only the releases visible in the current month view for the legend
  const visibleReleases = useMemo(() => {
    const inView = new Set();
    const releases = [];
    calendarDays.forEach(day => {
      day.releases.forEach(r => {
        const key = `${r.project}-${r.name}`;
        if (!inView.has(key)) {
          inView.add(key);
          releases.push(r);
        }
      });
    });
    // Sort them by date so they appear sequentially in the legend
    return releases.sort((a, b) => new Date(a.release_date) - new Date(b.release_date));
  }, [calendarDays]);

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const dayNames = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

  return (
    <div className="dashboard-calendar-widget">
      <div className="calendar-header">
        <div className="calendar-month-year">
          {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
        </div>
        <div className="calendar-nav">
          <button type="button" onClick={goToToday} className="calendar-nav-btn" style={{ fontSize: '0.8rem', width: 'auto', padding: '0 8px' }} title="Go to Today">Today</button>
          <button type="button" onClick={prevMonth} className="calendar-nav-btn" title="Previous Month">▲</button>
          <button type="button" onClick={nextMonth} className="calendar-nav-btn" title="Next Month">▼</button>
        </div>
      </div>

      <div className="calendar-grid">
        {dayNames.map(day => (
          <div key={day} className="calendar-day-name">{day}</div>
        ))}
        
        {calendarDays.map((day, index) => {
          let cellClass = "calendar-cell";
          if (day.isOtherMonth) cellClass += " other-month";
          if (day.isToday) cellClass += " today";

          const hasRelease = day.releases.length > 0;
          const tooltipText = hasRelease 
            ? `Releases:\n${day.releases.map(r => `• ${r.name} (${r.project})`).join('\n')}` 
            : '';

          return (
            <div 
              key={index} 
              className={cellClass}
              title={tooltipText}
            >
              {day.dateNumber}
              {hasRelease && (
                <div className="release-indicators-container">
                  {day.releases.map((r, i) => (
                    <span 
                      key={i} 
                      className="release-indicator-dot" 
                      style={{ backgroundColor: projectColors[r.project] || '#dc3545' }}
                    ></span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Updated Legend mapping over visible releases */}
      {visibleReleases.length > 0 && (
        <div className="calendar-legend">
          {visibleReleases.map((release) => (
            <div key={`${release.project}-${release.name}`} className="calendar-legend-item">
              <span 
                className="calendar-legend-color" 
                style={{ backgroundColor: projectColors[release.project] || '#dc3545' }}
              ></span>
              {release.project} - {release.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DashboardCalendarWidget;
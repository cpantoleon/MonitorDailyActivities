import React, { useState, useEffect } from 'react';
import './TeamsMeetingsWidget.css'; // ΣΗΜΑΝΤΙΚΟ: Βεβαιώσου ότι υπάρχει αυτή η γραμμή!

const TeamsMeetingsWidget = () => {
    const [meetings, setMeetings] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchMeetings = async () => {
            try {
                const res = await fetch('/api/meetings/today');
                const data = await res.json();
                if (data.data) {
                    setMeetings(data.data);
                }
            } catch (err) {
                console.error("Failed to fetch meetings", err);
            } finally {
                setLoading(false);
            }
        };

        fetchMeetings();
        // Ανανέωση στο UI κάθε 5 λεπτά
        const interval = setInterval(fetchMeetings, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, []);

    const formatTime = (isoString) => {
        const date = new Date(isoString);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    // Ελέγχει αν το meeting είναι στο παρελθόν, τώρα, ή στο μέλλον
    const getMeetingStatus = (start, end) => {
        const now = new Date();
        const startTime = new Date(start);
        const endTime = new Date(end);
        
        if (now > endTime) return 'past';
        if (now >= startTime && now <= endTime) return 'current';
        return 'future';
    };

    return (
        <div className="meetings-widget-container">
            {loading ? (
                <p className="loading-text" style={{ color: 'var(--text-secondary)' }}>Loading schedule...</p>
            ) : meetings.length === 0 ? (
                <p className="loading-text" style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '20px' }}>
                    No meetings left for today! 🎉
                </p>
            ) : (
                <ul className="meetings-list">
                    {meetings.map((meeting, index) => {
                        const status = getMeetingStatus(meeting.start, meeting.end);
                        return (
                            <li key={index} className={`meeting-item status-${status}`}>
                                <div className="meeting-time-block">
                                    <span className="time-start">{formatTime(meeting.start)}</span>
                                    <span className="time-separator">to</span>
                                    <span className="time-end">{formatTime(meeting.end)}</span>
                                </div>
                                <div className="meeting-divider"></div>
                                <div className="meeting-details-block">
                                    <span className="meeting-title" title={meeting.title}>
                                        {meeting.title}
                                    </span>
                                    {status === 'current' && <span className="meeting-now-badge">● Happening Now</span>}
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
};

export default TeamsMeetingsWidget;
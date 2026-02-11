import React, { useState, useEffect } from 'react';
import './WeatherWidget.css';

// FIX: Use import.meta.env for Vite and add VITE_ prefix
const API_KEY_VALUE = import.meta.env.OPENWEATHER_API_KEY;
const API_OPTIONS = "units=metric&";

const getBackgroundImage = (mainWeather) => {
    switch (mainWeather) {
        case "Snow":
            return "url('https://mdbcdn.b-cdn.net/img/Photos/new-templates/bootstrap-weather/draw1.webp')";
        case "Rain":
        case "Drizzle":
            return "url('https://images.pexels.com/photos/39811/pexels-photo-39811.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1')";
        case "Clouds":
            return "url('https://images.pexels.com/photos/53594/blue-clouds-day-fluffy-53594.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1')";
        case "Thunderstorm":
            return "url('https://images.pexels.com/photos/1118873/pexels-photo-1118873.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1')";
        case "Clear":
            return "url('https://images.pexels.com/photos/912110/pexels-photo-912110.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1')";
        case "Mist":
        case "Fog":
        case "Haze":
        case "Smoke":
            return "url('https://images.pexels.com/photos/167699/pexels-photo-167699.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1')";
        default:
            return "url('https://images.pexels.com/photos/53594/blue-clouds-day-fluffy-53594.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1')";
    }
};

const WeatherWidget = ({ showMessage }) => {
    const [weather, setWeather] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [location, setLocation] = useState('');
    const [searchInput, setSearchInput] = useState('');
    const [bgImage, setBgImage] = useState(getBackgroundImage('default'));

    useEffect(() => {
        const fetchSavedLocation = async () => {
            try {
                const res = await fetch('/api/settings/weather-location');
                const data = await res.json();
                if (data.location) {
                    setLocation(data.location);
                }
            } catch (err) {
                setError('Could not load saved location.');
            }
        };
        fetchSavedLocation();
    }, []);

    useEffect(() => {
        if (!location) return;

        // Check if API key is present
        if (!API_KEY_VALUE) {
            setError("API Key is missing in .env file");
            setLoading(false);
            return;
        }

        const fetchWeather = async () => {
            setLoading(true);
            setError(null);
            setWeather(null);
            try {
                // Construct URL with the variable
                const url = `https://api.openweathermap.org/data/2.5/weather?q=${location}&${API_OPTIONS}appid=${API_KEY_VALUE}`;
                
                const response = await fetch(url);
                const data = await response.json();
                if (!response.ok) {
                    throw new Error(data.message || 'Location not found');
                }
                setWeather(data);
                setBgImage(getBackgroundImage(data.weather[0].main));
            } catch (err) {
                setError(err.message);
                setBgImage(getBackgroundImage('default'));
            } finally {
                setLoading(false);
            }
        };

        fetchWeather();
    }, [location]);

    const handleSearch = async () => {
        if (!searchInput.trim()) return;

        try {
            const res = await fetch('/api/settings/weather-location', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ location: searchInput }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            
            setLocation(data.location);
            setSearchInput('');
            if (showMessage) showMessage('Location saved!', 'success');
        } catch (err) {
            if (showMessage) showMessage(`Error saving location: ${err.message}`, 'error');
        }
    };

    const renderCardContent = () => {
        if (loading && !weather) {
            return <p id="loading-text-id" className="loading-text">Loading...</p>;
        }
        if (error) {
            return <p id="error-text-id" className="error-text">Error: {error}</p>;
        }
        if (!weather) {
            return <p id="enter-location-text-id" className="loading-text">Enter a location.</p>;
        }
        return (
            <div id="weather-card-content-wrapper-id">
                <h4 id="location-name-id" className="location-name">{weather.name}, {weather.sys.country}</h4>
                <p id="temperature-id" className="temperature">{weather.main.temp.toFixed(1)}°C</p>
                <p id="feels-like-id" className="feels-like">
                    Feels Like: <strong>{weather.main.feels_like.toFixed(1)}°C</strong>
                </p>
                <h5 id="description-id" className="description">{weather.weather[0].description}</h5>
            </div>
        );
    };

    return (
        <div id="weather-widget-container-id" className="weather-widget-container">
            <div id="weather-card-static-bg-id" className="weather-card-static-bg" style={{ backgroundImage: bgImage }}>
                <div id="card-img-overlay-content-id" className="card-img-overlay-content">
                    {renderCardContent()}
                </div>
            </div>
            <div id="weather-search-id" className="weather-search">
                <input
                    id="weather-city-search"
                    name="weatherCitySearch"
                    type="text"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                    placeholder="Enter city..."
                />
                <button id="weather-set-button-id" type="button" onClick={handleSearch}>Set</button>
            </div>
        </div>
    );
};

export default WeatherWidget;
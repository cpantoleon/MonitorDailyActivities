import React, { useState, useRef, useEffect } from 'react';
import './Chatbot.css';

const TtsEnabledIcon = () => (
    <svg id="tts-enabled-icon-svg-id" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
        <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
        <line x1="12" y1="19" x2="12" y2="23"></line>
        <line x1="8" y1="23" x2="16" y2="23"></line>
    </svg>
);

const TtsDisabledIcon = () => (
    <svg id="tts-disabled-icon-svg-id" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="1" y1="1" x2="23" y2="23"></line>
        <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"></path>
        <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v-2"></path>
        <line x1="12" y1="19" x2="12" y2="23"></line>
        <line x1="8" y1="23" x2="16" y2="23"></line>
    </svg>
);

const Chatbot = ({ selectedProject, onDataChange, firstProjectName, className }) => {
    const getInitialState = () => {
        try {
            const storedMessages = sessionStorage.getItem('chatbotMessages');
            const storedIsOpen = sessionStorage.getItem('chatbotIsOpen');
            const messages = storedMessages 
                ? JSON.parse(storedMessages) 
                : [{ from: 'bot', text: 'Hello! How can I help you with your project today?' }];
            const isOpen = storedIsOpen ? JSON.parse(storedIsOpen) : false;
            return { messages, isOpen };
        } catch (error) {
            console.error("Failed to parse chatbot state from sessionStorage", error);
            return {
                messages: [{ from: 'bot', text: 'Hello! How can I help you with your project today?' }],
                isOpen: false
            };
        }
    };

    const [isOpen, setIsOpen] = useState(getInitialState().isOpen);
    const [messages, setMessages] = useState(getInitialState().messages);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [isTtsEnabled, setIsTtsEnabled] = useState(false);
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);
    const utteranceRef = useRef(null);

    useEffect(() => {
        sessionStorage.setItem('chatbotIsOpen', JSON.stringify(isOpen));
    }, [isOpen]);

    useEffect(() => {
        sessionStorage.setItem('chatbotMessages', JSON.stringify(messages));
    }, [messages]);

    const scrollToBottom = () => {
        setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 50);
    };

    useEffect(scrollToBottom, [messages]);

    useEffect(() => {
        if (isOpen) {
            scrollToBottom();
            inputRef.current?.focus();
        }
    }, [isOpen]);

    useEffect(() => {
        if (!isTtsEnabled) {
            window.speechSynthesis.cancel();
            setIsSpeaking(false);
        }
    }, [isTtsEnabled]);

    const handleSpeak = (text) => {
        if (isSpeaking && utteranceRef.current?.text === text) {
            window.speechSynthesis.cancel();
            setIsSpeaking(false);
            utteranceRef.current = null;
            return;
        }

        if (window.speechSynthesis.speaking) {
            window.speechSynthesis.cancel();
        }

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.onend = () => {
            setIsSpeaking(false);
            utteranceRef.current = null;
        };
        utterance.onerror = (event) => {
            console.error("Speech synthesis error", event);
            setIsSpeaking(false);
            utteranceRef.current = null;
        };
        
        utteranceRef.current = utterance;
        window.speechSynthesis.speak(utterance);
        setIsSpeaking(true);
    };

    const submitMessage = async (messageText) => {
        if (!messageText.trim() || isLoading) return;

        const userMessage = { from: 'user', text: messageText };
        setMessages(prev => [...prev, userMessage]);
        setInputValue('');
        setIsLoading(true);

        try {
            const response = await fetch('/api/chatbot', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: messageText, projectContext: selectedProject }),
            });

            if (!response.ok) {
                throw new Error('Network response was not ok');
            }

            const data = await response.json();
            const botMessage = { from: 'bot', text: data.reply || "I'm sorry, I had trouble responding." };
            setMessages(prev => [...prev, botMessage]);

            if (data.data_changed && onDataChange) {
                onDataChange(data.new_item); 
            }

        } catch (error) {
            console.error("Chatbot fetch error:", error);
            const errorMessage = { from: 'bot', text: 'Sorry, something went wrong. Please try again.' };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
            setTimeout(() => inputRef.current?.focus(), 0);
        }
    };

    const handleSendMessage = (e) => {
        e.preventDefault();
        submitMessage(inputValue);
    };

    const handleSuggestionClick = (suggestionText) => {
        submitMessage(suggestionText);
    };

    const handleClearChat = () => {
        setMessages([
            { from: 'bot', text: 'Hello! How can I help you with your project today?' }
        ]);
        window.speechSynthesis.cancel();
        setIsSpeaking(false);
        inputRef.current?.focus();
    };

    return (
        <div id="chatbot-container-id" className={`chatbot-container ${className || ''}`}>
            <div id="chatbot-window-id" className={`chatbot-window ${isOpen ? 'open' : ''}`}>
                    <div id="chatbot-header-id" className="chatbot-header">
                        <h3 id="project-assistant-h3-id">Project Assistant</h3>
                        <div id="chatbot-header-controls-id" className="chatbot-header-controls">
                            <button 
                                id="chatbot-tts-toggle-id"
                                onClick={() => setIsTtsEnabled(!isTtsEnabled)} 
                                className="chatbot-tts-toggle"
                                title={isTtsEnabled ? "Disable Text-to-Speech" : "Enable Text-to-Speech"}
                            >
                                {isTtsEnabled ? <TtsEnabledIcon /> : <TtsDisabledIcon />}
                            </button>
                            <button id="chatbot-clear-btn-id" onClick={handleClearChat} className="chatbot-clear-btn" title="Clear chat">
                               Clear
                            </button>
                            <button id="chatbot-close-btn-id" onClick={() => setIsOpen(false)} className="chatbot-close-btn">×</button>
                        </div>
                    </div>
                    <div id="chatbot-messages-id" className="chatbot-messages">
                        {messages.map((msg, index) => (
                            <div id={`message-${index}-id`} key={index} className={`message ${msg.from} ${msg.from === 'bot' && !isTtsEnabled ? 'bot-tts-disabled' : ''}`}>
                                <p id={`message-text-${index}-id`} dangerouslySetInnerHTML={{ __html: msg.text.replace(/\n/g, '<br />') }} />
                                {isTtsEnabled && msg.from === 'bot' && msg.text !== 'Hello! How can I help you with your project today?' && (
                                    <button 
                                        id={`speak-btn-${index}-id`}
                                        onClick={() => handleSpeak(msg.text.replace(/<[^>]+>/g, ''))} 
                                        className="speak-btn"
                                        aria-label="Speak message"
                                    >
                                        {isSpeaking && utteranceRef.current?.text === msg.text.replace(/<[^>]+>/g, '') 
                                            ? <img id={`stop-icon-${index}-id`} src="/stop-icon.svg" alt="Stop" className="speak-icon" />
                                            : <img id={`play-icon-${index}-id`} src="/play-icon.svg" alt="Play" className="speak-icon" />
                                        }
                                    </button>
                                )}
                            </div>
                        ))}
                        {isLoading && (
                            <div id="loading-message-bot-id" className="message bot">
                                <p id="typing-indicator-id" className="typing-indicator"><span id="typing-dot-1-id">.</span><span id="typing-dot-2-id">.</span><span id="typing-dot-3-id">.</span></p>
                            </div>
                        )}
                        
                        {messages.length === 1 && !isLoading && (
                            <div id="chatbot-suggestions-id" className="chatbot-suggestions">
                                <button id="suggestion-chip-joke-id" className="suggestion-chip" onClick={() => handleSuggestionClick('Tell me a joke')}>
                                    Tell me a joke
                                </button>
                                {firstProjectName && (
                                    <button id="suggestion-chip-defects-id" className="suggestion-chip" onClick={() => handleSuggestionClick(`Tell me the defects for ${firstProjectName}`)}>
                                        Defects for {firstProjectName}
                                    </button>
                                )}
                                <button id="suggestion-chip-weather-id" className="suggestion-chip" onClick={() => handleSuggestionClick('Tell me the weather')}>
                                    Tell me the weather
                                </button>
                                <button id="suggestion-chip-eortologio-id" className="suggestion-chip" onClick={() => handleSuggestionClick('eortologio today')}>
                                    Eortologio Today
                                </button>
                            </div>
                        )}
                        <div id="messages-end-ref-id" ref={messagesEndRef} />
                    </div>
                    <form id="chatbot-input-form-id" className="chatbot-input-form" onSubmit={handleSendMessage}>
                        <input
                            ref={inputRef}
                            id="chatbot-input"
                            name="chatbotInput"
                            type="text"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            placeholder="Ask a question or give a command..."
                            disabled={isLoading}
                            autoComplete="off"
                            aria-label="Chatbot input field"
                        />
                        <button
                            type="submit"
                            id="chatbot-send-button"
                            name="chatbotSendButton"
                            disabled={isLoading || !inputValue.trim()}
                        >
                            Send
                        </button>
                    </form>
                </div>
            <button
                id="chatbot-toggle-button"
                name="chatbotToggleButton"
                type="button"
                className={`chatbot-toggle-button ${isOpen ? 'open' : ''}`}
                onClick={() => setIsOpen(!isOpen)}
                aria-label="Toggle chatbot window"
            >
                🤖
            </button>
        </div>
    );
};

export default Chatbot;
import React, { useState, useRef, useEffect } from 'react';
import './Chatbot.css';

const Chatbot = ({ selectedProject, onDataChange }) => {
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
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);

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

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!inputValue.trim() || isLoading) return;

        const userMessage = { from: 'user', text: inputValue };
        setMessages(prev => [...prev, userMessage]);
        setInputValue('');
        setIsLoading(true);

        try {
            const response = await fetch('/api/chatbot', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: inputValue, projectContext: selectedProject }),
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
            // --- MODIFIED LINE ---
            // Use a timeout to ensure focus happens after the re-render from setIsLoading.
            setTimeout(() => inputRef.current?.focus(), 0);
            // --- END MODIFIED LINE ---
        }
    };

    const handleClearChat = () => {
        setMessages([
            { from: 'bot', text: 'Hello! How can I help you with your project today?' }
        ]);
        inputRef.current?.focus();
    };

    return (
        <div className="chatbot-container">
            {isOpen && (
                <div className="chatbot-window">
                    <div className="chatbot-header">
                        <h3>Project Assistant</h3>
                        <button onClick={handleClearChat} className="chatbot-clear-btn" title="Clear chat">
                           Clear
                        </button>
                        <button onClick={() => setIsOpen(false)} className="chatbot-close-btn">×</button>
                    </div>
                    <div className="chatbot-messages">
                        {messages.map((msg, index) => (
                            <div key={index} className={`message ${msg.from}`}>
                                <p dangerouslySetInnerHTML={{ __html: msg.text.replace(/\n/g, '<br />') }} />
                            </div>
                        ))}
                        {isLoading && (
                            <div className="message bot">
                                <p className="typing-indicator"><span>.</span><span>.</span><span>.</span></p>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>
                    <form className="chatbot-input-form" onSubmit={handleSendMessage}>
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
            )}
            <button
                id="chatbot-toggle-button"
                name="chatbotToggleButton"
                type="button"
                className="chatbot-toggle-button"
                onClick={() => setIsOpen(!isOpen)}
                aria-label="Toggle chatbot window"
            >
                🤖
            </button>
        </div>
    );
};

export default Chatbot;
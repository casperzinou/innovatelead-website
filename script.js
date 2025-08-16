// script.js - Corrected Final Production Code
(() => {
    // --- CONFIGURATION ---
    const API_BASE_URL = 'https://your-api.onrender.com'; // IMPORTANT: Update this to your deployed Render URL

    // --- SCRIPT INITIALIZATION ---
    const scriptTag = document.currentScript;
    const clientId = scriptTag.dataset.clientId;

    if (!clientId) {
        console.error("Chatbot Error: 'data-client-id' is missing from the script tag.");
        return;
    }
    
    // --- STATE MANAGEMENT ---
    let botState = 'IDLE'; // States: IDLE, AWAITING_TICKET_CONFIRMATION, AWAITING_EMAIL
    let lastUserMessage = ''; // Store the last user question for ticketing

    // --- INJECT STYLES ---
    const styles = `
        :root {
            --chatbot-primary: #007bff;
            --chatbot-light: #f8f9fa;
            --chatbot-dark: #343a40;
            --chatbot-white: #ffffff;
            --chatbot-radius: 8px;
            --chatbot-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }
        #chatbot-bubble {
            position: fixed;
            bottom: 20px;
            right: 20px;
            width: 60px;
            height: 60px;
            background-color: var(--chatbot-primary);
            color: var(--chatbot-white);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 28px;
            cursor: pointer;
            box-shadow: var(--chatbot-shadow);
            transition: transform 0.2s ease-in-out;
            z-index: 9998;
        }
        #chatbot-bubble:hover {
            transform: scale(1.1);
        }
        #chatbot-widget {
            position: fixed;
            bottom: 90px;
            right: 20px;
            width: 350px;
            max-width: 90vw;
            height: 500px;
            max-height: 80vh;
            background-color: var(--chatbot-white);
            border-radius: var(--chatbot-radius);
            box-shadow: var(--chatbot-shadow);
            display: flex;
            flex-direction: column;
            overflow: hidden;
            transform: scale(0.5);
            opacity: 0;
            pointer-events: none;
            transform-origin: bottom right;
            transition: transform 0.2s ease-out, opacity 0.2s ease-out;
            z-index: 9999;
        }
        #chatbot-widget.open {
            transform: scale(1);
            opacity: 1;
            pointer-events: auto;
        }
        .chatbot-header {
            background-color: var(--chatbot-primary);
            color: var(--chatbot-white);
            padding: 15px;
            font-weight: bold;
            text-align: center;
        }
        .chatbot-messages {
            flex-grow: 1;
            padding: 15px;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
        }
        .chatbot-message {
            max-width: 80%;
            padding: 10px 15px;
            border-radius: 15px;
            margin-bottom: 10px;
            line-height: 1.4;
            white-space: pre-wrap;
        }
        .chatbot-message.user {
            background-color: #e9ecef;
            color: var(--chatbot-dark);
            align-self: flex-end;
            border-bottom-right-radius: 3px;
        }
        .chatbot-message.bot {
            background-color: var(--chatbot-primary);
            color: var(--chatbot-white);
            align-self: flex-start;
            border-bottom-left-radius: 3px;
        }
         .chatbot-message.bot.loading {
            display: flex;
            align-items: center;
        }
        .chatbot-message.bot.loading span {
            height: 8px;
            width: 8px;
            border-radius: 50%;
            background-color: #fff;
            animation: bounce 1.4s infinite ease-in-out both;
            margin: 0 2px;
        }
        .chatbot-message.bot.loading span:nth-child(1) { animation-delay: -0.32s; }
        .chatbot-message.bot.loading span:nth-child(2) { animation-delay: -0.16s; }
        @keyframes bounce { 0%, 80%, 100% { transform: scale(0); } 40% { transform: scale(1.0); } }

        .chatbot-input-area {
            border-top: 1px solid #dee2e6;
            padding: 10px;
            display: flex;
        }
        #chatbot-input {
            flex-grow: 1;
            border: 1px solid #ced4da;
            border-radius: var(--chatbot-radius);
            padding: 10px;
            font-size: 16px;
        }
        #chatbot-send-btn {
            background-color: var(--chatbot-primary);
            color: var(--chatbot-white);
            border: none;
            border-radius: var(--chatbot-radius);
            padding: 0 15px;
            margin-left: 10px;
            cursor: pointer;
            font-size: 18px;
        }
    `;
    const styleSheet = document.createElement("style");
    styleSheet.innerText = styles;
    document.head.appendChild(styleSheet);

    // --- INJECT HTML ---
    const chatBubble = document.createElement("div");
    chatBubble.id = "chatbot-bubble";
    chatBubble.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="currentColor" class="bi bi-chat-dots-fill" viewBox="0 0 16 16">
            <path d="M16 8c0 3.866-3.582 7-8 7a9.06 9.06 0 0 1-2.347-.306c-.584.296-1.925.864-4.181 1.234-.2.032-.352-.176-.273-.362.354-.836.674-1.95.77-2.966C.744 11.37 0 9.76 0 8c0-3.866 3.582-7 8-7s8 3.134 8 7zM5 8a1 1 0 1 0-2 0 1 1 0 0 0 2 0zm4 0a1 1 0 1 0-2 0 1 1 0 0 0 2 0zm3 1a1 1 0 1 0 0-2 1 1 0 0 0 0 2z"/>
        </svg>
    `;

    const chatWidget = document.createElement("div");
    chatWidget.id = "chatbot-widget";
    chatWidget.innerHTML = `
        <div class="chatbot-header">AI Assistant</div>
        <div class="chatbot-messages"></div>
        <div class="chatbot-input-area">
            <input type="text" id="chatbot-input" placeholder="Ask a question...">
            <button id="chatbot-send-btn">➤</button>
        </div>
    `;
    document.body.appendChild(chatBubble);
    document.body.appendChild(chatWidget);

    // --- GET DOM ELEMENTS ---
    const messagesContainer = chatWidget.querySelector('.chatbot-messages');
    const inputField = chatWidget.querySelector('#chatbot-input');
    const sendButton = chatWidget.querySelector('#chatbot-send-btn');
    
    // --- FUNCTIONS & EVENT LISTENERS ---
    const toggleWidget = () => chatWidget.classList.toggle('open');
    chatBubble.addEventListener('click', toggleWidget);

    const addMessage = (text, sender, options = {}) => {
        const messageElement = document.createElement('div');
        messageElement.classList.add('chatbot-message', sender);

        if (options.loading) {
            messageElement.classList.add('loading');
            messageElement.innerHTML = `<span></span><span></span><span></span>`;
        } else {
            messageElement.textContent = text;
        }
        
        messagesContainer.appendChild(messageElement);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        return messageElement;
    };
    
    const handleSend = async () => {
        const message = inputField.value.trim();
        if (!message) return;

        addMessage(message, 'user');
        inputField.value = '';
        
        // State-based conversation logic
        if (botState === 'AWAITING_TICKET_CONFIRMATION') {
            handleTicketConfirmation(message);
        } else if (botState === 'AWAITING_EMAIL') {
            handleEmailCollection(message);
        } else {
            // Default state: Answer a question
            lastUserMessage = message; // Store for potential handoff
            await getBotAnswer(message);
        }
    };
    
    const getBotAnswer = async (question) => {
        const loadingIndicator = addMessage('', 'bot', { loading: true });
        try {
            const response = await fetch(`${API_BASE_URL}/ask`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question: question, clientId: clientId }) // CORRECTED KEY: 'question'
            });

            messagesContainer.removeChild(loadingIndicator);
            const data = await response.json();

            if (!response.ok) throw new Error(data.error || 'API Error');
            
            addMessage(data.answer, 'bot');
            
            // CORRECTED CHECK: For 'human_handoff' status
            if (data.status === 'human_handoff') {
                addMessage("Would you like me to create a support ticket for you so a human agent can get back to you? (yes/no)", 'bot');
                botState = 'AWAITING_TICKET_CONFIRMATION';
            }

        } catch (error) {
            console.error('Chatbot fetch error:', error);
            messagesContainer.removeChild(loadingIndicator);
            addMessage("Sorry, I'm having trouble connecting. Please try again later.", 'bot');
        }
    };
    
    const handleTicketConfirmation = (message) => {
        const positiveResponse = /^(yes|yeah|yup|sure|ok|yep)\b/i.test(message);
        const negativeResponse = /^(no|nope|nah)\b/i.test(message);

        if (positiveResponse) {
            addMessage("Great. What's the best email address to reach you at?", 'bot');
            botState = 'AWAITING_EMAIL';
        } else if (negativeResponse) {
            addMessage("No problem. Is there anything else I can help you with?", 'bot');
            botState = 'IDLE';
        } else {
            addMessage("Sorry, I didn't quite understand. Please answer with 'yes' or 'no'.", 'bot');
        }
    };
    
    const handleEmailCollection = (email) => {
        // Simple email validation
        if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            createTicket(lastUserMessage, email);
        } else {
            addMessage("That doesn't look like a valid email. Please provide a correct email address.", 'bot');
        }
    };

    const createTicket = async (originalQuestion, userEmail) => {
        addMessage("Creating a support ticket for you now...", 'bot');
        botState = 'IDLE'; // Reset state
        try {
            const response = await fetch(`${API_BASE_URL}/create_ticket`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                // CORRECTED PAYLOAD: Includes email
                body: JSON.stringify({ 
                    question: originalQuestion, 
                    email: userEmail,
                    clientId: clientId 
                })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || "Server error");

            addMessage("We've created a ticket and our team will get back to you at your provided email. Is there anything else I can help with?", 'bot');

        } catch (error) {
            console.error('Ticket creation error:', error);
            addMessage("I'm sorry, I couldn't create a ticket at this time. Please try again later.", 'bot');
        }
    };

    sendButton.addEventListener('click', handleSend);
    inputField.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSend();
    });

    // Initial greeting
    addMessage("Hello! How can I help you today?", 'bot');
})();
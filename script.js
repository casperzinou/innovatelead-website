// script.js - Final Production Version (Self-Contained)

(() => {
    // This is an IIFE (Immediately Invoked Function Expression)
    // It prevents our code from conflicting with the client's website's code.

    // --- 1. CONFIGURATION ---
    const SCRIPT_TAG = document.querySelector('script[data-client-id]');
    const CLIENT_ID = SCRIPT_TAG ? SCRIPT_TAG.dataset.clientId : null;
    
    // IMPORTANT: Change this to your live Render URL before the final deployment
    const API_DOMAIN = 'http://127.0.0.1:5000'; 
    
    const ASK_API_URL = `${API_DOMAIN}/ask`;
    const TICKET_API_URL = `${API_DOMAIN}/create_ticket`;
    const INITIAL_BOT_MESSAGE = "Hello! I'm a smart assistant. How can I help you today?";

    if (!CLIENT_ID) {
        console.error("Chatbot Error: Client ID is missing. Add 'data-client-id' to your script tag.");
        return; // Stop the script if the client ID is not found
    }

    // --- 2. DYNAMICALLY CREATE THE CHATBOT'S HTML AND CSS ---
    
    // The full HTML structure of the chat widget
    const chatWidgetHTML = `
        <div class="chat-widget">
            <div class="chat-window" id="chat-window">
                <div class="chat-header">
                    <h2>Chat with us!</h2>
                    <button class="close-btn" id="close-chat-btn" aria-label="Close chat">&times;</button>
                </div>
                <div class="chat-body" id="chat-body"></div>
                <div class="chat-footer">
                    <form id="chat-form" style="display: flex; flex: 1;">
                        <input type="text" id="chat-input" placeholder="Type a message..." autocomplete="off" required>
                        <button type="submit" id="send-message-btn">Send</button>
                    </form>
                </div>
            </div>
            <button class="chat-icon-btn" id="chat-icon-btn" aria-label="Open chat">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="32px" height="32px">
                    <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/>
                </svg>
            </button>
        </div>
    `;

    // The full CSS needed to style the chat widget
    const chatWidgetCSS = `
        .chat-widget { position: fixed; bottom: 20px; right: 20px; z-index: 1000; font-family: sans-serif; }
        .chat-window { width: 350px; max-height: 500px; border-radius: 10px; box-shadow: 0 4px 15px rgba(0,0,0,0.2); overflow: hidden; display: flex; flex-direction: column; background-color: #ffffff; margin-bottom: 15px; transform: translateY(20px) scale(0.95); opacity: 0; visibility: hidden; transition: all 0.3s ease-in-out; }
        .chat-window.open { transform: translateY(0) scale(1); opacity: 1; visibility: visible; }
        .chat-header { background-color: #0A2540; color: white; padding: 15px; display: flex; justify-content: space-between; align-items: center; }
        .chat-header h2 { margin: 0; font-size: 1.2em; }
        .close-btn { background: none; border: none; color: white; font-size: 24px; cursor: pointer; }
        .chat-body { flex: 1; padding: 15px; overflow-y: auto; background-color: #f9f9f9; display: flex; flex-direction: column; min-height: 300px; }
        .message { max-width: 85%; margin-bottom: 10px; line-height: 1.4; }
        .message p { padding: 10px 15px; border-radius: 18px; margin: 0; }
        .message.received { align-self: flex-start; }
        .message.received p { background-color: #e9e9eb; color: #333; }
        .message.sent { align-self: flex-end; }
        .message.sent p { background-color: #007bff; color: white; }
        .chat-footer { display: flex; padding: 10px; border-top: 1px solid #ddd; }
        #chat-input { flex: 1; border: 1px solid #ccc; border-radius: 20px; padding: 10px 15px; font-size: 1em; margin-right: 10px; }
        #send-message-btn { background-color: #007bff; color: white; border: none; border-radius: 20px; padding: 0 15px; cursor: pointer; transition: background-color 0.2s; font-weight: bold; }
        .chat-icon-btn { width: 60px; height: 60px; border-radius: 50%; background-color: #0A2540; color: white; border: none; cursor: pointer; display: flex; justify-content: center; align-items: center; box-shadow: 0 4px 8px rgba(0,0,0,0.2); transition: transform 0.2s; }
        .chat-icon-btn:hover { transform: scale(1.1); }
    `;

    // Inject the CSS into the page's <head>
    const styleElement = document.createElement('style');
    styleElement.textContent = chatWidgetCSS;
    document.head.appendChild(styleElement);

    // Inject the HTML into the page's <body>
    document.body.insertAdjacentHTML('beforeend', chatWidgetHTML);

    // --- 3. CORE CHATBOT LOGIC (This is the code you already perfected) ---
    // Now that the HTML exists on the page, we can find the elements and add our logic.
    let botState = 'READY_TO_CHAT';
    let pendingQuestion = '';
    const chatWindow = document.getElementById('chat-window');
    const chatIconBtn = document.getElementById('chat-icon-btn');
    const closeChatBtn = document.getElementById('close-chat-btn');
    const chatBody = document.getElementById('chat-body');
    const chatInput = document.getElementById('chat-input');
    const chatForm = document.getElementById('chat-form');

    // Add event listeners
    chatIconBtn.addEventListener('click', () => chatWindow.classList.toggle('open'));
    closeChatBtn.addEventListener('click', () => chatWindow.classList.remove('open'));
    chatForm.addEventListener('submit', handleFormSubmission);

    // All the functions that control the conversation
    function handleFormSubmission(event) {
        event.preventDefault();
        const userInput = chatInput.value.trim();
        if (userInput === '') return;
        displayMessage(userInput, 'sent');
        chatInput.value = '';
        if (botState === 'READY_TO_CHAT') {
            handleQuestion(userInput);
        } else {
            handleEmailSubmission(userInput);
        }
    }

    async function handleQuestion(question) {
        try {
            const response = await fetch(ASK_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question: question, clientId: CLIENT_ID })
            });
            const data = await response.json();
            displayMessage(data.answer, 'received');
            if (data.status === 'human_handoff') {
                botState = 'WAITING_FOR_EMAIL';
                pendingQuestion = question;
                chatInput.placeholder = 'Please enter your email...';
            }
        } catch (error) {
            console.error('Error:', error);
            displayMessage('Sorry, an error occurred.', 'received');
        }
    }

    async function handleEmailSubmission(userInput) {
        const cancelWords = ['no', 'cancel', 'stop', 'nevermind', 'no thanks', 'no thank you'];
        if (cancelWords.includes(userInput.toLowerCase())) {
            displayMessage("Okay, what else can I help you with?", 'received');
            botState = 'READY_TO_CHAT';
            pendingQuestion = '';
            chatInput.placeholder = 'Ask another question...';
            return;
        }
        if (!userInput.includes('@') || !userInput.includes('.')) {
            displayMessage("That doesn't look like a valid email. Please try again, or type 'no' to cancel.", 'received');
            return;
        }
        const email = userInput;
        displayMessage("Thank you. Creating a ticket for our team...", 'received');
        chatInput.disabled = true;
        try {
            const response = await fetch(TICKET_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    question: pendingQuestion,
                    clientId: CLIENT_ID,
                    email: email
                })
            });
            const data = await response.json();
            displayMessage(data.message, 'received');
        } catch (error) {
            displayMessage('Sorry, there was an issue creating the ticket.', 'received');
        } finally {
            botState = 'READY_TO_CHAT';
            pendingQuestion = '';
            chatInput.placeholder = 'Ask another question...';
            chatInput.disabled = false;
        }
    }

    function displayMessage(text, type) {
        const messageContainer = document.createElement('div');
        messageContainer.className = `message ${type}`;
        const p = document.createElement('p');
        p.textContent = text;
        messageContainer.appendChild(p);
        chatBody.appendChild(messageContainer);
        chatBody.scrollTop = chatBody.scrollHeight;
    }

    function initializeChat() {
        chatBody.innerHTML = '';
        displayMessage(INITIAL_BOT_MESSAGE, 'received');
    }
    
    // Start the bot
    initializeChat();

})(); // End of the IIFE
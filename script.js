document.addEventListener('DOMContentLoaded', () => {
    // --- 1. CONFIGURATION ---
    // This section makes it easy to update key variables without digging through the code.
    const API_URL = 'https://innovatelead-api.onrender.com/ask'; // <-- IMPORTANT: Change this to your live Render URL after deployment!
    const INITIAL_BOT_MESSAGE = "Hi there! I'm the AI assistant for InnovateLead. How can I help you today?";

    // --- 2. DOM ELEMENT SELECTION ---
    // Caching DOM elements improves performance by avoiding repeated lookups.
    const chatWindow = document.getElementById('chat-window');
    const chatIconBtn = document.getElementById('chat-icon-btn');
    const closeChatBtn = document.getElementById('close-chat-btn');
    const chatBody = document.getElementById('chat-body');
    const chatInput = document.getElementById('chat-input');
    const chatForm = document.getElementById('chat-form'); // The form wrapping the input and button

    // --- 3. EVENT LISTENERS ---
    
    // Toggle chat window when the icon is clicked
    chatIconBtn.addEventListener('click', () => chatWindow.classList.toggle('open'));

    // Close chat window when the close button is clicked
    closeChatBtn.addEventListener('click', () => chatWindow.classList.remove('open'));

    // BEST OF BOTH: Using the robust 'submit' event on the form.
    // This handles both button clicks and the 'Enter' key press efficiently and accessibly.
    chatForm.addEventListener('submit', handleSendMessage);

    // --- 4. CORE FUNCTIONS ---

    /**
     * Handles the entire process of sending a message when the form is submitted.
     * @param {Event} event - The form submission event object.
     */
    async function handleSendMessage(event) {
        // Prevent the default form submission which would cause a page reload.
        event.preventDefault(); 
        
        const userMessage = chatInput.value.trim();
        if (userMessage === '') return; // Don't send empty messages

        // Display the user's message immediately for a responsive feel.
        displayMessage(userMessage, 'sent');
        chatInput.value = ''; // Clear the input field

        // Await the response from the backend API.
        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question: userMessage }),
            });

            if (!response.ok) {
                throw new Error(`Network response was not ok. Status: ${response.status}`);
            }

            const data = await response.json();
            const botMessage = data.answer;
            displayMessage(botMessage, 'received');

        } catch (error) {
            console.error('Error fetching bot response:', error);
            displayMessage("Sorry, I'm having trouble connecting. Please try again later.", 'received');
        }
    }

    /**
     * Creates and appends a message element to the chat body.
     * @param {string} text - The text content of the message.
     * @param {string} type - The type of message ('sent' by user or 'received' from bot).
     */
    function displayMessage(text, type) {
        const messageContainer = document.createElement('div');
        messageContainer.className = `message ${type}`;

        const messageParagraph = document.createElement('p');
        messageParagraph.textContent = text;

        messageContainer.appendChild(messageParagraph);
        chatBody.appendChild(messageContainer);

        // Auto-scroll to the bottom to show the latest message.
        chatBody.scrollTop = chatBody.scrollHeight;
    }

    // --- 5. INITIALIZATION ---
    // Displays the initial greeting from the bot as soon as the page is ready.
    function initializeChat() {
        // Clear any hardcoded messages from the HTML to ensure a clean start.
        chatBody.innerHTML = ''; 
        displayMessage(INITIAL_BOT_MESSAGE, 'received');
    }
    
    initializeChat();
});
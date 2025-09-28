import os
import logging
import re
from dotenv import load_dotenv

# --- Flask and Database Imports ---
from flask import Flask, request, jsonify, render_template, redirect, url_for, flash # Added 'flash'
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user

# --- New Imports from worker.py ---
from sqlalchemy import BigInteger, Text
from pgvector.sqlalchemy import Vector
from bs4 import BeautifulSoup
import requests
from langchain.text_splitter import RecursiveCharacterTextSplitter
import google.generativeai as genai

# --- SETUP ---
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
load_dotenv()
app = Flask(__name__, template_folder='templates', static_folder='static') # Ensure static_folder is explicitly set if needed
CORS(app)

# --- Database Configuration ---
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

# --- Secret Key ---
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-secret-key-that-is-not-secure')

# --- AI Model Configuration (Moved from worker.py) ---
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
try:
    genai.configure(api_key=GEMINI_API_KEY)
    gemini_model = genai.GenerativeModel('gemini-1.5-flash')
    embedding_model = 'models/embedding-001'
    logging.info("Gemini models configured successfully.")
except Exception as e:
    gemini_model = None
    embedding_model = None
    logging.error(f"Failed to configure Gemini models: {e}")

logging.info("Worker application has initialized all core components and is ready to serve requests.")

# --- User Model and Auth Setup ---
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login_page' # Updated to match new route name for consistency

class User(db.Model, UserMixin):
    __tablename__ = 'users'
    id = db.Column(db.BigInteger, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(128), nullable=False)
    client_id = db.Column(db.Text, nullable=True)

# --- Document Model (Moved from worker.py) ---
class Document(db.Model):
    __tablename__ = 'documents'
    id = db.Column(db.BigInteger, primary_key=True)
    user_id = db.Column(db.BigInteger, db.ForeignKey('users.id'))
    client_id = db.Column(db.Text, nullable=False)
    content = db.Column(db.Text)
    embedding = db.Column(Vector(768))

@login_manager.user_loader
def load_user(user_id):
    return db.session.get(User, int(user_id))

# --- Helper Functions (Moved from worker.py) ---
def generate_collection_name(identifier: str):
    sanitized_name = re.sub(r'https?://', '', identifier)
    sanitized_name = re.sub(r'[^a-zA-Z0-9_.-]', '_', sanitized_name)
    sanitized_name = sanitized_name.strip('_.')[:60]
    return f"{sanitized_name}_docs"

def scrape_text_from_url(url: str):
    try:
        response = requests.get(url, headers={'User-Agent': 'Mozilla/5.0'}, timeout=20)
        response.raise_for_status()
        soup = BeautifulSoup(response.content, "html.parser")
        for tag in soup(["script", "style", "nav", "footer", "header"]):
            tag.decompose()
        return soup.get_text(separator='\n', strip=True)
    except requests.RequestException as e:
        logging.error(f"Error scraping {url}: {e}")
        return ""

# --- HEALTH CHECK ---
@app.route('/health')
def health_check():
    return "OK", 200

# --- NEW PUBLIC-FACING ROUTES (Crucial Addition) ---
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/pricing')
def pricing():
    return render_template('pricing.html')

@app.route('/privacy')
def privacy():
    return render_template('privacy.html')

@app.route('/terms')
def terms():
    return render_template('terms.html')

@app.route('/refund')
def refund():
    return render_template('refund.html')

# --- AUTHENTICATION ROUTES (MODIFIED for Flash Messages and internal redirects) ---
@app.route('/register', methods=['GET', 'POST']) # Added 'GET' method
def register_page():
    if request.method == 'POST':
        email = request.form.get('email')
        password = request.form.get('password')

        # Implement reCAPTCHA verification here if needed, before user creation
        # recaptcha_response = request.form.get('g-recaptcha-response')
        # if not verify_recaptcha(recaptcha_response): # You'll need to define verify_recaptcha
        #     flash("reCAPTCHA verification failed. Please try again.", "error")
        #     return redirect(url_for('register_page'))

        if User.query.filter_by(email=email).first():
            flash("This email is already registered. Please use a different email or log in.", "error")
            return redirect(url_for('register_page'))
        
        # Add server-side password confirmation (optional, but good practice)
        confirm_password = request.form.get('confirm_password') # Assuming your form has this field
        if password != confirm_password:
            flash("Passwords do not match.", "error")
            return redirect(url_for('register_page'))

        password_hash = generate_password_hash(password, method='pbkdf2:sha256')
        new_user = User(email=email, password_hash=password_hash)
        db.session.add(new_user)
        db.session.commit()
        login_user(new_user)
        flash("Registration successful! Welcome to MindWise.", "success")
        return redirect(url_for('dashboard'))
    return render_template('register.html') # For GET request

@app.route('/login', methods=['GET', 'POST']) # Added 'GET' method
def login_page():
    if request.method == 'POST':
        email = request.form.get('email')
        password = request.form.get('password')
        user = User.query.filter_by(email=email).first()
        if user and check_password_hash(user.password_hash, password):
            login_user(user)
            flash("Logged in successfully!", "success")
            return redirect(url_for('dashboard'))
        flash("Invalid email or password.", "error")
        return redirect(url_for('login_page'))
    return render_template('login.html') # For GET request

@app.route('/logout')
@login_required
def logout():
    logout_user()
    flash("You have been logged out.", "info")
    return redirect(url_for('login_page')) # Redirect to the new login page route name

# --- PROTECTED DASHBOARD ROUTES ---
@app.route('/dashboard')
@login_required
def dashboard():
    return render_template('dashboard.html')

# --- REFACTORED SCRIPT CREATION ROUTE (Now contains worker logic) ---
@app.route('/dashboard/create-script', methods=['POST'])
@login_required
def create_script():
    website_url = request.json.get('website_url')
    # Sales Team Handoff Email (backend saving logic)
    sales_email = request.json.get('sales_email') # Assuming this is sent with the request
    if sales_email:
        user = db.session.query(User).filter(User.id == current_user.id).first()
        if user:
            # You might need a new column in your User model for this, e.g., 'sales_handoff_email'
            # For now, let's just log it or handle it as needed.
            logging.info(f"User {current_user.id} updated sales handoff email to: {sales_email}")
            # user.sales_handoff_email = sales_email # Uncomment and add column if storing
            db.session.commit()
            return jsonify({"status": "success", "message": "Sales email updated."}), 200 # Return early if just updating email

    user_id = current_user.id
    
    if not website_url:
        return jsonify({'error': 'Website URL is required.'}), 400
    if not website_url.startswith('http'):
        website_url = 'https://' + website_url

    logging.info(f"Starting job for user_id: {user_id}, url: {website_url}")
    
    try:
        # 1. Generate a client_id
        client_id = generate_collection_name(website_url)

        # 2. Scrape the website
        content = scrape_text_from_url(website_url)
        if not content:
            raise ValueError("Scraping returned no content.")
        
        # 3. Chunk the content
        text_splitter = RecursiveCharacterTextSplitter(chunk_size=1500, chunk_overlap=200)
        chunks = text_splitter.split_text(content)
        logging.info(f"Split content into {len(chunks)} chunks.")

        # 4. Generate embeddings for each chunk
        if not embedding_model:
            raise ValueError("Embedding model is not configured.")
        embeddings = genai.embed_content(model=embedding_model, content=chunks, task_type="RETRIEVAL_DOCUMENT")
        
        # 5. Create Document objects to be saved
        documents_to_add = []
        for i, chunk_text in enumerate(chunks):
            doc = Document(
                user_id=user_id,
                client_id=client_id,
                content=chunk_text,
                embedding=embeddings['embedding'][i]
            )
            documents_to_add.append(doc)
        
        # 6. Save all documents to the database in one transaction
        db.session.add_all(documents_to_add)
        logging.info(f"Prepared {len(documents_to_add)} documents for database insertion.")

        # 7. Update the user's record with the new client_id
        user = db.session.query(User).filter(User.id == user_id).first()
        if user:
            user.client_id = client_id
            logging.info(f"Updating user {user_id} with client_id {client_id}.")
        else:
            logging.error(f"Could not find user with id {user_id} to update.")
        
        # 8. Commit all changes
        db.session.commit()
        logging.info("Job completed successfully. All data committed to database.")
        
        return jsonify({"status": "success", "client_id": client_id, "message": "Your chatbot is now being built. Please check back in a few minutes."}), 200

    except Exception as e:
        db.session.rollback() # Rollback changes on error
        logging.error(f"Job failed for user {user_id}: {e}", exc_info=True)
        return jsonify({"error": str(e), "message": "An error occurred while building your chatbot."}), 500

# --- Error Handler for 404 (Added) ---
@app.errorhandler(404)
def page_not_found(e):
    return render_template('404.html'), 404

# --- PUBLIC API ENDPOINTS (Unchanged - for now) ---
# NOTE: The public /ask endpoint will still rely on the ChromaDB filesystem,
# which is our *next* problem to solve after this architecture is proven.
# This code will be updated later to use the pgvector database for retrieval.

@app.route('/ask', methods=['POST'])
def ask_bot():
    # This logic will be refactored later
    from chromadb import PersistentClient
    from chromadb.utils import embedding_functions
    gemini_ef = embedding_functions.GoogleGenerativeAiEmbeddingFunction(api_key=os.environ["GEMINI_API_KEY"])
    db_client = PersistentClient(path="./db")
    # ... rest of the original /ask logic
    data = request.json
    question, client_id = data.get('question'), data.get('clientId')
    if not all([question, client_id]): return jsonify({'error': 'Missing data'}), 400
    try:
        collection = db_client.get_collection(name=client_id, embedding_function=gemini_ef)
        results = collection.query(query_texts=[question], n_results=5)
        context_chunks = results['documents'][0]
        # This will need to be refactored to not rely on global models
        # For now, this is a placeholder to keep it from crashing
        answer = "Answer generation is handled by the bot."
        if "knowledge_gap" in answer:
            return jsonify({"status": "human_handoff", "answer": "I couldn't find an answer. Would you like to create a support ticket?"})
        else:
            return jsonify({"status": "success", "answer": answer})
    except Exception as e:
        logging.error(f"Error in /ask for client {client_id}: {e}")
        return jsonify({"status": "human_handoff", "answer": "I'm having trouble accessing my knowledge. I can create a support ticket."})

# --- STARTUP ---
with app.app_context():
    db.create_all()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 5000)))
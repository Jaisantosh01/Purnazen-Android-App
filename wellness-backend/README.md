# Wellness Backend API

Enterprise-grade wellness SaaS backend built using Flask.

## Tech Stack
- **Framework:** Flask
- **ORM:** SQLAlchemy (with Flask-SQLAlchemy)
- **Migrations:** Alembic (with Flask-Migrate)
- **Authentication:** JWT (Flask-JWT-Extended)
- **Validation:** Marshmallow
- **Documentation:** Swagger (Flasgger)
- **Database:** PostgreSQL (via `psycopg2-binary`)

## Folder Structure
```text
wellness-backend/
├── app/
│   ├── config/          # Application configurations
│   ├── controllers/     # Request handlers (logic)
│   ├── extensions/      # Flask extension initializations (DB, JWT, etc.)
│   ├── middlewares/     # Custom middlewares (e.g., role_required)
│   ├── models/          # SQLAlchemy database models
│   ├── repositories/    # Data access layer (DB queries)
│   ├── routes/          # API endpoint definitions (Blueprints)
│   ├── services/        # Business logic layer
│   ├── utils/           # Helper functions (password hash, responses)
│   └── validators/      # Marshmallow schemas for data validation
├── migrations/          # Database migration scripts
├── .env                 # Environment variables (local only)
├── requirements.txt     # Python dependencies
└── run.py               # Application entry point
```

## Development Workflow

Follow this layered architecture when adding new features:

| Layer | Folder | Responsibility |
| :--- | :--- | :--- |
| **Model** | `app/models/` | Define database schemas (SQLAlchemy). |
| **Validator** | `app/validators/` | Define request/response validation (Marshmallow). |
| **Repository** | `app/repositories/` | Direct database operations (CRUD). Keep logic minimal. |
| **Service** | `app/services/` | Business logic, calculations, and data processing. |
| **Controller** | `app/controllers/` | Extract request data, call services, and return responses. |
| **Route** | `app/routes/` | Register API endpoints and map them to controllers. |

### How to Add a New Database Schema
1. **Define Model:** Create a new file in `app/models/` (e.g., `product_model.py`) and define your SQLAlchemy class.
2. **Register Model:** Import your new model in `app/__init__.py` to ensure Alembic detects it.
3. **Generate Migration:** Run:
   ```bash
   flask db migrate -m "added product table"
   ```
4. **Apply Changes:** Run:
   ```bash
   flask db upgrade
   ```

## Setup & Installation

### 1. Database Creation
Before running migrations, you must **manually create** the database in your PostgreSQL instance (e.g., `wellness_db`).

### 2. Environment Configuration
Create a `.env` file by copying the provided example:
```bash
cp .env.example .env
```
Then, update the `.env` file with your local credentials and configurations.

### 3. Install Dependencies
```bash
pip install -r requirements.txt
```

## Database Migrations

The project uses `Flask-Migrate`.

- **Apply migrations:**
  ```bash
  flask db upgrade
  ```
- **Create a new migration:**
  ```bash
  flask db migrate -m "Description of changes"
  ```
- **Initialize migrations (if starting fresh):**
  ```bash
  flask db init
  ```

## Running the Application

Start the development server:
```bash
python run.py
```
The server will start at `http://127.0.0.1:5000/`.

## API Documentation
Once the server is running, you can access the Swagger documentation at:
`http://127.0.0.1:5000/apidocs/`

# Event Registration System with AI-Powered Pre-Registration

A fast, lightweight event participant registration system with AI-powered Excel pre-registration processing and real-time updates.

## Features

### Pre-Registration Mode (Main Mode)
- **AI-Powered Excel Processing**: Upload Excel files and let Claude AI automatically:
  - Identify all columns in your spreadsheet
  - Determine the best identifier column (DNI > Email > Name)
  - Map columns to participant fields (name, email, DNI, area)
- **Smart Search**: Fast keyword search across all pre-registered participants
- **One-Click Registration**: Register participants with a single button click
- **Quick Add**: Add participants who didn't pre-register on the fly
- **Real-Time Updates**: All changes sync instantly across all connected devices

### Simple Mode (Legacy)
- Direct participant registration with manual entry
- Perfect for small events or walk-ins
- Clean, front-desk-friendly UI

### Real-Time Features
- Live updates across all connected clients using Server-Sent Events (SSE)
- Visual notifications for new registrations
- Automatic list synchronization
- Local SQLite database
- No build step required

## Quick Start

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file with your Anthropic API key:
```bash
ANTHROPIC_API_KEY=your_api_key_here
```

Get your API key from https://console.anthropic.com/

3. Start the server:
```bash
npm start
```

4. Open your browser:
```
http://localhost:3000
```

## Usage

### Pre-Registration Workflow (Recommended)

1. **Prepare Your Excel File**
   - Use any Excel format (.xlsx, .xls, .csv)
   - Include participant data with columns like:
     - Name/Full Name/Nombre
     - Email/Correo
     - DNI/Cedula/ID/Documento
     - Area/Department/Departamento
   - The AI will automatically detect column names in any language

2. **Upload the File**
   - Click "Pre-Registration Mode" tab (default)
   - Click "Choose Excel File"
   - Select your file
   - Click "Process File with AI"
   - Wait for AI to analyze and load participants

3. **Register Participants**
   - Search for participants by name, email, or DNI
   - Click "Register" button next to their name
   - Participant is instantly added to the registered list
   - Status changes to "Registered" automatically

4. **Handle Walk-Ins**
   - Use the "Not in the list?" quick add form
   - Enter name, email, and area
   - Click "Quick Add"

### Simple Mode Workflow

1. Click "Simple Mode" tab
2. Fill in the participant's Full Name, Email, and Area
3. Press Enter or click "Register Participant"
4. The form clears automatically for the next registration
5. New participants appear instantly in the list

### Searching Participants
Use the search box to filter by name, email, or area in real-time.

### Deleting Participants
Click the "Delete" button next to any participant to remove them.

## Database

Participant data is stored in `participants.db` (SQLite). The database is created automatically on first run.

### Tables
- **participants**: Registered participants (id, full_name, email, area, registered_at)
- **pre_registered_participants**: Pre-registered from Excel (id, identifier_type, identifier_value, full_name, email, dni, area, raw_data, is_registered, registered_participant_id, uploaded_at)

## API Endpoints

### Pre-Registration
- `POST /api/upload-preregister` - Upload and process Excel file with AI
- `GET /api/preregistered` - Get all pre-registered participants
- `GET /api/preregistered/search?q=query` - Search pre-registered participants
- `POST /api/preregistered/:id/register` - Register a pre-registered participant
- `DELETE /api/preregistered` - Clear all pre-registered participants
- `GET /api/preregistered/stats` - Get pre-registration statistics

### Regular Registration
- `GET /api/participants` - Get all registered participants
- `POST /api/participants` - Register new participant
- `DELETE /api/participants/:id` - Delete participant
- `GET /api/stats` - Get statistics
- `GET /events` - Server-Sent Events stream for real-time updates

## Tech Stack

- **Backend**: Node.js + Express.js
- **Database**: SQLite
- **AI**: Anthropic Claude 3.5 Sonnet
- **File Processing**: XLSX library
- **File Upload**: Multer
- **Real-time**: Server-Sent Events (SSE)
- **Frontend**: Vanilla JavaScript + HTML + CSS

## Security

- XSS protection via `escapeHtml()` function
- File type validation (only Excel/CSV files)
- File size limit (10MB)
- API key stored in `.env` (not committed to git)
- Input validation on all endpoints
# registeraton

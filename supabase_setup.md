# Student Helpdesk Bot Setup (Kommunicate + Supabase)

## 1) Install dependencies
```bash
npm install
```

## 2) Configure environment variables
Set these in `.env`:

```env
PORT=8080
BOT_NAME=CampusPulse AI
BOT_TIMEZONE=Asia/Karachi
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
GOOGLE_SHEET_ID=your_sheet_id
GOOGLE_SHEET_RANGE=Sheet1!A:G
GOOGLE_SERVICE_ACCOUNT_KEY_FILE=credentials.json
SMTP_USER=your_gmail@gmail.com
SMTP_PASS=your_gmail_app_password
```

## 3) Create Supabase tables
Run `supabase_setup.sql` in Supabase SQL Editor.

## 4) Kommunicate integration
1. Create a Kommunicate AI agent/app.
2. In Kommunicate, configure custom bot webhook URL:
   - local: `https://<ngrok-id>.ngrok-free.app/webhook`
   - deployed: `https://<your-domain>/webhook`
3. In your widget script, replace `YOUR_KOMMUNICATE_APP_ID` in `index.html`.
4. Configure Facebook channel from Kommunicate dashboard and link it to the same bot.

## 5) Run locally
```bash
npm start
```
Open `http://localhost:8080`.

## Endpoints
- `POST /webhook` -> Kommunicate custom bot webhook
- `POST /api/student-query` -> Manual query collection from frontend form
- `GET /health` -> Health check

## Notes
- `student_conversations` stores all bot exchanges.
- `student_queries` stores unresolved or manually submitted student issues.
- Query records are also appended to Google Sheets.
- Confirmation email is sent to student after query logging.

KABAS — Kanban Board Assessment System
A full-stack web application that aggregates Jira and GitHub Kanban board data into a unified instructor dashboard. Built with React, Node.js/Express, and MySQL.
Team 16 — YTC
NameStudent ID: Chu Jun An Theron(2303610) Tan Wen Lin Sheri Isabel(2303629) Yeo Kai Lin(2303636)

Prerequisites
Make sure you have the following installed before starting:
ToolVersionCheckNode.jsv18 or abovenode -vnpmv9 or abovenpm -vMySQLv8 or abovemysql --version

Getting Started
Step 1 — Clone the repository
bashgit clone https://github.com/<your-org>/G16-ICT2505C.git
cd G16-ICT2505C

Step 2 — Install dependencies
Run this once in the project root. It installs both frontend and backend packages.
bashnpm install

Step 3 — Set up the MySQL database
Open MySQL Workbench (or any MySQL client) and import the three SQL dump files in this order:

mysql_dumps/kabas_instructor.sql
mysql_dumps/kabas_team.sql
mysql_dumps/kabas_grade.sql

In MySQL Workbench: Server → Data Import → Import from Self-Contained File → select each file → click Start Import.
Then run this once to add the password column:
sqlUSE kabas;
ALTER TABLE instructor ADD COLUMN passwordHash VARCHAR(255) NOT NULL DEFAULT '';

Step 4 — Create the .env file
Create a file named .env in the project root (same folder as package.json):
PORT=3000
REACT_APP_API_URL=http://localhost:5000

Create a file named .env in the backend (same folder as server.json):
envDB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=kabas
SECRET_KEY=kabas_secret_key_2024
PORT=5000
CORS_ORIGIN=http://localhost:3000
NODE_ENV=development

Notes:

DB_USER — use root or whichever MySQL user has access to the kabas database
DB_PASSWORD — leave blank if your MySQL root has no password, otherwise fill it in
SECRET_KEY — used for AES encryption of Jira/GitHub tokens. Do not change this after accounts have been created or stored tokens will fail to decrypt
NODE_ENV=development — required for session cookies to work on localhost over HTTP



Step 5 — Start the backend
Open a terminal in the project root and run:
cd backend 
npm start
You should see:
Backend running on http://localhost:5000
The backend uses nodemon — it will automatically restart when you save any backend file.

Step 6 — Start the frontend
Open a second terminal (keep the first one running) and run:
bashnpm start
This opens the React app at http://localhost:3000 automatically.

Both terminals should look like this
Terminal 1 (backend)          Terminal 2 (frontend)
────────────────────────      ────────────────────────
npm run backend               npm start
→ Express on :5000            → React on :3000

Creating Your First Account

Open http://localhost:3000 in your browser
Click "Create an account"
Enter your SIT email address and a password
Optionally paste your Jira API token and/or GitHub personal access token
Click "Create account" — you will be logged in automatically

To update your API tokens later, click the profile icon in the top-right → Profile.

Adding Teams
Manual entry:

Click + Add Team in the header
Enter the team name
Paste either a Jira board URL or both GitHub URLs (repo + project)
Click Add

Bulk import via Excel:

Click Download Import Template to get the Excel template
Fill in your teams following the example rows
Click Import Teams and upload the completed file


Jira & GitHub URL Formats
PlatformFieldExampleJiraBoard URLhttps://workspace.atlassian.net/jira/software/projects/KEY/boards/67GitHubRepo URLhttps://github.com/owner/repo-nameGitHubProject URL (user)https://github.com/users/owner/projects/1GitHubProject URL (org)https://github.com/orgs/OrgName/projects/1

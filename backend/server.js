import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import session from "express-session"

import jiraRoutes from "./routes/jira.js";
import teamsRoutes from "./routes/teams.js";
import githubRoutes from "./routes/github.js";
import authRoutes from './routes/auth.js'

dotenv.config();

const app = express();

app.use(cors({
  origin: "http://localhost:3000",
  credentials: true
}));

app.use(express.json());

app.use(session({
  secret: process.env.SECRET_KEY,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: false,
    sameSite: "lax"
  }
}));

app.get("/api/health", (req, res) => {
  res.json({ status: "OK", message: "KABAS backend running" });
});

// Auth routes
app.use("/api", authRoutes);

// Jira routes
app.use("/api/jira", jiraRoutes);

// Teams routes
app.use("/api/teams", teamsRoutes);

// Github routes
app.use("/api/github", githubRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
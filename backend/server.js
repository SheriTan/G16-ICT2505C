import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import session from "express-session";

import jiraRoutes   from "./routes/jira.js";
import teamsRoutes  from "./routes/teams.js";
import githubRoutes from "./routes/github.js";
import authRoutes   from "./routes/auth.js";
import gradesRoutes from "./routes/grades.js"; // New grade CRUD routes

dotenv.config();

const app = express();

// FIX: CORS origin reads from env — avoids hardcoded localhost breaking on any deployment
app.use(cors({
  origin: process.env.CORS_ORIGIN || "http://localhost:3000",
  credentials: true
}));

app.use(express.json());

app.use(session({
  secret: process.env.SECRET_KEY,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    // FIX: secure must be true in production so cookie only travels over HTTPS
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax"
  }
}));

// Health check — lets the frontend confirm the backend is reachable
app.get("/api/health", (req, res) => {
  res.json({ status: "OK", message: "KABAS backend running" });
});

// Auth routes — login, register, logout, profile
app.use("/api", authRoutes);

// Jira dashboard and test routes
app.use("/api/jira", jiraRoutes);

// Team CRUD and bulk import routes
app.use("/api/teams", teamsRoutes);

// GitHub dashboard routes
app.use("/api/github", githubRoutes);

// Grade CRUD routes (new)
app.use("/api/grades", gradesRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});

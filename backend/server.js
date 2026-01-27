import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import jiraRoutes from "./routes/jira.js";
import teamsRoutes from "./routes/teams.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ status: "OK", message: "KABAS backend running" });
});

// Jira routes
app.use("/api/jira", jiraRoutes);

// Teams routes (NEW)
app.use("/api/teams", teamsRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});

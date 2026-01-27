import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const router = express.Router();

// Temporary
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const filePath = path.join(__dirname, "../data/teams.json");

function readTeams() {
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw);
}

function writeTeams(teams) {
  fs.writeFileSync(filePath, JSON.stringify(teams, null, 2), "utf-8");
}

// GET all teams
router.get("/", (req, res) => {
  const teams = readTeams();
  res.json({ success: true, teams });
});

// ADD a team
router.post("/", (req, res) => {
  const { teamName, projectKey } = req.body;
  if (!teamName || !projectKey) {
    return res.status(400).json({ success: false, message: "teamName and projectKey required" });
  }

  const teams = readTeams();
  const id = `team_${Date.now()}`;
  const newTeam = { id, teamName, projectKey };

  teams.push(newTeam);
  writeTeams(teams);

  res.json({ success: true, team: newTeam });
});

// DELETE a team
router.delete("/:id", (req, res) => {
  const { id } = req.params;
  const teams = readTeams();
  const filtered = teams.filter((t) => t.id !== id);

  writeTeams(filtered);
  res.json({ success: true });
});

export default router;

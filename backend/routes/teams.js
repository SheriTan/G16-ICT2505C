import express from "express";
import {
  addTeam,
  bulkAddTeams,
  deleteTeam,
  readTeams
} from "../data/teamStore.js";
const router = express.Router();

// URL parsers
function parseJiraBoardUrl(url) {
  // Example: https://sit-workspace.atlassian.net/jira/software/projects/K1/boards/67
  const m = String(url || "").match(/\/projects\/([^/]+)\/boards\/(\d+)/i);
  if (!m) return null;
  return { projectKey: m[1], boardId: Number(m[2]) };
}

function parseGithubRepoUrl(url) {
  // Example: https://github.com/TheronCJA/Testing-Kanban-1
  const m = String(url || "").match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)(\/)?$/i);
  if (!m) return null;
  return { owner: m[1], repo: m[2] };
}

function parseGithubProjectUrl(url) {
  // Example user project: https://github.com/users/TheronCJA/projects/1
  // Example org project:  https://github.com/orgs/ORG/projects/1
  const s = String(url || "");

  let m = s.match(/^https?:\/\/github\.com\/users\/([^/]+)\/projects\/(\d+)(\/)?$/i);
  if (m) return { owner: m[1], projectNumber: Number(m[2]), scope: "user" };

  m = s.match(/^https?:\/\/github\.com\/orgs\/([^/]+)\/projects\/(\d+)(\/)?$/i);
  if (m) return { owner: m[1], projectNumber: Number(m[2]), scope: "org" };

  return null;
}

// Single / Bulk Add
function buildTeamFromPayload(body) {
  const {
    teamName,
    platform, // "jira" | "github"
    jiraBoardUrl,
    githubRepoUrl,
    githubProjectUrl,
  } = body || {};

  const finalTeamName = String(teamName || "").trim();

  if (!finalTeamName) throw new Error("teamName required");
  if (platform !== "jira" && platform !== "github") {
    throw new Error("platform must be 'jira' or 'github'");
  }

  const id = `team_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

  const newTeam = {
    id,
    teamName: finalTeamName,
    platform, // store platform (useful for MySQL later)
  };

  if (platform === "jira") {
    if (!jiraBoardUrl) throw new Error("jiraBoardUrl required for Jira teams");

    const parsed = parseJiraBoardUrl(jiraBoardUrl);
    if (!parsed) {
      throw new Error("Invalid Jira board URL. Expected /projects/<KEY>/boards/<ID>");
    }

    newTeam.jira = {
      boardUrl: jiraBoardUrl,
      projectKey: parsed.projectKey,
      boardId: parsed.boardId,
    };

    newTeam.projectKey = parsed.projectKey;
    newTeam.boardId = parsed.boardId;
  }

  if (platform === "github") {
    if (!githubRepoUrl) throw new Error("githubRepoUrl required for GitHub teams");
    if (!githubProjectUrl) {
      throw new Error("githubProjectUrl required (used by current GitHub dashboard code)");
    }

    const repoParsed = parseGithubRepoUrl(githubRepoUrl);
    if (!repoParsed) {
      throw new Error("Invalid GitHub repo URL. Expected https://github.com/<owner>/<repo>");
    }

    const projParsed = parseGithubProjectUrl(githubProjectUrl);
    if (!projParsed) {
      throw new Error(
        "Invalid GitHub project URL. Expected https://github.com/users/<owner>/projects/<num> (or /orgs/... )"
      );
    }

    newTeam.github = {
      owner: projParsed.owner,
      projectNumber: projParsed.projectNumber,
      projectUrl: githubProjectUrl,

      repoUrl: githubRepoUrl,
      repoOwner: repoParsed.owner,
      repoName: repoParsed.repo,
    };
  }

  return newTeam;
}

// ---------------------------
// Routes
// ---------------------------

// GET all teams
router.get("/", async (req, res) => {
  const teams = await readTeams();
  res.json({ success: true, teams });
});

// ADD a team (manual UI)
router.post("/", async (req, res) => {
  try {
    const team = buildTeamFromPayload(req.body);
    const saved = await addTeam(team, 1); // instructor id 1 for now
    res.json({ success: true, team: saved });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
});

// BULK import teams (Excel -> frontend -> JSON -> this endpoint)
// POST /api/teams/bulk
router.post("/bulk", async (req, res) => {
  try {
    const { teams } = req.body;
    if (!Array.isArray(teams) || teams.length === 0) {
      return res.status(400).json({ success: false, message: "teams must be a non-empty array" });
    }

    const results = [];
    const toInsert = [];

    teams.forEach((row, idx) => {
      try {
        const t = buildTeamFromPayload(row);
        toInsert.push(t);
        results.push({ row: idx + 2, success: true, id: t.id, teamName: t.teamName });
      } catch (e) {
        results.push({ row: idx + 2, success: false, message: e.message });
      }
    });

    await bulkAddTeams(toInsert);

    const ok = results.filter((r) => r.success).length;
    const fail = results.length - ok;

    res.json({
      success: true,
      message: `Bulk import finished: ${ok} success, ${fail} failed`,
      results,
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// DELETE a team
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  const out = await deleteTeam(id);
  res.json({ success: true, ...out });
});

export default router;

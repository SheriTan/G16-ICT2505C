import express from "express";
import {
  addTeam,
  bulkAddTeams,
  deleteTeam,
  readTeams,
  updateTeam
} from "../data/teamStore.js";

import { validateJiraBoardUrl, validateGithubRepoUrl, validateGithubProjectUrl } from "../../src/utils/UrlValidator.js";
const router = express.Router();

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

    const parsed = validateJiraBoardUrl(jiraBoardUrl);
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

    const repoParsed = validateGithubRepoUrl(githubRepoUrl);
    if (!repoParsed) {
      throw new Error("Invalid GitHub repo URL. Expected https://github.com/<owner>/<repo>");
    }

    const projParsed = validateGithubProjectUrl(githubProjectUrl);
    if (!projParsed) {
      throw new Error(
        "Invalid GitHub project URL. Expected https://github.com/<users or orgs>/<owner>/projects/<num>"
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
  try {
    const iid = req.session.user?.iid;

    if (!iid) {
      return res.status(401).json({ success: false, message: "Unauthorized User" });
    }

    const teams = await readTeams(iid);
    res.json({ success: true, teams });
  } catch (e) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
});

// ADD a team (manual UI)
router.post("/", async (req, res) => {
  try {
    const iid = req.session.user?.iid;

    if (!iid) {
      return res.status(401).json({ success: false, message: "Unauthorized User" });
    }

    const team = buildTeamFromPayload(req.body);
    const saved = await addTeam(team, iid);

    res.json({ success: true, team: saved });

  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
});

// BULK import teams (Excel -> frontend -> JSON -> this endpoint)
router.post("/bulk", async (req, res) => {
  try {
    const iid = req.session.user?.iid;

    if (!iid) {
      return res.status(401).json({ success: false, message: "Unauthorized User" });
    }

    const { teams } = req.body;
    if (!Array.isArray(teams) || teams.length === 0) {
      return res.status(400).json({ success: false, message: "There are no teams to import" });
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

    await bulkAddTeams(toInsert, iid);

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

// UPDATE a team
router.put("/:id", async (req, res) => {
  try {
    const iid = req.session.user?.iid;

    if (!iid) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized User"
      });
    }

    const { id } = req.params;

    const team = buildTeamFromPayload(req.body);

    const result = await updateTeam(id, team, iid);

    if (!result.updated) {
      return res.status(404).json({
        success: false,
        message: "Team not found or not owned by user"
      });
    }

    res.json({
      success: true,
      message: "Team updated successfully"
    });

  } catch (e) {
    res.status(400).json({
      success: false,
      message: e.message
    });
  }
});

// DELETE a team
router.delete("/:id", async (req, res) => {
  const iid = req.session.user?.iid;
  if (!iid) {
    return res.status(401).json({ success: false, message: "Unauthorized User" });
  }
  const { id } = req.params;
  const out = await deleteTeam(id, iid);
  res.json({ success: true, ...out });
});

export default router;

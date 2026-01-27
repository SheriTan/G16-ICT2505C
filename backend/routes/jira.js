import express from "express";
import axios from "axios";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const router = express.Router();

// Temporary
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// ---------- Teams helpers ----------
const teamsFilePath = path.join(__dirname, "../data/teams.json");

function readTeams() {
  const raw = fs.readFileSync(teamsFilePath, "utf-8");
  return JSON.parse(raw);
}

function getTeamById(teamId) {
  const teams = readTeams();
  return teams.find((t) => t.id === teamId) || null;
}

// ---------- Stats helpers ----------
function hoursBetween(a, b) {
  const ms = new Date(b).getTime() - new Date(a).getTime();
  return ms / (1000 * 60 * 60);
}
function mean(nums) {
  if (!nums.length) return null;
  return nums.reduce((s, x) => s + x, 0) / nums.length;
}
function stdDev(nums) {
  if (nums.length < 2) return 0;
  const m = mean(nums);
  const variance = nums.reduce((s, x) => s + (x - m) ** 2, 0) / (nums.length - 1);
  return Math.sqrt(variance);
}
function groupBy(arr, keyFn) {
  const out = {};
  for (const x of arr) {
    const k = keyFn(x);
    if (!out[k]) out[k] = [];
    out[k].push(x);
  }
  return out;
}

// ---------- Jira auth config ----------
function jiraAuthConfig() {
  const { JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN } = process.env;
  return {
    baseUrl: JIRA_BASE_URL,
    axiosConfig: {
      auth: { username: JIRA_EMAIL, password: JIRA_API_TOKEN },
      headers: { Accept: "application/json" },
    },
  };
}

// ---------- Fetch board issues by projectKey (JQL) ----------
async function fetchIssuesByProjectKey(projectKey) {
  const { baseUrl, axiosConfig } = jiraAuthConfig();
  const jql = `project=${projectKey} ORDER BY created DESC`;

  const response = await axios.get(`${baseUrl}/rest/api/3/search/jql`, {
    ...axiosConfig,
    params: {
      jql,
      maxResults: 500,
      fields: [
        "project",
        "summary",
        "assignee",
        "status",
        "priority",
        "created",
        "updated",
        "resolutiondate",
      ].join(","),
    },
  });

  const rawIssues = response.data.issues || [];

  const issues = rawIssues.map((issue) => {
    const statusName = issue.fields.status?.name || "Unknown";
    const statusCategory = issue.fields.status?.statusCategory?.name || "Unknown"; // To Do / In Progress / Done

    return {
      key: issue.key,
      title: issue.fields.summary,
      assignee: issue.fields.assignee?.displayName || "Unassigned",
      status: statusName,
      statusCategory,
      priority: issue.fields.priority?.name || null,
      createdAt: issue.fields.created,
      updatedAt: issue.fields.updated,
      completedAt: issue.fields.resolutiondate || null,
    };
  });

  const projectName = rawIssues?.[0]?.fields?.project?.name || projectKey;

  return { issues, projectName };
}

// ---------- Fetch backlog-only issues by boardId (Agile API) ----------
async function fetchBacklogByBoardId(boardId) {
  if (!boardId) return { issues: [] };

  const { baseUrl, axiosConfig } = jiraAuthConfig();

  // Jira Agile API (Cloud): /rest/agile/1.0/board/{boardId}/backlog
  const response = await axios.get(`${baseUrl}/rest/agile/1.0/board/${boardId}/backlog`, {
    ...axiosConfig,
    params: {
      maxResults: 200,
      fields: [
        "summary",
        "assignee",
        "status",
        "priority",
        "created",
        "updated",
        "resolutiondate",
      ].join(","),
    },
  });

  const rawIssues = response.data.issues || [];

  const issues = rawIssues.map((issue) => {
    const statusName = issue.fields.status?.name || "Unknown";
    const statusCategory = issue.fields.status?.statusCategory?.name || "Unknown";

    return {
      key: issue.key,
      title: issue.fields.summary,
      assignee: issue.fields.assignee?.displayName || "Unassigned",
      status: statusName,
      statusCategory,
      priority: issue.fields.priority?.name || null,
      createdAt: issue.fields.created,
      updatedAt: issue.fields.updated,
      completedAt: issue.fields.resolutiondate || null,
    };
  });

  return { issues };
}

/**
 * TEST JIRA CONNECTION
 * http://localhost:5000/api/jira/test
 */
router.get("/test", async (req, res) => {
  try {
    const { baseUrl, axiosConfig } = jiraAuthConfig();
    const response = await axios.get(`${baseUrl}/rest/api/3/myself`, axiosConfig);
    res.json({ success: true, user: response.data.displayName });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.response?.data?.message || error.message,
    });
  }
});

/**
 * DASHBOARD
 * http://localhost:5000/api/jira/dashboard?teamId=team3
 */
router.get("/dashboard", async (req, res) => {
  try {
    const { teamId, projectKey } = req.query;

    let finalProjectKey = projectKey || null;
    let team = null;

    if (!finalProjectKey && teamId) {
      team = getTeamById(teamId);
      finalProjectKey = team?.projectKey || null;
    }

    if (!finalProjectKey) {
      return res.status(400).json({
        success: false,
        message: "Provide either projectKey or teamId",
      });
    }

    // 1) Fetch all project issues (board-side)
    const { issues: allIssues, projectName } = await fetchIssuesByProjectKey(finalProjectKey);

    // 2) Fetch backlog-only (if boardId exists)
    const boardId = team?.boardId || null;
    const { issues: backlogIssues } = await fetchBacklogByBoardId(boardId);

    // 3) Remove backlog issues from board issues (avoid double counting)
    const backlogKeys = new Set(backlogIssues.map((x) => x.key));
    const boardIssues = allIssues.filter((x) => !backlogKeys.has(x.key));

    // ---------------------- Counts (BOARD ONLY) ----------------------
    const statusCounts = {};
    const statusCategoryCounts = {};

    for (const i of boardIssues) {
      statusCounts[i.status] = (statusCounts[i.status] || 0) + 1;
      statusCategoryCounts[i.statusCategory] = (statusCategoryCounts[i.statusCategory] || 0) + 1;
    }

    const issuesByStatus = groupBy(boardIssues, (x) => x.status);
    const issuesByStatusCategory = groupBy(boardIssues, (x) => x.statusCategory);
    const issuesByAssignee = groupBy(boardIssues, (x) => x.assignee);

    // ---------------------- Longest open (BOARD ONLY) ----------------------
    const now = new Date().toISOString();
    const openIssues = boardIssues.filter((x) => !x.completedAt);

    let longestOpen = null;
    for (const i of openIssues) {
      const ageHours = hoursBetween(i.createdAt, now);
      if (!longestOpen || ageHours > longestOpen.ageHours) {
        longestOpen = { ...i, ageHours: Math.round(ageHours * 10) / 10 };
      }
    }

    // ---------------------- “Most X” metrics (BOARD ONLY) ----------------------
    const openedByMember = {};
    const todoByMember = {};
    const doneByMember = {};

    for (const i of boardIssues) {
      if (!i.completedAt) openedByMember[i.assignee] = (openedByMember[i.assignee] || 0) + 1;
      if (i.statusCategory === "To Do") todoByMember[i.assignee] = (todoByMember[i.assignee] || 0) + 1;
      if (i.completedAt) doneByMember[i.assignee] = (doneByMember[i.assignee] || 0) + 1;
    }

    // Backlog-by-member (BACKLOG ONLY)
    const backlogByMember = {};
    for (const i of backlogIssues) {
      backlogByMember[i.assignee] = (backlogByMember[i.assignee] || 0) + 1;
    }

    function topMember(countMap) {
      let best = null;
      for (const [member, count] of Object.entries(countMap)) {
        if (!best || count > best.count) best = { member, count };
      }
      return best;
    }

    const topOpenedMember = topMember(openedByMember);
    const topTodoMember = topMember(todoByMember);
    const topBacklogMember = topMember(backlogByMember);

    // ---------------------- Time metrics (completed tasks) BOARD ONLY ----------------------
    const completionTimesByMember = {};
    for (const i of boardIssues) {
      if (!i.completedAt) continue;
      const hrs = hoursBetween(i.createdAt, i.completedAt);
      if (!completionTimesByMember[i.assignee]) completionTimesByMember[i.assignee] = [];
      completionTimesByMember[i.assignee].push(hrs);
    }

    const timeStatsByMember = {};
    for (const [member, times] of Object.entries(completionTimesByMember)) {
      const avg = mean(times);
      const sd = stdDev(times);
      timeStatsByMember[member] = {
        completedTasks: times.length,
        avgCompletionHours: avg === null ? null : Math.round(avg * 10) / 10,
        stdDevHours: Math.round(sd * 10) / 10,
      };
    }

    // ---------------------- Efficiency (BOARD ONLY) ----------------------
    let projectDurationHours = 0;
    if (boardIssues.length > 0) {
      const earliest = boardIssues.reduce(
        (min, i) => (new Date(i.createdAt) < new Date(min) ? i.createdAt : min),
        boardIssues[0].createdAt
      );
      projectDurationHours = Math.max(0.0001, hoursBetween(earliest, now));
    } else {
      projectDurationHours = 0.0001;
    }

    let totalTimeAllTasksHours = 0;
    for (const i of boardIssues) {
      if (i.completedAt) totalTimeAllTasksHours += hoursBetween(i.createdAt, i.completedAt);
      else totalTimeAllTasksHours += hoursBetween(i.createdAt, now);
    }

    const avgTimePerTaskHours = boardIssues.length ? totalTimeAllTasksHours / boardIssues.length : 0;
    const efficiency = (avgTimePerTaskHours / projectDurationHours) * 100;

    // ---------------------- Latest sample per member (BOARD ONLY) ----------------------
    const latestSampleByMember = {};
    for (const [member, items] of Object.entries(issuesByAssignee)) {
      const opened = items
        .filter((x) => !x.completedAt)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      const completed = items
        .filter((x) => x.completedAt)
        .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));

      const sample = opened[0] || completed[0] || null;
      if (sample) latestSampleByMember[member] = sample;
    }

    // ---------------------- Response ----------------------
    res.json({
      success: true,

      team: team ? { id: team.id, teamName: team.teamName, boardId: team.boardId || null } : null,
      project: { key: finalProjectKey, name: projectName },

      totals: {
        boardIssues: boardIssues.length,
        backlogIssues: backlogIssues.length,
      },

      // BOARD ONLY summaries (what you want in “Status Summary”)
      statusCategoryCounts,
      statusCounts,

      memberCounts: Object.fromEntries(
        Object.entries(issuesByAssignee).map(([k, v]) => [k, v.length])
      ),

      backlog: {
        count: backlogIssues.length,
        byMember: backlogByMember,
        issues: backlogIssues,
      },

      longestOpen,

      topMembers: {
        mostOpened: topOpenedMember || { member: null, count: 0 },
        mostTodo: topTodoMember || { member: null, count: 0 },
        mostBacklog: topBacklogMember || { member: null, count: 0 },
      },

      timeStatsByMember,

      efficiency: {
        projectDurationHours: Math.round(projectDurationHours * 10) / 10,
        totalTimeAllTasksHours: Math.round(totalTimeAllTasksHours * 10) / 10,
        avgTimePerTaskHours: Math.round(avgTimePerTaskHours * 10) / 10,
        efficiencyScore: Math.round(efficiency * 10) / 10,
        note: "Board-only efficiency. Smaller is better. Uses completed duration + open age-so-far; project duration = now - earliest created.",
      },

      latestSampleByMember,

      // Drilldowns (BOARD ONLY)
      drilldowns: {
        issuesByStatus,
        issuesByStatusCategory,
        issuesByAssignee,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message:
        error.response?.data?.errorMessages?.[0] ||
        error.response?.data?.message ||
        error.message,
    });
  }
});

export default router;

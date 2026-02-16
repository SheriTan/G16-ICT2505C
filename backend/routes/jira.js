import express from "express";
import axios from "axios";
import { getTeamWithInstructor } from "../data/teamStore.js";

const router = express.Router();

/* =========================================================
   Helpers
========================================================= */

function extractBaseUrl(boardUrl) {
  try {
    const url = new URL(boardUrl);
    return `${url.protocol}//${url.host}`;
  } catch {
    return null;
  }
}

function parseJiraBoardUrl(url) {
  // Example: https://sit-workspace.atlassian.net/jira/software/projects/K1/boards/67
  const m = String(url || "").match(/\/projects\/([^/]+)\/boards\/(\d+)/i);
  if (!m) return null;
  return {
    projectKey: m[1],
    boardId: Number(m[2]),
  };
}

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
  const variance =
    nums.reduce((s, x) => s + (x - m) ** 2, 0) / (nums.length - 1);
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

function jiraAuthConfig(team) {
  if (!team?.instructor) {
    throw new Error("Instructor data missing for team");
  }

  const baseUrl = extractBaseUrl(team.jira.boardUrl);

  if (!baseUrl) {
    throw new Error("Invalid Jira board URL");
  }

  const email = team.instructor.email;
  const token = team.instructor.jiraToken;

  if (!email || !token) {
    throw new Error("Instructor Jira credentials missing");
  }

  return {
    baseUrl,
    axiosConfig: {
      auth: {
        username: email,
        password: token,
      },
      headers: { Accept: "application/json" },
    },
  };
}

/* =========================================================
   Jira Fetchers
========================================================= */

async function fetchIssuesByProjectKey(projectKey, team) {
  const { baseUrl, axiosConfig } = jiraAuthConfig(team);
  const jql = `project=${projectKey} ORDER BY created DESC`;

  const response = await axios.get(
    `${baseUrl}/rest/api/3/search/jql`,
    {
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
    }
  );

  const rawIssues = response.data.issues || [];

  const issues = rawIssues.map((issue) => ({
    key: issue.key,
    title: issue.fields.summary,
    assignee:
      issue.fields.assignee?.displayName || "Unassigned",
    status: issue.fields.status?.name || "Unknown",
    statusCategory:
      issue.fields.status?.statusCategory?.name || "Unknown",
    priority: issue.fields.priority?.name || null,
    createdAt: issue.fields.created,
    updatedAt: issue.fields.updated,
    completedAt: issue.fields.resolutiondate || null,
  }));

  const projectName =
    rawIssues?.[0]?.fields?.project?.name || projectKey;

  return { issues, projectName };
}

async function fetchBacklogByBoardId(boardId, team) {
  if (!boardId) return { issues: [] };

  if (!team) throw new Error("Team is required to fetch Jira backlog");

  const { baseUrl, axiosConfig } = jiraAuthConfig(team);

  const response = await axios.get(
    `${baseUrl}/rest/agile/1.0/board/${boardId}/backlog`,
    {
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
    }
  );

  const rawIssues = response.data.issues || [];

  const issues = rawIssues.map((issue) => ({
    key: issue.key,
    title: issue.fields.summary,
    assignee: issue.fields.assignee?.displayName || "Unassigned",
    status: issue.fields.status?.name || "Unknown",
    statusCategory: issue.fields.status?.statusCategory?.name || "Unknown",
    priority: issue.fields.priority?.name || null,
    createdAt: issue.fields.created,
    updatedAt: issue.fields.updated,
    completedAt: issue.fields.resolutiondate || null,
  }));

  return { issues };
}

router.get("/test", async (req, res) => {
  try {
    const { teamId } = req.query;
    if (!teamId) throw new Error("Provide teamId as query param");

    const team = await getTeamWithInstructor(teamId);
    if (!team) throw new Error("Team not found");

    const { baseUrl, axiosConfig } = jiraAuthConfig(team);
    const response = await axios.get(`${baseUrl}/rest/api/3/myself`, axiosConfig);

    res.json({ success: true, user: response.data.displayName });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.response?.data?.message || error.message,
    });
  }
});

router.get("/dashboard", async (req, res) => {
  try {
    const { teamId, projectKey } = req.query;

    let finalProjectKey = projectKey || null;
    let team = null;
    let boardId = null;

    // -------- Resolve from teamId --------
    if (!finalProjectKey && teamId) {
      team = await getTeamWithInstructor(teamId);

      if (!team) {
        return res.status(404).json({
          success: false,
          message: "Team not found",
        });
      }

      if (!team.jira || !team.jira.boardUrl) {
        return res.status(400).json({
          success: false,
          message: "This team is not configured for Jira",
        });
      }

      const parsed = parseJiraBoardUrl(team.jira.boardUrl);
      if (!parsed) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid Jira board URL format in database",
        });
      }

      finalProjectKey = parsed.projectKey;
      boardId = parsed.boardId;
    }

    if (!finalProjectKey) {
      return res.status(400).json({
        success: false,
        message: "Provide either projectKey or teamId",
      });
    }

    // -------- Fetch data --------
    const { issues: allIssues, projectName } =
      await fetchIssuesByProjectKey(finalProjectKey, team);

    const { issues: backlogIssues } =
      await fetchBacklogByBoardId(boardId, team);

    const backlogKeys = new Set(backlogIssues.map((x) => x.key));
    const boardIssues = allIssues.filter((x) => !backlogKeys.has(x.key));

    // -------- Metrics --------
    const statusCounts = {};
    const statusCategoryCounts = {};

    for (const i of boardIssues) {
      statusCounts[i.status] = (statusCounts[i.status] || 0) + 1;
      statusCategoryCounts[i.statusCategory] =
        (statusCategoryCounts[i.statusCategory] || 0) + 1;
    }

    const issuesByStatus = groupBy(boardIssues, (x) => x.status);
    const issuesByStatusCategory = groupBy(boardIssues, (x) => x.statusCategory);
    const issuesByAssignee = groupBy(boardIssues, (x) => x.assignee);

    const now = new Date().toISOString();
    const openIssues = boardIssues.filter((x) => !x.completedAt);

    let longestOpen = null;
    for (const i of openIssues) {
      const ageHours = hoursBetween(i.createdAt, now);
      if (!longestOpen || ageHours > longestOpen.ageHours) {
        longestOpen = {
          ...i,
          ageHours: Math.round(ageHours * 10) / 10,
        };
      }
    }

    res.json({
      success: true,
      team: team ? { id: team.id, teamName: team.teamName } : null,
      project: { key: finalProjectKey, name: projectName },
      totals: { boardIssues: boardIssues.length, backlogIssues: backlogIssues.length },
      statusCounts,
      statusCategoryCounts,
      memberCounts: Object.fromEntries(
        Object.entries(issuesByAssignee).map(([k, v]) => [k, v.length])
      ),
      backlog: { count: backlogIssues.length, issues: backlogIssues },
      longestOpen,
      drilldowns: { issuesByStatus, issuesByStatusCategory, issuesByAssignee },
    });
  } catch (error) {
    console.error("Jira dashboard error:", error);

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
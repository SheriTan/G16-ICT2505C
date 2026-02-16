import express from "express";
import axios from "axios";
import { getTeamWithInstructor } from "../data/teamStore.js";

const router = express.Router();
const GITHUB_GRAPHQL = "https://api.github.com/graphql";

/* =========================================================
   Helpers
========================================================= */

async function ghQuery(token, query, variables = {}) {
  if (!token) {
    throw new Error("Missing GitHub token for instructor");
  }

  const res = await axios.post(
    GITHUB_GRAPHQL,
    { query, variables },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (res.data?.errors?.length) {
    throw new Error(res.data.errors.map((e) => e.message).join(" | "));
  }

  return res.data.data;
}

function hoursBetween(aISO, bISO) {
  const ms = new Date(bISO).getTime() - new Date(aISO).getTime();
  return Math.max(0, Math.round((ms / 3600000) * 100) / 100);
}

function stdDev(values) {
  if (!values.length) return 0;
  const mean = values.reduce((s, x) => s + x, 0) / values.length;
  const variance = values.reduce((s, x) => s + (x - mean) ** 2, 0) / values.length;
  return Math.round(Math.sqrt(variance) * 100) / 100;
}

function normalizeStatus(raw) {
  if (!raw) return "To Do";
  const s = raw.toLowerCase();
  if (s.includes("backlog")) return "Backlog";
  if (s === "todo" || s.includes("to do")) return "To Do";
  if (s.includes("in progress") || s.includes("doing")) return "In Progress";
  if (s.includes("done") || s.includes("complete")) return "Done";
  return "To Do";
}

/* =========================================================
   GitHub Project V2 fetchers
========================================================= */

async function getUserProject(token, ownerLogin, projectNumber) {
  const q = `
    query($login: String!, $number: Int!) {
      user(login: $login) {
        projectV2(number: $number) {
          id
          title
        }
      }
    }
  `;
  const data = await ghQuery(token, q, { login: ownerLogin, number: projectNumber });
  const proj = data?.user?.projectV2;
  if (!proj) throw new Error("Project not found (check owner + projectNumber).");
  return proj;
}

async function getProjectFields(token, projectId) {
  const q = `
    query($projectId: ID!) {
      node(id: $projectId) {
        ... on ProjectV2 {
          fields(first: 50) {
            nodes {
              __typename
              ... on ProjectV2FieldCommon {
                id
                name
              }
            }
          }
        }
      }
    }
  `;

  const data = await ghQuery(token, q, { projectId });
  return data?.node?.fields?.nodes || [];
}

async function getAllProjectItems(token, projectId) {
  const q = `
    query($projectId: ID!) {
      node(id: $projectId) {
        ... on ProjectV2 {
          items(first: 100) {
            nodes {
              id
              createdAt
              updatedAt
              content {
                __typename
                ... on Issue {
                  number
                  title
                  url
                  state
                  createdAt
                  updatedAt
                  closedAt
                  assignees(first: 10) { nodes { login } }
                }
                ... on PullRequest {
                  number
                  title
                  url
                  state
                  createdAt
                  updatedAt
                  closedAt
                  assignees(first: 10) { nodes { login } }
                }
              }
              fieldValues(first: 20) {
                nodes {
                  __typename
                  ... on ProjectV2ItemFieldSingleSelectValue {
                    name
                    field { ... on ProjectV2SingleSelectField { name } }
                  }
                  ... on ProjectV2ItemFieldTextValue {
                    text
                    field { ... on ProjectV2FieldCommon { name } }
                  }
                }
              }
            }
          }
        }
      }
    }
  `;
  const data = await ghQuery(token, q, { projectId });
  return data?.node?.items?.nodes || [];
}

/* =========================================================
   Dashboard builder
========================================================= */

function buildDashboard(projectTitle, teamName, items) {
  const normalized = [];

  for (const item of items) {
    const content = item.content;
    if (!content) continue;

    let rawStatus = null;
    for (const fv of item.fieldValues?.nodes || []) {
      if (fv.__typename === "ProjectV2ItemFieldSingleSelectValue") {
        const fieldName = fv.field?.name || "";
        if (fieldName.toLowerCase() === "status") rawStatus = fv.name;
      }
    }

    const statusCategory = normalizeStatus(rawStatus);
    const assignee = content.assignees?.nodes?.[0]?.login || "Unassigned";

    normalized.push({
      key: `#${content.number}`,
      title: content.title,
      url: content.url,
      assignee,
      status: rawStatus || "To Do",
      statusCategory,
      priority: null,
      createdAt: content.createdAt,
      updatedAt: content.updatedAt,
      completedAt: content.closedAt || null,
    });
  }

  const backlogIssues = normalized.filter((x) => x.statusCategory === "Backlog");
  const boardIssues = normalized.filter((x) => x.statusCategory !== "Backlog");

  const statusCategoryCounts = {};
  const statusCounts = {};
  const memberCounts = {};

  for (const i of boardIssues) {
    statusCategoryCounts[i.statusCategory] = (statusCategoryCounts[i.statusCategory] || 0) + 1;
    statusCounts[i.status] = (statusCounts[i.status] || 0) + 1;
    memberCounts[i.assignee] = (memberCounts[i.assignee] || 0) + 1;
  }

  const issuesByStatusCategory = {};
  for (const i of boardIssues) {
    if (!issuesByStatusCategory[i.statusCategory]) issuesByStatusCategory[i.statusCategory] = [];
    issuesByStatusCategory[i.statusCategory].push(i);
  }

  const now = new Date().toISOString();
  const openIssues = boardIssues.filter((x) => !x.completedAt);
  let longestOpen = null;
  for (const i of openIssues) {
    const ageHours = hoursBetween(i.createdAt, now);
    if (!longestOpen || ageHours > longestOpen.ageHours) longestOpen = { ...i, ageHours };
  }

  // Top members
  const openedByMember = {};
  const todoByMember = {};
  const backlogByMember = {};

  for (const i of boardIssues) {
    if (!i.completedAt) openedByMember[i.assignee] = (openedByMember[i.assignee] || 0) + 1;
    if (i.statusCategory === "To Do") todoByMember[i.assignee] = (todoByMember[i.assignee] || 0) + 1;
  }
  for (const i of backlogIssues) backlogByMember[i.assignee] = (backlogByMember[i.assignee] || 0) + 1;

  const topMember = (map) => {
    let best = null;
    for (const [member, count] of Object.entries(map)) {
      if (!best || count > best.count) best = { member, count };
    }
    return best;
  };

  const topMembers = {
    mostOpened: topMember(openedByMember) || { member: null, count: 0 },
    mostTodo: topMember(todoByMember) || { member: null, count: 0 },
    mostBacklog: topMember(backlogByMember) || { member: null, count: 0 },
  };

  // Time stats
  const completedTimesByMember = {};
  for (const i of boardIssues) {
    if (!i.completedAt) continue;
    const hrs = hoursBetween(i.createdAt, i.completedAt);
    if (!completedTimesByMember[i.assignee]) completedTimesByMember[i.assignee] = [];
    completedTimesByMember[i.assignee].push(hrs);
  }

  const timeStatsByMember = {};
  for (const [member, times] of Object.entries(completedTimesByMember)) {
    const avg = times.reduce((s, x) => s + x, 0) / times.length;
    timeStatsByMember[member] = {
      completedTasks: times.length,
      avgCompletionHours: Math.round(avg * 100) / 100,
      stdDevHours: stdDev(times),
    };
  }

  return {
    success: true,
    teamName,
    projectTitle,
    totals: { boardIssues: boardIssues.length, backlogIssues: backlogIssues.length },
    statusCategoryCounts,
    statusCounts,
    memberCounts,
    backlog: { count: backlogIssues.length, byMember: backlogByMember, issues: backlogIssues },
    longestOpen,
    topMembers,
    timeStatsByMember,
    drilldowns: { issuesByStatusCategory },
  };
}

/* =========================================================
   Routes
========================================================= */

router.get("/test", async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Missing token in query",
      });
    }

    const data = await ghQuery(token, "query { viewer { login } }");

    res.json({ success: true, viewer: data?.viewer?.login });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

router.get("/dashboard", async (req, res) => {
  try {
    const { teamId } = req.query;

    if (!teamId)
      return res.status(400).json({ success: false, message: "Missing teamId" });

    const team = await getTeamWithInstructor(teamId);

    if (!team)
      return res.status(404).json({ success: false, message: "Team not found" });

    if (!team.github?.owner || !team.github?.projectNumber) {
      return res.status(400).json({
        success: false,
        message: "Team missing github.owner or github.projectNumber",
      });
    }

    if (!team.instructor?.githubToken) {
      return res.status(400).json({
        success: false,
        message: "Instructor GitHub token missing",
      });
    }

    const token = team.instructor.githubToken;
    const owner = team.github.owner;
    const projectNumber = Number(team.github.projectNumber);

    const proj = await getUserProject(token, owner, projectNumber);
    const fields = await getProjectFields(token, proj.id);

    const hasStatus = fields.some(
      (f) => (f.name || "").toLowerCase() === "status"
    );

    if (!hasStatus) {
      return res.status(400).json({
        success: false,
        message:
          'Your GitHub Project is missing a field named "Status". Add a single-select field called Status (Backlog/To Do/In Progress/Done).',
      });
    }

    const items = await getAllProjectItems(token, proj.id);
    const dashboard = buildDashboard(proj.title, team.teamName, items);

    res.json(dashboard);
  } catch (e) {
    console.error("GitHub dashboard error:", e);
    res.status(500).json({ success: false, message: e.message });
  }
});

export default router;
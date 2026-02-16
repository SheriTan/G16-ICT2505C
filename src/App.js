import React, { useEffect, useMemo, useState } from "react";
import "./App.css";
import * as XLSX from "xlsx";

const API_BASE = "http://localhost:5000";

export default function App() {
  const [teams, setTeams] = useState([]);
  const [platformFilter, setPlatformFilter] = useState("all"); // all | jira | github
  const [selectedTeamId, setSelectedTeamId] = useState("");

  const [loadingTeams, setLoadingTeams] = useState(false);
  const [loadingDash, setLoadingDash] = useState(false);

  const [dashboard, setDashboard] = useState(null);
  const [error, setError] = useState("");

  // last updated indicator
  const [lastUpdated, setLastUpdated] = useState(null);

  // -----------------------------
  // Add Team form states
  // -----------------------------
  const [newPlatform, setNewPlatform] = useState("jira");
  const [newTeamName, setNewTeamName] = useState("");
  const [newJiraBoardUrl, setNewJiraBoardUrl] = useState("");
  const [newGithubRepoUrl, setNewGithubRepoUrl] = useState("");
  const [newGithubProjectUrl, setNewGithubProjectUrl] = useState("");
  const [savingTeam, setSavingTeam] = useState(false);

  // -----------------------------
  // Excel import states
  // -----------------------------
  const [importFile, setImportFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  // -----------------------------
  // Helpers
  // -----------------------------
  async function refreshTeams() {
    const res = await fetch(`${API_BASE}/api/teams`);
    const data = await res.json();
    if (!data?.success) throw new Error(data?.message || "Failed to load teams");

    const arr = data.teams || [];
    setTeams(arr);

    if (arr.length > 0 && !arr.some((t) => t.id === selectedTeamId)) {
      setSelectedTeamId(arr[0].id);
    }
    if (arr.length > 0 && !selectedTeamId) {
      setSelectedTeamId(arr[0].id);
    }
  }

  async function addTeam() {
    try {
      setSavingTeam(true);
      setError("");

      const payload =
        newPlatform === "jira"
          ? {
              platform: "jira",
              teamName: newTeamName,
              jiraBoardUrl: newJiraBoardUrl,
            }
          : {
              platform: "github",
              teamName: newTeamName,
              githubRepoUrl: newGithubRepoUrl,
              githubProjectUrl: newGithubProjectUrl,
            };

      const res = await fetch(`${API_BASE}/api/teams`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!data?.success) throw new Error(data?.message || "Failed to add team");

      // Clear form
      setNewTeamName("");
      setNewJiraBoardUrl("");
      setNewGithubRepoUrl("");
      setNewGithubProjectUrl("");

      await refreshTeams();
    } catch (e) {
      setError(e.message);
    } finally {
      setSavingTeam(false);
    }
  }

  async function deleteSelectedTeam() {
    try {
      if (!selectedTeamId) return;
      setError("");

      const res = await fetch(
        `${API_BASE}/api/teams/${encodeURIComponent(selectedTeamId)}`,
        { method: "DELETE" }
      );
      const data = await res.json();
      if (!data?.success) throw new Error(data?.message || "Failed to delete team");

      await refreshTeams();
    } catch (e) {
      setError(e.message);
    }
  }

  // -----------------------------
  // Excel import helpers
  // -----------------------------
  function norm(v) {
    if (v === null || v === undefined) return "";
    return String(v).trim();
  }

  // Download an Excel template for instructors/students
  function downloadExcelTemplate() {
    // You can include one example row or keep them blank.
    const rows = [
      {
        platform: "jira",
        teamName: "Team 1",
        jiraBoardUrl: "https://sit-workspace.atlassian.net/jira/software/projects/K1/boards/67",
        githubRepoUrl: "",
        githubProjectUrl: "",
      },
      {
        platform: "github",
        teamName: "Team 2",
        jiraBoardUrl: "",
        githubRepoUrl: "https://github.com/<owner>/<repo>",
        githubProjectUrl: "https://github.com/users/<owner>/projects/1",
      },
    ];

    const ws = XLSX.utils.json_to_sheet(rows, {
      header: [
        "platform",
        "teamName",
        "jiraBoardUrl",
        "githubRepoUrl",
        "githubProjectUrl",
      ],
    });

    // Make columns a bit wider
    ws["!cols"] = [
      { wch: 10 }, // platform
      { wch: 22 }, // teamName
      { wch: 60 }, // jiraBoardUrl
      { wch: 45 }, // githubRepoUrl
      { wch: 50 }, // githubProjectUrl
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Teams");

    const arrayBuf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([arrayBuf], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "teams_import_template.xlsx";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function importTeamsFromExcel() {
    try {
      if (!importFile) return;

      setImporting(true);
      setError("");
      setImportResult(null);

      const buffer = await importFile.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];

      const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
      if (!rows.length) throw new Error("Excel file has no data rows.");

      // Map rows to API payload
      const teamsPayload = rows.map((r) => {
        // Support only your recommended headers (but tolerate capitalization)
        const platform = norm(r.platform || r.Platform).toLowerCase();
        const teamName = norm(r.teamName || r.TeamName);

        const jiraBoardUrl = norm(r.jiraBoardUrl || r.JiraBoardUrl);
        const githubRepoUrl = norm(r.githubRepoUrl || r.GithubRepoUrl);
        const githubProjectUrl = norm(r.githubProjectUrl || r.GithubProjectUrl);

        return {
          platform: platform || undefined,
          teamName: teamName || undefined,
          jiraBoardUrl: jiraBoardUrl || undefined,
          githubRepoUrl: githubRepoUrl || undefined,
          githubProjectUrl: githubProjectUrl || undefined,
        };
      });

      const res = await fetch(`${API_BASE}/api/teams/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teams: teamsPayload }),
      });

      const data = await res.json();
      if (!data?.success) throw new Error(data?.message || "Bulk import failed");

      setImportResult(data);
      await refreshTeams();
    } catch (e) {
      setError(e.message);
    } finally {
      setImporting(false);
      setImportFile(null);
    }
  }

  // -----------------------------
  // 1) Load teams
  // -----------------------------
  useEffect(() => {
    async function loadTeams() {
      try {
        setLoadingTeams(true);
        setError("");
        await refreshTeams();
      } catch (e) {
        setError(e.message);
      } finally {
        setLoadingTeams(false);
      }
    }
    loadTeams();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -----------------------------
  // 2) Filter teams by toggle
  // -----------------------------
  const filteredTeams = useMemo(() => {
    if (platformFilter === "all") return teams;
    if (platformFilter === "jira") return teams.filter((t) => !t.github);
    if (platformFilter === "github") return teams.filter((t) => !!t.github);
    return teams;
  }, [teams, platformFilter]);

  // If chosen team disappears after filtering, auto-select first valid
  useEffect(() => {
    if (!filteredTeams.length) return;
    const exists = filteredTeams.some((t) => t.id === selectedTeamId);
    if (!exists) setSelectedTeamId(filteredTeams[0].id);
  }, [filteredTeams, selectedTeamId]);

  const selectedTeam = useMemo(
    () => teams.find((t) => t.id === selectedTeamId) || null,
    [teams, selectedTeamId]
  );

  // -----------------------------
  // 3) Decide which dashboard API to call
  // -----------------------------
  function getDashboardUrl(team) {
    if (!team) return null;

    if (team.github) {
      return `${API_BASE}/api/github/dashboard?teamId=${encodeURIComponent(team.id)}`;
    }

    return `${API_BASE}/api/jira/dashboard?teamId=${encodeURIComponent(team.id)}`;
  }

  // ======================================================
  // 4) Load dashboard + AUTO-REFRESH (silent polling)
  //    - No “Updating…” text
  //    - No hiding dashboard every refresh
  //    - Shows “Loading dashboard…” only on first load
  // ======================================================
  useEffect(() => {
    let cancelled = false;
    let intervalId = null;
    let abortCtrl = null;

    async function loadDashboard({ silent = false } = {}) {
      try {
        if (!selectedTeam) return;

        // Abort previous fetch if still running
        if (abortCtrl) abortCtrl.abort();
        abortCtrl = new AbortController();

        // Only show big loading on first load (no dashboard yet)
        if (!silent && !dashboard) setLoadingDash(true);

        const url = getDashboardUrl(selectedTeam);
        if (!url) throw new Error("Selected team is missing configuration.");

        const res = await fetch(url, { signal: abortCtrl.signal });
        const data = await res.json();

        if (!data?.success) throw new Error(data?.message || "Dashboard request failed");

        if (!cancelled) {
          setDashboard(data);
          setLastUpdated(new Date());
        }
      } catch (e) {
        if (e.name === "AbortError") return;
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoadingDash(false);
      }
    }

    // Initial load (not silent)
    loadDashboard({ silent: false });

    // Silent auto-refresh every 10 seconds (change to 15000/30000 if you want)
    intervalId = setInterval(() => {
      loadDashboard({ silent: true });
    }, 10000);

    return () => {
      cancelled = true;
      if (abortCtrl) abortCtrl.abort();
      if (intervalId) clearInterval(intervalId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTeamId, selectedTeam]);

  // -----------------------------
  // 5) Normalize fields (Jira/GitHub differ slightly)
  // -----------------------------
  const statusSummary =
    dashboard?.statusCategoryCounts ||
    dashboard?.statusCounts ||
    dashboard?.statusSummary ||
    {};

  const memberCounts = dashboard?.memberCounts || dashboard?.workloadByMember || {};

  const backlogBlock = dashboard?.backlog || null;
  const topMembers = dashboard?.topMembers || null;
  const longestOpen = dashboard?.longestOpen || dashboard?.longestOpenTask || null;

  const issuesByStatusCategory =
    dashboard?.drilldowns?.issuesByStatusCategory ||
    dashboard?.issuesByStatusCategory ||
    null;

  return (
    <div className="App" style={{ maxWidth: 980, margin: "0 auto", padding: 20 }}>
      <h1 style={{ textAlign: "center" }}>KABAS Dashboard</h1>

      {lastUpdated && (
        <div style={{ textAlign: "center", fontSize: 12, opacity: 0.7 }}>
          Last updated: {lastUpdated.toLocaleTimeString()}
        </div>
      )}

      {/* Bulk Import Teams (Excel/CSV) */}
      <div
        style={{
          border: "1px solid #444",
          borderRadius: 10,
          padding: 12,
          marginBottom: 16,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <h2 style={{ marginTop: 0, marginBottom: 0 }}>Bulk Import Teams (Excel / CSV)</h2>

          <button
            onClick={downloadExcelTemplate}
            style={{ padding: "10px 12px", borderRadius: 8, cursor: "pointer" }}
          >
            Download Excel Template
          </button>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 10 }}>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(e) => setImportFile(e.target.files?.[0] || null)}
          />

          <button
            onClick={importTeamsFromExcel}
            disabled={!importFile || importing}
            style={{ padding: "10px 12px", borderRadius: 8, cursor: "pointer" }}
          >
            {importing ? "Importing..." : "Import File"}
          </button>
        </div>

        <div style={{ marginTop: 10, fontSize: 12, opacity: 0.85 }}>
          Required headers:{" "}
          <code>platform</code>, <code>teamName</code>,{" "}
          <code>jiraBoardUrl</code>, <code>githubRepoUrl</code>, <code>githubProjectUrl</code>.
          <br />
          Rules: Jira requires <code>jiraBoardUrl</code>. GitHub requires <code>githubRepoUrl</code> +{" "}
          <code>githubProjectUrl</code>.
        </div>

        {importResult && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontWeight: "bold" }}>{importResult.message}</div>

            {Array.isArray(importResult.results) && importResult.results.some((r) => !r.success) && (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontWeight: "bold" }}>Failed rows (first 8):</div>
                <ul>
                  {importResult.results
                    .filter((r) => !r.success)
                    .slice(0, 8)
                    .map((r, idx) => (
                      <li key={idx}>
                        Row {r.row}: {r.message}
                      </li>
                    ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add Team block */}
      <div
        style={{
          border: "1px solid #444",
          borderRadius: 10,
          padding: 12,
          marginBottom: 16,
        }}
      >
        <h2 style={{ marginTop: 0 }}>Add Team</h2>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <label>
            <strong>Platform:</strong>{" "}
            <select
              value={newPlatform}
              onChange={(e) => setNewPlatform(e.target.value)}
              style={{ padding: 6 }}
            >
              <option value="jira">Jira</option>
              <option value="github">GitHub</option>
            </select>
          </label>

          <label style={{ flex: "1 1 320px" }}>
            <strong>Team Name:</strong>
            <input
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.target.value)}
              placeholder="e.g., Team 3 - Kanban 1"
              style={{ width: "100%", padding: 8, marginTop: 6 }}
            />
          </label>

          {newPlatform === "jira" ? (
            <label style={{ flex: "1 1 520px" }}>
              <strong>Jira Board URL:</strong>
              <input
                value={newJiraBoardUrl}
                onChange={(e) => setNewJiraBoardUrl(e.target.value)}
                placeholder="https://.../jira/software/projects/K1/boards/67"
                style={{ width: "100%", padding: 8, marginTop: 6 }}
              />
            </label>
          ) : (
            <>
              <label style={{ flex: "1 1 520px" }}>
                <strong>GitHub Repo URL:</strong>
                <input
                  value={newGithubRepoUrl}
                  onChange={(e) => setNewGithubRepoUrl(e.target.value)}
                  placeholder="https://github.com/<owner>/<repo>"
                  style={{ width: "100%", padding: 8, marginTop: 6 }}
                />
              </label>

              <label style={{ flex: "1 1 520px" }}>
                <strong>GitHub Project URL:</strong>
                <input
                  value={newGithubProjectUrl}
                  onChange={(e) => setNewGithubProjectUrl(e.target.value)}
                  placeholder="https://github.com/users/<owner>/projects/1"
                  style={{ width: "100%", padding: 8, marginTop: 6 }}
                />
              </label>
            </>
          )}
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
          <button
            onClick={addTeam}
            disabled={savingTeam}
            style={{ padding: "10px 12px", borderRadius: 8, cursor: "pointer" }}
          >
            {savingTeam ? "Saving..." : "Add Team"}
          </button>

          <button
            onClick={deleteSelectedTeam}
            disabled={!selectedTeamId}
            style={{ padding: "10px 12px", borderRadius: 8, cursor: "pointer" }}
          >
            Delete Selected Team
          </button>
        </div>

        <div style={{ marginTop: 8, fontSize: 12, opacity: 0.85 }}>
          Note: If the lecturer’s token is used, teams must add the lecturer as collaborator in Jira/GitHub to allow API access.
        </div>
      </div>

      {/* Platform Toggle */}
      <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 10 }}>
        <strong>Platform:</strong>

        <label>
          <input
            type="radio"
            name="platform"
            checked={platformFilter === "all"}
            onChange={() => setPlatformFilter("all")}
          />{" "}
          All
        </label>

        <label>
          <input
            type="radio"
            name="platform"
            checked={platformFilter === "jira"}
            onChange={() => setPlatformFilter("jira")}
          />{" "}
          Jira
        </label>

        <label>
          <input
            type="radio"
            name="platform"
            checked={platformFilter === "github"}
            onChange={() => setPlatformFilter("github")}
          />{" "}
          GitHub
        </label>
      </div>

      {/* Team selector */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14 }}>
        <strong>Select Team:</strong>
        {loadingTeams ? (
          <span>Loading teams...</span>
        ) : (
          <select
            value={selectedTeamId}
            onChange={(e) => setSelectedTeamId(e.target.value)}
            style={{ padding: 6, minWidth: 360 }}
          >
            {filteredTeams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.teamName}
              </option>
            ))}
          </select>
        )}
      </div>

      {selectedTeam && (
        <div style={{ textAlign: "center", marginBottom: 10 }}>
          <div>
            <strong>Team:</strong> {selectedTeam.teamName}
          </div>
          <div>
            <strong>Source:</strong> {selectedTeam.github ? "GitHub" : "Jira"}
          </div>
        </div>
      )}

      <hr />

      {/* Errors */}
      {error && (
        <div
          style={{
            padding: 10,
            background: "#3b1a1a",
            border: "1px solid #7a2b2b",
            marginBottom: 12,
            borderRadius: 6,
          }}
        >
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Only show big loading message if NO dashboard yet */}
      {!dashboard && loadingDash && <div>Loading dashboard...</div>}

      {/* Keep dashboard visible even while silently refreshing */}
      {dashboard && (
        <>
          {/* Status Summary */}
          <h2 style={{ textAlign: "center" }}>Status Summary (On Board)</h2>
          {Object.keys(statusSummary).length ? (
            <ul style={{ maxWidth: 380, margin: "0 auto" }}>
              {Object.entries(statusSummary).map(([k, v]) => (
                <li key={k}>
                  {k}: {v}
                </li>
              ))}
            </ul>
          ) : (
            <div style={{ textAlign: "center" }}>No status summary available.</div>
          )}

          <hr />

          {/* Workload */}
          <h2 style={{ textAlign: "center" }}>Workload by Member (On Board)</h2>
          {Object.keys(memberCounts).length ? (
            <ul style={{ maxWidth: 420, margin: "0 auto" }}>
              {Object.entries(memberCounts).map(([k, v]) => (
                <li key={k}>
                  {k}: {v} tasks
                </li>
              ))}
            </ul>
          ) : (
            <div style={{ textAlign: "center" }}>No workload data.</div>
          )}

          <hr />

          {/* Top Members */}
          {topMembers && (
            <>
              <h2 style={{ textAlign: "center" }}>Most Tasks (Top Members)</h2>
              <ul style={{ maxWidth: 560, margin: "0 auto" }}>
                {topMembers.mostOpened && (
                  <li>
                    Most Opened (not completed): {topMembers.mostOpened.member} (
                    {topMembers.mostOpened.count})
                  </li>
                )}
                {topMembers.mostTodo && (
                  <li>
                    Most To-Do: {topMembers.mostTodo.member} ({topMembers.mostTodo.count})
                  </li>
                )}
                {topMembers.mostBacklog && (
                  <li>
                    Most Backlog: {topMembers.mostBacklog.member} (
                    {topMembers.mostBacklog.count})
                  </li>
                )}
              </ul>
              <hr />
            </>
          )}

          {/* Backlog block */}
          {dashboard?.backlog && (
            <>
              <h2 style={{ textAlign: "center" }}>Backlog (Off Board)</h2>
              <div style={{ textAlign: "center" }}>Count: {dashboard.backlog.count ?? 0}</div>

              {dashboard.backlog.byMember && (
                <>
                  <h3 style={{ textAlign: "center", marginTop: 10 }}>Backlog by Member</h3>
                  <ul style={{ maxWidth: 420, margin: "0 auto" }}>
                    {Object.entries(dashboard.backlog.byMember).map(([k, v]) => (
                      <li key={k}>
                        {k}: {v}
                      </li>
                    ))}
                  </ul>
                </>
              )}

              <hr />
            </>
          )}

          {/* Longest Open */}
          <h2 style={{ textAlign: "center" }}>Longest Open Task</h2>
          {longestOpen ? (
            <div
              style={{
                border: "1px solid #444",
                padding: 12,
                borderRadius: 8,
                maxWidth: 720,
                margin: "0 auto",
              }}
            >
              <div>
                <strong>Key:</strong> {longestOpen.key}
              </div>
              <div>
                <strong>Title:</strong> {longestOpen.title}
              </div>
              <div>
                <strong>Status:</strong> {longestOpen.status}
              </div>
              {typeof longestOpen.ageHours !== "undefined" && (
                <div>
                  <strong>Age (hours):</strong> {Number(longestOpen.ageHours).toFixed(2)}
                </div>
              )}
              {longestOpen.url && (
                <div style={{ marginTop: 6 }}>
                  <a href={longestOpen.url} target="_blank" rel="noreferrer">
                    Open link
                  </a>
                </div>
              )}
            </div>
          ) : (
            <div style={{ textAlign: "center" }}>No open task found.</div>
          )}

          <hr />

          {/* Issues by status - expandable with details */}
          {issuesByStatusCategory && (
            <>
              <h2 style={{ textAlign: "center" }}>Issues by Status</h2>
              <div style={{ textAlign: "center", fontSize: 13, opacity: 0.85 }}>
                Click each status to expand and see issue details (priority, assignee, dates, link).
              </div>

              <div style={{ maxWidth: 920, margin: "12px auto" }}>
                {Object.entries(issuesByStatusCategory).map(([status, list]) => (
                  <StatusPanel key={status} status={status} items={list || []} />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

// ------------------------------------------------------
// Expandable status panel that shows full issue details
// ------------------------------------------------------
function StatusPanel({ status, items }) {
  const [open, setOpen] = React.useState(false);

  return (
    <div style={{ marginBottom: 14 }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          cursor: "pointer",
          padding: "10px 12px",
          border: "1px solid #444",
          borderRadius: 8,
          background: "transparent",
          fontWeight: "bold",
          width: "100%",
          textAlign: "left",
        }}
      >
        {open ? "▼" : "▶"} {status} ({items.length})
      </button>

      {open && (
        <div
          style={{
            border: "1px solid #333",
            borderTop: "none",
            padding: 12,
            borderRadius: "0 0 8px 8px",
          }}
        >
          {items.length === 0 ? (
            <div>No items.</div>
          ) : (
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {items.map((it) => (
                <li key={it.key} style={{ marginBottom: 12 }}>
                  <div style={{ marginBottom: 2 }}>
                    <strong>[{it.key}]</strong> {it.title}
                  </div>

                  <div style={{ fontSize: 13, opacity: 0.9, lineHeight: 1.5 }}>
                    <div>
                      <strong>Assignee:</strong> {it.assignee || "Unassigned"}
                    </div>
                    <div>
                      <strong>Priority:</strong> {it.priority || "-"}
                    </div>
                    <div>
                      <strong>Status:</strong> {it.status || status}
                    </div>

                    {it.createdAt && (
                      <div>
                        <strong>Created:</strong> {it.createdAt}
                      </div>
                    )}
                    {it.updatedAt && (
                      <div>
                        <strong>Updated:</strong> {it.updatedAt}
                      </div>
                    )}
                    {it.completedAt && (
                      <div>
                        <strong>Completed:</strong> {it.completedAt}
                      </div>
                    )}
                  </div>

                  {it.url && (
                    <div style={{ marginTop: 4 }}>
                      <a href={it.url} target="_blank" rel="noreferrer">
                        Open issue
                      </a>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

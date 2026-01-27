import { useEffect, useMemo, useState } from "react";
import "./App.css";

function prettyHours(x) {
  if (x === null || x === undefined) return "-";
  return `${x}h`;
}

function Drilldown({ title, items, onClose }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        zIndex: 9999,
      }}
    >
      <div
        style={{
          background: "white",
          width: "min(900px, 95vw)",
          maxHeight: "85vh",
          overflow: "auto",
          borderRadius: 8,
          padding: 16,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ margin: 0 }}>{title}</h2>
          <button onClick={onClose}>Close</button>
        </div>

        <div style={{ marginTop: 12 }}>
          {!items || items.length === 0 ? (
            <p>No items</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Key", "Title", "Assignee", "Status", "Priority", "Created", "Completed"].map(
                    (h) => (
                      <th
                        key={h}
                        style={{
                          textAlign: "left",
                          borderBottom: "1px solid #ddd",
                          padding: "8px 6px",
                        }}
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.key}>
                    <td style={{ padding: "8px 6px", borderBottom: "1px solid #f0f0f0" }}>
                      {i.key}
                    </td>
                    <td style={{ padding: "8px 6px", borderBottom: "1px solid #f0f0f0" }}>
                      {i.title}
                    </td>
                    <td style={{ padding: "8px 6px", borderBottom: "1px solid #f0f0f0" }}>
                      {i.assignee}
                    </td>
                    <td style={{ padding: "8px 6px", borderBottom: "1px solid #f0f0f0" }}>
                      {i.status}
                    </td>
                    <td style={{ padding: "8px 6px", borderBottom: "1px solid #f0f0f0" }}>
                      {i.priority || "-"}
                    </td>
                    <td style={{ padding: "8px 6px", borderBottom: "1px solid #f0f0f0" }}>
                      {i.createdAt}
                    </td>
                    <td style={{ padding: "8px 6px", borderBottom: "1px solid #f0f0f0" }}>
                      {i.completedAt || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function App() {
  const [teams, setTeams] = useState([]);
  const [selectedTeamId, setSelectedTeamId] = useState("team1");

  const [data, setData] = useState(null);
  const [loadingTeams, setLoadingTeams] = useState(true);
  const [loadingDash, setLoadingDash] = useState(true);
  const [error, setError] = useState("");

  const [drill, setDrill] = useState(null); // { title, items }

  // Load team list
  useEffect(() => {
    fetch("http://localhost:5000/api/teams")
      .then((res) => res.json())
      .then((result) => {
        if (!result.success) throw new Error("Failed to load teams");
        setTeams(result.teams || []);
        // auto-select first team if team1 not found
        const hasTeam1 = (result.teams || []).some((t) => t.id === "team1");
        if (!hasTeam1 && (result.teams || []).length > 0) {
          setSelectedTeamId(result.teams[0].id);
        }
        setLoadingTeams(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoadingTeams(false);
      });
  }, []);

  // Load dashboard when team changes
  useEffect(() => {
    if (!selectedTeamId) return;

    setLoadingDash(true);
    setError("");

    fetch(`http://localhost:5000/api/jira/dashboard?teamId=${selectedTeamId}`)
      .then((res) => res.json())
      .then((result) => {
        if (!result.success) throw new Error(result.message || "Failed to load dashboard");
        setData(result);
        setLoadingDash(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoadingDash(false);
      });
  }, [selectedTeamId]);

  // Derived display values
  const teamName = data?.team?.teamName || "Unknown Team";
  const boardName = data?.project?.name || "Unknown Board";

  // BOARD ONLY summaries
  const statusCategoryCounts = data?.statusCategoryCounts || {};
  const memberCounts = data?.memberCounts || {};
  const longestOpen = data?.longestOpen || null;

  // Backlog (OFF BOARD)
  const backlog = data?.backlog || { count: 0, byMember: {}, issues: [] };

  // Analysis
  const top = data?.topMembers || {};
  const timeStats = data?.timeStatsByMember || {};
  const latestSample = data?.latestSampleByMember || {};

  // Drilldowns (board-only)
  const drilldowns = data?.drilldowns || {};

  const sortedMembers = useMemo(() => {
    return Object.keys(memberCounts).sort(
      (a, b) => (memberCounts[b] || 0) - (memberCounts[a] || 0)
    );
  }, [memberCounts]);

  if (loadingTeams) return <h2 style={{ padding: 20 }}>Loading teams...</h2>;
  if (error) return <h2 style={{ padding: 20 }}>Error: {error}</h2>;

  return (
    <div style={{ padding: "24px", fontFamily: "Arial" }}>
      <h1 style={{ marginTop: 0 }}>KABAS Dashboard</h1>

      {/* Team selector */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontWeight: "bold", marginRight: 10 }}>Select Team:</label>
        <select value={selectedTeamId} onChange={(e) => setSelectedTeamId(e.target.value)}>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.teamName}
            </option>
          ))}
        </select>
      </div>

      {loadingDash ? (
        <h2>Loading dashboard...</h2>
      ) : (
        <>
          <h3 style={{ margin: "6px 0" }}>Team: {teamName}</h3>
          <h3 style={{ margin: "6px 0" }}>Board: {boardName}</h3>

          <hr />

          {/* STATUS SUMMARY (ON BOARD ONLY) */}
          <h2>Status Summary (On Board)</h2>
          <p style={{ marginTop: 0, color: "#555" }}>
            “To Do / In Progress / Done” are Jira status categories (works even if teams customize
            status names). This section excludes backlog-tab items.
          </p>

          <ul>
            {Object.entries(statusCategoryCounts).map(([k, v]) => (
              <li key={k}>
                <button
                  style={{ cursor: "pointer" }}
                  onClick={() =>
                    setDrill({
                      title: `On Board — Status Category: ${k}`,
                      items: drilldowns.issuesByStatusCategory?.[k] || [],
                    })
                  }
                >
                  <b>{k}</b>: {v}
                </button>
              </li>
            ))}
          </ul>

          <hr />

          {/* BACKLOG (OFF BOARD ONLY) */}
          <h2>Backlog (Off Board)</h2>
          <p style={{ marginTop: 0, color: "#555" }}>
            These are items from Jira’s <b>Backlog tab</b>. They are shown separately from the board
            status counts.
          </p>

          <div style={{ marginBottom: 10 }}>
            <button
              style={{ cursor: "pointer" }}
              onClick={() => setDrill({ title: "Backlog items (Off Board)", items: backlog.issues })}
            >
              <b>Total Backlog:</b> {backlog.count}
            </button>
          </div>

          <h3>Backlog by Member</h3>
          {Object.keys(backlog.byMember || {}).length === 0 ? (
            <p>No backlog items or not supported for this team (needs boardId).</p>
          ) : (
            <ul>
              {Object.entries(backlog.byMember || {}).map(([member, count]) => (
                <li key={member}>
                  {member}: {count}
                </li>
              ))}
            </ul>
          )}

          <hr />

          <h2>Workload by Member (On Board)</h2>
          <ul>
            {sortedMembers.map((m) => (
              <li key={m}>
                <button
                  style={{ cursor: "pointer" }}
                  onClick={() =>
                    setDrill({
                      title: `On Board — Assignee: ${m}`,
                      items: drilldowns.issuesByAssignee?.[m] || [],
                    })
                  }
                >
                  {m}: {memberCounts[m]} tasks
                </button>
              </li>
            ))}
          </ul>

          <hr />

          <h2>Most Tasks (Top Members)</h2>
          <ul>
            <li>
              Most Opened (not completed): <b>{top?.mostOpened?.member || "-"}</b> (
              {top?.mostOpened?.count || 0})
            </li>
            <li>
              Most To-Do (status category = To Do): <b>{top?.mostTodo?.member || "-"}</b> (
              {top?.mostTodo?.count || 0})
            </li>
            <li>
              Most Backlog (from backlog tab): <b>{top?.mostBacklog?.member || "-"}</b> (
              {top?.mostBacklog?.count || 0})
            </li>
          </ul>

          <hr />

          <h2>Longest Open Task (On Board)</h2>
          {longestOpen ? (
            <div style={{ border: "1px solid #ccc", padding: 12, borderRadius: 6 }}>
              <p>
                <b>Key:</b> {longestOpen.key}
              </p>
              <p>
                <b>Title:</b> {longestOpen.title}
              </p>
              <p>
                <b>Status:</b> {longestOpen.status} ({longestOpen.statusCategory})
              </p>
              <p>
                <b>Owner:</b> {longestOpen.assignee}
              </p>
              <p>
                <b>Age:</b> {prettyHours(longestOpen.ageHours)}
              </p>

              <button onClick={() => setDrill({ title: "Longest Open Task (details)", items: [longestOpen] })}>
                View details
              </button>
            </div>
          ) : (
            <p>No open tasks 🎉</p>
          )}

          <hr />

          <h2>Completion Time (Avg + Std Dev) per Member</h2>
          {Object.keys(timeStats).length === 0 ? (
            <p>No completed tasks yet (need Done tasks with completion time).</p>
          ) : (
            <ul>
              {Object.entries(timeStats).map(([m, s]) => (
                <li key={m}>
                  <b>{m}</b> — Completed: {s.completedTasks}, Avg: {prettyHours(s.avgCompletionHours)}, StdDev:{" "}
                  {prettyHours(s.stdDevHours)}
                </li>
              ))}
            </ul>
          )}

          <hr />

          <h2>Efficiency</h2>
          <div style={{ border: "1px solid #ddd", padding: 12, borderRadius: 6 }}>
            <p style={{ marginTop: 0 }}>
              <b>Efficiency score:</b> {data?.efficiency?.efficiencyScore} (smaller is better)
            </p>
            <p style={{ margin: 0, color: "#555" }}>
              Avg time per task: {prettyHours(data?.efficiency?.avgTimePerTaskHours)} • Project duration:{" "}
              {prettyHours(data?.efficiency?.projectDurationHours)}
            </p>
            <p style={{ margin: 0, color: "#777", fontSize: 12 }}>
              {data?.efficiency?.note}
            </p>
          </div>

          <hr />

          <h2>Latest Sample per Member (On Board)</h2>
          <p style={{ marginTop: 0, color: "#555" }}>
            For each member: show latest opened issue; if none, show latest completed issue.
          </p>
          <ul>
            {Object.entries(latestSample).map(([m, issue]) => (
              <li key={m}>
                <b>{m}</b>: [{issue.key}] {issue.title} — {issue.status}
              </li>
            ))}
          </ul>
        </>
      )}

      {drill && <Drilldown title={drill.title} items={drill.items} onClose={() => setDrill(null)} />}
    </div>
  );
}

export default App;

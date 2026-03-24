import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";

export default function Team({ api = '', teams = [] }) {
    const { id } = useParams();
    const [dashboard, setDashboard] = useState(null);
    const [loadingDash, setLoadingDash] = useState(false);
    const [lastUpdated, setLastUpdated] = useState(null);

    const selectedTeam = teams?.find(t => String(t.id) === String(id));

    // Dashboard Statistics Data Handling
    const statusSummary =
        dashboard?.statusCategoryCounts ||
        dashboard?.statusCounts ||
        dashboard?.statusSummary ||
        {};

    const memberCounts =
        dashboard?.memberCounts ||
        dashboard?.workloadByMember ||
        {};

    const topMembers = dashboard?.topMembers || null;

    const longestOpen = dashboard?.longestOpen || dashboard?.longestOpenTask || null;

    const issuesByStatusCategory =
        dashboard?.drilldowns?.issuesByStatusCategory ||
        dashboard?.issuesByStatusCategory ||
        null;

    function getDashboardUrl(team) {
        if (!team) return null;

        if (team.github) {
            return `${api}/api/github/dashboard?teamId=${encodeURIComponent(team.id)}`;
        }

        return `${api}/api/jira/dashboard?teamId=${encodeURIComponent(team.id)}`;
    }

    function StatusPanel({ status, items }) {
        const [open, setOpen] = useState(false);

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

    useEffect(() => {
        let intervalId;
        let abortCtrl = new AbortController();

        async function loadDashboard({ silent = false } = {}) {
            try {
                if (!selectedTeam) return;

                if (!silent && !dashboard) setLoadingDash(true);

                const url = getDashboardUrl(selectedTeam);
                const res = await fetch(url, { signal: abortCtrl.signal });
                const data = await res.json();

                if (data.success) {
                    setDashboard(data);
                    setLastUpdated(new Date());
                }
            } catch (e) {
                if (e.name !== "AbortError") {
                    console.error(e);
                }
            } finally {
                setLoadingDash(false);
            }
        }

        loadDashboard();

        intervalId = setInterval(() => {
            loadDashboard({ silent: true });
        }, 10000);

        return () => {
            abortCtrl.abort();
            clearInterval(intervalId);
        };
    }, [id, selectedTeam]);

    if (!teams || teams.length === 0) {
        return <div>Loading teams...</div>;
    }

    if (!selectedTeam) {
        return <div>Team not found</div>;
    }

    return (
    <div>
        <h1>{selectedTeam.teamName} Dashboard</h1>

        {lastUpdated && (
            <div>Last updated: {lastUpdated.toLocaleTimeString()}</div>
        )}

        {!dashboard && loadingDash && <div>Loading dashboard...</div>}

        {dashboard && (
            <div>
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
                                    Most Opened: {topMembers.mostOpened.member} ({topMembers.mostOpened.count})
                                </li>
                            )}
                            {topMembers.mostTodo && (
                                <li>
                                    Most To-Do: {topMembers.mostTodo.member} ({topMembers.mostTodo.count})
                                </li>
                            )}
                            {topMembers.mostBacklog && (
                                <li>
                                    Most Backlog: {topMembers.mostBacklog.member} ({topMembers.mostBacklog.count})
                                </li>
                            )}
                        </ul>
                        <hr />
                    </>
                )}

                {/* Backlog */}
                {dashboard?.backlog && (
                    <>
                        <h2 style={{ textAlign: "center" }}>Backlog (Off Board)</h2>
                        <div style={{ textAlign: "center" }}>
                            Count: {dashboard.backlog.count ?? 0}
                        </div>

                        {dashboard.backlog.byMember && (
                            <>
                                <h3 style={{ textAlign: "center" }}>Backlog by Member</h3>
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
                    <div style={{ border: "1px solid #444", padding: 12, borderRadius: 8 }}>
                        <div><strong>{longestOpen.key}</strong> {longestOpen.title}</div>
                        <div>Status: {longestOpen.status}</div>
                    </div>
                ) : (
                    <div style={{ textAlign: "center" }}>No open task found.</div>
                )}

                <hr />

                {/* Issues */}
                {issuesByStatusCategory && (
                    <>
                        <h2 style={{ textAlign: "center" }}>Issues by Status</h2>

                        <div style={{ maxWidth: 920, margin: "12px auto" }}>
                            {Object.entries(issuesByStatusCategory).map(([status, list]) => (
                                <StatusPanel key={status} status={status} items={list || []} />
                            ))}
                        </div>
                    </>
                )}
            </div>
        )}
    </div>
);}
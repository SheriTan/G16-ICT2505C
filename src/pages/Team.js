import { useEffect, useState, useMemo } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import { TbEdit } from "react-icons/tb";
import { MdDelete } from "react-icons/md";
import "../Team.css";
import "./Team.page.css";

// ── Status colours for Kanban columns ───────────────────────────────────────
const STATUS_COLORS = {
  "Backlog":     { bg: "#f0f0f8", border: "#9090c0", badge: "#6060a0" },
  "To Do":       { bg: "#fff8e6", border: "#e0b040", badge: "#b07800" },
  "In Progress": { bg: "#e8f4ff", border: "#3090e0", badge: "#1060b0" },
  "Done":        { bg: "#e6f8ee", border: "#30b860", badge: "#107830" },
};
const KANBAN_COLS = ["Backlog", "To Do", "In Progress", "Done"];

export default function Team() {
    const [dashboard,    setDashboard]    = useState(null);
    const [loadingDash,  setLoadingDash]  = useState(false);
    const [lastUpdated,  setLastUpdated]  = useState(null);
    const [error,        setError]        = useState('');
    const [modalError,   setModalError]   = useState('');
    const [showEditModal,  setShowEditModal]  = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false); // replaces window.confirm
    const [deleteGradeId,  setDeleteGradeId]  = useState(null);   // gid pending grade delete

    // Tab: "dashboard" | "kanban" | "grades"
    const [activeTab, setActiveTab] = useState("dashboard");

    // Grade state
    const [grades,        setGrades]        = useState([]);
    const [gradeLoading,  setGradeLoading]  = useState(false);
    const [gradeError,    setGradeError]    = useState('');
    const [gradeForm,     setGradeForm]     = useState({ gradeComp: '', gradeScore: '' });
    const [editingGrade,  setEditingGrade]  = useState(null); // gid being edited

    const [editTeam, setEditTeam] = useState({
        teamName:'', platform:'', jiraBoardUrl:'', githubRepoUrl:'', githubProjectUrl:''
    });

    const { api, teams, setTeams, selectedTeamID, setSelectedTeamID, refreshTeams } = useOutletContext();
    const navigate = useNavigate();

    const selectedTeam = useMemo(
        () => teams?.find(t => String(t.id) === String(selectedTeamID)),
        [teams, selectedTeamID]
    );

    // ── Dashboard data helpers ─────────────────────────────────────────────
    const statusSummary         = dashboard?.statusCategoryCounts || dashboard?.statusCounts || {};
    const memberCounts          = dashboard?.memberCounts || {};
    const topMembers            = dashboard?.topMembers || null;
    const longestOpen           = dashboard?.longestOpen || null;
    const issuesByStatusCategory= dashboard?.drilldowns?.issuesByStatusCategory || {};
    const timeStatsByMember     = dashboard?.timeStatsByMember || {};
    const efficiency            = dashboard?.efficiency ?? null;

    function getDashboardUrl(team) {
        if (team.github)
            return `${api}/api/github/dashboard?teamId=${encodeURIComponent(selectedTeamID)}`;
        return `${api}/api/jira/dashboard?teamId=${encodeURIComponent(selectedTeamID)}`;
    }

    // ── Load dashboard ────────────────────────────────────────────────────
    useEffect(() => {
        if (!selectedTeam) return;
        setDashboard(null);
        setLastUpdated(null);
        setError('');
        setActiveTab("dashboard");

        let intervalId;
        let abortCtrl = new AbortController();

        async function loadDashboard(silent = false) {
            try {
                if (!silent) setLoadingDash(true);
                const res  = await fetch(getDashboardUrl(selectedTeam), { signal: abortCtrl.signal, credentials: "include" });
                const data = await res.json();
                if (!data?.success) return setError(data?.message || "Failed to load dashboard");
                setDashboard(data);
                setLastUpdated(new Date());
                setLoadingDash(false);
            } catch (e) {
                if (e.name !== "AbortError") { console.error(e); setLoadingDash(false); }
            }
        }

        loadDashboard();
        intervalId = setInterval(() => loadDashboard(true), 10000);
        return () => { abortCtrl.abort(); clearInterval(intervalId); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedTeam]);

    // ── Load grades when tab switches ─────────────────────────────────────
    useEffect(() => {
        if (activeTab === "grades" && selectedTeamID) {
            fetchGrades();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab, selectedTeamID]);

    async function fetchGrades() {
        setGradeLoading(true);
        setGradeError('');
        try {
            const res  = await fetch(`${api}/api/grades?teamId=${selectedTeamID}`, { credentials: "include" });
            const data = await res.json();
            if (data.success) setGrades(data.grades);
            else setGradeError(data.message || "Failed to load grades");
        } catch (e) { setGradeError(e.message); }
        setGradeLoading(false);
    }

    async function handleAddGrade() {
        if (!gradeForm.gradeComp || gradeForm.gradeScore === '') return setGradeError("Fill in both component and score.");
        try {
            const res  = await fetch(`${api}/api/grades`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ teamId: selectedTeamID, gradeComp: gradeForm.gradeComp, gradeScore: Number(gradeForm.gradeScore) })
            });
            const data = await res.json();
            if (data.success) { setGradeForm({ gradeComp:'', gradeScore:'' }); fetchGrades(); }
            else setGradeError(data.message);
        } catch (e) { setGradeError(e.message); }
    }

    async function handleUpdateGrade(gid) {
        try {
            const res  = await fetch(`${api}/api/grades/${gid}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ gradeComp: gradeForm.gradeComp, gradeScore: Number(gradeForm.gradeScore) })
            });
            const data = await res.json();
            if (data.success) { setEditingGrade(null); setGradeForm({ gradeComp:'', gradeScore:'' }); fetchGrades(); }
            else setGradeError(data.message);
        } catch (e) { setGradeError(e.message); }
    }

    async function handleDeleteGrade(gid) {
        if (!gid) return;
        setDeleteGradeId(gid); // open the confirm modal instead of window.confirm
        try {
            await fetch(`${api}/api/grades/${gid}`, { method: "DELETE", credentials: "include" });
            fetchGrades();
        } catch (e) { setGradeError(e.message); }
    }

    async function confirmDeleteGrade() {
        if (!deleteGradeId) return;
        try {
            await fetch(`${api}/api/grades/${deleteGradeId}`, { method: "DELETE", credentials: "include" });
            fetchGrades();
        } catch (e) { setGradeError(e.message); }
        setDeleteGradeId(null);
    }
    const handleUpdate = async () => {
        const { teamName, jiraBoardUrl, githubRepoUrl, githubProjectUrl } = editTeam;
        if (!jiraBoardUrl && (!githubRepoUrl || !githubProjectUrl)) return setModalError("Provide a Jira or GitHub URL");
        if (jiraBoardUrl && (githubRepoUrl || githubProjectUrl)) return setModalError("Only one platform allowed");
        if (!teamName) return setModalError("Team name required");
        const payload = { ...editTeam, platform: jiraBoardUrl ? "jira" : "github" };
        const res  = await fetch(`${api}/api/teams/${encodeURIComponent(selectedTeam.id)}`, { method:"PUT", headers:{"Content-Type":"application/json"}, credentials:"include", body:JSON.stringify(payload) });
        const data = await res.json();
        if (!data?.success) return setModalError(data?.message || "Failed to update team");
        setModalError(''); await refreshTeams(); setDashboard(null); setShowEditModal(false);
    };

    const handleDelete = () => {
        if (!selectedTeam) return;
        setShowDeleteModal(true); // open styled confirm modal
    };

    const confirmDeleteTeam = async () => {
        setShowDeleteModal(false);
        try {
            const res  = await fetch(`${api}/api/teams/${encodeURIComponent(selectedTeam.id)}`, { method:"DELETE", credentials:"include" });
            const data = await res.json();
            if (!data?.success) return setError(data?.message || 'Failed to delete team');
            await refreshTeams(); setTeams(prev => prev.filter(t => t.id !== selectedTeam.id));
            setSelectedTeamID(""); navigate("/overview");
        } catch (e) { setError(e.message); }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setEditTeam(prev => ({ ...prev, [name]: value }));
    };

    // ── Kanban column component ──────────────────────────────────────────
    function KanbanColumn({ status }) {
        const items  = issuesByStatusCategory[status] || [];
        const colors = STATUS_COLORS[status] || STATUS_COLORS["To Do"];
        return (
            <div className="kb-col" style={{ borderTop: `3px solid ${colors.border}` }}>
                <div className="kb-col-header">
                    <span className="kb-badge" style={{ background: colors.badge }}>{status}</span>
                    <span className="kb-count">{items.length}</span>
                </div>
                <div className="kb-cards">
                    {items.length === 0
                        ? <div className="kb-empty">No items</div>
                        : items.map(item => (
                            <div className="kb-card" key={item.key} style={{ background: colors.bg }}>
                                <div className="kb-card-key">{item.key}</div>
                                <div className="kb-card-title">{item.title}</div>
                                <div className="kb-card-meta">
                                    <span className="kb-assignee">{item.assignee}</span>
                                    {item.priority && <span className="kb-priority">{item.priority}</span>}
                                </div>
                                {item.url && <a className="kb-link" href={item.url} target="_blank" rel="noreferrer">Open</a>}
                            </div>
                        ))
                    }
                </div>
            </div>
        );
    }

    // ── Status panel (drilldown accordion) ───────────────────────────────
    // eslint-disable-next-line no-unused-vars
    function StatusPanel({ status, items }) {
        const [open, setOpen] = useState(false);
        return (
            <div className="sp-wrap">
                <button className="sp-toggle" onClick={() => setOpen(v => !v)}>
                    <span>{open ? "▼" : "▶"} {status}</span>
                    <span className="sp-count">{items.length}</span>
                </button>
                {open && (
                    <div className="sp-body">
                        {items.length === 0
                            ? <p className="sp-empty">No items.</p>
                            : items.map(it => (
                                <div className="sp-item" key={it.key}>
                                    <div className="sp-item-title"><strong>[{it.key}]</strong> {it.title}</div>
                                    <div className="sp-item-meta">
                                        <span>Assignee: {it.assignee || "Unassigned"}</span>
                                        <span>Priority: {it.priority || "—"}</span>
                                        <span>Status: {it.status || status}</span>
                                    </div>
                                    {it.url && <a href={it.url} target="_blank" rel="noreferrer" className="sp-link">Open issue</a>}
                                </div>
                            ))
                        }
                    </div>
                )}
            </div>
        );
    }

    // ── Dashboard tab content ────────────────────────────────────────────
    function DashboardTab() {
        // Track which stat card is selected — clicking it reveals issues for that status
        const [selectedStatus, setSelectedStatus] = useState(null);
        const filteredIssues = selectedStatus ? (issuesByStatusCategory[selectedStatus] || []) : [];

        return (
            <div className="tab-content">
                {/* Stat cards — clickable to filter issues below */}
                <div className="stats-row">
                    {Object.entries(statusSummary).map(([k, v]) => {
                        const colors  = STATUS_COLORS[k] || {};
                        const active  = selectedStatus === k;
                        return (
                            <div
                                key={k}
                                className={`stat-card stat-card-btn${active ? ' stat-card-active' : ''}`}
                                style={{
                                    borderTop:  `3px solid ${colors.border || '#aaa'}`,
                                    background: active ? (colors.bg || '#f8f9fc') : '#fff',
                                    boxShadow:  active ? `0 0 0 2px ${colors.border || '#aaa'}` : undefined,
                                }}
                                onClick={() => setSelectedStatus(active ? null : k)}
                                title={active ? 'Click to clear filter' : `Show ${k} issues`}
                            >
                                <div className="stat-num">{v}</div>
                                <div className="stat-label">{k}</div>
                                {active && <div className="stat-filter-hint">click to clear</div>}
                            </div>
                        );
                    })}
                    {efficiency !== null && (
                        <div className="stat-card" style={{ borderTop: '3px solid #33209f' }}>
                            <div className="stat-num">{efficiency.toFixed(1)}%</div>
                            <div className="stat-label">Efficiency</div>
                        </div>
                    )}
                </div>

                {/* Inline issues list — shown when a stat card is selected */}
                {selectedStatus && (
                    <div className="issues-inline">
                        <div className="issues-inline-header">
                            <span className="issues-inline-title">
                                <span className="iil-badge" style={{ background: STATUS_COLORS[selectedStatus]?.badge || '#888' }}>
                                    {selectedStatus}
                                </span>
                                <span className="iil-count">{filteredIssues.length} issue{filteredIssues.length !== 1 ? 's' : ''}</span>
                            </span>
                            {/* Click the active stat card again to clear — no separate button needed */}
                        </div>

                        {filteredIssues.length === 0
                            ? <p className="no-data" style={{ padding: '12px 0' }}>No issues in this status.</p>
                            : (
                                <div className="iil-list">
                                    {filteredIssues.map(item => (
                                        <div className="iil-item" key={item.key}
                                            style={{ borderLeft: `3px solid ${STATUS_COLORS[selectedStatus]?.border || '#aaa'}` }}>
                                            <div className="iil-top">
                                                <span className="iil-key">{item.key}</span>
                                                <span className="iil-assignee">{item.assignee || 'Unassigned'}</span>
                                                {item.priority && <span className="iil-priority">{item.priority}</span>}
                                            </div>
                                            <div className="iil-title">{item.title}</div>
                                            <div className="iil-meta">
                                                {item.createdAt && <span>Created: {new Date(item.createdAt).toLocaleDateString()}</span>}
                                                {item.completedAt && <span>Done: {new Date(item.completedAt).toLocaleDateString()}</span>}
                                                {item.url && <a className="iil-link" href={item.url} target="_blank" rel="noreferrer">Open ↗</a>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )
                        }
                    </div>
                )}

                <div className="dash-grid">
                    {/* Workload */}
                    <div className="dash-panel">
                        <h3 className="panel-title">Workload by member</h3>
                        {Object.keys(memberCounts).length === 0
                            ? <p className="no-data">No data</p>
                            : Object.entries(memberCounts).map(([member, count]) => {
                                const total = Object.values(memberCounts).reduce((a, b) => a + b, 0);
                                const pct   = total ? Math.round((count / total) * 100) : 0;
                                return (
                                    <div key={member} className="member-row">
                                        <span className="member-name">{member}</span>
                                        <div className="member-bar-wrap">
                                            <div className="member-bar" style={{ width: `${pct}%` }} />
                                        </div>
                                        <span className="member-count">{count}</span>
                                    </div>
                                );
                            })
                        }
                    </div>

                    {/* Top members */}
                    {topMembers && (
                        <div className="dash-panel">
                            <h3 className="panel-title">Top members</h3>
                            {[
                                { label: "Most open tasks", data: topMembers.mostOpened },
                                { label: "Most to-do",      data: topMembers.mostTodo },
                                { label: "Most backlog",    data: topMembers.mostBacklog },
                            ].filter(x => x.data?.member).map(({ label, data }) => (
                                <div key={label} className="top-row">
                                    <span className="top-label">{label}</span>
                                    <span className="top-member">{data.member}</span>
                                    <span className="top-count">{data.count}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Longest open */}
                    <div className="dash-panel">
                        <h3 className="panel-title">Longest open task</h3>
                        {longestOpen ? (
                            <div>
                                <div className="lo-key">{longestOpen.key}</div>
                                <div className="lo-title">{longestOpen.title}</div>
                                <div className="lo-meta">
                                    <span>Assignee: {longestOpen.assignee}</span>
                                    <span>{longestOpen.ageHours}h open</span>
                                </div>
                            </div>
                        ) : <p className="no-data">No open tasks</p>}
                    </div>

                    {/* Backlog */}
                    {dashboard?.backlog && (
                        <div className="dash-panel">
                            <h3 className="panel-title">Backlog</h3>
                            <div className="backlog-count">{dashboard.backlog.count}</div>
                            <div className="backlog-label">items off board</div>
                            {dashboard.backlog.byMember && Object.entries(dashboard.backlog.byMember).map(([m, c]) => (
                                <div key={m} className="member-row">
                                    <span className="member-name">{m}</span>
                                    <span className="member-count">{c}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Time stats */}
                    {Object.keys(timeStatsByMember).length > 0 && (
                        <div className="dash-panel">
                            <h3 className="panel-title">Completion time by member</h3>
                            {Object.entries(timeStatsByMember).map(([member, stats]) => (
                                <div key={member} className="time-row">
                                    <span className="member-name">{member}</span>
                                    <span className="time-stat">avg {stats.avgCompletionHours}h</span>
                                    <span className="time-stat">{stats.completedTasks} done</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // ── Kanban tab content ───────────────────────────────────────────────
    function KanbanTab() {
        if (Object.keys(issuesByStatusCategory).length === 0) {
            return <div className="tab-content"><p className="no-data" style={{marginTop:40,textAlign:'center'}}>No board data available.</p></div>;
        }
        return (
            <div className="tab-content">
                <div className="kanban-board">
                    {KANBAN_COLS.map(col => <KanbanColumn key={col} status={col} />)}
                </div>
            </div>
        );
    }

    // ── Main render ──────────────────────────────────────────────────────
    if (!selectedTeam) return <div className="tab-content"><p className="no-data" style={{marginTop:60,textAlign:'center'}}>Select a team from the dropdown above.</p></div>;

    // Always render the full shell so Edit/Delete are visible even when dashboard errors
    return (
        <div className="team-page">
            {/* Page header — always visible even on error */}
            <div className="team-page-header">
                <div>
                    <h2 className="team-name">{selectedTeam.teamName}</h2>
                    <span className="platform-badge">{selectedTeam.platform === 'jira' ? 'Jira' : 'GitHub'}</span>
                    {lastUpdated && <span className="last-updated">Updated {lastUpdated.toLocaleTimeString()}</span>}
                </div>
                <div className="team-actions">
                    <button className="editbtn" onClick={() => {
                        setEditTeam({ teamName: selectedTeam.teamName, jiraBoardUrl: selectedTeam.jira?.boardUrl || '', githubRepoUrl: selectedTeam.github?.repoUrl || '', githubProjectUrl: selectedTeam.github?.projectUrl || '' });
                        setShowEditModal(true);
                    }}>
                        <TbEdit /> <span>Edit</span>
                    </button>
                    <button className="delbtn" onClick={handleDelete}>
                        <MdDelete /> <span>Delete</span>
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="tab-bar">
                {[
                    { id: 'dashboard', label: 'Dashboard' },
                    { id: 'kanban',    label: 'Kanban Board' },
                    { id: 'grades',    label: 'Grades' },
                ].map(tab => (
                    <button
                        key={tab.id}
                        className={`tab-btn ${activeTab === tab.id ? 'tab-active' : ''}`}
                        onClick={() => setActiveTab(tab.id)}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab panels */}
            {error && activeTab !== 'grades' && (
                <div className="tab-content">
                    <div className="error-state">
                        <p className="error-state-msg">{error}</p>
                        <p className="error-state-hint">The board URL for this team may be incorrect. Use <strong>Edit</strong> to fix it, or <strong>Delete</strong> to remove it.</p>
                    </div>
                </div>
            )}
            {!error && !dashboard && loadingDash && activeTab !== 'grades' && (
                <div className="tab-content">
                    <p className="no-data" style={{marginTop:60,textAlign:'center'}}>Loading dashboard...</p>
                </div>
            )}
            {!error && activeTab === 'dashboard' && <DashboardTab />}
            {!error && activeTab === 'kanban'    && <KanbanTab />}

            {/* Grades — rendered inline NOT as a nested function so inputs keep focus */}
            {activeTab === 'grades' && (
                <div className="tab-content">
                    <div className="grades-panel">
                        <h3 className="panel-title">Record grade</h3>

                        <div className="grade-form">
                            <input
                                className="grade-input"
                                placeholder="Component (e.g. Sprint 1 Assessment)"
                                value={gradeForm.gradeComp}
                                onChange={e => setGradeForm(p => ({ ...p, gradeComp: e.target.value }))}
                            />
                            <input
                                className="grade-input grade-score"
                                type="number"
                                placeholder="Score"
                                min="0"
                                max="100"
                                value={gradeForm.gradeScore}
                                onChange={e => setGradeForm(p => ({ ...p, gradeScore: e.target.value }))}
                            />
                            {editingGrade ? (
                                <>
                                    <button className="grade-btn-primary" onClick={() => handleUpdateGrade(editingGrade)}>Update</button>
                                    <button className="grade-btn-cancel" onClick={() => { setEditingGrade(null); setGradeForm({ gradeComp:'', gradeScore:'' }); }}>Cancel</button>
                                </>
                            ) : (
                                <button className="grade-btn-primary" onClick={handleAddGrade}>Add grade</button>
                            )}
                        </div>

                        {gradeError && <p className="lf-error">{gradeError}</p>}

                        {gradeLoading
                            ? <p className="no-data">Loading grades...</p>
                            : grades.length === 0
                            ? <p className="no-data">No grades recorded yet for this team.</p>
                            : (
                                <table className="grade-table">
                                    <thead>
                                        <tr>
                                            <th>Component</th>
                                            <th>Score</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {grades.map(g => (
                                            <tr key={g.gid} className={editingGrade === g.gid ? 'grade-editing' : ''}>
                                                <td>{g.gradeComp}</td>
                                                <td><span className="grade-score-badge">{g.gradeScore}</span></td>
                                                <td>
                                                    <button className="grade-edit-btn" onClick={() => {
                                                        setEditingGrade(g.gid);
                                                        setGradeForm({ gradeComp: g.gradeComp, gradeScore: String(g.gradeScore) });
                                                    }}>Edit</button>
                                                    <button className="grade-del-btn" onClick={() => handleDeleteGrade(g.gid)}>Delete</button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )
                        }
                    </div>
                </div>
            )}

            {/* Edit team modal — only shows fields relevant to the team's platform */}
            {showEditModal && (
                <div className="overlay">
                    <div className="modal">
                        <h2>Edit Team</h2>

                        {/* Platform badge so the instructor knows which platform they are editing */}
                        <div style={{ marginBottom: 12 }}>
                            <span style={{ background: selectedTeam?.platform === 'jira' ? '#e8f0ff' : '#e6f8ee', color: selectedTeam?.platform === 'jira' ? '#1a4fbf' : '#107830', fontWeight: 700, fontSize: 12, padding: '3px 10px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                {selectedTeam?.platform === 'jira' ? 'Jira Team' : 'GitHub Team'}
                            </span>
                        </div>

                        <input
                            type="text"
                            name='teamName'
                            placeholder="Team Name"
                            value={editTeam.teamName}
                            onChange={handleInputChange}
                        />

                        {/* Jira teams: show only Jira URL */}
                        {selectedTeam?.platform === 'jira' && (
                            <>
                                <p style={{ fontSize: 12, color: '#888', margin: '4px 0' }}>
                                    Format: https://workspace.atlassian.net/jira/software/projects/&lt;KEY&gt;/boards/&lt;ID&gt;
                                </p>
                                <input
                                    type="text"
                                    name='jiraBoardUrl'
                                    placeholder="Jira board URL"
                                    value={editTeam.jiraBoardUrl}
                                    onChange={handleInputChange}
                                />
                            </>
                        )}

                        {/* GitHub teams: show only GitHub URLs */}
                        {selectedTeam?.platform === 'github' && (
                            <>
                                <p style={{ fontSize: 12, color: '#888', margin: '4px 0' }}>
                                    Repo: https://github.com/&lt;owner&gt;/&lt;repo&gt;
                                </p>
                                <input
                                    type="text"
                                    name='githubRepoUrl'
                                    placeholder="GitHub repo URL"
                                    value={editTeam.githubRepoUrl}
                                    onChange={handleInputChange}
                                />
                                <p style={{ fontSize: 12, color: '#888', margin: '4px 0' }}>
                                    Project: https://github.com/users/&lt;owner&gt;/projects/&lt;N&gt;
                                </p>
                                <input
                                    type="text"
                                    name='githubProjectUrl'
                                    placeholder="GitHub project URL"
                                    value={editTeam.githubProjectUrl}
                                    onChange={handleInputChange}
                                />
                            </>
                        )}

                        {modalError && <p className="error">{modalError}</p>}
                        <div className='linebreak' />
                        <div className="modalActions">
                            <button className="misc-team-btn" onClick={() => { setShowEditModal(false); setModalError(''); }}>Cancel</button>
                            <button className="add-team-btn" onClick={handleUpdate}>Save</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Delete team confirmation modal ── */}
            {showDeleteModal && (
                <div className="overlay">
                    <div className="modal confirm-modal">
                        <div className="confirm-icon confirm-icon-danger">🗑</div>
                        <h3 className="confirm-title">Delete team?</h3>
                        <p className="confirm-body">
                            <strong>{selectedTeam?.teamName}</strong> and all its grade records will be permanently removed. This cannot be undone.
                        </p>
                        <div className="confirm-actions">
                            <button className="misc-team-btn" onClick={() => setShowDeleteModal(false)}>Cancel</button>
                            <button className="confirm-btn-danger" onClick={confirmDeleteTeam}>Yes, delete</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Delete grade confirmation modal ── */}
            {deleteGradeId && (
                <div className="overlay">
                    <div className="modal confirm-modal">
                        <div className="confirm-icon confirm-icon-warn">⚠</div>
                        <h3 className="confirm-title">Delete grade entry?</h3>
                        <p className="confirm-body">This grade entry will be permanently removed.</p>
                        <div className="confirm-actions">
                            <button className="misc-team-btn" onClick={() => setDeleteGradeId(null)}>Cancel</button>
                            <button className="confirm-btn-danger" onClick={confirmDeleteGrade}>Yes, delete</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
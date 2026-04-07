import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { IoMdHome, IoMdAdd, IoMdDownload } from "react-icons/io";
import { TbUserFilled, TbDotsVertical, TbTableImport } from "react-icons/tb";
import * as XLSX from "xlsx";
import "../Header.css";
import { validateGithubProjectUrl, validateGithubRepoUrl, validateJiraBoardUrl } from "../utils/UrlValidator";
import { useAuth } from "../utils/AuthContext";

export default function Header({ api, teams, selectedTeamID, setSelectedTeamID, refreshTeams }) {
    const [showManualModal, setShowManualModal] = useState(false);
    const [showBulkModal,   setShowBulkModal]   = useState(false);

    const [teamName,       setTeamName]       = useState('');
    const [jiraURL,        setJiraURL]        = useState('');
    const [githubRepoURL,  setGithubRepoURL]  = useState('');
    const [githubProjURL,  setGithubProjURL]  = useState('');
    const [importFile,     setImportFile]     = useState(null);

    const [error,      setError]      = useState('');
    const [mobileOpen, setMobileOpen] = useState(false);

    const navigate = useNavigate();
    const { logout } = useAuth();

    const handleInputChange = (e) => {
        e.preventDefault();
        const { name, value } = e.target;
        switch (name) {
            case 'jiraURL':       setJiraURL(value);       break;
            case 'githubRepoURL': setGithubRepoURL(value); break;
            case 'githubProjURL': setGithubProjURL(value); break;
            case 'teamName':      setTeamName(value);      break;
        }
    };

    const handleManualAddSubmit = async () => {
        if (!jiraURL && (!githubRepoURL || !githubProjURL)) {
            setError("Please provide either a Jira or GitHub Kanban Board URL");
            return;
        }

        if (jiraURL && (githubRepoURL || githubProjURL)) {
            setError("You can only provide one Kanban Board URL (Jira OR GitHub)");
            return;
        }

        if (!teamName) {
            setError("Please provide a Team Name");
            return;
        }

        // Build the payload based on which platform URL was provided
        const payload = jiraURL
            ? { platform: "jira",   teamName, jiraBoardUrl: jiraURL }
            : { platform: "github", teamName, githubRepoUrl: githubRepoURL, githubProjectUrl: githubProjURL };

        const res = await fetch(`${api}/api/teams`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (!data?.success) {
            return setError(data?.message || "Failed to add team");
        }

        await refreshTeams();
        setTeamName(''); setJiraURL(''); setGithubRepoURL(''); setGithubProjURL('');
        setError('');
        setSelectedTeamID('');
        setShowManualModal(false);
        navigate('/overview');
    };

    const handleBulkAddSubmit = async () => {
        try {
            if (!importFile) {
                return setError("Please upload an import team excel file");
            }

            if (!importFile.name.startsWith('KABAS Import Teams Template')) {
                return setError("Incorrect excel file uploaded (Correct Filename: KABAS Import Teams Template.xlsx)");
            }

            const buffer = await importFile.arrayBuffer();
            const wb     = XLSX.read(buffer, { type: "array" });
            const ws     = wb.Sheets[wb.SheetNames[0]];
            const rows   = XLSX.utils.sheet_to_json(ws, { defval: "" });

            if (!rows.length) {
                return setError("Excel file contains no records");
            }

            let dataErrors  = [];
            let bulkPayload = [];

            rows.map((row, index) => {
                // Normalise all column headers to lowercase to handle casing differences
                const header = Object.fromEntries(
                    Object.entries(row).map(([key, value]) => [key.toLowerCase().trim(), value])
                );

                const rowNum          = index + 2;
                const platform        = String(header.platform        ?? "").trim().toLowerCase();
                const teamName        = String(header.teamname        ?? "").trim();
                const jiraBoardUrl    = String(header.jiraboardurl    ?? "").trim();
                const githubRepoUrl   = String(header.githubrepourl   ?? "").trim();
                const githubProjectUrl= String(header.githubprojecturl?? "").trim();

                let rowHasError = false;

                if (!teamName) {
                    dataErrors.push(`Row ${rowNum}: Missing team name`);
                    rowHasError = true;
                }

                if (platform !== 'jira' && platform !== 'github') {
                    dataErrors.push(`Row ${rowNum}: Platform must be 'jira' or 'github', got '${platform}'`);
                    rowHasError = true;
                }

                if (platform === 'jira') {
                    if (!jiraBoardUrl) {
                        dataErrors.push(`Row ${rowNum}: Missing Jira board URL`);
                        rowHasError = true;
                    } else if (!validateJiraBoardUrl(jiraBoardUrl)) {
                        dataErrors.push(`Row ${rowNum}: Invalid Jira board URL. Expected /projects/<KEY>/boards/<ID>`);
                        rowHasError = true;
                    }
                }

                if (platform === 'github') {
                    if (!githubRepoUrl) {
                        dataErrors.push(`Row ${rowNum}: Missing GitHub repo URL`);
                        rowHasError = true;
                    } else if (!validateGithubRepoUrl(githubRepoUrl)) {
                        dataErrors.push(`Row ${rowNum}: Invalid GitHub repo URL. Expected https://github.com/<owner>/<repo>`);
                        rowHasError = true;
                    }

                    if (!githubProjectUrl) {
                        dataErrors.push(`Row ${rowNum}: Missing GitHub project URL`);
                        rowHasError = true;
                    } else if (!validateGithubProjectUrl(githubProjectUrl)) {
                        dataErrors.push(`Row ${rowNum}: Invalid GitHub project URL. Expected https://github.com/<users or orgs>/<owner>/projects/<num>`);
                        rowHasError = true;
                    }
                }
                if (!rowHasError) {
                    bulkPayload.push({ platform, teamName, jiraBoardUrl, githubRepoUrl, githubProjectUrl });
                }
            });

            // Show all row errors at once so the user can fix them in one go
            if (dataErrors.length > 0) {
                return setError(dataErrors);
            }

            const res = await fetch(`${api}/api/teams/bulk`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ teams: bulkPayload })
            });

            const data = await res.json();
            if (!data?.success) {
                setError(data?.message || "Bulk Import Failed");
            }

            await refreshTeams();
            setError('');
            setShowBulkModal(false);

        } catch (e) {
            setError(e.message);
        }
    };

    // Generates and downloads the Excel template the instructor fills in before bulk import
    function downloadExcelTemplate() {
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
            header: ["platform","teamName","jiraBoardUrl","githubRepoUrl","githubProjectUrl"],
        });

        ws["!cols"] = [
            { wch: 10 }, // platform
            { wch: 22 }, // teamName
            { wch: 60 }, // jiraBoardUrl
            { wch: 45 }, // githubRepoUrl
            { wch: 50 }, // githubProjectUrl
        ];

        const wb       = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Teams");

        const arrayBuf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
        const blob     = new Blob([arrayBuf], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });

        const url = URL.createObjectURL(blob);
        const a   = document.createElement("a");
        a.href     = url;
        a.download = "KABAS Import Teams Template.xlsx";
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    }

    return (
        <header className="header">
            <div className="header-left">
                <button onClick={() => { setSelectedTeamID(''); navigate('/overview'); }}>
                    <IoMdHome />
                </button>

                {/* Team selector dropdown — navigates to /team/:id on change */}
                <div style={{ marginTop: 10 }}>
                    <select
                        value={selectedTeamID}
                        onChange={(e) => {
                            const id = e.target.value;
                            setSelectedTeamID(id);
                            navigate(`/team/${id}`);
                        }}>
                        <option value="" disabled>Select Team</option>
                        {teams.map((team) => (
                            <option key={team.id} value={team.id}>
                                {team.teamName}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="header-btn">
                    <button className="add-team-btn" onClick={() => setShowManualModal(true)}>
                        <IoMdAdd /> Add Team
                    </button>
                    <button className="misc-team-btn" onClick={() => setShowBulkModal(true)}>
                        <TbTableImport /> Import Teams
                    </button>
                    <button className="misc-team-btn" onClick={downloadExcelTemplate}>
                        <IoMdDownload /> Download Import Template
                    </button>
                </div>
            </div>

            <div className="header-right">
                <div className="desktop-menu">
                    <div className="dropdown-menu"><TbUserFilled /></div>
                    <div className="account-dropdown-content">
                        <a onClick={(e) => { e.preventDefault(); navigate('/profile'); setSelectedTeamID(''); }}>
                            Profile
                        </a>
                        <a onClick={async (e) => { e.preventDefault(); setSelectedTeamID(''); await logout(); }}>
                            Logout
                        </a>
                    </div>
                </div>

                <div className='mobile-menu'>
                    <div className="dropdown-menu" onClick={() => setMobileOpen(!mobileOpen)}>
                        <TbDotsVertical />
                    </div>
                    <div className={`account-dropdown-content ${mobileOpen ? "show" : ""}`}>
                        <a onClick={(e) => { e.preventDefault(); setMobileOpen(false); setShowManualModal(true); }}>Add Team</a>
                        <a onClick={(e) => { e.preventDefault(); setMobileOpen(false); setShowBulkModal(true); }}>Import Teams</a>
                        <a onClick={(e) => { e.preventDefault(); setMobileOpen(false); downloadExcelTemplate(); }}>Download Import Template</a>
                        <a onClick={(e) => { e.preventDefault(); navigate('/profile'); setSelectedTeamID(''); setMobileOpen(false); }}>Profile</a>
                        <a onClick={async (e) => { e.preventDefault(); setSelectedTeamID(''); setMobileOpen(false); await logout(); }}>Logout</a>
                    </div>
                </div>
            </div>

            {/* Manual add team modal */}
            {showManualModal && (
                <div className="overlay">
                    <div className="modal">
                        <div>
                            <h2>Add Team</h2>
                            <p>Copy the URL from Jira / GitHub's Kanban board page: e.g.,</p>
                            <ul>
                                <li>(Jira) https://example-workspace.atlassian.net/jira/software/projects/example/boards/1</li>
                                <li>(GitHub) https://github.com/users/ExampleUser/projects/1</li>
                            </ul>
                        </div>
                        <input type="text" name='teamName' placeholder="Team Name" value={teamName} onChange={handleInputChange} />
                        <input type="text" name='jiraURL' placeholder="https://<workspace>/jira/software/projects/<key>/boards/<ID>" value={jiraURL} onChange={handleInputChange} disabled={githubRepoURL.length > 0 || githubProjURL.length > 0} />
                        <input type="text" name='githubRepoURL' placeholder="https://github.com/<owner>/<repo>" value={githubRepoURL} onChange={handleInputChange} disabled={jiraURL.length > 0} />
                        <input type="text" name='githubProjURL' placeholder="https://github.com/users/<owner>/projects/<ID>" value={githubProjURL} onChange={handleInputChange} disabled={jiraURL.length > 0} />
                        {error && <p className="error">{error}</p>}
                        <div className='linebreak' />
                        <div className="modalActions">
                            <button className="misc-team-btn" onClick={() => { setTeamName(''); setJiraURL(''); setGithubRepoURL(''); setGithubProjURL(''); setError(''); setShowManualModal(false); }}>Cancel</button>
                            <button className="add-team-btn" onClick={handleManualAddSubmit}>Add</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Bulk import modal */}
            {showBulkModal && (
                <div className="overlay">
                    <div className="modal">
                        <div>
                            <h2>Import Teams</h2>
                            <p>Upload the import team excel.</p>
                            <input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => { setError(''); setImportFile(e.target.files?.[0]); }} />
                            <p>Note: Download a template from <strong>Download Import Template</strong> button.</p>
                            {error && (
                                Array.isArray(error) && error.length > 0
                                    ? <ul className="error">{error.map((err, i) => <li key={i}>{err}</li>)}</ul>
                                    : <p className="error">{error}</p>
                            )}
                            <div className='linebreak' />
                            <div className="modalActions">
                                <button className="misc-team-btn" onClick={() => { setImportFile(null); setError(''); setShowBulkModal(false); }}>Cancel</button>
                                <button className="add-team-btn" onClick={handleBulkAddSubmit}>Import</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </header>
    );
}
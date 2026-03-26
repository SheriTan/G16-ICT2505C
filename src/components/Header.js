import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { IoMdHome, IoMdAdd, IoMdDownload } from "react-icons/io";
import { TbUserFilled, TbDotsVertical, TbTableImport } from "react-icons/tb";
import * as XLSX from "xlsx";
import "../Header.css";
import { validateGithubProjectUrl, validateGithubRepoUrl, validateJiraBoardUrl } from "../utils/UrlValidator";

export default function Header({ api, teams, setTeams, selectedTeamID, setSelectedTeamID, refreshTeams }) {
    const [showManualModal, setShowManualModal] = useState(false);
    const [showBulkModal, setShowBulkModal] = useState(false);
    // Manual add form fields
    const [teamName, setTeamName] = useState('');
    const [jiraURL, setJiraURL] = useState('');
    const [githubRepoURL, setGithubRepoURL] = useState('');
    const [githubProjURL, setGithubProjURL] = useState('');
    // Import fields
    const [importFile, setImportFile] = useState(null);

    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleInputChange = (e) => {
        e.preventDefault();
        const { name, value } = e.target;

        switch (name) {
            case 'jiraURL': setJiraURL(value);
                break;
            case 'githubRepoURL': setGithubRepoURL(value);
                break;
            case 'githubProjURL': setGithubProjURL(value);
                break;
            case 'teamName': setTeamName(value);
                break;
        }
    }

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
            setError("Please provide a Team Name")
            return;
        }

        const payload = jiraURL
            ? {
                platform: "jira",
                teamName: teamName,
                jiraBoardUrl: jiraURL,
            }
            : {
                platform: "github",
                teamName: teamName,
                githubRepoUrl: githubRepoURL,
                githubProjectUrl: githubProjURL,
            };

        const res = await fetch(`${api}/api/teams`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (!data?.success) {
            setError(data?.message || "Failed to add team");
            return;
        };

        await refreshTeams();
        setTeamName("");
        setJiraURL("");
        setGithubRepoURL("");
        setGithubProjURL("");
        setError("");
        setShowManualModal(false);
    };

    const handleBulkAddSubmit = async () => {
        try {
            if (!importFile) {
                return setError("Please upload an import team excel file")
            };

            if (!importFile.name.startsWith('KABAS Import Teams Template')) {
                return setError("Incorrect excel file uploaded (Correct Filename: KABAS Import Teams Template.xlsx)")
            }

            const buffer = await importFile.arrayBuffer();
            const wb = XLSX.read(buffer, { type: "array" });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });

            if (!rows.length) {
                return setError("Excel file contains no records")
            }

            let dataErrors = [];
            let bulkPayload = [];
            // Map rows to API payload
            const teamsPayload = rows.map((row, index) => {
                const header = Object.fromEntries(
                    Object.entries(row).map(([key, value]) => [key.toLowerCase().trim(), value])
                );

                let rowNum = index + 2;

                const platform = String(header.platform ?? "").trim().toLowerCase();
                const teamName = String(header.teamname ?? "").trim();
                const jiraBoardUrl = String(header.jiraboardurl ?? "").trim();
                const githubRepoUrl = String(header.githubrepourl ?? "").trim();
                const githubProjectUrl = String(header.githubprojecturl ?? "").trim();

                if (!teamName) {
                    dataErrors.push(`Row ${rowNum}: Missing team name`)
                }

                if (platform == 'jira') {
                    if (!jiraBoardUrl) {
                        dataErrors.push(`Row ${rowNum}: Missing Jira board URL`)
                    }
                    else if (!validateJiraBoardUrl(jiraBoardUrl)) {
                        dataErrors.push(`Row ${rowNum}: Invalid Jira board URL. Expected /projects/<KEY>/boards/<ID>`)
                    }
                }

                if (platform == 'github') {
                    if (!githubRepoUrl) {
                        dataErrors.push(`Row ${rowNum}: Missing GitHub repo URL`)
                    }
                    else if (!validateGithubRepoUrl(githubRepoUrl)) {
                        dataErrors.push(`Row ${rowNum}: Invalid GitHub repo URL. Expected https://github.com/<owner>/<repo>`)
                    }

                    if (!githubProjectUrl) {
                        dataErrors.push(`Row ${rowNum}: Missing GitHub project URL`)
                    }
                    else if (!validateGithubProjectUrl(githubProjectUrl)) {
                        dataErrors.push(`Row ${rowNum}: Invalid GitHub project URL. Expected https://github.com/<users or orgs>/<owner>/projects/<num>`)
                    }
                }

                if (dataErrors.length == 0) {
                    bulkPayload.push({
                        platform: platform,
                        teamName: teamName,
                        jiraBoardUrl: jiraBoardUrl,
                        githubRepoUrl: githubRepoUrl,
                        githubProjectUrl: githubProjectUrl,
                    });
                }
            })

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
            setError("");
            setShowBulkModal(false);

        } catch (e) {
            setError(e.message);
        }
    }

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
            header: [
                "platform",
                "teamName",
                "jiraBoardUrl",
                "githubRepoUrl",
                "githubProjectUrl",
            ],
        });

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
        a.download = "KABAS Import Teams Template.xlsx";
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    }

    return (
        <header className="header">
            <div className="header-left">
                <button
                    onClick={() => {
                        navigate('/overview');
                        setSelectedTeamID('');
                    }}
                >
                    <IoMdHome />
                </button>
                <div style={{ marginTop: 10 }}>
                    <select
                        value={selectedTeamID}
                        onChange={(e) => {
                            const id = e.target.value;
                            setSelectedTeamID(id);
                            navigate(`/team/${id}`)
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
                <button className="add-team-btn"
                    onClick={() => setShowManualModal(true)}
                >
                    <IoMdAdd /> Add Team
                </button>
                <button className="misc-team-btn"
                    onClick={() => setShowBulkModal(true)}
                >
                    <TbTableImport /> Import Teams
                </button>
                <button className="misc-team-btn"
                    onClick={downloadExcelTemplate}>
                    <IoMdDownload /> Download Import Template
                </button>
                </div>
            </div>

            <div className="header-right">
                <button className="profile-btn"
                    onClick={() => {
                        navigate('/profile');
                        setSelectedTeamID('');
                    }}
                >
                    <TbUserFilled />
                </button>
                <button className="mobile-menu">
                    <TbDotsVertical />
                </button>

            </div>
            {
                showManualModal && (
                    <div className="overlay">
                        <div className="modal">
                            <div>
                                <h2>Add Team</h2>
                                <p>Copy the URL from Jira / GitHub’s Kanban board page: e.g.,</p>
                                <ul>
                                    <li>(Jira) https://example-workspace.atlassian.net/jira/software/projects/example/boards/1</li>
                                    <li>(GitHub) https://github.com/users/ExampleUser/projects/1</li>
                                </ul>
                            </div>
                            <input
                                type="text"
                                name='teamName'
                                placeholder="Team Name"
                                value={teamName}
                                onChange={(e) => handleInputChange(e)}
                            />
                            <input
                                type="text"
                                name='jiraURL'
                                placeholder="https://<workspace>/jira/software/projects/<key>/boards/<ID>"
                                value={jiraURL}
                                onChange={(e) => handleInputChange(e)}
                                disabled={githubRepoURL.length > 0 || githubProjURL.length > 0}
                            />

                            <input
                                type="text"
                                name='githubRepoURL'
                                placeholder="https://github.com/<owner>/<repo>"
                                value={githubRepoURL}
                                onChange={(e) => handleInputChange(e)}
                                disabled={jiraURL.length > 0}
                            />

                            <input
                                type="text"
                                name='githubProjURL'
                                placeholder="https://github.com/users/<owner>/projects/<ID>"
                                value={githubProjURL}
                                onChange={(e) => handleInputChange(e)}
                                disabled={jiraURL.length > 0}
                            />
                            {error && <p className="error">{error}</p>}
                            <div className='linebreak' />
                            <div className="modalActions">
                                <button className="misc-team-btn"
                                    onClick={() => {
                                        setTeamName("");
                                        setJiraURL("");
                                        setGithubRepoURL("");
                                        setGithubProjURL("");
                                        setError("");
                                        setShowManualModal(false)
                                    }}>Cancel</button>

                                <button className="add-team-btn"
                                    onClick={() => handleManualAddSubmit()}>
                                    Add
                                </button>
                            </div>

                        </div>
                    </div>
                )
            }
            {
                showBulkModal && (
                    <div className="overlay">
                        <div className="modal">
                            <div>
                                <h2>Import Teams</h2>
                                <p>Upload the import team excel.</p>
                                <input
                                    type="file"
                                    accept=".xlsx,.xls,.csv"
                                    onChange={(e) => {
                                        setError('');
                                        setImportFile(e.target.files?.[0]);
                                    }}
                                />
                                <p>Note: Download a template from <strong>Download Import Template</strong> button.</p>
                                {error &&
                                    (Array.isArray(error) && error.length > 0) ?
                                    <ul className="error">
                                        {
                                            error.map((err, i) => (
                                                <li key={i}>{err}</li>
                                            ))
                                        }
                                    </ul>
                                    :
                                    <p className="error">{error}</p>
                                }
                                <div className='linebreak' />
                                <div className="modalActions">
                                    <button className="misc-team-btn"
                                        onClick={() => {
                                            setImportFile(null);
                                            setError("");
                                            setShowBulkModal(false)
                                        }}>Cancel</button>

                                    <button className="add-team-btn"
                                        onClick={() => handleBulkAddSubmit()}>
                                        Import
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }
        </header >
    );
}
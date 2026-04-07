import { useOutletContext } from 'react-router-dom';
import { useNavigate }      from 'react-router-dom';
import { useEffect, useState } from 'react';
import './Overview.css';

const Overview = () => {
    const { teams, setSelectedTeamID, api } = useOutletContext();
    const navigate = useNavigate();

    // Map of teamId -> { status: 'ok' | 'error' | 'checking', message: string }
    const [healthMap, setHealthMap] = useState({});

    // On load (and whenever teams list changes), ping each team's dashboard endpoint
    useEffect(() => {
        if (!teams.length) return;

        // Mark all as checking first
        const initial = {};
        teams.forEach(t => { initial[t.id] = { status: 'checking' }; });
        setHealthMap(initial);

        // Health check for every team in parallel
        teams.forEach(async (team) => {
            const url = team.platform === 'github'
                ? `${api}/api/github/dashboard?teamId=${encodeURIComponent(team.id)}`
                : `${api}/api/jira/dashboard?teamId=${encodeURIComponent(team.id)}`;

            try {
                const res  = await fetch(url, { credentials: 'include' });
                const data = await res.json();

                if (data?.success) {
                    setHealthMap(prev => ({ ...prev, [team.id]: { status: 'ok' } }));
                } else {
                    // Simplify the error message for display
                    const raw = data?.message || 'Connection failed';
                    const msg = simplifyError(raw);
                    setHealthMap(prev => ({ ...prev, [team.id]: { status: 'error', message: msg } }));
                }
            } catch (e) {
                setHealthMap(prev => ({ ...prev, [team.id]: { status: 'error', message: 'Could not reach server' } }));
            }
        });
    }, [teams]);

    // Turns raw API error messages into short readable labels
    function simplifyError(msg) {
        if (!msg) return 'Connection issue';
        const m = msg.toLowerCase();
        if (m.includes('token') || m.includes('credentials') || m.includes('unauthorized'))
            return 'API token missing or invalid';
        if (m.includes('could not resolve') || m.includes('login') || m.includes('owner'))
            return 'Invalid owner / project URL';
        if (m.includes('not found') || m.includes('board') || m.includes('project'))
            return 'Board or project not found';
        if (m.includes('status') && m.includes('missing'))
            return 'GitHub project missing Status field';
        if (m.includes('network') || m.includes('reach') || m.includes('econnrefused'))
            return 'Cannot reach platform';
        return 'Connection issue';
    }

    const handleTeamClick = (team) => {
        setSelectedTeamID(team.id);
        navigate(`/team/${team.id}`);
    };

    // Count how many teams have errors
    const errorTeams = teams.filter(t => healthMap[t.id]?.status === 'error');

    return (
        <div className="overview-root">
            <h2 className="overview-title">All Teams</h2>

            {/* Error banner — only shown when one or more teams have connection issues */}
            {errorTeams.length > 0 && (
                <div className="overview-error-banner">
                    <div className="oeb-icon">!</div>
                    <div className="oeb-body">
                        <div className="oeb-heading">
                            {errorTeams.length === 1
                                ? '1 team has a connection issue'
                                : `${errorTeams.length} teams have connection issues`}
                        </div>
                        <div className="oeb-detail">
                            {errorTeams.map(t => (
                                <span key={t.id} className="oeb-team-pill" onClick={() => handleTeamClick(t)}>
                                    {t.teamName}
                                </span>
                            ))}
                            — click a team card to edit its URL or API token.
                        </div>
                    </div>
                </div>
            )}

            {teams.length === 0 ? (
                <p className="overview-empty">No teams yet. Use "Add Team" in the header to get started.</p>
            ) : (
                <div className="overview-grid">
                    {teams.map(team => {
                        const health  = healthMap[team.id];
                        const isError = health?.status === 'error';
                        const isOk    = health?.status === 'ok';
                        const checking= health?.status === 'checking' || !health;

                        return (
                            <div
                                key={team.id}
                                className={`ov-card${isError ? ' ov-card-error' : ''}${isOk ? ' ov-card-ok' : ''}`}
                                onClick={() => handleTeamClick(team)}
                            >
                                {/* Status dot top-right */}
                                <div className={`ov-dot${isError ? ' ov-dot-error' : isOk ? ' ov-dot-ok' : ' ov-dot-checking'}`}
                                     title={isError ? health.message : isOk ? 'Connected' : 'Checking...'} />

                                <div className="ov-card-name">{team.teamName}</div>

                                <div className="ov-card-platform">
                                    <span className={`ov-platform-badge ov-platform-${team.platform}`}>
                                        {team.platform === 'jira' ? 'Jira' : 'GitHub'}
                                    </span>
                                </div>

                                {/* Error label under team name */}
                                {isError && (
                                    <div className="ov-error-label">
                                        <span className="ov-error-icon">⚠</span>
                                        CONNECTION ISSUE
                                        <div className="ov-error-msg">{health.message}</div>
                                    </div>
                                )}

                                {checking && (
                                    <div className="ov-checking-label">Checking connection...</div>
                                )}

                                {isOk && (
                                    <div className="ov-ok-label">Connected</div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default Overview;
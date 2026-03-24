import { useNavigate } from "react-router-dom";
import { FaHome, FaUser } from "react-icons/fa";
import { HiDotsVertical } from "react-icons/hi";
import "../Header.css";

export default function Header({ teams, selectedTeamID, setSelectedTeamID }) {
    const navigate = useNavigate();

    return (
        <header className="header">
            <div className="header-left">
                <button
                    onClick={() => {
                        navigate('/overview');
                        setSelectedTeamID('');
                    }}
                >
                    <FaHome className="home-icon" />
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
                <button className="add-team-btn">
                    + Add Team
                </button>
                <button className="add-team-btn">
                    + Import Teams
                </button>
                <button className="add-team-btn">
                    Download Import Template
                </button>
            </div>

            <div className="header-right">
                <button
                    onClick={() => {
                        navigate('/profile');
                        setSelectedTeamID('');
                    }}
                >
                    <FaUser className="profile-icon" />
                </button>
                <button className="mobile-menu">
                    <HiDotsVertical />
                </button>

            </div>
        </header>
    );
}
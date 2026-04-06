import { useState, useEffect } from 'react';
import { useAuth } from '../utils/AuthContext';

const Profile = () => {
    const { getProfile, updateProfile } = useAuth();

    const [form, setForm] = useState({
        email:       "",
        jiraToken:   "",
        githubToken: ""
    });

    // FIX: added error state — previously update failures were silently swallowed
    const [updateError,   setUpdateError]   = useState('');
    const [updateSuccess, setUpdateSuccess] = useState(false);

    // Load the current profile data from the backend when the page mounts
    useEffect(() => {
        const loadUser = async () => {
            const data = await getProfile();
            setForm(data);
        };
        loadUser();
    }, []);

    const handleChange = (e) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    const handleSubmit = async () => {
        // FIX: wrapped in try/catch so failures show an error instead of doing nothing
        try {
            setUpdateError('');
            setUpdateSuccess(false);
            await updateProfile(form);
            setUpdateSuccess(true);
        } catch (err) {
            setUpdateError(err.response?.data?.message || 'Update failed. Please try again.');
        }
    };

    return (
        <div style={{ marginTop: "40px", width: "360px" }} className="card">
            <h2>Account Details</h2>
            <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                placeholder="Email Address"
            />
            {/* Tokens are shown decrypted for editing — stored encrypted in DB */}
            <input
                name="jiraToken"
                value={form.jiraToken}
                onChange={handleChange}
                placeholder="Jira API Token (Optional)"
            />
            <input
                name="githubToken"
                value={form.githubToken}
                onChange={handleChange}
                placeholder="GitHub API Token (Optional)"
            />
            <button onClick={handleSubmit}>
                Save Changes
            </button>

            {/* Show success or error feedback below the button */}
            {updateSuccess && <p style={{ color: 'green' }}>Profile updated successfully.</p>}
            {updateError   && <p className="error">{updateError}</p>}
        </div>
    );
};

export default Profile;

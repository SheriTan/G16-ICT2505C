import { useState, useEffect } from 'react';
import { useAuth } from '../utils/AuthContext';

const Profile = () => {
    const { user, getProfile, updateProfile } = useAuth();
    const [form, setForm] = useState({
        email: "",
        jiraToken: "",
        githubToken: ""
    });

    useEffect(() => {
        const loadUser = async () => {
            const data = await getProfile();
            setForm(data);
        };

        loadUser();
    }, []);

    const handleChange = (e) => {
        setForm({
            ...form,
            [e.target.name]: e.target.value
        });
    };

    const handleSubmit = async () => {
        await updateProfile(form);
        alert("Profile updated!");
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
        </div>
    );
}

export default Profile;
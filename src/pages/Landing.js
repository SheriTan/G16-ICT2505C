import { useState } from 'react';
import { useAuth } from "../utils/AuthContext";
import './Landing.css';

const Landing = ({ refreshTeams }) => {
    const { login, register } = useAuth();

    const [loginError,    setLoginError]    = useState('');
    const [registerError, setRegisterError] = useState('');
    const [showRegister,  setShowRegister]  = useState(false);

    const [loginField, setLoginField] = useState({ email: '', password: '' });
    const [registerField, setRegisterField] = useState({
        email: '', password: '', jiraToken: '', githubToken: ''
    });

    const handleLogin = async () => {
        setLoginError('');
        try {
            if (!loginField.email)    return setLoginError('Please enter your email address.');
            if (!loginField.password) return setLoginError('Please enter your password.');
            await login(loginField.email, loginField.password);
            await refreshTeams();
        } catch (error) {
            setLoginError(error.response?.data?.message || 'Invalid email or password.');
        }
    };

    const handleRegister = async () => {
        setRegisterError('');
        try {
            if (!registerField.email)    return setRegisterError('Please enter an email address.');
            if (!registerField.password) return setRegisterError('Please enter a password.');
            await register(registerField.email, registerField.password, registerField.jiraToken, registerField.githubToken);
        } catch (error) {
            setRegisterError(error.response?.data?.message || 'Registration failed. Please try again.');
        }
    };

    const handleKeyDown = (e, action) => { if (e.key === 'Enter') action(); };

    return (
        <div className="landing-root">
            <div className="landing-brand">
                <div className="landing-brand-inner">
                    <h1 className="landing-title">KABAS</h1>
                    <p className="landing-subtitle">Kanban Board Assessment System</p>
                    <div className="landing-features">
                        <div className="lf-item"><span className="lf-dot" />Jira &amp; GitHub integration</div>
                        <div className="lf-item"><span className="lf-dot" />Automated metrics &amp; efficiency</div>
                        <div className="lf-item"><span className="lf-dot" />Grade recording &amp; export</div>
                        <div className="lf-item"><span className="lf-dot" />Real-time dashboard refresh</div>
                    </div>
                </div>
            </div>

            <div className="landing-form-panel">
                <div className="landing-form-box">
                    <h2 className="landing-form-title">Welcome back</h2>
                    <p className="landing-form-sub">Sign in to your KABAS account</p>

                    <div className="lf-group">
                        <label className="lf-label">Email address</label>
                        <input className="lf-input" type="email" placeholder="you@example.com"
                            value={loginField.email}
                            onChange={e => setLoginField(p => ({ ...p, email: e.target.value }))}
                            onKeyDown={e => handleKeyDown(e, handleLogin)} />
                    </div>

                    <div className="lf-group">
                        <label className="lf-label">Password</label>
                        <input className="lf-input" type="password" placeholder="••••••••"
                            value={loginField.password}
                            onChange={e => setLoginField(p => ({ ...p, password: e.target.value }))}
                            onKeyDown={e => handleKeyDown(e, handleLogin)} />
                    </div>

                    {loginError && <p className="lf-error">{loginError}</p>}

                    <button className="lf-btn-primary" onClick={handleLogin}>Sign in</button>

                    <p className="lf-register-prompt">
                        New to KABAS?{' '}
                        <button className="lf-link-btn" onClick={() => { setShowRegister(true); setLoginError(''); }}>
                            Create an account
                        </button>
                    </p>
                </div>
            </div>

            {showRegister && (
                <div className="landing-overlay" onClick={() => setShowRegister(false)}>
                    <div className="landing-modal" onClick={e => e.stopPropagation()}>
                        <button className="lm-close" onClick={() => setShowRegister(false)}>x</button>
                        <h2 className="lm-title">Create account</h2>
                        <p className="lm-sub">API tokens can be added later from your Profile page.</p>

                        <div className="lf-group">
                            <label className="lf-label">Email address</label>
                            <input className="lf-input" type="email" placeholder="you@example.com"
                                value={registerField.email}
                                onChange={e => setRegisterField(p => ({ ...p, email: e.target.value }))} />
                        </div>
                        <div className="lf-group">
                            <label className="lf-label">Password</label>
                            <input className="lf-input" type="password" placeholder="Choose a strong password"
                                value={registerField.password}
                                onChange={e => setRegisterField(p => ({ ...p, password: e.target.value }))} />
                        </div>
                        <div className="lf-group">
                            <label className="lf-label">Jira API Token <span className="lf-optional">(optional)</span></label>
                            <input className="lf-input" placeholder="Paste your Jira token"
                                value={registerField.jiraToken}
                                onChange={e => setRegisterField(p => ({ ...p, jiraToken: e.target.value }))} />
                        </div>
                        <div className="lf-group">
                            <label className="lf-label">GitHub API Token <span className="lf-optional">(optional)</span></label>
                            <input className="lf-input" placeholder="Paste your GitHub token"
                                value={registerField.githubToken}
                                onChange={e => setRegisterField(p => ({ ...p, githubToken: e.target.value }))} />
                        </div>

                        {registerError && <p className="lf-error">{registerError}</p>}

                        <button className="lf-btn-primary" onClick={handleRegister}>Create account</button>

                        <p className="lf-register-prompt" style={{ marginTop: 12 }}>
                            Already have an account?{' '}
                            <button className="lf-link-btn" onClick={() => setShowRegister(false)}>Sign in</button>
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Landing;
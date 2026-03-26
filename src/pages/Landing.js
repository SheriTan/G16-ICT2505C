import { useState } from 'react';
import { useAuth } from "../utils/AuthContext";

const Landing = () => {
    const { login, register } = useAuth();
    const [loginError, setLoginError] = useState('');
    const [registerError, setRegisterError] = useState('');
    const [loginField, setLoginField] = useState({
        email: ''
    });

    const [registerField, setRegisterField] = useState({
        email: '',
        jiraToken: '',
        githubToken: ''
    });

    const handleLogin = async () => {
        setLoginError('');
        setRegisterError('');
        try {
            if (!loginField.email) {
                return setLoginError('Please provide an Email Address');
            }
            await login(loginField.email);
        } catch (error) {
            setLoginError(error.response.data.message || 'An unexpected error occurred. Please try again later.');
        }
    }

    const handleRegister = async () => {
        setLoginError('');
        setRegisterError('');

        try {
            if (!registerField.email) {
                return setRegisterError('Please provide an Email Address');
            }
            await register(registerField.email, registerField.jiraToken, registerField.githubToken);
        }
        catch (error) {
            setRegisterError(error.response.data.message || 'An unexpected error occurred. Please try again later.');
        }
    }

    const handleInputChange = (e, type) => {
        e.preventDefault();
        const { name, value } = e.target;

        if (type === 'register') {
            setRegisterField((prevState) => ({
                ...prevState,
                [name]: value
            }))
        } else if (type === 'login') {
            setLoginField((prevState) => ({
                ...prevState,
                [name]: value
            }))
        }
    }

    return (
        <div className='pageWrapper'>
            <div className='card'>
                <h2>Login</h2>
                <input type='email' name='email' placeholder='Email Address'
                    onChange={(e) => handleInputChange(e, 'login')} />
                <button onClick={handleLogin}>Login</button>
                {loginError && <p className="error">{loginError}</p>}
            </div>
            <div className='card'>
                <h2>Register</h2>
                <input type='email' name='email' placeholder='Email Address'
                    onChange={(e) => handleInputChange(e, 'register')} />
                <input name='jiraToken' placeholder='Jira API Token (Optional)'
                    onChange={(e) => handleInputChange(e, 'register')} />
                <input name='githubToken' placeholder='GitHub API Token (Optional)'
                    onChange={(e) => handleInputChange(e, 'register')} />
                <button onClick={handleRegister}>Register</button>
                {registerError && <p className="error">{registerError}</p>}
            </div>
        </div>
    )
}

export default Landing;
import { useState } from 'react';
import { useAuth } from "../utils/AuthContext";

const Landing = () => {
    const { login, register } = useAuth();
    const [loginField, setLoginField] = useState({
        email: ''
    });

    const [registerField, setRegisterField] = useState({
        email: '',
        jiraToken: '',
        githubToken: ''
    });

    const handleLogin = async () => {
        await login(loginField.email);
    }

    const handleRegister = async () => {
        console.log(registerField)
        await register(registerField.email, registerField.jiraToken, registerField.githubToken);
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
            </div>
        </div>
    )
}

export default Landing;
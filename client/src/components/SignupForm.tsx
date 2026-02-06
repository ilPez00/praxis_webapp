import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const SignupForm: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [age, setAge] = useState('');
    const [bio, setBio] = useState('');
    const [message, setMessage] = useState('');
    const navigate = useNavigate();

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const response = await axios.post('http://localhost:3001/auth/signup', {
                email,
                password,
                name,
                age: parseInt(age),
                bio,
            });
            setMessage(response.data.message);
            navigate('/login'); // Redirect to login after successful signup
        } catch (error: any) {
            setMessage(error.response?.data?.message || 'Signup failed.');
        }
    };

    return (
        <form onSubmit={handleSignup}>
            <h2>Signup</h2>
            <p>{message}</p>
            <div>
                <label>Email:</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div>
                <label>Password:</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <div>
                <label>Name:</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div>
                <label>Age:</label>
                <input type="number" value={age} onChange={(e) => setAge(e.target.value)} required />
            </div>
            <div>
                <label>Bio:</label>
                <textarea value={bio} onChange={(e) => setBio(e.target.value)} required />
            </div>
            <button type="submit">Signup</button>
            <p>Already have an account? <a href="/login">Login here</a></p>
        </form>
    );
};

export default SignupForm;
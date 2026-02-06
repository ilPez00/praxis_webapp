import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const LoginForm: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await axios.post('http://localhost:3001/auth/login', {
        email,
        password,
      });
      setMessage(response.data.message);
      // In a real app, save the token and user ID to local storage or context
      const userId = response.data.user.id; // Assuming the backend sends back user ID
      localStorage.setItem('userId', userId); // Store user ID
      navigate(`/profile/${userId}`); // Redirect to user's profile
    } catch (error: any) {
      setMessage(error.response?.data?.message || 'Login failed.');
    }
  };

  return (
    <form onSubmit={handleLogin}>
      <h2>Login</h2>
      <p>{message}</p>
      <div>
        <label>Email:</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <div>
        <label>Password:</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </div>
      <button type="submit">Login</button>
      <p>Don't have an account? <a href="/signup">Signup here</a></p>
    </form>
  );
};

export default LoginForm;

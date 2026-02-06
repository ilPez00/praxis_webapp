import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';
import './styles/pages.css'; // This imports ALL page styles at once

function App() {
  const [message, setMessage] = useState('');

  useEffect(() => {
    axios.get('http://localhost:3001')
      .then(response => {
        setMessage(response.data);
      })
      .catch(error => {
        console.error('There was an error fetching the data!', error);
      });
  }, []);

  return (
    <div className="App">
      <header className="App-header">
        <p>
          {message}
        </p>
      </header>
    </div>
  );
}

export default App;
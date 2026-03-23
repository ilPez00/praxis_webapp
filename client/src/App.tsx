import React, { useState, useEffect } from 'react';
import api from './lib/api';
import './App.css';
import './styles/pages.css'; // This imports ALL page styles at once

function App() {
  const [message, setMessage] = useState('');

  useEffect(() => {
    api.get('/')
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
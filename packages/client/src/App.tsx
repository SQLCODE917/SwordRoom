import { FormEvent, useState } from 'react';
import type { HelloResponse } from '@starter/core';
import { fetchHello } from './services/api';

export default function App() {
  const [name, setName] = useState('World');
  const [response, setResponse] = useState<HelloResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const data = await fetchHello({ name });
      setResponse(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setResponse(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ fontFamily: 'sans-serif', maxWidth: 480, margin: '2rem auto' }}>
      <h1>Hello Monorepo</h1>
      <form onSubmit={onSubmit}>
        <label htmlFor="name">Name</label>
        <input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ marginLeft: 8 }}
        />
        <button type="submit" disabled={loading} style={{ marginLeft: 8 }}>
          {loading ? 'Loading...' : 'Fetch'}
        </button>
      </form>

      {error && <p role="alert">{error}</p>}
      {response && (
        <section aria-label="hello-response" style={{ marginTop: 16 }}>
          <p>{response.message}</p>
          <small>{response.timestamp}</small>
        </section>
      )}
    </main>
  );
}

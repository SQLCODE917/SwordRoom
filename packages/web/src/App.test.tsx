import { afterEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';
import { writeDevSession } from './auth/DevAuthProvider';

describe('App shell routes', () => {
  afterEach(() => {
    window.localStorage.clear();
    window.history.pushState({}, '', '/');
  });

  it('redirects unauthenticated users to the account page', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Sword Room Online' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Account' })).toBeTruthy();
  });

  it('renders home page when a dev session exists', async () => {
    writeDevSession({ username: 'player-aaa', actorId: 'player-aaa' });
    window.history.pushState({}, '', '/');
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Home' })).toBeTruthy();
  });
});

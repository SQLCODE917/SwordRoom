import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

describe('App shell routes', () => {
  it('renders home page inside app shell', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Character Creation Vertical Slice' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Home' })).toBeTruthy();
  });
});

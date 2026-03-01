import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

describe('Web app scaffold', () => {
  it('renders placeholder text for the vertical slice', () => {
    render(<App />);
    expect(screen.getByText('Character Creation Vertical Slice')).toBeTruthy();
  });
});

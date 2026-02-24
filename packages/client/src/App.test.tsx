import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import App from './App';
import { fetchHello } from './services/api';

vi.mock('./services/api', () => ({
  fetchHello: vi.fn(),
}));

const fetchHelloMock = vi.mocked(fetchHello);

describe('App', () => {
  it('renders response from API', async () => {
    fetchHelloMock.mockResolvedValue({
      message: 'Hello, Ada!',
      source: 'core',
      timestamp: '2024-01-01T00:00:00.000Z',
    });

    render(<App />);

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Ada' } });
    fireEvent.click(screen.getByRole('button', { name: 'Fetch' }));

    await waitFor(() => {
      expect(screen.getByText('Hello, Ada!')).toBeTruthy();
    });
  });
});

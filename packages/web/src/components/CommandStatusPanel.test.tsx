import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CommandStatusPanel } from './CommandStatusPanel';

describe('CommandStatusPanel', () => {
  it('renders idle state in reserved panel', () => {
    render(
      <CommandStatusPanel
        status={{
          state: 'Idle',
          commandId: null,
          message: 'No command submitted yet.',
          errorCode: null,
          errorMessage: null,
        }}
      />
    );

    expect(screen.getByText('State: Idle')).toBeTruthy();
    expect(screen.getByText('No command submitted yet.')).toBeTruthy();
  });
});

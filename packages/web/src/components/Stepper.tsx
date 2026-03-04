import type { ReactNode } from 'react';

export interface StepperItem {
  id: string;
  title: string;
  panel: ReactNode;
  isError?: boolean;
}

interface StepperProps {
  steps: StepperItem[];
  activeStepIndex: number;
  onStepChange: (index: number) => void;
  getPanelRef?: (index: number) => (element: HTMLElement | null) => void;
}

export function Stepper({ steps, activeStepIndex, onStepChange, getPanelRef }: StepperProps) {
  return (
    <div className="c-stepper">
      <div className="l-row">
        {steps.map((step, index) => {
          const stateClasses = [
            index === activeStepIndex ? 'is-active' : '',
            step.isError ? 'is-error' : '',
          ]
            .filter(Boolean)
            .join(' ');

          return (
            <button
              key={step.id}
              type="button"
              className={`c-stepper__step c-btn ${stateClasses}`.trim()}
              onClick={() => onStepChange(index)}
              aria-current={index === activeStepIndex ? 'step' : undefined}
            >
              <span className="c-stepper__title">{index + 1}) {step.title}</span>
            </button>
          );
        })}
      </div>

      <div className="l-col">
        {steps.map((step, index) => {
          const stateClasses = [
            index === activeStepIndex ? 'is-active' : '',
            index !== activeStepIndex ? 'is-disabled' : '',
            step.isError ? 'is-error' : '',
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <section
              key={step.id}
              className={`c-stepper__panel ${stateClasses}`.trim()}
              aria-disabled={index !== activeStepIndex}
              aria-label={step.title}
              ref={getPanelRef ? getPanelRef(index) : undefined}
            >
              {step.panel}
            </section>
          );
        })}
      </div>
    </div>
  );
}

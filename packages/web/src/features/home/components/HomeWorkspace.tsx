import { Link } from 'react-router-dom';
import { ButtonLink } from '../../../components/ButtonLink';
import {
  type ActionDeckViewModel,
  type ActionViewModel,
  type CharacterRowViewModel,
  type GameRowViewModel,
  type HomeTabViewModel,
  type HomeWorkspaceStateViewModel,
  type HomeWorkspaceViewModel,
  type MyGamesWorkspaceStateViewModel,
  type PublicGamesWorkspaceStateViewModel,
  type YourCharactersWorkspaceStateViewModel,
} from '../viewModel';
import styles from '../HomePage.module.css';

export function HomeWorkspace({
  workspace,
}: {
  workspace: HomeWorkspaceViewModel;
}) {
  return (
    <section className={styles.homeWorkspace} aria-label="Home workspace">
      <HomeTabs tabs={workspace.tabs} />
      <div className={styles.tabPanel}>
        <HomeWorkspaceState state={workspace.active} />
      </div>
    </section>
  );
}

export function ActionDeck(input: { actions: ActionDeckViewModel }) {
  return (
    <div className={styles.actionDeck}>
      <div className={styles.primaryAction}>{renderAction(input.actions.primary)}</div>
      {input.actions.secondary.length > 0 ? (
        <details className={styles.secondaryActions}>
          <summary className={`c-btn ${styles.secondarySummary}`}>
            {input.actions.moreLabel}
          </summary>
          <div className={styles.secondaryList}>
            {input.actions.secondary.map((action) => renderAction(action))}
          </div>
        </details>
      ) : (
        <div className={styles.secondaryPlaceholder}>
          <span
            className={`c-btn is-disabled ${styles.secondaryPlaceholderButton}`}
            aria-hidden="true"
          >
            No Secondary Actions
          </span>
        </div>
      )}
    </div>
  );
}

function HomeTabs({ tabs }: { tabs: HomeTabViewModel[] }) {
  return (
    <nav className={styles.tabList} aria-label="Home sections" role="tablist">
      {tabs.map((tab) => (
        <Link
          key={tab.id}
          className={`c-btn ${styles.tabLink}`}
          to={tab.href}
          role="tab"
          aria-selected={tab.selected}
          aria-current={tab.selected ? 'page' : undefined}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

function HomeWorkspaceState({ state }: { state: HomeWorkspaceStateViewModel }) {
  switch (state.kind) {
    case 'my-games':
      return <MyGamesWorkspace state={state} />;
    case 'public-games':
      return <PublicGamesWorkspace state={state} />;
    case 'your-characters':
      return <YourCharactersWorkspace state={state} />;
  }
}

function MyGamesWorkspace({ state }: { state: MyGamesWorkspaceStateViewModel }) {
  return (
    <section className="l-col" aria-label="My Games section">
      <div className={styles.sectionHeader}>
        <SectionTitle title={state.title} />
        <ButtonLink to={state.createGameHref}>Create Game</ButtonLink>
      </div>
      <MyGamesTable
        rows={state.rows}
        loading={state.loading}
        emptyText={state.emptyText}
      />
    </section>
  );
}

function PublicGamesWorkspace({
  state,
}: {
  state: PublicGamesWorkspaceStateViewModel;
}) {
  return (
    <section className="l-col" aria-label="Public Games section">
      <div className={styles.sectionHeader}>
        <SectionTitle title={state.title} />
        <ButtonLink to={state.createGameHref}>Create Game</ButtonLink>
      </div>
      <PublicGamesTable
        rows={state.rows}
        loading={state.loading}
        emptyText={state.emptyText}
      />
    </section>
  );
}

function YourCharactersWorkspace({
  state,
}: {
  state: YourCharactersWorkspaceStateViewModel;
}) {
  return (
    <section className="l-col" aria-label="Your Characters section">
      <div className={styles.sectionHeader}>
        <SectionTitle title={state.title} />
        <ButtonLink to={state.newCharacterHref}>New Character</ButtonLink>
      </div>
      <CharactersTable
        rows={state.rows}
        loading={state.loading}
        emptyText={state.emptyText}
      />
    </section>
  );
}

function SectionTitle({ title }: { title: string }) {
  return <h3 className="t-h4">{title}</h3>;
}

function CharactersTable(input: {
  rows: CharacterRowViewModel[];
  loading: boolean;
  emptyText: string;
}) {
  return (
    <table className={styles.table} aria-label="Your Characters">
      <thead>
        <tr>
          <th className={`${styles.headerCell} t-small`} scope="col">
            Character
          </th>
          <th className={`${styles.headerCell} t-small`} scope="col">
            Status
          </th>
          <th className={`${styles.headerCell} t-small`} scope="col">
            Actions
          </th>
        </tr>
      </thead>
      <tbody>
        {input.rows.length === 0 ? (
          renderLoadingOrEmptyRows({
            loading: input.loading,
            emptyText: input.emptyText,
            loadingLabel: 'Loading characters...',
            columnCount: 3,
          })
        ) : (
          input.rows.map((row) => (
            <tr key={row.key}>
              <td className={`${styles.bodyCell} t-small`}>{row.characterName}</td>
              <td className={`${styles.bodyCell} t-small`}>{row.status}</td>
              <td className={`${styles.bodyCell} t-small`}>
                <ActionDeck actions={row.actions} />
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}

function MyGamesTable(input: {
  rows: GameRowViewModel[];
  loading: boolean;
  emptyText: string;
}) {
  return (
    <table className={styles.table} aria-label="My Games">
      <thead>
        <tr>
          <th className={`${styles.headerCell} t-small`} scope="col">
            Game
          </th>
          <th className={`${styles.headerCell} t-small`} scope="col">
            Visibility
          </th>
          <th className={`${styles.headerCell} t-small`} scope="col">
            Actions
          </th>
        </tr>
      </thead>
      <tbody>
        {input.rows.length === 0 ? (
          renderLoadingOrEmptyRows({
            loading: input.loading,
            emptyText: input.emptyText,
            loadingLabel: 'Loading games...',
            columnCount: 3,
          })
        ) : (
          input.rows.map((row) => (
            <tr key={row.key}>
              <td className={`${styles.bodyCell} t-small`}>
                <div>{row.gameName}</div>
                {row.phaseLabel ? <div className="t-small">Phase: {row.phaseLabel}</div> : null}
              </td>
              <td className={`${styles.bodyCell} t-small`}>{row.visibility}</td>
              <td className={`${styles.bodyCell} t-small`}>
                <ActionDeck actions={row.actions} />
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}

export function PublicGamesTable(input: {
  rows: GameRowViewModel[];
  loading: boolean;
  emptyText: string;
}) {
  return (
    <table className={styles.table} aria-label="Public Games">
      <thead>
        <tr>
          <th className={`${styles.headerCell} t-small`} scope="col">
            Game
          </th>
          <th className={`${styles.headerCell} t-small`} scope="col">
            Visibility
          </th>
          <th className={`${styles.headerCell} t-small`} scope="col">
            Actions
          </th>
        </tr>
      </thead>
      <tbody>
        {input.rows.length === 0 ? (
          renderLoadingOrEmptyRows({
            loading: input.loading,
            emptyText: input.emptyText,
            loadingLabel: 'Loading games...',
            columnCount: 3,
          })
        ) : (
          input.rows.map((row) => (
            <tr key={row.key}>
              <td className={`${styles.bodyCell} t-small`}>
                <div>{row.gameName}</div>
                {row.phaseLabel ? <div className="t-small">Phase: {row.phaseLabel}</div> : null}
              </td>
              <td className={`${styles.bodyCell} t-small`}>{row.visibility}</td>
              <td className={`${styles.bodyCell} t-small`}>
                <ActionDeck actions={row.actions} />
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}

function renderAction(action: ActionViewModel) {
  if (action.kind === 'link') {
    return (
      <ButtonLink
        key={action.key}
        to={action.to}
        disabled={action.disabled}
        disabledReason={action.disabledReason}
        variant={action.variant}
      >
        {action.label}
      </ButtonLink>
    );
  }

  return (
    <button
      key={action.key}
      className={[
        'c-btn',
        action.variant === 'destructive' ? 'c-btn--destructive' : '',
        action.disabled ? 'is-disabled' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      type="button"
      disabled={action.disabled}
      onClick={action.onClick}
    >
      {action.label}
    </button>
  );
}

function renderLoadingOrEmptyRows(input: {
  loading: boolean;
  emptyText: string;
  loadingLabel: string;
  columnCount: number;
}) {
  if (input.loading) {
    return Array.from({ length: 3 }, (_, index) => (
      <tr key={`loading-${index}`}>
        <td className={`${styles.bodyCell} t-small`} colSpan={input.columnCount}>
          <div className={styles.loadingRow}>
            <span>{input.loadingLabel}</span>
            <span className={`c-btn is-disabled ${styles.loadingActionPlaceholder}`}>
              Loading...
            </span>
          </div>
        </td>
      </tr>
    ));
  }

  return (
    <tr>
      <td className={`${styles.bodyCell} t-small`} colSpan={input.columnCount}>
        {input.emptyText}
      </td>
    </tr>
  );
}

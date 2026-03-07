import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { createApiClient, type CharacterItem } from '../api/ApiClient';
import { useAuthProvider } from '../auth/AuthProvider';
import { ImageBox } from '../components/ImageBox';
import { Panel } from '../components/Panel';
import { SheetTabs, type SheetTabItem } from '../components/SheetTabs';
import { StatBox } from '../components/StatBox';
import { TableLite, type TableLiteColumn } from '../components/TableLite';

type StatKey = 'dex' | 'agi' | 'int' | 'str' | 'lf' | 'mp';

interface SubAbilityView {
  A: number;
  B: number;
  C: number;
  D: number;
  E: number;
  F: number;
  G: number;
  H: number;
}

interface AbilityView {
  dex: number;
  agi: number;
  int: number;
  str: number;
  lf: number;
  mp: number;
}

interface SkillRow {
  name: string;
  level: number;
}

interface PurchaseRow {
  category: string;
  itemId: string;
  qty: number;
  reqStr: number | null;
  costGamels: number;
}

interface HeaderView {
  characterName: string;
  playerName: string;
  raceLabel: string;
  gender: string;
  age: string;
  origin: string;
}

interface SheetView {
  status: string;
  header: HeaderView;
  subAbility: SubAbilityView;
  ability: AbilityView;
  bonus: AbilityView;
  expTotal: number;
  expUnspent: number;
  skills: SkillRow[];
  imageUrl: string | null;
  notes: string;
  moneyGamels: number;
  purchases: PurchaseRow[];
}

const statKeys: StatKey[] = ['dex', 'agi', 'int', 'str', 'lf', 'mp'];

const abilityLabelByKey: Record<StatKey, string> = {
  dex: 'DEX',
  agi: 'AGI',
  int: 'INT',
  str: 'STR',
  lf: 'LF',
  mp: 'MP',
};

const subAbilityColumns: Array<TableLiteColumn<{ key: keyof SubAbilityView; value: number }>> = [
  { id: 'sub-ability', header: 'Sub-Ability', render: (row) => row.key },
  { id: 'sub-value', header: 'Value', render: (row) => row.value },
];

const skillColumns: Array<TableLiteColumn<SkillRow>> = [
  { id: 'skill-name', header: 'Skill', render: (row) => row.name },
  { id: 'skill-level', header: 'Level', render: (row) => row.level },
];

const languageColumns: Array<TableLiteColumn<{ language: string; speak: string; read: string }>> = [
  { id: 'language-name', header: 'Language', render: (row) => row.language },
  { id: 'language-speak', header: 'Speak', render: (row) => row.speak },
  { id: 'language-read', header: 'Read', render: (row) => row.read },
];

const magicColumns: Array<TableLiteColumn<{ rune: string; level: string; magicPower: string }>> = [
  { id: 'magic-rune', header: 'Rune', render: (row) => row.rune },
  { id: 'magic-level', header: 'Level', render: (row) => row.level },
  { id: 'magic-power', header: 'Magic Power', render: (row) => row.magicPower },
];

const equipmentColumns: Array<TableLiteColumn<PurchaseRow>> = [
  { id: 'equip-category', header: 'Category', render: (row) => row.category },
  { id: 'equip-item', header: 'Item', render: (row) => row.itemId },
  { id: 'equip-qty', header: 'Qty', render: (row) => row.qty },
  {
    id: 'equip-reqstr',
    header: 'Req STR',
    render: (row) => (row.reqStr === null ? '-' : row.reqStr),
  },
  { id: 'equip-cost', header: 'Cost (G)', render: (row) => row.costGamels },
];

const combatColumns: Array<TableLiteColumn<{ label: string; value: string }>> = [
  { id: 'combat-label', header: 'Field', render: (row) => row.label },
  { id: 'combat-value', header: 'Value', render: (row) => row.value },
];

const emptyLanguageRows = [
  { language: ' ', speak: ' ', read: ' ' },
  { language: ' ', speak: ' ', read: ' ' },
  { language: ' ', speak: ' ', read: ' ' },
];

const emptyMagicRows = [
  { rune: ' ', level: ' ', magicPower: ' ' },
  { rune: ' ', level: ' ', magicPower: ' ' },
  { rune: ' ', level: ' ', magicPower: ' ' },
];

const emptyCombatRows = [
  { label: 'Attack', value: ' ' },
  { label: 'Strike', value: ' ' },
  { label: 'Critical', value: ' ' },
  { label: 'Bonus Damage', value: ' ' },
  { label: 'Evasion', value: ' ' },
  { label: 'Defense', value: ' ' },
  { label: 'Damage Reduction', value: ' ' },
];

export function CharacterSheetPage() {
  const auth = useAuthProvider();
  const api = useMemo(() => createApiClient({ auth }), [auth]);
  const params = useParams<{ gameId: string; characterId: string }>();
  const gameId = params.gameId ?? 'game-1';
  const characterId = params.characterId ?? 'char-human-1';

  const [activeTabId, setActiveTabId] = useState('sheet-page-1');
  const [character, setCharacter] = useState<CharacterItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(' ');

  const refreshCharacter = useCallback(async () => {
    const response = await api.getCharacter(gameId, characterId);
    setCharacter(response);
    setError(response ? null : `Character not found: ${characterId}`);
  }, [api, characterId, gameId]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const response = await api.getCharacter(gameId, characterId);
        if (cancelled) {
          return;
        }
        setCharacter(response);
        setError(response ? null : `Character not found: ${characterId}`);
      } catch (loadError) {
        if (cancelled) {
          return;
        }
        const message = loadError instanceof Error ? loadError.message : String(loadError);
        setError(message);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [api, characterId, gameId]);

  const view = useMemo(() => normalizeCharacter(character), [character]);
  const noticeClassName = useMemo(() => `c-note ${error ? 'c-note--error' : 'c-note--info'}`, [error]);

  const subAbilityRows = useMemo(
    () =>
      (Object.keys(view.subAbility) as Array<keyof SubAbilityView>).map((key) => ({
        key,
        value: view.subAbility[key],
      })),
    [view.subAbility]
  );

  const tabs: SheetTabItem[] = [
    {
      id: 'sheet-page-1',
      title: 'Character Sheet (1)',
      panel: (
        <div className="c-sheet__page l-col">
          <Panel title="Character Header" subtitle="Identity and origin">
            <div className="c-sheet__header-grid">
              <HeaderField label="Name" value={view.header.characterName} />
              <HeaderField label="Player" value={view.header.playerName} />
              <HeaderField label="Race" value={view.header.raceLabel} />
              <HeaderField label="Age" value={view.header.age} />
              <HeaderField label="Gender" value={view.header.gender} />
              <HeaderField label="Origin" value={view.header.origin} />
            </div>
          </Panel>

          <div className="c-sheet__page1-main l-split">
            <div className="c-sheet__page1-left l-col l-grow">
              <Panel title="Ability Block" subtitle="Sub-abilities, derived abilities, and bonuses.">
                <TableLite
                  ariaLabel="Sub-abilities"
                  columns={subAbilityColumns}
                  rows={subAbilityRows}
                  placeholder="No sub-abilities."
                />
                <div className="c-sheet__stats-grid">
                  {statKeys.map((statKey) => (
                    <StatBox
                      key={statKey}
                      variant={statKey}
                      label={abilityLabelByKey[statKey]}
                      value={view.ability[statKey]}
                      sub={`Bonus ${formatBonus(view.bonus[statKey])}`}
                    />
                  ))}
                </div>
              </Panel>

              <Panel title="Skills Block" subtitle="Experience and acquired skills.">
                <div className="l-row">
                  <div className="c-note c-note--info l-grow" role="note">
                    <span className="t-small">EXP Total: {view.expTotal}</span>
                  </div>
                  <div className="c-note c-note--info l-grow" role="note">
                    <span className="t-small">EXP Unspent: {view.expUnspent}</span>
                  </div>
                </div>
                <TableLite ariaLabel="Skills" columns={skillColumns} rows={view.skills} placeholder="No skills." />
              </Panel>
            </div>

            <div className="c-sheet__page1-right l-col l-grow">
              <Panel title="Appearance Block" subtitle="Portrait preview (upload in a later ticket).">
                <ImageBox
                  imageUrl={view.imageUrl}
                  placeholder="No portrait uploaded."
                  isLoading={uploading}
                  errorMessage={uploadError}
                  onFileSelected={(file) => void handleImageUpload(file)}
                />
                <div className="c-note c-note--info" role="note">
                  <span className="t-small">{view.notes || 'No notes.'}</span>
                </div>
              </Panel>

              <Panel title="Languages Block" subtitle="Placeholder rows for this slice.">
                <TableLite
                  ariaLabel="Languages"
                  columns={languageColumns}
                  rows={emptyLanguageRows}
                  placeholder="No language entries."
                />
              </Panel>

              <Panel title="Magic Block" subtitle="Placeholder rows for this slice.">
                <TableLite ariaLabel="Magic" columns={magicColumns} rows={emptyMagicRows} placeholder="No magic entries." />
              </Panel>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'sheet-page-2',
      title: 'Character Sheet (2)',
      panel: (
        <div className="c-sheet__page l-col">
          <Panel title="Equipment Block" subtitle="Money and purchased equipment lists.">
            <div className="c-note c-note--info" role="note">
              <span className="t-small">Money (Gamels): {view.moneyGamels}</span>
            </div>
            <TableLite
              ariaLabel="Equipment"
              columns={equipmentColumns}
              rows={view.purchases}
              placeholder="No equipment purchases."
            />
          </Panel>

          <Panel title="Combat Summary Block" subtitle="Placeholder values; layout remains stable.">
            <TableLite
              ariaLabel="Combat Summary"
              columns={combatColumns}
              rows={emptyCombatRows}
              placeholder="No combat values."
            />
          </Panel>
        </div>
      ),
    },
  ];

  return (
    <div className="l-page c-sheet">
      <Panel
        title="Character Sheet"
        subtitle={`Game ${gameId} / Character ${characterId}`}
        footer={<span className="t-small">Status: {view.status}</span>}
      >
        <div className={noticeClassName} role="note" aria-live="polite">
          <span className="t-small">
            {error ?? (loading ? 'Loading character...' : 'Read-only sheet bound to GET /games/{gameId}/characters/{characterId}.')}
          </span>
        </div>
        <SheetTabs tabs={tabs} activeTabId={activeTabId} onTabChange={setActiveTabId} />
      </Panel>
    </div>
  );

  async function handleImageUpload(file: File) {
    setUploadError(' ');
    setUploading(true);
    try {
      const uploadSession = await api.requestAppearanceUploadUrl(gameId, characterId, {
        contentType: file.type,
        fileName: file.name,
        fileSizeBytes: file.size,
      });

      const putResponse = await fetch(uploadSession.putUrl, {
        method: 'PUT',
        headers: {
          'content-type': file.type,
        },
        body: file,
      });
      if (!putResponse.ok) {
        throw new Error(`Upload failed: ${putResponse.status} ${putResponse.statusText}`);
      }

      const confirm = await api.confirmAppearanceUpload(gameId, characterId, {
        uploadId: uploadSession.uploadId,
        s3Key: uploadSession.s3Key,
      });
      if (!confirm.ok) {
        throw new Error('Upload confirmation failed.');
      }

      await refreshCharacter();
    } catch (uploadFailure) {
      setUploadError(uploadFailure instanceof Error ? uploadFailure.message : String(uploadFailure));
    } finally {
      setUploading(false);
    }
  }
}

function HeaderField({ label, value }: { label: string; value: string }) {
  return (
    <div className="c-sheet__header-field">
      <span className="t-small">{label}</span>
      <span className="t-body">{value || ' '}</span>
    </div>
  );
}

function normalizeCharacter(raw: CharacterItem | null): SheetView {
  const defaultSubAbility: SubAbilityView = { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0, G: 0, H: 0 };
  const defaultAbility: AbilityView = { dex: 0, agi: 0, int: 0, str: 0, lf: 0, mp: 0 };

  const characterRecord: Record<string, unknown> = isRecord(raw) ? raw : {};
  const draft = isRecord(characterRecord.draft) ? characterRecord.draft : {};
  const identity = isRecord(draft.identity) ? draft.identity : {};
  const background = isRecord(draft.background) ? draft.background : {};
  const starting = isRecord(draft.starting) ? draft.starting : {};
  const purchases = isRecord(draft.purchases) ? draft.purchases : {};
  const appearance = isRecord(draft.appearance) ? draft.appearance : {};

  const subAbility = normalizeSubAbility(draft.subAbility) ?? defaultSubAbility;
  const derivedFromSub = computeAbilityFromSubAbility(subAbility);
  const ability = normalizeAbility(draft.ability) ?? derivedFromSub;
  const bonus = normalizeAbility(draft.bonus) ?? computeBonus(ability);
  const race = readString(draft.race);
  const raisedBy = readString(draft.raisedBy);
  const raceLabel = formatRaceLabel(race, raisedBy);
  const origin = formatOriginLabel(readString(background.kind), race, raisedBy);

  return {
    status: readString(characterRecord.status) || 'DRAFT',
    header: {
      characterName: readString(identity.name) || ' ',
      playerName: readString(characterRecord.ownerPlayerId) || ' ',
      raceLabel,
      gender: readString(identity.gender) || ' ',
      age: formatOptionalNumber(identity.age),
      origin,
    },
    subAbility,
    ability,
    bonus,
    expTotal: readNumber(starting.expTotal),
    expUnspent: readNumber(starting.expUnspent),
    skills: normalizeSkillRows(draft.skills),
    imageUrl: readString(appearance.imageUrl) || null,
    notes: readString(draft.gmNote) || ' ',
    moneyGamels: readNumber(starting.moneyGamels),
    purchases: normalizePurchases(purchases),
  };
}

function computeAbilityFromSubAbility(subAbility: SubAbilityView): AbilityView {
  return {
    dex: subAbility.A + subAbility.B,
    agi: subAbility.B + subAbility.C,
    int: subAbility.C + subAbility.D,
    str: subAbility.E + subAbility.F,
    lf: subAbility.F + subAbility.G,
    mp: subAbility.G + subAbility.H,
  };
}

function computeBonus(ability: AbilityView): AbilityView {
  return {
    dex: Math.floor(ability.dex / 6),
    agi: Math.floor(ability.agi / 6),
    int: Math.floor(ability.int / 6),
    str: Math.floor(ability.str / 6),
    lf: Math.floor(ability.lf / 6),
    mp: Math.floor(ability.mp / 6),
  };
}

function normalizeSubAbility(value: unknown): SubAbilityView | null {
  const record = isRecord(value) ? value : null;
  if (!record) {
    return null;
  }
  return {
    A: readNumber(record.A),
    B: readNumber(record.B),
    C: readNumber(record.C),
    D: readNumber(record.D),
    E: readNumber(record.E),
    F: readNumber(record.F),
    G: readNumber(record.G),
    H: readNumber(record.H),
  };
}

function normalizeAbility(value: unknown): AbilityView | null {
  const record = isRecord(value) ? value : null;
  if (!record) {
    return null;
  }
  return {
    dex: readNumber(record.dex),
    agi: readNumber(record.agi),
    int: readNumber(record.int),
    str: readNumber(record.str),
    lf: readNumber(record.lf),
    mp: readNumber(record.mp),
  };
}

function normalizeSkillRows(value: unknown): SkillRow[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const rows: SkillRow[] = [];
  for (const item of value) {
    const record = isRecord(item) ? item : null;
    if (!record) {
      continue;
    }
    const name = readString(record.skill);
    if (!name) {
      continue;
    }
    rows.push({
      name,
      level: readNumber(record.level),
    });
  }
  return rows;
}

function normalizePurchases(value: Record<string, unknown>): PurchaseRow[] {
  const rows: PurchaseRow[] = [];

  pushPurchaseRows(rows, 'Weapon', value.weapons, false);
  pushPurchaseRows(rows, 'Armor', value.armor, false);
  pushPurchaseRows(rows, 'Shield', value.shields, false);
  pushPurchaseRows(rows, 'Gear', value.gear, true);

  return rows;
}

function pushPurchaseRows(rows: PurchaseRow[], category: string, value: unknown, withQty: boolean): void {
  if (!Array.isArray(value)) {
    return;
  }

  for (const item of value) {
    const record = isRecord(item) ? item : null;
    if (!record) {
      continue;
    }
    const itemId = readString(record.itemId);
    if (!itemId) {
      continue;
    }

    rows.push({
      category,
      itemId,
      qty: withQty ? Math.max(1, readNumber(record.qty)) : 1,
      reqStr: withQty ? null : readNumber(record.reqStr),
      costGamels: readNumber(record.costGamels),
    });
  }
}

function formatRaceLabel(race: string, raisedBy: string): string {
  if (race === 'HALF_ELF' && raisedBy) {
    return `${formatLabel(race)} (${formatLabel(raisedBy)})`;
  }
  return formatLabel(race) || ' ';
}

function formatOriginLabel(backgroundKind: string, race: string, raisedBy: string): string {
  if (backgroundKind) {
    return formatLabel(backgroundKind);
  }
  if (race === 'HALF_ELF') {
    if (raisedBy === 'ELVES') {
      return 'Elf package';
    }
    if (raisedBy === 'HUMANS') {
      return 'Human backgrounds';
    }
  }
  if (race) {
    return `${formatLabel(race)} package`;
  }
  return ' ';
}

function formatBonus(value: number): string {
  return value >= 0 ? `+${value}` : String(value);
}

function formatOptionalNumber(value: unknown): string {
  return typeof value === 'number' ? String(value) : ' ';
}

function formatLabel(value: string): string {
  return value
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function readNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export type EquipmentRosterCategory = 'weapon' | 'armor' | 'shield' | 'gear';

export interface EquipmentRosterItem {
  itemId: string;
  label: string;
  category: EquipmentRosterCategory;
  group: string;
  usage?: string;
  requiredStrength?: string | number;
  priceSpec: string | number;
  tags?: string[];
  usedFor?: string;
}

export interface ResolvedEquipmentRosterItem extends EquipmentRosterItem {
  reqStrMin: number;
  reqStrMax: number | null;
  effectiveReqStr: number;
  canMeetRequiredStrength: boolean;
  costGamels: number;
  variablePrice: boolean;
  priceLabel: string;
}

export const equipmentRoster: EquipmentRosterItem[] = [
  { itemId: 'dagger', label: 'Dagger', category: 'weapon', group: 'swords', usage: '1H', requiredStrength: '1~5', priceSpec: 'x10+20', tags: ['throwable'] },
  { itemId: 'main_gauche', label: 'Main Gauche', category: 'weapon', group: 'swords', usage: '1H', requiredStrength: '1~5', priceSpec: 'x20+20' },
  { itemId: 'swordbreaker', label: 'Swordbreaker', category: 'weapon', group: 'swords', usage: '1H', requiredStrength: '1~5', priceSpec: 'x20+40' },
  { itemId: 'katar', label: 'Katar', category: 'weapon', group: 'swords', usage: '1H', requiredStrength: '3~5', priceSpec: 'x10+30' },
  { itemId: 'shortsword', label: 'Short Sword', category: 'weapon', group: 'swords', usage: '1H', requiredStrength: '3~8', priceSpec: 'x10+30' },
  { itemId: 'cutlass', label: 'Cutlass', category: 'weapon', group: 'swords', usage: '1H', requiredStrength: '6~12', priceSpec: 'x20+40' },
  { itemId: 'rapier', label: 'Rapier', category: 'weapon', group: 'swords', usage: '1H', requiredStrength: '6~14', priceSpec: 'x10+90' },
  { itemId: 'saber', label: 'Saber', category: 'weapon', group: 'swords', usage: '1H', requiredStrength: '7~14', priceSpec: 'x20+50' },
  { itemId: 'scimitar', label: 'Scimitar', category: 'weapon', group: 'swords', usage: '1H', requiredStrength: '8~14', priceSpec: 'x20+50' },
  { itemId: 'broadsword', label: 'Broadsword', category: 'weapon', group: 'swords', usage: '1H', requiredStrength: '8~16', priceSpec: 'x20+40' },
  { itemId: 'falchion', label: 'Falchion', category: 'weapon', group: 'swords', usage: '1H', requiredStrength: '12~16', priceSpec: 'x20+60' },
  { itemId: 'bastard_sword', label: 'Bastard Sword', category: 'weapon', group: 'swords', usage: '1~2H', requiredStrength: '13~17', priceSpec: 'x30+50' },
  { itemId: 'estoc', label: 'Estoc', category: 'weapon', group: 'swords', usage: '2H', requiredStrength: '11~16', priceSpec: 'x30+40' },
  { itemId: 'shamshir', label: 'Shamshir', category: 'weapon', group: 'swords', usage: '2H', requiredStrength: '14~', priceSpec: 'x40+70' },
  { itemId: 'flamberge', label: 'Flamberge', category: 'weapon', group: 'swords', usage: '2H', requiredStrength: '15~21', priceSpec: 'x40+80' },
  { itemId: 'greatsword', label: 'Greatsword', category: 'weapon', group: 'swords', usage: '2H', requiredStrength: '16~', priceSpec: 'x40+60' },
  { itemId: 'hand_ax', label: 'Hand Ax', category: 'weapon', group: 'axes', usage: '1H', requiredStrength: '4~11', priceSpec: 'x10+20', tags: ['throwable'] },
  { itemId: 'battle_ax', label: 'Battle Ax', category: 'weapon', group: 'axes', usage: '1~2H', requiredStrength: '10~20', priceSpec: 'x20+40' },
  { itemId: 'great_ax', label: 'Great Ax', category: 'weapon', group: 'axes', usage: '2H', requiredStrength: '18~', priceSpec: 'x20+50' },
  { itemId: 'javelin', label: 'Javelin', category: 'weapon', group: 'spears', usage: '1H', requiredStrength: '1~10', priceSpec: 'x10+15', tags: ['throwable'] },
  { itemId: 'short_spear', label: 'Short Spear', category: 'weapon', group: 'spears', usage: '1H', requiredStrength: '2~13', priceSpec: 'x10+10', tags: ['throwable'] },
  { itemId: 'trident', label: 'Trident', category: 'weapon', group: 'spears', usage: '1H', requiredStrength: '4~16', priceSpec: 'x10+20', tags: ['throwable'] },
  { itemId: 'longspear', label: 'Longspear', category: 'weapon', group: 'spears', usage: '1~2H', requiredStrength: '4~20', priceSpec: 'x10+20' },
  { itemId: 'pike', label: 'Pike', category: 'weapon', group: 'spears', usage: '2H', requiredStrength: '10~', priceSpec: 'x10+40' },
  { itemId: 'light_mace', label: 'Light Mace', category: 'weapon', group: 'maces', usage: '1H', requiredStrength: '5~12', priceSpec: 'x20+20' },
  { itemId: 'heavy_mace', label: 'Heavy Mace', category: 'weapon', group: 'maces', usage: '1~2H', requiredStrength: '9~16', priceSpec: 'x20+30' },
  { itemId: 'maul', label: 'Maul', category: 'weapon', group: 'maces', usage: '2H', requiredStrength: '16~', priceSpec: 'x20+40' },
  { itemId: 'boomerang', label: 'Boomerang', category: 'weapon', group: 'clubs', usage: '1H', requiredStrength: '1~9', priceSpec: 'x10+10', tags: ['made_for_throwing'] },
  { itemId: 'club', label: 'Club', category: 'weapon', group: 'clubs', usage: '1H', requiredStrength: '1~', priceSpec: 'x5+10', tags: ['throwable'] },
  { itemId: 'mage_staff', label: "Mage's Staff", category: 'weapon', group: 'staves', usage: '2H', requiredStrength: '1~10', priceSpec: 'x10+100', tags: ['SORCERER_REQUIRED'] },
  { itemId: 'big_club', label: 'Big Club', category: 'weapon', group: 'staves', usage: '2H', requiredStrength: '1~', priceSpec: 'x10+10' },
  { itemId: 'quarterstaff', label: 'Quarterstaff', category: 'weapon', group: 'staves', usage: '2H', requiredStrength: '8~', priceSpec: 'x10+20' },
  { itemId: 'light_flail', label: 'Light Flail', category: 'weapon', group: 'flails', usage: '1H', requiredStrength: '7~14', priceSpec: 'x10+20' },
  { itemId: 'morning_star', label: 'Morning Star', category: 'weapon', group: 'flails', usage: '1H', requiredStrength: '11~19', priceSpec: 'x20+40' },
  { itemId: 'heavy_flail', label: 'Heavy Flail', category: 'weapon', group: 'flails', usage: '1~2H', requiredStrength: '10~', priceSpec: 'x20+40' },
  { itemId: 'pickax', label: 'Pickax', category: 'weapon', group: 'war_hammers', usage: '1H', requiredStrength: '2~10', priceSpec: 'x20+20' },
  { itemId: 'war_hammer', label: 'War Hammer', category: 'weapon', group: 'war_hammers', usage: '1H', requiredStrength: '6~19', priceSpec: 'x20+30' },
  { itemId: 'mattock', label: 'Mattock', category: 'weapon', group: 'war_hammers', usage: '2H', requiredStrength: '10~', priceSpec: 'x20+40' },
  { itemId: 'short_bow', label: 'Short Bow', category: 'weapon', group: 'bows', usage: '2H', requiredStrength: '2~8', priceSpec: 'x10+40', tags: ['shooting'] },
  { itemId: 'longbow', label: 'Longbow', category: 'weapon', group: 'bows', usage: '2H', requiredStrength: '6~', priceSpec: 'x10+50', tags: ['shooting'] },
  { itemId: 'light_crossbow', label: 'Light Crossbow', category: 'weapon', group: 'crossbows', usage: '2H', requiredStrength: '5~15', priceSpec: 'x20+60', tags: ['shooting'] },
  { itemId: 'heavy_crossbow', label: 'Heavy Crossbow', category: 'weapon', group: 'crossbows', usage: '2H', requiredStrength: '10~', priceSpec: 'x30+80', tags: ['shooting'] },
  { itemId: 'sling', label: 'Sling', category: 'weapon', group: 'slings', usage: '1H', requiredStrength: '1~8', priceSpec: 'x10+10', tags: ['shooting'] },
  { itemId: 'staff_sling', label: 'Staff Sling', category: 'weapon', group: 'slings', usage: '2H', requiredStrength: '1~14', priceSpec: 'x10+20', tags: ['shooting'] },
  { itemId: 'rock', label: 'Rock', category: 'weapon', group: 'rocks', usage: '1H', requiredStrength: '1~', priceSpec: '0', tags: ['made_for_throwing'] },
  { itemId: 'whip', label: 'Whip', category: 'weapon', group: 'entangling_weapons', usage: '1H', requiredStrength: '5', priceSpec: '150' },
  { itemId: 'net', label: 'Net', category: 'weapon', group: 'entangling_weapons', usage: '1H', requiredStrength: '7', priceSpec: '200', tags: ['throwable'] },
  { itemId: 'bola', label: 'Bola', category: 'weapon', group: 'entangling_weapons', usage: '1H', requiredStrength: '3', priceSpec: '80', tags: ['made_for_throwing'] },
  { itemId: 'light_cranequin_crossbow', label: 'Light Cranequin Crossbow', category: 'weapon', group: 'cranequin_crossbows', usage: '2H', requiredStrength: '5~15', priceSpec: 'x30+90', tags: ['shooting'] },
  { itemId: 'heavy_cranequin_crossbow', label: 'Heavy Cranequin Crossbow', category: 'weapon', group: 'cranequin_crossbows', usage: '2H', requiredStrength: '10~', priceSpec: 'x45+120', tags: ['shooting'] },
  { itemId: 'ballista', label: 'Ballista', category: 'weapon', group: 'cranequin_crossbows', usage: '2H', requiredStrength: '20~', priceSpec: 'x60+200', tags: ['shooting'] },
  { itemId: 'pole_weapon', label: 'Pole Weapon', category: 'weapon', group: 'other', usage: '2H', requiredStrength: '10~', priceSpec: 'x30+50' },
  { itemId: 'lance', label: 'Lance', category: 'weapon', group: 'other', usage: '1H', requiredStrength: '12~', priceSpec: 'x30+60' },
  { itemId: 'shotel', label: 'Shotel', category: 'weapon', group: 'other', usage: '1H', requiredStrength: '8~16', priceSpec: 'x20+50' },
  { itemId: 'cestus', label: 'Cestus', category: 'weapon', group: 'other', usage: '1H', requiredStrength: '1~5', priceSpec: 'x10+10' },
  { itemId: 'blackjack', label: 'Blackjack', category: 'weapon', group: 'other', usage: '1H', requiredStrength: '1~4', priceSpec: 'x10+10' },
  { itemId: 'garrote', label: 'Garrote', category: 'weapon', group: 'other', usage: '2H', requiredStrength: '1', priceSpec: '5' },
  { itemId: 'prodd', label: 'Prodd', category: 'weapon', group: 'other', usage: '2H', requiredStrength: '5~15', priceSpec: 'x20+60', tags: ['shooting'] },
  { itemId: 'dart', label: 'Dart', category: 'weapon', group: 'other', usage: '1H', requiredStrength: '1~3', priceSpec: 'x5+10', tags: ['made_for_throwing'] },
  { itemId: 'arrows', label: 'Arrows (12)', category: 'gear', group: 'ammunition', priceSpec: '10', usedFor: 'bows' },
  { itemId: 'quarrels', label: 'Quarrels (12)', category: 'gear', group: 'ammunition', priceSpec: '10', usedFor: 'crossbows' },
  { itemId: 'bullets', label: 'Bullets (20)', category: 'gear', group: 'ammunition', priceSpec: '5', usedFor: 'slings' },
  { itemId: 'cloth_armor', label: 'Cloth Armor', category: 'armor', group: 'non_metal_armor', requiredStrength: '1~3', priceSpec: 'x10+10', tags: ['LIGHT', 'SHAMAN_ARMOR_OK'] },
  { itemId: 'soft_leather_armor', label: 'Soft Leather Armor', category: 'armor', group: 'non_metal_armor', requiredStrength: '2~7', priceSpec: 'x15+20', tags: ['LIGHT', 'SHAMAN_ARMOR_OK'] },
  { itemId: 'hard_leather_armor', label: 'Hard Leather Armor', category: 'armor', group: 'non_metal_armor', requiredStrength: '5~13', priceSpec: 'x30+30', tags: ['SHAMAN_ARMOR_OK'] },
  { itemId: 'ring_mail', label: 'Ring Mail', category: 'armor', group: 'metal_armor', requiredStrength: '5~12', priceSpec: 'x30+40', tags: ['METAL_EXCEPTION_FOR_RANGER_THIEF'] },
  { itemId: 'splint_armor', label: 'Splint Armor', category: 'armor', group: 'metal_armor', requiredStrength: '8~17', priceSpec: 'x40+50', tags: ['METAL'] },
  { itemId: 'chain_mail_armor', label: 'Chain Mail Armor', category: 'armor', group: 'metal_armor', requiredStrength: '10~19', priceSpec: 'x50+50', tags: ['METAL'] },
  { itemId: 'lamellar_armor', label: 'Lamellar Armor', category: 'armor', group: 'metal_armor', requiredStrength: '11~22', priceSpec: 'x70+70', tags: ['METAL'] },
  { itemId: 'plate_armor', label: 'Plate Armor', category: 'armor', group: 'metal_armor', requiredStrength: '13~', priceSpec: 'x100+100', tags: ['METAL'] },
  { itemId: 'small_shield', label: 'Small Shield', category: 'shield', group: 'shield', requiredStrength: 1, priceSpec: 60 },
  { itemId: 'large_shield', label: 'Large Shield', category: 'shield', group: 'shield', requiredStrength: 13, priceSpec: 300 },
  { itemId: 'rucksack_leather', label: 'Leather Rucksack', category: 'gear', group: 'bags', priceSpec: 50 },
  { itemId: 'bag_cloth', label: 'Cloth Bag', category: 'gear', group: 'bags', priceSpec: 15 },
  { itemId: 'pouch_cloth', label: 'Cloth Pouch', category: 'gear', group: 'bags', priceSpec: 5 },
  { itemId: 'handbag_cloth', label: 'Cloth Handbag', category: 'gear', group: 'bags', priceSpec: 10 },
  { itemId: 'belt_pouch_leather', label: 'Leather Belt Pouch', category: 'gear', group: 'bags', priceSpec: 15 },
  { itemId: 'water_bag_leather', label: 'Leather Water Bag', category: 'gear', group: 'bags', priceSpec: 20 },
  { itemId: 'mantle', label: 'Mantle', category: 'gear', group: 'camping_tools', priceSpec: 40 },
  { itemId: 'blanket', label: 'Blanket', category: 'gear', group: 'camping_tools', priceSpec: 50 },
  { itemId: 'tent_for_5_people', label: 'Tent (5 people)', category: 'gear', group: 'camping_tools', priceSpec: 300 },
  { itemId: 'tableware_set', label: 'Tableware Set', category: 'gear', group: 'camping_tools', priceSpec: 12 },
  { itemId: 'cooking_utensils_set', label: 'Cooking Utensils Set', category: 'gear', group: 'camping_tools', priceSpec: 50 },
  { itemId: 'torch_6_lasts_2_hours_each', label: 'Torch Bundle (6)', category: 'gear', group: 'lighting_equipment', priceSpec: 5 },
  { itemId: 'lantern', label: 'Lantern', category: 'gear', group: 'lighting_equipment', priceSpec: 40 },
  { itemId: 'tinderbox', label: 'Tinderbox', category: 'gear', group: 'lighting_equipment', priceSpec: 20 },
  { itemId: 'oil_1_bottle_for_lantern_lasts_12_hours_each', label: 'Lantern Oil (1 bottle)', category: 'gear', group: 'lighting_equipment', priceSpec: 5 },
  { itemId: 'rope_10_meters', label: 'Rope (10m)', category: 'gear', group: 'adventuring_tools', priceSpec: 10 },
  { itemId: 'wedges_10', label: 'Wedges (10)', category: 'gear', group: 'adventuring_tools', priceSpec: 20 },
  { itemId: 'small_hammer', label: 'Small Hammer', category: 'gear', group: 'adventuring_tools', priceSpec: 10 },
  { itemId: 'hand_mirror', label: 'Hand Mirror', category: 'gear', group: 'adventuring_tools', priceSpec: 100 },
  { itemId: 'parchment_10_sheets', label: 'Parchment (10 sheets)', category: 'gear', group: 'other', priceSpec: 10 },
  { itemId: 'quill_pen_and_ink', label: 'Quill Pen and Ink', category: 'gear', group: 'other', priceSpec: 5 },
  { itemId: 'thieves_tools', label: "Thieves' Tools", category: 'gear', group: 'other', priceSpec: 100 },
  { itemId: 'musical_instrument', label: 'Musical Instrument', category: 'gear', group: 'other', priceSpec: '100+' },
  { itemId: 'one_serving', label: 'One Serving', category: 'gear', group: 'food', priceSpec: '3+' },
  { itemId: 'one_serving_of_rations', label: 'Rations (1 serving)', category: 'gear', group: 'food', priceSpec: '7+' },
  { itemId: 'wine_1_cup', label: 'Wine (1 cup)', category: 'gear', group: 'food', priceSpec: '2+' },
  { itemId: 'ale_1_cup', label: 'Ale (1 cup)', category: 'gear', group: 'food', priceSpec: '1+' },
  { itemId: 'pack_horse', label: 'Pack Horse', category: 'gear', group: 'horses', priceSpec: 1500 },
  { itemId: 'riding_horse', label: 'Riding Horse', category: 'gear', group: 'horses', priceSpec: 5000 },
  { itemId: 'warhorse', label: 'Warhorse', category: 'gear', group: 'horses', priceSpec: 10000 },
  { itemId: 'mule', label: 'Mule', category: 'gear', group: 'horses', priceSpec: 1000 },
  { itemId: 'donkey', label: 'Donkey', category: 'gear', group: 'horses', priceSpec: 800 },
  { itemId: 'camel', label: 'Camel', category: 'gear', group: 'horses', priceSpec: 2000 },
  { itemId: 'one_night_not_including_food', label: 'Lodging (1 night)', category: 'gear', group: 'lodging', priceSpec: '30+' },
  { itemId: 'one_week_not_including_food', label: 'Lodging (1 week)', category: 'gear', group: 'lodging', priceSpec: '150+' },
  { itemId: 'one_month_not_including_food', label: 'Lodging (1 month)', category: 'gear', group: 'lodging', priceSpec: '300+' },
  { itemId: 'one_day', label: 'Living Expenses (1 day)', category: 'gear', group: 'living_expenses', priceSpec: '10+' },
];

export const equipmentRosterById: Record<string, EquipmentRosterItem> = Object.fromEntries(
  equipmentRoster.map((item) => [item.itemId, item])
);

export function listEquipmentRosterByCategory(category: EquipmentRosterCategory): EquipmentRosterItem[] {
  return equipmentRoster.filter((item) => item.category === category);
}

export function resolveEquipmentRosterItem(itemId: string, characterStrength: number): ResolvedEquipmentRosterItem | null {
  const item = equipmentRosterById[itemId];
  if (!item) {
    return null;
  }

  const { min, max } = parseRequiredStrength(item.requiredStrength);
  const effectiveReqStr = resolveEffectiveRequiredStrength(item.requiredStrength, characterStrength);
  const { costGamels, variablePrice, priceLabel } = resolvePrice(item.priceSpec, effectiveReqStr);

  return {
    ...item,
    reqStrMin: min,
    reqStrMax: max,
    effectiveReqStr,
    canMeetRequiredStrength: characterStrength >= min,
    costGamels,
    variablePrice,
    priceLabel,
  };
}

export function parseRequiredStrength(requiredStrength: string | number | undefined): { min: number; max: number | null } {
  if (requiredStrength === undefined) {
    return { min: 0, max: null };
  }
  if (typeof requiredStrength === 'number') {
    return { min: requiredStrength, max: requiredStrength };
  }

  const normalized = requiredStrength.trim();
  const rangeMatch = normalized.match(/^(\d+)~(\d+)?$/);
  if (rangeMatch) {
    return {
      min: Number(rangeMatch[1]),
      max: rangeMatch[2] ? Number(rangeMatch[2]) : null,
    };
  }

  return { min: Number(normalized), max: Number(normalized) };
}

export function resolveEffectiveRequiredStrength(requiredStrength: string | number | undefined, characterStrength: number): number {
  const { min, max } = parseRequiredStrength(requiredStrength);
  if (characterStrength <= min) {
    return min;
  }
  if (max === null) {
    return characterStrength;
  }
  return Math.min(characterStrength, max);
}

export function resolvePrice(priceSpec: string | number, effectiveRequiredStrength: number): {
  costGamels: number;
  variablePrice: boolean;
  priceLabel: string;
} {
  if (typeof priceSpec === 'number') {
    return { costGamels: priceSpec, variablePrice: false, priceLabel: `${priceSpec} G` };
  }

  const normalized = priceSpec.trim();
  const formulaMatch = normalized.match(/^x(\d+)\+(\d+)(?:x)?$/i);
  if (formulaMatch) {
    const costGamels = effectiveRequiredStrength * Number(formulaMatch[1]) + Number(formulaMatch[2]);
    return { costGamels, variablePrice: false, priceLabel: `${costGamels} G` };
  }

  const ammoMatch = normalized.match(/^(\d+)\s+for\s+(\d+)$/i);
  if (ammoMatch) {
    return {
      costGamels: Number(ammoMatch[1]),
      variablePrice: false,
      priceLabel: `${Number(ammoMatch[1])} G / ${ammoMatch[2]}`,
    };
  }

  const numericMatch = normalized.match(/^(\d+)\+?$/);
  if (numericMatch) {
    const costGamels = Number(numericMatch[1]);
    return {
      costGamels,
      variablePrice: normalized.endsWith('+'),
      priceLabel: normalized.endsWith('+') ? `${costGamels}+ G` : `${costGamels} G`,
    };
  }

  return { costGamels: 0, variablePrice: true, priceLabel: normalized };
}

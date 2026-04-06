# Sword World RPG — Gameplay Loop Flow Diagrams (Modalities)

These diagrams mirror the rulebook’s structure:
- **Free play / interaction** (GM narration + player intent)
- **Success rolls** (public target scores)
- **Difficulty checks** (secret target scores)
- **Combat rounds** (round-based resolution + weapon combat checks)
- **Magic** (a combat/non-combat action modality)

---

## 1) Master gameplay loop (scene → intent → resolve → new scene)

```mermaid
flowchart TD
    A[GM frames the current scene\n(place, time, NPCs, threats, clues)] --> B[Players ask questions\n+ declare intent & actions]
    B --> C{Is the outcome uncertain\nor meaningfully contested?}

    C -- No --> D[GM adjudicates without a roll\n(automatic success/failure as fiction demands)]
    D --> A

    C -- Yes --> E{Should success/failure be hidden\nfrom the character?}
    E -- Yes --> F[Difficulty Check\n(secret target: difficulty + GM 2D)]
    F --> G[GM describes only what the character can tell\n(not “success/failure” explicitly)]
    G --> A

    E -- No --> H{Is it a hostile, time-critical clash\nwhere action order matters?}
    H -- Yes --> I[Enter Combat Round Loop]
    I --> A

    H -- No --> J[Standard Success Roll\n(public target score)]
    J --> K[GM narrates outcome + consequences]
    K --> A
```

---

## 2) Resolution modality selection (what kind of procedure do we use?)

```mermaid
flowchart TD
    S[Player intent] --> Q{GM chooses procedure\nbased on the fiction + rules}

    Q -->|No roll| NR[Adjudicate directly\n(common sense + scenario logic)]
    Q -->|Standard Success Roll| SR[Baseline + 2D ± mods\nvs Target Score]
    Q -->|Difficulty Check| DC[Baseline + 2D ± mods\nvs (Difficulty + GM 2D) secret]
    Q -->|Combat| CR[Round structure\n(announce → act by Agility)]
    Q -->|Magic action| MA[Cast a spell / use runes\n(usually within SR or CR)]
```

---

## 3) Standard Success Roll (Chapter 2: Success Rolls)

```mermaid
flowchart TD
    A[Pick the action] --> B[Determine relevant skill\n+ relevant ability bonus]
    B --> C{Does the character have\nan associated skill?}

    C -- No --> D[Baseline = 0\n(ability bonus does NOT apply)]
    C -- Yes --> E[Baseline = skill level + ability bonus]

    D --> F[GM sets Target Score\n(public)]
    E --> F

    F --> G[Apply GM modifiers\n(+ bonuses / − penalties)]
    G --> H[Roll 2D]
    H --> I{2D result?}

    I -- 12 (double sixes) --> AS[Automatic Success]
    I -- 2 (double ones) --> AF[Automatic Failure]
    I -- otherwise --> J[Final = Baseline + 2D ± mods]
    J --> K{Final ≥ Target?}
    K -- Yes --> Suc[Success]
    K -- No --> Fail[Failure]

    AS --> Out[GM narrates outcome\n+ consequences]
    AF --> Out
    Suc --> Out
    Fail --> Out
```

---

## 4) Difficulty Check (Chapter 2.5: Difficulty Checks)

Used when **the character cannot directly know** whether the attempt succeeded
(e.g., checking for traps, searching, sensing something hidden).

```mermaid
flowchart TD
    A[Pick the action\n(e.g., find traps)] --> B[Determine Baseline\n(skill level + ability bonus\nor 0 if no skill)]
    B --> C[GM sets Difficulty\n(may or may not be disclosed)]
    C --> D[GM rolls 2D secretly]
    D --> E[Secret Target = Difficulty + GM 2D\n(not revealed)]
    E --> F[Apply GM modifiers to player\n(+ / −)]
    F --> G[Player rolls 2D]
    G --> H[Player Final = Baseline + 2D ± mods]
    H --> I{Final ≥ Secret Target?}
    I -- Yes --> S[Check succeeds]
    I -- No --> Fai[Check fails]
    S --> J[GM answers only as the character would perceive]
    Fai --> J
```

---

## 5) Combat round loop (Chapter 3: Combat Rounds)

Key structure:
- **Each round = 10 seconds**
- **Action announcements** happen by **group**, ordered by **Intelligence** (high INT group announces later).
- **Resolution order** is by **Agility** (friend and foe mixed).
- You may **delay** your action to **order 0** if declared in announcements.
- You may **cancel** an action, but generally **may not switch** it (with a specific exception for changing targets when engaged and enemies withdraw).

```mermaid
flowchart TD
    R0[Start of Round] --> R1[Action Announcements\n(Group order by Intelligence)]
    R1 --> R2[Resolve actions in Agility order\n(ties are simultaneous)]
    R2 --> R3{For each actor on their turn}

    R3 --> M{Choose movement mode}
    M -->|Full movement| FM[Move up to Agility×3 meters\n(monsters: move speed×3)\nHeavy action limits]
    M -->|Normal movement| NM[Move moderate distance\n(can attack/cast with limits)]
    M -->|Stand still| SS[Minimal movement\n(needed for many precise actions\nand for projectile use)]

    FM --> Act[Perform the announced action\nor cancel]
    NM --> Act
    SS --> Act

    Act --> Next{More actors this round?}
    Next -- Yes --> R3
    Next -- No --> End{Combat end condition met?}
    End -- No --> R0
    End -- Yes --> Post[Exit combat\n(handle aftermath, loot, injuries, etc.)]
```

---

## 6) Weapon-combat resolution (Chapter 4: Weapon Combat)

This is the **common “attack → hit check → damage” pipeline**.
The exact hit procedure depends on attacker/defender type.

```mermaid
flowchart TD
    A[Declare attack\n(target, weapon, position)] --> B{Attack context?}

    B -->|Character → Monster| CM[Hit check:\n(Attack Power + 2D) ≥\nMonster Evasion Points\n(12 auto-hit, 2 auto-miss)]
    B -->|Monster → Character| MC[Evasion check:\n(Evasion Speed + 2D) ≥\nMonster Attack Points\n(12 auto-evade, 2 auto-fail)]
    B -->|Character → Character| CC[Opposed hit:\n(Attack Power + 2D) >\n(Evasion Speed + 2D)\n(tie = miss)]

    CM -->|Hit| DM1[Damage vs monster:\nStrike Roll (Rating Table)\n→ Base Damage\n(+ Critical chain)\n+ Bonus Damage\n− Monster Defense Points\n(≤0 = no damage)]
    CM -->|Miss| X1[No damage]

    MC -->|Evade| X2[No damage]
    MC -->|Fail to evade| DM2[Damage vs character:\nMonster Strike Points\n− (Defense Roll + Damage Reduction)\nDefense Roll uses Rating Table\n(no critical; double ones = no reduction)\n(≤0 = no damage)]

    CC -->|Hit| DM3[Damage vs character-like target:\nStrike Roll (Rating Table)\n(+ Critical chain)\n+ Bonus Damage\n− (Defense Roll + Damage Reduction)\n(≤0 = no damage)]
    CC -->|Miss| X3[No damage]
```

---

## 7) “Exploration / Interaction” as a structured loop (no map required)

This is the practical loop for “walking around, talking, investigating”:

```mermaid
flowchart TD
    A[GM describes the environment\n(what is obvious)] --> B[Players ask questions\nand declare approaches]
    B --> C{Is there risk, time pressure,\nor hidden information?}
    C -- No --> D[GM answers & advances fiction]
    D --> A

    C -- Yes --> E{Is the result meant to be hidden\nfrom the character?}
    E -- Yes --> F[Difficulty Check\n(Chapter 2.5)]
    E -- No --> G[Standard Success Roll\n(Chapter 2.1–2.4)]

    F --> H[GM gives “in-fiction” feedback\n(what the character perceives)]
    G --> I[GM narrates success/failure\n+ consequences]
    H --> A
    I --> A
```

---

## 8) Quick legend: which numbers exist in which modality

```mermaid
flowchart LR
    SR[Standard Success Roll] -->|needs| TS[Target Score (public)]
    DC[Difficulty Check] -->|needs| D[Difficulty (base)]
    DC -->|creates| ST[Secret Target = Difficulty + GM 2D]
    CR[Combat] -->|uses| AGI[Agility (action order)]
    CR -->|uses| INT[Intelligence (announcement order)]
    CR -->|uses| WP[Weapon-combat checks\n(Chapter 4)]
```

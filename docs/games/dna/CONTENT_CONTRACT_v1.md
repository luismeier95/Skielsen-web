# SKIELSEN DNA — Content Contract v1

**Status:** Approved  
**Version:** 1.0  
**Date:** 2026-09-24  
**Applies to:** All DNA content categories

## 1. Purpose

This contract defines what constitutes valid production content for DNA.

Every term must follow the same content structure regardless of category and must work with the generic DNA game engine without category-specific gameplay logic.

## 2. Content unit

Every DNA term contains:

- one primary category,
- one canonical answer,
- optional accepted answer aliases,
- Hint 1 — VERY HARD,
- Hint 2 — HARD,
- Hint 3 — MEDIUM,
- content status,
- optional editorial/source notes.

## 3. Categories

Initial categories:

- Länder
- Städte
- Tiere
- Filme
- Automarken
- Unternehmen
- Fußballvereine
- Essen & Gerichte
- Technologie
- Berufe
- Videospiele
- Historische Personen
- Musik

New categories may be added later without changing the term structure.

## 4. Canonical answer

Every term has exactly one canonical answer.

The canonical answer is the form displayed during Reveal.

It should:

- use the most common German name where appropriate,
- be clear and recognizable,
- be as short as reasonably possible,
- avoid unnecessary legal or formal additions.

Example:

Prefer `Kasachstan` over `Republik Kasachstan`.

## 5. Accepted aliases

Alternative valid answers are explicitly stored as aliases.

Examples:

Canonical: `Vereinigte Arabische Emirate`

Accepted aliases may include:

- `VAE`
- `UAE`
- `United Arab Emirates`

Canonical: `Citroën`

Alias:

- `Citroen`

Canonical: `FC Barcelona`

Possible aliases:

- `Barcelona`
- `Barca`
- `Barça`

Aliases are editorially maintained.

Generic fuzzy matching is not part of v1.

## 6. Technical normalization

Before comparison, the system may normalize:

- capitalization,
- leading/trailing whitespace,
- repeated internal spaces.

Accents, abbreviations, translations, alternative spellings, and naming variants require explicit aliases.

## 7. Three-hint progression

Every active term contains exactly three hints:

`VERY HARD → HARD → MEDIUM`

The hints are not three random facts.

They must form a controlled progression in which every additional hint reduces the plausible answer space.

## 8. Hint 1 — VERY HARD

Value: **+3**

Purpose:

Reward strong knowledge, specialist knowledge, or an early association.

Hint 1 may allow several plausible answers, but it must have a meaningful relationship to the target and must not be misleading.

Good source material includes:

- lesser-known history,
- distinctive technical philosophy,
- unusual geography,
- characteristic design principles,
- specific cultural or strategic traits.

Difficulty should come from limited information, not deception.

## 9. Hint 2 — HARD

Value: **+2**

Purpose:

Significantly narrow the answer space.

Combined with Hint 1, a well-informed player should have a strong direction.

Useful material includes:

- characteristic product or model,
- specific technology,
- recognizable historical phase,
- important person,
- distinctive location or geographic property,
- strongly associated cultural trait.

## 10. Hint 3 — MEDIUM

Value: **+1**

Purpose:

Give an average member of the target audience a realistic chance to solve the term.

Hint 3 may be substantially more concrete but must not simply state the answer.

Useful material includes:

- iconic product/model,
- famous landmark,
- strongly associated person,
- widely known achievement,
- highly characteristic symbol or property.

## 11. Progressive uniqueness

Core rule:

**Every additional hint must reduce the plausible answer space.**

Ideal progression:

`broad → narrower → clear`

A later hint must not be weaker or less discriminating than an earlier hint.

## 12. Ambiguity

A single early hint may be ambiguous.

The complete three-hint set may not remain materially ambiguous.

Editorial review must ask:

> What other answer could a reasonable player derive from these three hints?

If another solution is equally plausible, the term must be revised.

The game must never rely on:

> We meant answer X.

## 13. No trivia traps

Difficulty must come from information density and recognition, not trick wording.

Avoid:

- obscure dates with little relevance,
- irrelevant edge facts,
- semantic/definition traps,
- technically true but misleading statements,
- deliberate gotchas.

## 14. No false leads

Hints may be difficult but must not deliberately point toward another answer.

`VERY HARD` means **less information**, not **misinformation**.

## 15. Hint length

Mobile readability is mandatory.

Target:

- 1–2 short sentences,
- ideally about 8–22 words per hint.

A player must be able to read and process the hint while the 10-second IDEA timer is running.

Long paragraphs are not valid production content.

## 16. Language and tone

Default language: **German**

Style:

- direct,
- neutral,
- concise,
- natural,
- quickly readable.

Avoid quizmaster filler such as:

> Welches faszinierende Land könnte hier wohl gesucht sein?

Prefer factual wording.

## 17. No answer leakage

A hint must not contain:

- the canonical answer,
- an obvious direct derivative,
- a wording that trivially exposes the answer.

Example:

If the answer is `Amsterdam`, do not use `Amsterdamer Grachten` as a hint.

## 18. Category-specific fact types

### Countries

Good dimensions:

- geography,
- history,
- culture,
- economy,
- neighboring states,
- landscapes,
- long-term institutions.

### Cities

Good dimensions:

- location,
- architecture,
- history,
- city structure,
- landmarks,
- cultural role.

### Animals

Good dimensions:

- habitat,
- anatomy,
- behavior,
- reproduction,
- diet,
- special abilities.

### Car brands

Good dimensions:

- origin,
- engineering philosophy,
- motorsport,
- iconic models,
- design,
- company history.

### Movies

Good dimensions:

- setting,
- plot structure,
- characters,
- director,
- recognizable production characteristics,
- release era.

Avoid unnecessary spoilers for very recent works.

### Companies

Good dimensions:

- origin,
- business model,
- products,
- historical development,
- innovation.

### Music

Good dimensions:

- origin,
- style,
- career,
- band composition,
- performance identity,
- notable works.

Song lyrics are not used as regular DNA hints.

## 19. Time-sensitive facts

Prefer durable facts.

Avoid facts such as:

- current employee count,
- current league position,
- current monthly listeners,
- current stock price,
- current ranking.

If dynamic facts are ever used, they require an explicit update strategy.

Default DNA content should be time-stable.

## 20. Numerical claims

Numbers may be used when they are:

- characteristic,
- relevant,
- stable enough.

Avoid unnecessary precision where definitions vary.

Prefer robust wording such as:

> mehr als 17.000 Inseln

instead of an exact count that changes by source or definition.

## 21. Contested facts

Politically, historically, geographically, or scientifically disputed claims must not be phrased as uncontested facts.

If a claim is materially uncertain or disputed and cannot be expressed neutrally, do not use it as a hint.

## 22. Source standard

Production terms must be fact-checkable.

For non-obvious or critical factual claims, editorial notes should retain reliable sources.

Preferred source types:

- official institutions,
- manufacturers,
- governing bodies,
- scientific institutions,
- established reference works,
- reputable historical sources.

Wikipedia may support research, but unusual or disputed claims should not rely on Wikipedia alone.

Sources are editorial metadata and are not shown during gameplay.

## 23. Copyright

Hints are written in original wording.

Do not copy substantial wording from:

- Wikipedia,
- manufacturer pages,
- books,
- articles,
- films,
- song lyrics,
- proprietary databases.

Regular DNA content should not depend on quotations.

## 24. Brands and product names

Brands and products may be answers or factual references.

Content must not imply sponsorship, partnership, endorsement, or official affiliation with Skielsen.

Logos are a separate asset/content type and are not covered by the ordinary text-hint contract.

## 25. Target audience

Primary target group:

Adults roughly 25–35 playing socially in friend groups.

DNA is not designed as an academic specialist quiz.

A MEDIUM hint should generally be realistically solvable by this audience when the underlying answer itself is sufficiently well known.

## 26. Term familiarity

Each term should carry an internal familiarity tier:

- `MAINSTREAM`
- `KNOWN`
- `NICHE`

Production pools should primarily consist of `MAINSTREAM` and `KNOWN` terms.

`NICHE` terms should be used deliberately and sparingly.

## 27. Term difficulty vs. hint difficulty

Hint difficulty is always:

`VERY_HARD / HARD / MEDIUM`

A separate overall term difficulty may be stored for balancing.

A difficult term still uses the same three hint stages; its overall knowledge requirement is simply higher.

## 28. Repetition rules

A term must not occur twice within the same game session.

Stable `term_id` values should support repetition avoidance across sessions.

Repeated exposure should be minimized where practical.

## 29. Content proximity

Closely related terms should not be scheduled back-to-back if one term would reveal or strongly prime the next.

Example:

Avoid placing Saab directly next to Volvo if both question sets heavily rely on Swedish automotive history.

## 30. Reveal content

Reveal always displays the canonical answer.

Optional future reveal content may include:

- short fun fact,
- image,
- additional context.

Such content is not required for v1 and must not delay the gameplay loop unnecessarily.

## 31. Quality gate

A term may become `ACTIVE` only after passing:

### FACT CHECK
All three hints are factually correct.

### AMBIGUITY CHECK
No equally plausible alternative remains after all three hints.

### PROGRESSION CHECK
Every new hint meaningfully narrows the answer space.

### MOBILE CHECK
Every hint is short enough for the mobile gameplay screen and 10-second reading context.

### ANSWER CHECK
Common valid spellings and aliases are covered.

### LEAK CHECK
No hint directly or trivially reveals the answer.

### LANGUAGE CHECK
Wording is natural, concise, and understandable.

## 32. Content status

Each term has one status:

### DRAFT
Under construction.

### REVIEW
Complete but awaiting quality review.

### ACTIVE
Approved for production selection.

### RETIRED
No longer used in new games but retained for historical integrity.

## 33. Minimum pool size

Recommended minimums per category:

- Test operation: **30 ACTIVE terms**
- Useful production pool: **100 ACTIVE terms**
- Strong long-term pool: **250+ ACTIVE terms**

## 34. Recommended familiarity mix

Suggested production mix:

- ~50% MAINSTREAM
- ~35% KNOWN
- ~15% NICHE

This is a balancing guideline, not a hard database constraint.

## 35. Example — valid term

**Category:** Automarken  
**Canonical answer:** Lotus  
**Familiarity:** KNOWN

### Hint 1 — VERY HARD — +3

> Die Marke entwickelte ihre Identität stärker über geringes Gewicht als über maximale Motorleistung.

### Hint 2 — HARD — +2

> Der britische Hersteller ist für besonders leichte und fahraktive Sportwagen bekannt.

### Hint 3 — MEDIUM — +1

> Elise, Exige und Evora gehören zu seinen bekanntesten Modellen.

**Status:** ACTIVE

## 36. Example — invalid term

**Answer:** Delfin

Hints:

1. Dieses Tier ist intelligent.
2. Es lebt in sozialen Gruppen.
3. Es kann komplexe Probleme lösen.

Problem:

The full hint set also plausibly describes chimpanzees, elephants, crows, and other animals.

The term fails the ambiguity check and may not become ACTIVE.

## 37. Non-negotiables

Every ACTIVE DNA term:

- has exactly one canonical answer,
- has exactly three hints,
- follows VERY HARD → HARD → MEDIUM,
- follows +3 → +2 → +1,
- becomes progressively more specific,
- is sufficiently unambiguous by Hint 3,
- contains no deliberate false lead,
- contains no trivia trap,
- is quickly readable on mobile,
- does not leak the answer,
- uses original wording,
- prefers durable facts,
- includes required aliases,
- has passed fact and ambiguity review,
- works without category-specific game-engine logic.

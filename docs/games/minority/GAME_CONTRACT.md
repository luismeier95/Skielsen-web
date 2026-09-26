# SKIELSEN Minority — Game Contract v1

**Status:** Approved working rule set  
**Version:** 1.1  
**Date:** 2026-09-27  
**Game key:** `minority`  
**Platform:** Mobile-first, individual devices

## 0. Binding status

This contract is the semantic source of truth for Minority.

Before changing or implementing Minority, consult:

1. `docs/games/minority/GAME_CONTRACT.md`
2. `docs/GAME_DESIGN_CONTRACT.md`
3. `docs/THEME_CONTRACT.md`
4. `docs/style/SKIELSEN_ANIMATION_STYLE_TEMPLATE_v1.md`
5. `docs/END_GAME_MERGE_TEMPLATE.html`

A new explicit user decision overrides this contract, but the contract must be updated in the same change set.

## 1. Core principle

All active players choose one answer simultaneously.

The winning answer is the least-selected answer **only when it forms a real minority relative to at least one other selected answer**.

With four players and two answers:

| Distribution | Result |
|---|---|
| 3:1 | The single player on the minority answer wins |
| 2:2 | No minority; no winner |
| 4:0 | No minority; no winner |

Selections are hidden until every required player has locked an answer or the round is otherwise resolved by the authoritative game flow.

### Answer interaction

- **One tap = final selection.**
- Tapping an answer tile immediately locks and submits that answer; there is no separate confirm button.
- After a player has tapped, the answer cannot be changed for that round.
- In local/solo QA with bots, the tap immediately triggers round resolution.
- In multiplayer, the tapping player enters a locked waiting state until all required players have selected; the server then advances automatically to the reveal.

## 2. Difficulty rules

### EASY

- Standard rounds use 2 answer options.
- 3:1: minority player receives **+1**.
- 2:2: no points.
- 4:0: no points.
- No pot buildup.
- No Chaos Round.

### NORMAL

- Standard rounds use 2 answer options.
- The round value starts at **1 point**.
- If a round has no minority, the value of the next round increases by **+1**.
- When a minority exists again, the winning player(s) receive the current accumulated round value.
- After a scored minority round, the round value resets to **1**.
- Every 5th question is a **Chaos Round** with exactly **3 answer options**.

### HARDCORE

- Uses the same pot system as NORMAL.
- Every 5th question is a **Chaos Round** with randomly **3 or 4 answer options**.
- Special 4:0 rule: when all four players choose the same answer, the player currently leading the game loses **1 point**.
- If several players are tied for the lead, every tied leader loses **1 point**.
- The leader penalty is currently approved **only for 4:0**. It does not automatically apply to 2:2 or 1:1:1:1.

## 3. Multi-answer Chaos Round resolution

With 3 or 4 answer options, more than one player may share the minority win.

Examples with four players:

| Distribution | Result |
|---|---|
| 3:1:0 | Single player wins |
| 2:1:1 | Both single players win |
| 2:2:0 | No minority |
| 4:0:0 | No minority |
| 2:1:1:0 | Both single players win |
| 1:1:1:1 | No minority |

Unused answer options do not count as a minority. A zero-selection option can never win.

## 4. Question cadence

- Questions 1–4: standard 2-option rounds.
- Question 5: Chaos Round according to difficulty.
- Then the cadence repeats in blocks of five.
- EASY remains 2-option only.
- NORMAL uses 3 options on every 5th question.
- HARDCORE uses randomly 3 or 4 options on every 5th question.

## 5. Approved 2-option question pool

The following pool is the current approved 2-option content:

1. Rechts / Links
2. Oben / Unten
3. Heiß / Kalt
4. Drinnen / Draußen
5. Regen / Sonne
6. Tag / Nacht
7. Früh / Spät
8. Cola / Fanta
9. Mayo / Ketchup
10. Nudeln / Reis
11. Apfel / Banane
12. Schokolade / Chips
13. Dusche / Badewanne
14. Fenster / Tür
15. Treppe / Aufzug
16. Fliegen / Fahren
17. Hotel / Ferienwohnung
18. Strand / Pool
19. Camping / Hotel
20. Film / Serie
21. Kino / Zuhause
22. Musik / Podcast
23. Spotify / YouTube
24. Buch / Film
25. Horror / Comedy
26. Action / Drama
27. Marvel / DC
28. Harry Potter / Herr der Ringe
29. Star Wars / Star Trek
30. Mario / Sonic
31. FIFA / Call of Duty
32. Maus / Controller
33. Chrome / Safari
34. Anrufen / Schreiben
35. Foto / Video
36. Selfie / Gruppenfoto
37. Frühaufsteher / Nachteule
38. Planen / Spontan
39. Chaos / Ordnung
40. Laut / Leise
41. Schnell / Langsam
42. Kopf / Bauch
43. Glück / Können
44. Risiko / Sicherheit
45. Geld / Freizeit
46. Bekannt / Unbekannt
47. Vergangenheit / Zukunft
48. Fragen / Antworten
49. Gewinnen / Spaß
50. Allein / Gruppe
51. Gastgeber / Gast
52. Wahrheit / Pflicht
53. Reden / Zuhören
54. Tanzen / Singen
55. Kochen / Bestellen
56. Sport / Gaming
57. Tischtennis / Dart
58. Fitnessstudio / Laufen
59. Angreifen / Verteidigen
60. Kraft / Geschwindigkeit
61. Linksfuß / Rechtsfuß
62. Schwarz / Weiß
63. Kreis / Quadrat
64. Groß / Klein
65. Rund / Eckig
66. Voll / Leer
67. Hell / Dunkel
68. Hoch / Tief
69. Vorne / Hinten
70. Innen / Außen
71. Gerade / Kurve
72. Kopf / Zahl
73. Eins / Zwei
74. Plus / Minus
75. Ja / Nein
76. Jetzt / Später
77. Mehr / Weniger
78. Anfang / Ende
79. Alt / Neu

## 6. Approved 3-option Chaos Round pool

3-option categories must not reuse a term from the approved 4-option pool.

1. Frühstück / Mittagessen / Abendessen
2. Schule / Uni / Arbeit
3. Dusche / Sauna / Whirlpool
4. Balkon / Terrasse / Garten
5. Hemd / Hoodie / T-Shirt
6. Sneakers / Stiefel / Sandalen
7. Gold / Silber / Bronze
8. Rock / Pop / Hip-Hop
9. WhatsApp / Telegram / Snapchat
10. Comedy / Thriller / Dokumentation
11. Frühstücksei / Müsli / Toast
12. Gabel / Messer / Löffel
13. Taxi / E-Scooter / Motorrad
14. Keller / Erdgeschoss / Dachgeschoss
15. Kissen / Decke / Matratze
16. Augen / Ohren / Nase
17. Morgen / Mittag / Abend
18. Zuhause / Büro / Café
19. Tick / Trick / Track

The earlier candidates `Wasser / Saft / Energy` and `Samstag / Sonntag / Feiertag` are excluded because `Wasser` and `Sonntag` already occur in the 4-option pool.

## 7. Approved 4-option Chaos Round pool

1. Frühling / Sommer / Herbst / Winter
2. Nord / Süd / Ost / West
3. Rot / Blau / Grün / Gelb
4. Montag / Mittwoch / Freitag / Sonntag
5. Pizza / Burger / Döner / Pasta
6. Hund / Katze / Pferd / Vogel
7. PC / PlayStation / Xbox / Switch
8. Auto / Fahrrad / Bahn / Zu Fuß
9. Netflix / YouTube / TikTok / Instagram
10. Meer / Berge / Stadt / Land
11. Süß / Salzig / Sauer / Scharf
12. Fußball / Basketball / Tennis / Tischtennis
13. Herz / Pik / Karo / Kreuz
14. Feuer / Wasser / Erde / Luft
15. Januar / April / Juli / Oktober

## 8. Content constraints

- Questions must be understandable immediately without explanation.
- There is no objectively correct answer.
- Knowledge questions and calculations do not belong in Minority.
- Option order may be randomized, but every client must resolve the same authoritative question/options for the same round.
- A term used in the 4-option pool must not be used in the 3-option pool.
- The current 2-option pool was specifically cleaned against the 4-option pool.
- Do not silently add, remove, rename, or rebalance approved categories without updating this contract.

## 9. Player-count and future team mode

- The current standalone / Quick Games baseline is **SOLO with 4 players**.
- Minority must later support a **team mode with up to 8 human players**.
- The 4-player SOLO limit must therefore not be treated as a permanent global Minority limit.
- In team mode, every player earns Minority points individually using the same round rules as SOLO.
- A team's game result is the **sum of the individual Minority points of all players assigned to that team**.
- Player scores must therefore remain individually stored and addressable; team score is an aggregation, not a replacement score.
- The exact future team composition, team decision model and tie behavior are **not yet fixed** and must not be invented during implementation.
- Shared game logic and data structures should remain extensible so that the later 8-player team mode can be added without replacing the entire Minority implementation.

## 10. Not yet fixed by this contract

The following implementation details remain open until explicitly decided:

- exact total number of rounds/questions per match,
- tie-break at the end of the full game,
- exact READY-page copy,
- animation timings,
- timeout behavior for a player who does not answer,
- bot strategy,
- final ranking/merge point mapping into the tournament framework.

These open items must not be guessed into permanent game rules without a subsequent explicit decision.

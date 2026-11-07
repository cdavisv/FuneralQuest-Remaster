# Character voice ledger

What every file in this directory is, and what is not settled about it.

- **Origin.** Each clip was generated with ElevenLabs text to speech (model `eleven_v4`) under
  the project owner's ElevenLabs account, from the game's own text: the exact words of one line
  of dialogue (original 2001 lines word for word as written; Expanded lines as written for the
  remaster), with at most a bracketed delivery direction such as `[deadpan]` before it. The
  voices are ElevenLabs library voices chosen for each character (`cast.json`). Every prompt,
  voice, model, generation id, date and the credits charged are in `sources.json` and
  `takes.json`. The clips were then post-processed by `packages/audio` (`pnpm --filter
  @fq/audio run voice`): silence trimmed, loudness normalised to -16 LUFS, encoded to Ogg
  Opus and AAC. No recording of a person and no audio from the original 2001 game was given to
  the generator.
- **Checked against the script.** Every clip was transcribed back to text with a local
  speech-to-text model and its words compared with the line; a take whose words differ in any
  way was rejected. The transcripts are in `sources.json`.
- **Licence: not established here.** These files are not covered by the project's licence. Their
  redistribution terms are those of ElevenLabs' terms of service for the plan the owner's account
  is on at the time of generation, and of the library voices used. The owner must confirm those
  terms allow shipping them (in the web build, the desktop and mobile apps, and any store build)
  before the voice pack ships in a store build. Until then the web build bundles it only when asked
  to (`FQ_AUDIO_PACKS` naming `voice`).
- **Cost.** 6905 credits in all (every take, kept or not; the ledger is in `sources.json`).

| File | Speaker | Model | Voice id | Generation id | Generated on |
|---|---|---|---|---|---|
| clerk/clerk-d5d0b470b26e0e76.ogg | Clerk | eleven_v4 | dmWfLQZJq7wNPv9WmtiM | aFftoIo6sR3fiFyfIUfB | 2026-11-06 |
| clerk/clerk-0a7515bb2f88f861.ogg | Clerk | eleven_v4 | dmWfLQZJq7wNPv9WmtiM | mquIFw1RhIXUo26hx1iO | 2026-11-06 |
| clerk/clerk-061521b410dbf26a.ogg | Clerk | eleven_v4 | dmWfLQZJq7wNPv9WmtiM | 1yGe2jzvCKJj6NZ56QGx | 2026-11-06 |
| elijah/elijah-bfceb479dcc22a4f.ogg | Elijah | eleven_v4 | weNdhGmYaizQlfiLlyJq | LI0H0POrt8GLzKvBqPXb | 2026-11-06 |
| elijah/elijah-3d061f7153861097.ogg | Elija | eleven_v4 | weNdhGmYaizQlfiLlyJq | o9QfgqZMFuYZUKPyKK2w | 2026-11-06 |
| elijah/elijah-ae51db10cd12a3fe.ogg | Elijah | eleven_v4 | weNdhGmYaizQlfiLlyJq | D6QvelaV7rlhdk4KnzNt | 2026-11-06 |
| elijah/elijah-4ccd59ce1d49b684.ogg | Elijah | eleven_v4 | weNdhGmYaizQlfiLlyJq | 6hVo2LKsnaW018EOWfjv | 2026-11-06 |
| june/june-c2fd47640d9c6a86.ogg | June | eleven_v4 | yX1d4od5qd09pvOQx88H | vilX674VV8dWRWcuZfwC | 2026-11-06 |
| june/june-9938048043116ffe.ogg | June | eleven_v4 | yX1d4od5qd09pvOQx88H | ejWdKw8iomJ74rP5YBkO | 2026-11-06 |
| june/june-c8f2948708645501.ogg | June | eleven_v4 | yX1d4od5qd09pvOQx88H | MwzmDYdXdTo4JeT0aTa4 | 2026-11-06 |
| june/june-f2ce5f6d01ee52c7.ogg | June | eleven_v4 | yX1d4od5qd09pvOQx88H | NgcEfZthPhEdP1mfUP5j | 2026-11-06 |
| june/june-1e3d9b04f539a13e.ogg | June | eleven_v4 | yX1d4od5qd09pvOQx88H | UPklRITBDgeT4BrgKMi7 | 2026-11-06 |
| june/june-16bb2772d065bea4.ogg | June | eleven_v4 | yX1d4od5qd09pvOQx88H | qFA074J1LRGEFrZ8DHwS | 2026-11-06 |
| june/june-d16db5886703331a.ogg | June | eleven_v4 | yX1d4od5qd09pvOQx88H | gEb6vAaN8biFdeH522hK | 2026-11-06 |
| nurse/nurse-6a1f8532d1d0ca84.ogg | Nurse | eleven_v4 | YHcCpa6SBWnKDaCPZJQR | 8BrZrRbcoy2XarmzmAlI | 2026-11-06 |
| nurse/nurse-29293a8f59429b49.ogg | Nurse | eleven_v4 | YHcCpa6SBWnKDaCPZJQR | 0B6OIXaUrwxK8fvH7lYp | 2026-11-06 |
| smyth/smyth-147ce9b3fdca65dd.ogg | Father Smyth | eleven_v4 | MDLAMJ0jxkpYkjXbmG4t | 7CUUDjWC1Q62njNQ6vgZ | 2026-11-06 |
| smyth/smyth-0aebe0fae31297b0.ogg | Father Smyth | eleven_v4 | MDLAMJ0jxkpYkjXbmG4t | vsMCZo3GnOpAJPLJKb8E | 2026-11-06 |
| smyth/smyth-21de31fbabe51bfd.ogg | Father Smyth | eleven_v4 | MDLAMJ0jxkpYkjXbmG4t | stmBYC0gaKX0QgADMF5Y | 2026-11-06 |
| smyth/smyth-3f5fc9e386d4d861.ogg | Father Smyth | eleven_v4 | MDLAMJ0jxkpYkjXbmG4t | wowNo18SK9HXll9GH8BW | 2026-11-06 |
| smyth/smyth-69dc7315ee0099d3.ogg | Father Smyth | eleven_v4 | MDLAMJ0jxkpYkjXbmG4t | ppp5slAcewb3XSfDabjo | 2026-11-06 |
| smyth/smyth-43f9533b2a3283c5.ogg | Father Smyth | eleven_v4 | MDLAMJ0jxkpYkjXbmG4t | KhFnsQc99R9DMDZlly9s | 2026-11-06 |
| smyth/smyth-60d7484557c3b50f.ogg | Father Smyth | eleven_v4 | MDLAMJ0jxkpYkjXbmG4t | 3jBHsogUDc6aKXd0Bn9H | 2026-11-06 |
| smyth/smyth-995ff7e5aaee3c63.ogg | Father Smyth | eleven_v4 | MDLAMJ0jxkpYkjXbmG4t | xOBzrq83WvbAgCqbSnxQ | 2026-11-06 |
| smyth/smyth-ab0255a6aa141024.ogg | Father Smyth | eleven_v4 | MDLAMJ0jxkpYkjXbmG4t | 27v9JF8pQ9lVNgvdHdvH | 2026-11-06 |
| smyth/smyth-c0dc23ca7325db3c.ogg | Father Smyth | eleven_v4 | MDLAMJ0jxkpYkjXbmG4t | OWcINI5UtKw3yOfHqq5L | 2026-11-06 |
| smyth/smyth-9b3726be96da4c4c.ogg | Father Smyth | eleven_v4 | MDLAMJ0jxkpYkjXbmG4t | N5W8jWHud3PJqDa2cTqU | 2026-11-06 |
| smyth/smyth-d431cc76ea0f7df8.ogg | Father Smyth | eleven_v4 | MDLAMJ0jxkpYkjXbmG4t | D5hxIB6kkaYOtakbunja | 2026-11-06 |
| smyth/smyth-e36f9aa0e657fa02.ogg | Father Smyth | eleven_v4 | MDLAMJ0jxkpYkjXbmG4t | I22H5Nv1aLCI2GOA8rkV | 2026-11-06 |
| smyth/smyth-9fbc0aec114012f2.ogg | Father Smyth | eleven_v4 | MDLAMJ0jxkpYkjXbmG4t | ZV1gSUXgcO1FtiBasHRK | 2026-11-06 |
| teller/teller-f1fea7143c711bca.ogg | Teller | eleven_v4 | hgnWqggl2GuD6Xmc3ymR | rfc40HzLeJd6lqNOGPDZ | 2026-11-06 |
| teller/teller-998254a2cb036a44.ogg | Teller | eleven_v4 | hgnWqggl2GuD6Xmc3ymR | OB9fVk7xTw0MWSXqdtg2 | 2026-11-06 |
| teller/teller-51dc2777f08c8bc5.ogg | Teller | eleven_v4 | hgnWqggl2GuD6Xmc3ymR | DuKpamrd0evDwCTM284i | 2026-11-06 |
| teller/teller-ef263dda83f3673c.ogg | Teller | eleven_v4 | hgnWqggl2GuD6Xmc3ymR | NKbJ0zbInSq4BDWJ74Hh | 2026-11-06 |

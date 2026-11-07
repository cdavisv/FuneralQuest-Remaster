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
- **Cost.** 7382 credits in all (every take, kept or not; the ledger is in `sources.json`).

| File | Speaker | Model | Voice id | Generation id | Generated on |
|---|---|---|---|---|---|
| clerk/clerk-2a3f913d43bd10c3.ogg | Clerk | eleven_v4 | dmWfLQZJq7wNPv9WmtiM | 6Mwycxr734cOVMNN7P18 | 2026-11-06 |
| clerk/clerk-240963811aec56a7.ogg | Clerk | eleven_v4 | dmWfLQZJq7wNPv9WmtiM | 2lZkIxaT9WXAuMvjQ7PE | 2026-11-06 |
| clerk/clerk-e321c7a9632dde83.ogg | Clerk | eleven_v4 | dmWfLQZJq7wNPv9WmtiM | 4Y2ROZmRt3ScYMYBazW9 | 2026-11-06 |
| clerk/clerk-d5d0b470b26e0e76.ogg | Clerk | eleven_v4 | dmWfLQZJq7wNPv9WmtiM | aFftoIo6sR3fiFyfIUfB | 2026-11-06 |
| clerk/clerk-0a7515bb2f88f861.ogg | Clerk | eleven_v4 | dmWfLQZJq7wNPv9WmtiM | mquIFw1RhIXUo26hx1iO | 2026-11-06 |
| clerk/clerk-061521b410dbf26a.ogg | Clerk | eleven_v4 | dmWfLQZJq7wNPv9WmtiM | 1yGe2jzvCKJj6NZ56QGx | 2026-11-06 |
| clerk/clerk-545563d0787540be.ogg | Clerk | eleven_v4 | dmWfLQZJq7wNPv9WmtiM | oPoQxKoF1Eh70OJ97Cta | 2026-11-06 |
| elijah/elijah-bfceb479dcc22a4f.ogg | Elijah | eleven_v4 | weNdhGmYaizQlfiLlyJq | LI0H0POrt8GLzKvBqPXb | 2026-11-06 |
| elijah/elijah-1bb109889f7afe4a.ogg | Elijah | eleven_v4 | weNdhGmYaizQlfiLlyJq | BFFPtYZt9DPaTY9UGdOb | 2026-11-06 |
| elijah/elijah-d791a9fc2ed3e42a.ogg | Elijah | eleven_v4 | weNdhGmYaizQlfiLlyJq | HjX9pAbVEWAktJB9xLDC | 2026-11-06 |
| elijah/elijah-3d061f7153861097.ogg | Elija | eleven_v4 | weNdhGmYaizQlfiLlyJq | o9QfgqZMFuYZUKPyKK2w | 2026-11-06 |
| elijah/elijah-a901bda9a94f1337.ogg | Elijah | eleven_v4 | weNdhGmYaizQlfiLlyJq | hjbkBfLZHNoMidaKPp0k | 2026-11-06 |
| elijah/elijah-e51521cfeb987d71.ogg | Elijah | eleven_v4 | weNdhGmYaizQlfiLlyJq | jr73grZlEdJcVEmY8U7G | 2026-11-06 |
| elijah/elijah-b4e4c65f5ce17c8d.ogg | Elija | eleven_v4 | weNdhGmYaizQlfiLlyJq | UiROMBBO57STFIEQStKz | 2026-11-06 |
| elijah/elijah-7f48e0acf6bcd812.ogg | Elijah | eleven_v4 | weNdhGmYaizQlfiLlyJq | C2lTXhWpmmt5PMJ7hlij | 2026-11-06 |
| elijah/elijah-ae51db10cd12a3fe.ogg | Elijah | eleven_v4 | weNdhGmYaizQlfiLlyJq | D6QvelaV7rlhdk4KnzNt | 2026-11-06 |
| elijah/elijah-4ccd59ce1d49b684.ogg | Elijah | eleven_v4 | weNdhGmYaizQlfiLlyJq | 6hVo2LKsnaW018EOWfjv | 2026-11-06 |
| elijah/elijah-54867630dc89c13a.ogg | Elija | eleven_v4 | weNdhGmYaizQlfiLlyJq | vzqUoD0ShPD7TfiLPw59 | 2026-11-06 |
| elijah/elijah-3aef7f26c8ae4aa8.ogg | Elija | eleven_v4 | weNdhGmYaizQlfiLlyJq | VmcMY3GEQUDlM2DLS6S1 | 2026-11-06 |
| elijah/elijah-25d71da77e6c4805.ogg | Elija | eleven_v4 | weNdhGmYaizQlfiLlyJq | nkYRiBLO6gEvkUGrnAMP | 2026-11-06 |
| elijah/elijah-4188aa9744e11ad5.ogg | Elijah | eleven_v4 | weNdhGmYaizQlfiLlyJq | b0lVTuPEC7Y6NbUFfho7 | 2026-11-06 |
| gertie/gertie-ae527bd9c093f85b.ogg | Nurse Gertie | eleven_v4 | YHcCpa6SBWnKDaCPZJQR | n6fzPOGGho1kKI4GlvXJ | 2026-11-06 |
| gertie/gertie-fa4426733cd21e91.ogg | Nurse Gertie | eleven_v4 | YHcCpa6SBWnKDaCPZJQR | pNrajwgIl9cVo0FqoWUD | 2026-11-06 |
| grubb/grubb-863246de762321d8.ogg | Mayor Hollis Grubb | eleven_v4 | mKoqwDP2laxTdq1gEgU6 | 0R4moQlUh8tFuaebr6Xf | 2026-11-06 |
| june/june-c2fd47640d9c6a86.ogg | June | eleven_v4 | yX1d4od5qd09pvOQx88H | vilX674VV8dWRWcuZfwC | 2026-11-06 |
| june/june-9938048043116ffe.ogg | June | eleven_v4 | yX1d4od5qd09pvOQx88H | ejWdKw8iomJ74rP5YBkO | 2026-11-06 |
| june/june-c8f2948708645501.ogg | June | eleven_v4 | yX1d4od5qd09pvOQx88H | MwzmDYdXdTo4JeT0aTa4 | 2026-11-06 |
| june/june-f2ce5f6d01ee52c7.ogg | June | eleven_v4 | yX1d4od5qd09pvOQx88H | NgcEfZthPhEdP1mfUP5j | 2026-11-06 |
| june/june-1e3d9b04f539a13e.ogg | June | eleven_v4 | yX1d4od5qd09pvOQx88H | UPklRITBDgeT4BrgKMi7 | 2026-11-06 |
| june/june-16bb2772d065bea4.ogg | June | eleven_v4 | yX1d4od5qd09pvOQx88H | qFA074J1LRGEFrZ8DHwS | 2026-11-06 |
| june/june-d16db5886703331a.ogg | June | eleven_v4 | yX1d4od5qd09pvOQx88H | gEb6vAaN8biFdeH522hK | 2026-11-06 |
| mudge/mudge-e45707657015f267.ogg | Inspector Mudge | eleven_v4 | mSOmKHC6GZcZbSTGlqHO | AgFh27hUfkyFIWB6N7r3 | 2026-11-06 |
| nurse/nurse-6a1f8532d1d0ca84.ogg | Nurse | eleven_v4 | YHcCpa6SBWnKDaCPZJQR | 8BrZrRbcoy2XarmzmAlI | 2026-11-06 |
| nurse/nurse-29293a8f59429b49.ogg | Nurse | eleven_v4 | YHcCpa6SBWnKDaCPZJQR | 0B6OIXaUrwxK8fvH7lYp | 2026-11-06 |
| smyth/smyth-c7b2ad74afa6bc3e.ogg | Father Smyth | eleven_v4 | MDLAMJ0jxkpYkjXbmG4t | 0FPgxAaiNcS9vtKeYcaJ | 2026-11-06 |
| smyth/smyth-147ce9b3fdca65dd.ogg | Father Smyth | eleven_v4 | MDLAMJ0jxkpYkjXbmG4t | 7CUUDjWC1Q62njNQ6vgZ | 2026-11-06 |
| smyth/smyth-6e42bdff706bc0d9.ogg | Father Smyth | eleven_v4 | MDLAMJ0jxkpYkjXbmG4t | Pdy0qHgd5oGp95JAsNku | 2026-11-06 |
| smyth/smyth-0aebe0fae31297b0.ogg | Father Smyth | eleven_v4 | MDLAMJ0jxkpYkjXbmG4t | vsMCZo3GnOpAJPLJKb8E | 2026-11-06 |
| smyth/smyth-c99353119c957b67.ogg | Father Smyth | eleven_v4 | MDLAMJ0jxkpYkjXbmG4t | 4QShGRmr8ARhhZu2n7yR | 2026-11-06 |
| smyth/smyth-21de31fbabe51bfd.ogg | Father Smyth | eleven_v4 | MDLAMJ0jxkpYkjXbmG4t | stmBYC0gaKX0QgADMF5Y | 2026-11-06 |
| smyth/smyth-b8f2152b445c566d.ogg | Father Smyth | eleven_v4 | MDLAMJ0jxkpYkjXbmG4t | 6C5C4v36RjggaNj5VDDs | 2026-11-06 |
| smyth/smyth-3f5fc9e386d4d861.ogg | Father Smyth | eleven_v4 | MDLAMJ0jxkpYkjXbmG4t | wowNo18SK9HXll9GH8BW | 2026-11-06 |
| smyth/smyth-69dc7315ee0099d3.ogg | Father Smyth | eleven_v4 | MDLAMJ0jxkpYkjXbmG4t | ppp5slAcewb3XSfDabjo | 2026-11-06 |
| smyth/smyth-6c3de27b44569fbd.ogg | Smyth | eleven_v4 | MDLAMJ0jxkpYkjXbmG4t | ZHdlrwujT8WZb4UL2bfw | 2026-11-06 |
| smyth/smyth-43f9533b2a3283c5.ogg | Father Smyth | eleven_v4 | MDLAMJ0jxkpYkjXbmG4t | KhFnsQc99R9DMDZlly9s | 2026-11-06 |
| smyth/smyth-8168fdeb6dacb059.ogg | Father Smyth | eleven_v4 | MDLAMJ0jxkpYkjXbmG4t | 75bdmYO6GACZ2T20NoOH | 2026-11-06 |
| smyth/smyth-60d7484557c3b50f.ogg | Father Smyth | eleven_v4 | MDLAMJ0jxkpYkjXbmG4t | 3jBHsogUDc6aKXd0Bn9H | 2026-11-06 |
| smyth/smyth-995ff7e5aaee3c63.ogg | Father Smyth | eleven_v4 | MDLAMJ0jxkpYkjXbmG4t | xOBzrq83WvbAgCqbSnxQ | 2026-11-06 |
| smyth/smyth-ab0255a6aa141024.ogg | Father Smyth | eleven_v4 | MDLAMJ0jxkpYkjXbmG4t | 27v9JF8pQ9lVNgvdHdvH | 2026-11-06 |
| smyth/smyth-23d8e4ccf040af9a.ogg | Father Smyth | eleven_v4 | MDLAMJ0jxkpYkjXbmG4t | IpsPiFwpNtwOGqLamhBJ | 2026-11-06 |
| smyth/smyth-c0dc23ca7325db3c.ogg | Father Smyth | eleven_v4 | MDLAMJ0jxkpYkjXbmG4t | OWcINI5UtKw3yOfHqq5L | 2026-11-06 |
| smyth/smyth-9b3726be96da4c4c.ogg | Father Smyth | eleven_v4 | MDLAMJ0jxkpYkjXbmG4t | N5W8jWHud3PJqDa2cTqU | 2026-11-06 |
| smyth/smyth-eff981eea7bd6adc.ogg | Father Smyth | eleven_v4 | MDLAMJ0jxkpYkjXbmG4t | JFBuFzagadvoD7bZYsmZ | 2026-11-06 |
| smyth/smyth-d431cc76ea0f7df8.ogg | Father Smyth | eleven_v4 | MDLAMJ0jxkpYkjXbmG4t | D5hxIB6kkaYOtakbunja | 2026-11-06 |
| smyth/smyth-295466bef0ec9070.ogg | Smyth | eleven_v4 | MDLAMJ0jxkpYkjXbmG4t | RC3WQhQ5XHmoj8K9F4yh | 2026-11-06 |
| smyth/smyth-e36f9aa0e657fa02.ogg | Father Smyth | eleven_v4 | MDLAMJ0jxkpYkjXbmG4t | I22H5Nv1aLCI2GOA8rkV | 2026-11-06 |
| smyth/smyth-9fbc0aec114012f2.ogg | Father Smyth | eleven_v4 | MDLAMJ0jxkpYkjXbmG4t | ZV1gSUXgcO1FtiBasHRK | 2026-11-06 |
| teller/teller-f1fea7143c711bca.ogg | Teller | eleven_v4 | hgnWqggl2GuD6Xmc3ymR | rfc40HzLeJd6lqNOGPDZ | 2026-11-06 |
| teller/teller-998254a2cb036a44.ogg | Teller | eleven_v4 | hgnWqggl2GuD6Xmc3ymR | OB9fVk7xTw0MWSXqdtg2 | 2026-11-06 |
| teller/teller-51dc2777f08c8bc5.ogg | Teller | eleven_v4 | hgnWqggl2GuD6Xmc3ymR | DuKpamrd0evDwCTM284i | 2026-11-06 |
| teller/teller-ef263dda83f3673c.ogg | Teller | eleven_v4 | hgnWqggl2GuD6Xmc3ymR | NKbJ0zbInSq4BDWJ74Hh | 2026-11-06 |
| twins/twins-1afa45efa7f9db49.ogg | The Twins | eleven_v4 | Cx1u6YPIa1SPiAbYj3gJ | UboHBG46ibkO4yPXZwlY | 2026-11-06 |
| twins/twins-ee739afb9a1b2f79.ogg | The Twins | eleven_v4 | Cx1u6YPIa1SPiAbYj3gJ | WaLN2F4mDXt0sCIYUV0y | 2026-11-06 |
| twins/twins-c92ee2f47d035f06.ogg | The Twins | eleven_v4 | Cx1u6YPIa1SPiAbYj3gJ | rjrgNtD5JETdLUeod4Aa | 2026-11-06 |
| twins/twins-ae226cdef7129330.ogg | The Twins | eleven_v4 | Cx1u6YPIa1SPiAbYj3gJ | 4rcyle2nLafof1RLK8bR | 2026-11-06 |
| twins/twins-abdbe6614550b0eb.ogg | The Twins | eleven_v4 | Cx1u6YPIa1SPiAbYj3gJ | rrjcOnMV1turW4sKTGkl | 2026-11-06 |
| vane/vane-3dfada11d39f5ac7.ogg | Vane | eleven_v4 | M5E055lOUxMi0kJpGyE9 | ZFCLJOp3ip3Qcg83BAB1 | 2026-11-06 |
| vane/vane-7043de59220dacf7.ogg | Vane | eleven_v4 | M5E055lOUxMi0kJpGyE9 | PSiUFDrbKmxquTYbowtG | 2026-11-06 |
| vane/vane-3f80edd0c5949bd2.ogg | Vane | eleven_v4 | M5E055lOUxMi0kJpGyE9 | 4qatqbfDgxYYkhbxQWyG | 2026-11-06 |
| vane/vane-ebca209e722d5c28.ogg | Vane | eleven_v4 | M5E055lOUxMi0kJpGyE9 | mmuY5b8LIu9YwNMa0xHv | 2026-11-06 |
| vane/vane-181a57afa7da7b5d.ogg | Lucius Vane | eleven_v4 | M5E055lOUxMi0kJpGyE9 | vk8bOeehRe9sN1wqMHPU | 2026-11-06 |
| vane/vane-29190437d7a1cad1.ogg | Vane | eleven_v4 | M5E055lOUxMi0kJpGyE9 | GjfQpreC07ZRRW1Z0Yzi | 2026-11-06 |
| yang/yang-fd4265360d460760.ogg | Mr. Yang | eleven_v4 | yE92kjHV7JLsMwRaRjeg | apoVbpRRWLpEMTx6gl4J | 2026-11-06 |
| yang/yang-6d3db037a0a511d1.ogg | Mr. Yang | eleven_v4 | yE92kjHV7JLsMwRaRjeg | Dfh8Tt8HfdWZkIgRftSF | 2026-11-06 |

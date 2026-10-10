# CANDIDATE: Dirty Sprite Supper Club (DS2): simulated virtual-experience pitch

## CANDIDATE (filled)
- Idea / product name: Dirty Sprite Supper Club, first exhibition "DS2". A rotating-exhibition dining and live-performance concept.
- One-line problem it solves: a pitch deck cannot make an investor, venue owner, or artist's team feel the room, so the concept needs a walkable, visual, sound-off-safe preview of one full evening.
- Audience for the POC: prospective partners and venues (investors, restaurant/venue operators), and the rights-holder side later. They need to feel the night, then react per scene.
- Live app to compare against: none. This is a concept, so there is no Compare screen. Say "no live app" in BUILD.md.
- Backend that exists today: none. Every API status is PROPOSED or POC ONLY. Candidate future endpoints (all PROPOSED): reservations/seating, tasting-menu and allergen service, run-of-show cue sheet, exhibition rotation calendar, ticketing.
- Screens/flows already wanted: a virtual walk-through of one evening, in order: arrival and dress code, the room, the orchestra pit, each course paired with a dancer piece, cocktails and non-alcoholic menu, the rotation concept (what changes between exhibitions), and a "bring this to your venue" close.

## The pitch (source text, supplied by Lenox, do not rewrite its claims)
Dirty Sprite Supper Club is an elevated trap dining experience. You dress. Low-lit deep purple and black room, a single live orchestra pit at one end of a long intimate room, no DJ booth. A small ensemble (strings, horns, percussion, keys) in formal black plays charts that turn trap 808s and hi-hats into a film score. Between courses a company of six to eight dancers runs short precise pieces, each built around one song or a few sharp bars, staged like a compact Broadway number. Lighting follows the arrangement: hard cuts, slow purple washes, one tight spotlight. Timed so food never sits long and the show never overstays. Kitchen is Afro-Caribbean, plated as a serious tasting menu: jerk finished with restrained sweetness, plantain in two or three textures, oxtail cooked down and re-plated with a clean jus, island-nodding seafood, precise sauces, a couple of courses with purple-leaning color or a cooling herbal note. Cocktails dark and aromatic (rum, amaro, smoked citrus, bitterness); non-alcoholic versions on the same menu. The room rotates: DS2 runs a set number of weeks, then new charts, new dance pieces, new plating cues, same room, same dress code, next artist. Constant is the format: live ensemble, compact performance pieces that treat the source seriously, food that stands next to it.

## Media addendum (this candidate needs generated imagery and video)
The POC renders scenes with text-to-image and image-to-video. This changes some template rules:

1. **Media is baked, never generated at view time.** Generate offline, review, then ship. The page makes zero runtime generation or API calls.
2. **Bundle shape:** `poc.html` plus a `media/` folder (posters as `.webp`/`.jpg`, short loops as `.mp4` or `.webm`), all referenced by relative path. The 1.5 MB single-file budget applies to `poc.html` only (no inlined video). Total bundle budget: 60 MB. Videos lazy-load on scene entry, are muted, loop, have a poster, and every scene still reads correctly with video blocked.
3. **Pipeline per scene (record it in `media/manifest.json`):** scene id, text prompt, negative prompt, image model and version, seed, still file; for video scenes: image-to-video model and version, source still, motion prompt, duration, fps, file; plus generation date. Keep the stills so a scene can be re-rolled.
4. **Consistency:** write one `style-bible` block first (palette: deep purple and black, one warm accent; lens, grain, lighting language, dress code, room geometry: long narrow room, orchestra pit at one end) and reuse it verbatim in every prompt. Reuse the same reference stills for image-to-video so the room is the same room in every scene.
5. **Honest labels (extends the data-label rule):** every generated image or clip carries a corner tag `AI-GENERATED CONCEPT ART`. Scene captions describe intent, not fact. No real venue, no claim that this exists.
6. **People and rights:** no real person's likeness, including the artist the concept draws on. Dancers and musicians are generic, unnamed, non-identifiable figures (decided: render dancers and musicians as silhouettes or backlit figures, no visible faces). Do not reproduce lyrics; song titles named in the pitch may appear as program-style labels only, with a visible line on the closing screen: "Concept only. Not affiliated with or endorsed by any artist, label, or rights-holder. Music and choreography rights are an open item." Surface rights as a PROPOSED gap, not a footnote.
7. **No fabricated proof:** no testimonials, no ticket sales, no press quotes, no "sold out", no audience photos. If a figure is needed (seats, course count, run length), label it `EXAMPLE` and keep it consistent with the pitch (six to eight dancers, small ensemble, tasting-menu cadence).
8. **Sound:** audio off by default. Optional sound bed only if it is original or royalty-free and labelled. Do not include any recording of the referenced artist.

## Suggested screen map (adjust, keep stable IDs)
| ID | Screen | Media |
|---|---|---|
| LP-01 | Landing: the one-line pitch + "Walk the room" | hero loop (room, purple wash) |
| WT-01 | Arrival and dress code | still + slow push-in |
| WT-02 | The room and the orchestra pit | wide still + loop |
| WT-03 | Course 1 with Piece 1 (paranoid glide) | plate still + dancer loop |
| WT-04 | Course 2 with Piece 2 (cold flex) | plate still + spotlight loop |
| WT-05 | Course 3 with Piece 3 (late-night spiral) | plate still + slow-wash loop |
| WT-06 | Cocktails and zero-proof menu | two still glasses |
| WT-07 | Rotation: DS2 now, "next exhibition" slot | calendar-style card, no media |
| WT-08 | Run of show (cue sheet, timing so food never sits) | timeline infographic |
| IN-01 | Infographic: one evening as a timeline (courses vs pieces vs light cues) | none |
| IN-02 | Infographic: what rotates vs what stays | none |
| BR-01 | Bring this to your venue (open items: rights, kitchen, build-out; all labelled PROPOSED) | none |
| IX-00 | Screen index + feedback export | none |

## Open items to flag in BUILD.md (do not hide)
- Music rights, choreography rights, and name/trademark use are unresolved.
- No menu testing, no costing, no venue, no cast: all `EXAMPLE`/`PROPOSED`.
- Any video that drifts or has artifacts in faces/hands/text must be re-rolled or replaced with a still; list which scenes were re-rolled.

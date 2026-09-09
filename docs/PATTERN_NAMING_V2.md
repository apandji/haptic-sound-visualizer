# Pattern Naming — V2 Framework & Proposed Names (Patterns 1–21)

_Draft for review. Generated 2026-07-02._

This document extends the V1 naming work (Eileen 7/2 + Pandji 7/1–7/2 freeform
naming test) with two additional evidence sources:

1. **Participant survey data** in `haptic_research_v2.db` (a *different* survey
   protocol — structured vibe/binary/emotion scales rather than freeform
   adjectives). We map its characteristics onto the V1 descriptors and **flag
   contradictions**.
2. **Pattern signal metadata** (`pattern_metadata.json`): RMS (loudness proxy),
   stereo balance (L/R lean), and stereo movement (how much the signal travels).

**EEG / brainwave data is intentionally excluded from this draft.** The current
dataset is too small (single headset, few trials per pattern, and only ~13 of 21
patterns have a usable baseline+stimulation pair) to responsibly drive naming or
classification. It will be revisited once more data is collected. Deep "driving
context" / focus modeling is likewise **tabled for next session** (per your note
on questions 9 & 10); what is here is exploratory only.

---

## 0. How pattern numbers map to the data

**Important:** In the DB, `pattern_id` is *shuffled* relative to the audio file
number (e.g. `pattern_id 3` → `AUD012.mp3`). The stable identifier is the **AUD
file number**, and that is what the V1 test's "Pattern N" refers to.

I validated this mapping using directionality, which is unambiguous:

| Pattern | Metadata stereo balance | V1 direction note | Match |
|---|---|---|---|
| 16 | −0.945 (strongly left) | "Mostly L slight R" (Pandji) | ✅ |
| 11 | −0.547 (left) | "LLL" (Pandji) | ✅ |
| 18 | +1.000 (fully right) | "R Shoulder to Front" (Pandji) | ✅ |

The alternative mapping (`pattern number = pattern_id`) fails all three. So
throughout: **Pattern N = AUD0NN**, and all DB aggregates below are joined
through that mapping.

> Data confidence caveat: trial counts per pattern are small and uneven (2–11
> responses). Patterns **10 (n=2, avg confidence 0.17)**, 4, 6, 8, 13, 16, 17,
> 18, 21 (n=3–4) are thin — treat their DB signals as directional hints, not
> verdicts.

---

## 1. Nomenclature framework

Per your target structure:

```
[Quality] + [Type] + " : " + [Direction]
e.g.  Sharp Pulse : L→R
```

### 1a. TYPE — the mechanical "what it is" (noun)

The core morphology of the haptic event. From the user tests, eight recurring
type nouns emerged. Proposed working definitions:

| Type | Definition | Signal signature |
|---|---|---|
| **Pulse** | Discrete, rhythmic on/off beats with clear gaps | Rhythmic, moderate RMS, clean |
| **Buzz** | Continuous higher-frequency vibration | Sustained, fuzzy texture |
| **Rumble** | Continuous low-frequency, broadband weight | Sustained, low pitch, "heavy" |
| **Thump** | Single or sparse strong hit(s) | Sharp onset, sparse |
| **Shake** | Irregular agitation / wobble | High movement, erratic |
| **Rattle** | Rapid, rough chattering | Rough texture, high urgency |
| **Spring** | Bouncy, decaying oscillation | Smooth, decaying, "boingy" |
| **Swing** | Sweeping traversal across the body | High stereo movement |

### 1b. QUALITY — modifiers (adjectives)

We hypothesize **three modifier sub-dimensions**. A name uses 1–2 quality words,
drawn from the strongest-consensus dimension(s):

| Sub-dimension | Poles | Evidence sources |
|---|---|---|
| **Intensity / Temperature** | Hot ↔ Cold | V1 Hot/Cold, DB `hot_cold` vibe, DB urgency+intensity scalars, RMS |
| **Texture / Quality** | Sharp · Clear · Smooth ↔ Rough · Fuzzy · Flat · Hard | V1 texture words, DB `smooth_rough` + `hard_soft` vibes |
| **Rhythm** | Rhythmic ↔ Erratic | V1 Rhythmic/Erratic |

"Hot/Cold" is doing double duty in V1 as both *temperature* and *intensity/urgency*.
DB `urgency` + `intensity` scalars generally corroborate: Hot-labeled patterns
skew to higher urgency (P3, P9, P1), Cold-labeled to lower (P4, P12).

### 1c. DIRECTION — spatial signature (kept verbatim + corroborated)

Direction is treated as **both a name suffix and a tag** (your answer to Q8). We
keep the V1 directional notes verbatim and corroborate/contradict them with
metadata (`stereo_balance`, `stereo_movement`) and DB binary axes
(`left_right`, `up_down`, `forward_backward`). Notation: `L→R` (travels),
`L⇄R` (oscillates), `Center` (static/centered), `Front`, `Up`, etc.

---

## 2. Proposed V2 names (1–21)

Format: **`[Quality] [Type] : [Direction]`**. "V1 consensus" = repeated
descriptors + directions carried from the naming test. "DB lean" = dominant
survey signal. Contradictions flagged with ⚠.

| # | Proposed V2 name | V1 consensus | DB lean (survey) | Metadata (rms / bal / move) | Flags |
|---|---|---|---|---|---|
| 1 | **Clear Pulse : R→L (sweep)** | Rhythmic, Clear — R→L, LCRCLCR | Rough, Hard, Hot; urgency 0.70; Engaged/Charged; Left; Focus | 0.018 / +0.01 / 0.37 | ⚠ Texture: users "Clear" vs DB "Rough/Hard". Very low RMS but high urgency. |
| 2 | **Fuzzy Rumble : Back⇄Front** | Erratic, Fuzzy — BFFBFF | Hard, Rough, Hot; Backward; Left | 0.129 / +0.02 / 0.07 | ⚠ Temp split (Eileen Hot / Pandji Cold; DB Hot). |
| 3 | **Fuzzy Buzz : Center (static)** | Fuzzy, Buzz — Back Front | Hot, Smooth; **urgency 0.93 (highest)**; Distressed/Tense; Abort/Stop | 0.268 (loudest) / 0.00 / 0.00 | Strong "alert/abort" signal. ⚠ Temp: Eileen Cold vs DB Hot. |
| 4 | **Smooth Pulse : Front / Down** | Rhythmic, Fuzzy, Smooth — Front | Soft, Smooth, Cold; urgency 0.33 (low); Balanced/Loose; Down | 0.121 / 0.00 / 0.00 | Clean agreement. Calm, gentle. |
| 5 | **Hot Pulse : Left + vertical** | Hot, Pulse, Buzz — Top Bottom | Hot, Bright, Safe, Open; urgency 0.65 | 0.153 / **−0.55 (left)** / 0.37 | ⚠ Direction: users "Top/Bottom" but metadata strongly Left + moving. |
| 6 | **Rough Rattle : Center** | Hot, Erratic, Fuzzy, Sharp, Rough, Shake, Rattle — Center | Hard, Rough, Danger, Unwelcoming, Anxious; Abort; Tighten | 0.191 / 0.00 / 0.00 | Full agreement. Harsh "danger/abort" alarm. |
| 7 | **Rough Pulse : Right** | Rhythmic, Fuzzy, Rough — Center | Cold, Expected, Grounded, Clear; urgency 0.46 | 0.019 / **+0.43 (right)** / 0.32 | ⚠ Direction: users "Center" vs metadata Right. |
| 8 | **Cold Spring : Right** | Cold, Rhythmic, Pulse, Spring — Right, Top Center | Smooth, Soft, Cautious; Slower; **Right (3/3)** | 0.061 / +0.10 / 0.36 | Direction agrees. |
| 9 | **Hot Rough Rumble : Front (L→R)** | Hot, Fuzzy, Sharp, Rough — Front, L→R | Rough, Hot, Dark; urgency 0.80; Sharp; Forward; Focus | 0.060 / −0.04 / 0.27 | High-urgency alert. Strong agreement. |
| 10 | **Sharp Thump : Center** | Rhythmic, Clear, Sharp, Thump — Centered | Rough; **n=2, confidence 0.17** | 0.042 / −0.11 / 0.18 | ⚠ Insufficient data (2 trials). Provisional. |
| 11 | **Clear Pulse : Left** | Rhythmic, Clear, Pulse — LLL | Short, Expected, Focus; **Left (3/3)**; Faster; Start | 0.031 / **−0.55 (left)** / 0.17 | Direction agrees strongly. |
| 12 | **Cold Clear Pulse : L⇄R** | Cold, Rhythmic, Clear, Pulse — LR, RLRL | Safe, Bright, Welcoming, Open; urgency 0.39, intensity 0.31 (low); Relax; Continue | 0.011 (quietest) / −0.10 / 0.31 | Pleasant/"safe-continue" signal. Clean agreement. |
| 13 | **Rough Thump : Forward/Center** | Rhythmic, Thump — Center | Rough, Hot, Shine; Forward; Up; Sharp; Compelled | 0.063 / −0.27 / 0.19 | ⚠ Minor: metadata slightly Left vs users Center. |
| 14 | **Smooth Spring : Left (R-clear/L-fuzzy)** | Fuzzy, Flat, Smooth, Spring — L, "R clear L fuzzy" | Soft, Danger; **Left (4/4)**; Tighten | 0.077 / **+0.22 (right)** / 0.40 | ⚠ Metadata right-biased but users + DB say Left. |
| 15 | **Cold Rough Rumble : Back→Front** | Smooth — Back to Front | **Cold (6/7)**, Rough (5/7), Hard, Danger, Unknown; Stop; Push | 0.157 / 0.00 / 0.00 | ⚠ Texture: user "Smooth" vs DB "Rough/Hard". Temp: DB Cold. |
| 16 | **Hot Buzz : Left** | Hot, Fuzzy, Buzz — Mostly L slight R | Hot, Hard, Recognizable; **Left (2/2)**; Start | 0.155 / **−0.95 (strong left)** / 0.30 | Strongest lateralization in set — good directional exemplar. |
| 17 | **Sharp Pulse : Up / front** | Sharp — up, "Top to Bottom & centered in front" | Soft, Long, Welcoming, Open; Backward | 0.024 / **+0.76 (right)** / 0.15 | ⚠ Direction: metadata strongly Right vs users Up/front/left. |
| 18 | **Fuzzy Rumble : Right→Front** | Fuzzy, Rumble — R Shoulder to Front | Hard, Rough, Cold, Danger; **Right (3/3)**; Backward | **0.000 (silent?)** / **+1.00 (full right)** / 0.28 | ⚠⚠ RMS=0.000 but users perceive a Rumble (intensity 0.58). Likely sub-bass energy invisible to standard RMS, or metadata bug. Direction agrees. |
| 19 | **Rough Shake : Front** | Hot — Front, Front Center | Hard, Rough, **Cold (3/4)**, Danger; Right; Stop | 0.045 / +0.12 / 0.44 (high) | ⚠ Temp: V1 "Hot" vs DB "Cold". |
| 20 | **Rough Rumble : Front (moving)** | Flat, Rough, Rumble, Rattle — Front Center | Rough (6/8), Hard, Hot, Danger, Unknown, Dark, Unwelcoming, Closed; Tired/Sad/Foggy | 0.137 / −0.17 / **0.55 (highest move)** | Heavy, dark, unpleasant. Highest movement in set. |
| 21 | **Rough Rattle : Center (static)** | Hot, Rough, Rattle — Front Center | Hard, Rough, Hot, Danger, Dark, Rain; Backward; Abort | 0.122 / −0.01 / 0.09 (static) | Near-twin of P20 in labels, but **P20 moves / P21 is static** — key differentiator. |

### Quick-reference name list

```
1.  Clear Pulse : R→L (sweep)
2.  Fuzzy Rumble : Back⇄Front
3.  Fuzzy Buzz : Center
4.  Smooth Pulse : Front / Down
5.  Hot Pulse : Left + vertical
6.  Rough Rattle : Center
7.  Rough Pulse : Right
8.  Cold Spring : Right
9.  Hot Rough Rumble : Front (L→R)
10. Sharp Thump : Center           (provisional — thin data)
11. Clear Pulse : Left
12. Cold Clear Pulse : L⇄R
13. Rough Thump : Forward/Center
14. Smooth Spring : Left (R-clear/L-fuzzy)
15. Cold Rough Rumble : Back→Front
16. Hot Buzz : Left
17. Sharp Pulse : Up / front
18. Fuzzy Rumble : Right→Front
19. Rough Shake : Front
20. Rough Rumble : Front (moving)
21. Rough Rattle : Center
```

---

## 3. Contradictions surfaced (for discussion / resolution)

These are the places where V1 naming, DB survey, and/or signal metadata
disagree. Grouped by type; each needs a resolution decision.

### 3a. Direction: metadata lean vs. user-reported note
| # | Users said | Metadata says | Note |
|---|---|---|---|
| 5 | Top/Bottom (vertical) | Left (−0.55) + moving | Users may map lateral energy to vertical; or vertical is a real percept metadata can't capture. |
| 7 | Center | Right (+0.43) | Consistent user "Center" across both testers despite right bias. |
| 14 | Left | Right (+0.22) | But DB `left_right` also says **Left (4/4)** — so metadata is the odd one out here. |
| 17 | Up / front / (Pandji) left | Right (+0.76) | Both a vertical claim and an L/R disagreement. |

**Proposed resolution options:** (a) trust user percept for the *name*, keep
metadata as a tag; (b) re-examine the audio files for these four to see if
balance is being computed on a channel-swapped or mislabeled source.

### 3b. Texture: user "smooth/clear" vs DB "rough/hard"
| # | Users said | DB vibe majority |
|---|---|---|
| 1 | Clear | Rough (6/9), Hard (6/8) |
| 15 | Smooth | Rough (5/7), Hard (4/5) |

**Likely cause:** the two surveys ask different questions ("clear/smooth" as
*legibility* vs "rough/hard" as *tactile texture*). Recommend we decide whether
Texture in the name means legibility or tactile grain — they are not the same
axis.

### 3c. Temperature / intensity split
| # | Eileen | Pandji | DB `hot_cold` | Suggested |
|---|---|---|---|---|
| 2 | Hot | Cold | Hot (4/5) | Hot |
| 3 | Cold | — | Hot (3/3) | Hot |
| 15 | Hot | Cold | Cold (6/7) | Cold |
| 19 | Hot | — | Cold (3/4) | Cold |

Recommend using **DB majority as tie-breaker** for temperature when testers
split (applied provisionally in §2).

### 3d. Signal integrity
- **Pattern 18: `rms_mean = 0.000`** while participants reliably perceive a
  "Fuzzy Rumble" (intensity 0.58) and it is hard-panned fully right (+1.000).
  This strongly suggests the RMS metric is missing sub-bass / Woojer-band energy
  (or a bad extraction). **Action:** re-run metadata generation with a
  low-frequency-inclusive RMS before trusting RMS as an intensity proxy.
- **Pattern 10:** only 2 trials, avg confidence 0.17 → name is provisional.

---

## 4. "Types" and "Modifiers" observed (rollup)

**Types actually used across the 21:** Pulse (7), Rumble (5), Rattle (3), Thump
(2), Buzz (3), Spring (2), Shake (1). Pulse and Rumble are the workhorse
categories; Rattle clusters tightly with "danger/abort" alerts (P6, P20, P21).

**Modifier clusters that co-travel (candidate archetypes):**
- **Alert / Abort:** Rough + Hard + Danger + high urgency → P3, P6, P9, P20, P21.
- **Calm / Safe:** Smooth + Soft + Safe/Welcoming + low urgency → P4, P12, (P8).
- **Directional / informational:** strong single-side lean, moderate urgency →
  P11 (Left), P16 (Left), P8 (Right), P18 (Right).

---

## 5. Directionality → early "driving context" hypotheses (exploratory)

_Deep driving-context + focus modeling is tabled for next session; this is a
placeholder to react to._

- **Lateral single-side patterns (P11 Left, P16 Left, P8 Right)** are the
  cleanest candidates for *spatial cues* (e.g., "hazard/turn on your left"),
  because user notes, DB `left_right`, and metadata balance all agree.
- **Sweeping / oscillating patterns (P1 R→L, P12 L⇄R, P20 moving)** read as
  *transitions / ongoing states* rather than point events — plausibly
  "rerouting" or "scanning" cues.
- **Static high-urgency center patterns (P3, P6)** behave like *stop/abort
  alarms* — attention-grabbing, non-directional.
- **Calm centered/front patterns (P4, P12)** are candidates for *ambient/status*
  ("all clear", "continue") given Safe/Relax/Continue responses.

---

## Appendix A — Brainwave (EEG): deferred

EEG/brainwave analysis is **deferred** for this draft. The dataset is currently
too small to be reliable: single headset, few trials per pattern, and only ~13
of 21 patterns have a usable baseline+stimulation pair. Rather than let
underpowered signals influence naming or classification, we will revisit EEG once
more data is collected (and can then re-open the focus / "driving context"
questions tabled from Q9–Q10). The extraction logic remains available in
`scripts/v2_naming_analysis.py` for when we resume.

---

## Appendix B — Reproducibility

- Analysis script: `scripts/v2_naming_analysis.py` (read-only against
  `haptic_research_v2.db`, uses `pattern_metadata.json`).
- Pattern-number → AUD-file mapping validated via stereo balance vs. V1
  direction notes (see §0).

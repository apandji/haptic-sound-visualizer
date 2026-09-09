"""
V2 naming analysis: aggregate DB survey + brainwave + audio metadata per pattern.
Pattern number 1..21 == AUD file number (validated via directional metadata).
Read-only against haptic_research_v2.db. Prints a compact per-pattern summary.
"""
import json
import sqlite3
import statistics
from collections import defaultdict

DB = "haptic_research_v2.db"
META = "pattern_metadata.json"

con = sqlite3.connect(DB)
con.row_factory = sqlite3.Row


def aud_num(name_or_path):
    # e.g. "AUD007.mp3" or "audio_files/AUD007.mp3"
    i = name_or_path.find("AUD")
    return int(name_or_path[i + 3 : i + 6])


# ---- audio metadata ----
meta = {}
for p in json.load(open(META))["patterns"]:
    meta[aud_num(p["filename"])] = p

# ---- pattern_id -> aud num ----
pid2aud = {}
for r in con.execute("SELECT pattern_id, file_path FROM patterns"):
    pid2aud[r["pattern_id"]] = aud_num(r["file_path"])


def per_pattern(query):
    """Return dict aud -> list of rows, mapping via pattern_id join already done."""
    out = defaultdict(list)
    for r in con.execute(query):
        out[r["aud"]].append(r)
    return out


# ---- n trials/responses per pattern ----
counts = {}
for r in con.execute(
    """SELECT p.pattern_id, COUNT(DISTINCT t.trial_id) nt, COUNT(DISTINCT r.response_id) nr
       FROM patterns p LEFT JOIN trials t ON t.pattern_id=p.pattern_id
       LEFT JOIN trial_survey_responses r ON r.trial_id=t.trial_id
       GROUP BY p.pattern_id"""
):
    counts[pid2aud[r["pattern_id"]]] = (r["nt"], r["nr"])

# ---- urgency / intensity / confidence means ----
scalars = defaultdict(lambda: defaultdict(list))
for r in con.execute(
    """SELECT t.pattern_id pid, r.urgency, r.intensity, r.confidence
       FROM trial_survey_responses r JOIN trials t ON t.trial_id=r.trial_id"""
):
    a = pid2aud[r["pid"]]
    scalars[a]["urgency"].append(r["urgency"])
    scalars[a]["intensity"].append(r["intensity"])
    scalars[a]["confidence"].append(r["confidence"])

# ---- categorical emotion fields ----
emo_fields = ["mood", "anxiety", "focus", "body", "energy", "clarity", "social", "motivation"]
emo = defaultdict(lambda: defaultdict(lambda: defaultdict(int)))
for r in con.execute(
    """SELECT t.pattern_id pid, r.mood,r.anxiety,r.focus,r.body,r.energy,r.clarity,r.social,r.motivation
       FROM trial_survey_responses r JOIN trials t ON t.trial_id=r.trial_id"""
):
    a = pid2aud[r["pid"]]
    for f in emo_fields:
        emo[a][f][r[f]] += 1

# ---- vibes ----
vibes = defaultdict(lambda: defaultdict(lambda: defaultdict(int)))
for r in con.execute(
    """SELECT t.pattern_id pid, v.pair_id, v.value
       FROM trial_survey_vibes v JOIN trial_survey_responses r ON r.response_id=v.response_id
       JOIN trials t ON t.trial_id=r.trial_id"""
):
    vibes[pid2aud[r["pid"]]][r["pair_id"]][r["value"]] += 1

# ---- binary actions ----
binaries = defaultdict(lambda: defaultdict(lambda: defaultdict(int)))
for r in con.execute(
    """SELECT t.pattern_id pid, b.pair_id, b.value
       FROM trial_survey_binary_actions b JOIN trial_survey_responses r ON r.response_id=b.response_id
       JOIN trials t ON t.trial_id=r.trial_id"""
):
    binaries[pid2aud[r["pid"]]][r["pair_id"]][r["value"]] += 1

# ---- actions ----
actions = defaultdict(lambda: defaultdict(int))
for r in con.execute(
    """SELECT t.pattern_id pid, a.action_value av
       FROM trial_survey_actions a JOIN trial_survey_responses r ON r.response_id=a.response_id
       JOIN trials t ON t.trial_id=r.trial_id"""
):
    actions[pid2aud[r["pid"]]][r["av"]] += 1

# ---- brainwave: mean relative band power per phase per pattern ----
bands = ["delta_rel", "theta_rel", "alpha_rel", "beta_rel", "gamma_rel"]
bw = defaultdict(lambda: defaultdict(lambda: defaultdict(list)))  # aud -> phase -> band -> list
for r in con.execute(
    """SELECT t.pattern_id pid, br.phase, br.signal_quality,
              br.delta_rel,br.theta_rel,br.alpha_rel,br.beta_rel,br.gamma_rel
       FROM brainwave_readings br JOIN trials t ON t.trial_id=br.trial_id
       WHERE br.signal_quality IS NULL OR br.signal_quality <= 50"""
):
    a = pid2aud[r["pid"]]
    for b in bands:
        if r[b] is not None:
            bw[a][r["phase"]][b].append(r[b])


def dom(counter):
    """Return (top_value, top_n, second_n, total)."""
    if not counter:
        return (None, 0, 0, 0)
    items = sorted(counter.items(), key=lambda x: -x[1])
    total = sum(counter.values())
    top_v, top_n = items[0]
    second_n = items[1][1] if len(items) > 1 else 0
    return (top_v, top_n, second_n, total)


def mean(xs):
    return statistics.mean(xs) if xs else None


# compute brainwave stim-baseline beta shift per pattern for outlier scan
beta_shift = {}
for a in range(1, 22):
    sb = mean(bw[a]["stimulation"].get("beta_rel", []))
    bl = mean(bw[a]["baseline"].get("beta_rel", []))
    if sb is not None and bl is not None:
        beta_shift[a] = sb - bl

print("=" * 90)
for a in range(1, 22):
    m = meta[a]
    nt, nr = counts.get(a, (0, 0))
    print(f"\n### PATTERN {a}  (AUD{a:03d})  trials={nt} responses={nr}")
    print(f"  META rms={m['rms_mean']:.3f}  balance={m['stereo_balance']:+.3f}  movement={m['stereo_movement']:.3f}")
    u = mean(scalars[a]["urgency"]); it = mean(scalars[a]["intensity"]); cf = mean(scalars[a]["confidence"])
    def fmt(x):
        return f"{x:.2f}" if x is not None else "NA"
    print(f"  SCALARS urgency={fmt(u)} intensity={fmt(it)} confidence={fmt(cf)}")
    # vibes dominant (show where clear majority)
    vparts = []
    for pair, c in vibes[a].items():
        tv, tn, sn, tot = dom(c)
        if tot >= 2 and tn > sn:
            vparts.append(f"{tv}({tn}/{tot})")
    print("  VIBES  " + ", ".join(vparts))
    # binary directions
    bparts = []
    for pair, c in binaries[a].items():
        tv, tn, sn, tot = dom(c)
        bparts.append(f"{pair}:{tv}({tn}/{tot})")
    print("  BINARY " + ", ".join(bparts))
    # emotions dominant
    eparts = []
    for f in emo_fields:
        tv, tn, sn, tot = dom(emo[a][f])
        if tot:
            eparts.append(f"{f}={tv}({tn}/{tot})")
    print("  EMOT   " + ", ".join(eparts))
    if actions[a]:
        print("  ACTION " + ", ".join(f"{k}({v})" for k, v in sorted(actions[a].items(), key=lambda x:-x[1])))
    # brainwave summary
    bwparts = []
    for b in bands:
        sb = mean(bw[a]["stimulation"].get(b, []))
        bl = mean(bw[a]["baseline"].get(b, []))
        if sb is not None and bl is not None:
            bwparts.append(f"{b.split('_')[0]}:{sb-bl:+.3f}")
    nreads = sum(len(v) for v in bw[a]["stimulation"].values()) // max(1, len(bands))
    print(f"  BRAINWAVE(stim-base rel, good-signal reads~{nreads}) " + ", ".join(bwparts))

# outlier scan on beta shift
print("\n" + "=" * 90)
print("BETA (focus/alertness) stim-baseline shift ranking:")
vals = list(beta_shift.values())
mu = statistics.mean(vals); sd = statistics.pstdev(vals)
for a, v in sorted(beta_shift.items(), key=lambda x: -x[1]):
    z = (v - mu) / sd if sd else 0
    flag = "  <== OUTLIER" if abs(z) >= 1.3 else ""
    print(f"  P{a:2d}: beta shift {v:+.4f}  z={z:+.2f}{flag}")

# alpha (relaxation) shift too
print("\nALPHA (relaxation) stim-baseline shift ranking:")
ashift = {}
for a in range(1, 22):
    sb = mean(bw[a]["stimulation"].get("alpha_rel", [])); bl = mean(bw[a]["baseline"].get("alpha_rel", []))
    if sb is not None and bl is not None:
        ashift[a] = sb - bl
vals = list(ashift.values()); mu = statistics.mean(vals); sd = statistics.pstdev(vals)
for a, v in sorted(ashift.items(), key=lambda x: -x[1]):
    z = (v - mu) / sd if sd else 0
    flag = "  <== OUTLIER" if abs(z) >= 1.3 else ""
    print(f"  P{a:2d}: alpha shift {v:+.4f}  z={z:+.2f}{flag}")
con.close()

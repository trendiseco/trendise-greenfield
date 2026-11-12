"""Build static checkout PIN data from the Department of Posts directory CSV."""
import csv
import json
import sys
from statistics import median
from collections import Counter, defaultdict
from pathlib import Path

source = Path(sys.argv[1])
target = Path(__file__).resolve().parents[1] / "apps/web/public/data/india-pins"
matches = defaultdict(Counter)
coordinates = defaultdict(set)
with source.open(encoding="utf-8-sig", newline="") as file:
    for row in csv.DictReader(file):
        if row["OfficeName"].strip().upper() == "TEST OFFICE":
            continue
        pin, district, state = (row[key].strip() for key in ("Pincode", "District", "StateName"))
        if len(pin) == 6 and pin.isascii() and pin.isdecimal() and pin[0] != "0" and district and state:
            matches[pin][(district, state)] += 2 if row["Delivery"].strip() == "Delivery" else 1
            try:
                latitude, longitude = float(row["Latitude"]), float(row["Longitude"])
            except (KeyError, ValueError):
                continue
            if 6 <= latitude <= 38 and 68 <= longitude <= 98:
                coordinates[pin].add((latitude, longitude))


assert len(matches) > 18000, "Expected a nationwide directory"
target.mkdir(parents=True, exist_ok=True)
shards = {str(digit): {} for digit in range(1, 10)}
for pin, candidates in sorted(matches.items()):
    district, state = min(candidates, key=lambda pair: (-candidates[pair], pair))
    entry = [district.title(), state.title().removeprefix("The ")]
    if coordinates[pin]:
        entry.extend(round(median(point[i] for point in coordinates[pin]), 5) for i in range(2))
    shards[pin[0]][pin] = entry
for prefix, shard in shards.items():
    (target / (prefix + ".json")).write_text(json.dumps(shard, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
print(f"Bundled {len(matches):,} PIN codes across {len({state for counts in matches.values() for _, state in counts})} states and union territories")

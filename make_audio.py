import json
from pathlib import Path
from gtts import gTTS

Path("audio").mkdir(exist_ok=True)

index = json.loads(Path("data/hiragana/index.json").read_text(encoding="utf-8"))

for series_id in index:
    series = json.loads(Path(f"data/hiragana/{series_id}.json").read_text(encoding="utf-8"))
    for ch in series["chars"]:
        out = Path("audio") / f"{ch['romaji']}.mp3"
        if out.exists():
            continue  # skip ones already made
        # speak the KANA (not the romaji), so the Japanese voice reads it
        gTTS(text=ch["kana"], lang="ja").save(str(out))
        print("made", out)

print("done!")
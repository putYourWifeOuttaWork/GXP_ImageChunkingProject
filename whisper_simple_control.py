import subprocess
import tempfile
import whisper
import pyperclip
import os
import datetime
import pathlib


filename = f"whisper_{datetime.datetime.now().strftime('%H%M%S')}.wav"
temp_path = os.path.join(tempfile.gettempdir(), filename)

print("🎙️ Recording started... Type 'stop' to end:")

process = subprocess.Popen([
    "ffmpeg", "-f", "avfoundation", "-i", ":0",
    "-ac", "1", "-ar", "16000", "-y", temp_path
], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


print("🎙️ Recording... Type 'stop' to end:")

while input().strip().lower() != "stop":
    print("⌛ Waiting for 'stop'...")

process.terminate()
process.wait()

print("🧠 Transcribing...")
model = whisper.load_model("base")
result = model.transcribe(temp_path)
text = result["text"]

pyperclip.copy(text)
print(f"✅ Transcription copied to clipboard:\n\n{text}")
# Add at the end, after transcription is complete
log_path = pathlib.Path.home() / "/Users/thefinalmachine/dev/Project_X/gasX_invivo_v1.125/history.md"
log_path.parent.mkdir(parents=True, exist_ok=True)

with open(log_path, "a") as f:
    f.write(f"\n\n### {datetime.datetime.now().isoformat()}\n")
    f.write(text.strip())
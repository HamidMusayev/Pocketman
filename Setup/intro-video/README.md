# Intro video

`Front/public/intro/pocketman-intro.mp4` is the walkthrough shown by the "Watch the intro"
button on the login / register screen. It was recorded from a local run on a **throwaway
database** filled with made-up data, so no real account is ever touched.

To re-record it after a UI change:

```bash
# 1. backend on a scratch database + frontend dev server
mkdir -p /tmp/demo/data
cd Backend
export DATABASE_URL=sqlite:////tmp/demo/data/demo.db
alembic upgrade head && uvicorn app.main:app --port 8000 &
cd ../Front && npx vite --port 5173 &

# 2. fake data (user "demouser"), then record with Playwright + Chrome
pip install playwright requests
python3 Setup/intro-video/seed.py
python3 Setup/intro-video/record.py /tmp/demo/rec

# 3. encode
ffmpeg -f concat -safe 0 -i /tmp/demo/rec/list.txt -vf "fps=30,format=yuv420p" \
  -c:v libx264 -preset slow -crf 26 -movflags +faststart -an Front/public/intro/pocketman-intro.mp4
ffmpeg -ss 1.5 -i Front/public/intro/pocketman-intro.mp4 -frames:v 1 -q:v 5 Front/public/intro/poster.jpg
ffmpeg -ss 5.5 -i Front/public/intro/pocketman-intro.mp4 -frames:v 1 -vf scale=480:-1 -q:v 5 Front/public/intro/thumb.jpg
```

`seed.py` dates its data around a fixed "today" (`today=` near the top); move it when re-recording.
`record.py` expects Chrome at `/usr/bin/google-chrome`.

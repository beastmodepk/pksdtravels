# PK-SD Travels

Parthey & Shannon's travel journal, live at **https://beastmodepk.github.io/pksdtravels/**

Every trip gets its own circle on the home page — cover photo inside, name in glass across it — and the circles glue together into one cluster as trips are added. Hikes are day trips, so they all live inside **one special Hikes circle**, as entries in a single collection. Design follows Donnell Khanderia Home Search: all-glass frosted Liquid Glass over a photo backdrop, glass pill nav (Home + About), no solid blocks.

> This repo is the GitHub Pages app. The Muse app of the same name was the prototype ("database" version); this one is deliberately different — a static site whose only content file is `data/places.json`. Only real trips and hikes are listed: no examples, no placeholders.

## Where the photos live — Cloudflare R2 (not this repo)

**No photo files are ever committed here.** Photos are stored in a Cloudflare R2 bucket and referenced by path:

| Kind  | Cover            | Gallery                    |
|-------|------------------|----------------------------|
| Trip  | `trips/<slug>/home.jpg` | `trips/<slug>/0.jpg`, `trips/<slug>/1.jpg`, … |
| Hike  | `hikes/<slug>/home.jpg` | `hikes/<slug>/0.jpg`, `hikes/<slug>/1.jpg`, … |

`data/places.json` carries a `photoBaseUrl` — the bucket's public base URL (an `r2.dev` URL or a custom domain, e.g. `https://pics.example.com/`). The site resolves every photo like this:

- a photo value that is an absolute URL is used as-is;
- otherwise `photoBaseUrl` is prefixed to the path.

Google Photos albums remain the master archive: each trip/hike can carry an `albumUrl`, shown in the app as an "Open the Google Photos album" button. (Albums can't be the live store — Google retired third-party album reads in 2025 — so the pictures the site displays are the R2 copies.)

## The content file — `data/places.json`

```json
{
  "photoBaseUrl": "https://pics.example.com/",
  "trips": [
    {
      "slug": "yosemite",
      "name": "Yosemite",
      "where": "California",
      "start": "2026-06-01",
      "end": "2026-06-04",
      "kind": "been",
      "albumUrl": "https://photos.google.com/share/…",
      "cover": "trips/yosemite/home.jpg",
      "photos": ["trips/yosemite/0.jpg", "trips/yosemite/1.jpg"],
      "journal": [
        { "date": "2026-06-02", "title": "Valley day", "text": "What we did, in our own words." }
      ]
    }
  ],
  "hikes": [
    {
      "slug": "monadnock",
      "name": "Mt Monadnock",
      "date": "2026-05-01",
      "where": "New Hampshire",
      "albumUrl": "",
      "cover": "hikes/monadnock/home.jpg",
      "photos": ["hikes/monadnock/0.jpg"],
      "notes": "Windy at the top."
    }
  ]
}
```

`kind` is `"been"` (gold BEEN stamp) or `"wishlist"` (teal WISHLIST stamp). Slugs are lower-case-with-hyphens and must match the R2 folder names.

## How to add things

### A trip
1. Pick a slug, e.g. `yosemite`.
2. Upload its photos to R2 (below): cover first as `trips/yosemite/home.jpg`, gallery as `0.jpg`, `1.jpg`, …
3. Add one object to `trips` in `data/places.json` (copy the shape above), with `cover`/`photos` pointing at those keys.
4. Commit + push to `main`. Pages redeploys automatically.

### A hike
Same, but the object goes in `hikes` and the photos under `hikes/<slug>/`. Opening the Hikes circle shows every hike as its own circle in a glued cluster; tapping one opens that hike's detail (notes, gallery, album link).

### Photos only (to an existing trip/hike)
Upload the new files to that slug's R2 folder with the next numbers, then append the new paths to its `photos` list in `data/places.json` and push.

### Uploading to R2

R2 is S3-compatible, so `aws` CLI or `rclone` both work. One-time setup (endpoint placeholder — use your account's endpoint):

```bash
# ~/.aws/credentials profile for R2, or environment variables:
export AWS_ACCESS_KEY_ID="<R2 access key id>"
export AWS_SECRET_ACCESS_KEY="<R2 secret access key>"
export R2_ENDPOINT="https://<account-id>.r2.cloudflarestorage.com"
export R2_BUCKET="pk-sd-travels-pics"

# Cover + gallery for a trip:
aws s3 cp ./home.jpg "s3://$R2_BUCKET/trips/yosemite/home.jpg" --endpoint-url "$R2_ENDPOINT"
aws s3 cp ./0.jpg    "s3://$R2_BUCKET/trips/yosemite/0.jpg"    --endpoint-url "$R2_ENDPOINT"

# …or a whole folder at once:
aws s3 sync ./yosemite/ "s3://$R2_BUCKET/trips/yosemite/" --endpoint-url "$R2_ENDPOINT"

# rclone equivalent (remote named r2):
rclone copy ./yosemite/ r2:$R2_BUCKET/trips/yosemite/
```

Keys/secrets for R2 are created in the Cloudflare dashboard and stay in the secure vault — never in this repo and never in chat.

## Files

```
index.html              the page (home cluster, trip detail, hikes, about)
assets/spices.css       all styling — the Liquid Glass "spices"
assets/spices.js        all behaviour — renders everything from places.json
data/places.json        the ONLY content file (trips, hikes, photoBaseUrl)
.github/workflows/      Pages deploy on push to main (auto-enables Pages)
```

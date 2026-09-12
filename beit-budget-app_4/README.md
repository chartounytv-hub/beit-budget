# Beit Budget — your own app, on your own address

Everything in this folder is the app: one HTML file, an icon set, a manifest, a service worker,
and one small serverless function that stores the budget so your devices share it.

No account beyond Netlify. No database to sign up for. Nothing to pay.

---

## 1. Put it online

1. Go to **app.netlify.com** and **sign in first** (free). This matters — see the note below.
2. Go to **app.netlify.com/drop** and drag this whole folder onto the page.
3. It deploys and gives you an address like `curious-otter-a1b2c3.netlify.app`.
4. **Site configuration → Change site name** to make it something like `beit-budget.netlify.app`.
   Your own domain works too.

**Why signed in matters:** the sync function needs a build step to install its one dependency.
Dropped while signed out, the files publish as-is, the function never gets built, and the app
falls back to storing everything on the one device. If that happens, sign in and drop again —
the app will tell you plainly when the endpoint isn't there rather than pretending to sync.

## 2. Install it on the phone

Open the address in the phone browser, then:

- **iPhone — must be Safari.** Share → **Add to Home Screen**. (Chrome on iOS can't install web
  apps; it will just bookmark the page.)
- **Android — Chrome.** Menu → **Install app**.

It opens full screen with its own icon — no browser bar, nothing to sign into, and it fits
around the notch and the home indicator. It works with no signal: the service worker keeps the
app cached and every figure is kept on the device too.

Two extras once installed:

- **Long-press the icon → "Log an expense"** opens straight on the amount keypad.
- **Android only:** share text from any app into Beit Budget and it opens pre-filled — the
  number becomes the amount, the rest becomes the description.

## 3. Turn on sync

1. Open the app → **Plan → Sync**.
2. Tap **Generate**, then **Turn on sync**.
3. On every other phone and laptop, enter **the same household code** and turn sync on there too.

That's the whole setup. The code is the key to your budget — anyone who has it can read and
write it, and nobody without it can see anything at all. Treat it like a password, and don't
make it the site's name.

**How it works:** the budget is a single record in Netlify Blobs, your site's own key-value
store, included free. The app pushes when something changes and pulls every 25 seconds and
whenever you bring it to the foreground. It merges rather than overwrites — entries from both
phones are unioned by id, and deletions are remembered so a deleted expense doesn't come back
from the other device. Tested two-device: entries flow both ways, deletions stick, and a budget
edit on one phone reaches the other.

It's a few KB. Netlify's free tier is not remotely troubled by it.

### If you'd rather use a database instead

Only needed if you host somewhere without the function (GitHub Pages, plain S3). **Plan → Sync**
has a Supabase option underneath: create a free project at supabase.com, run this in its SQL
Editor, then paste the project URL, the anon key and a household code into the app.

```sql
create table if not exists budget_state (
  id         text primary key,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);
alter table budget_state enable row level security;
create policy "household only" on budget_state
  for all
  using      ( id = current_setting('request.headers', true)::json->>'x-household' )
  with check ( id = current_setting('request.headers', true)::json->>'x-household' );
```

Note this path is untested — the Netlify one above is the one that was tested end to end.

---

## What's in the folder

| File | Why |
|---|---|
| `index.html` | The whole app — markup, styles, logic, the Excel writer, everything |
| `netlify/functions/state.mjs` | The sync endpoint. Reads and writes one household's record |
| `package.json` | Declares the one dependency the function needs |
| `netlify.toml` | Routes `/api/state`, stops the browser caching a stale app |
| `manifest.webmanifest` | Makes it installable; carries the icon, the shortcut, the share target |
| `sw.js` | Offline shell. Bump `VERSION` when you replace index.html |
| `icon-*.png`, `apple-touch-icon.png` | Home screen icons |

## Moving existing data across

The Claude copy and this one are separate stores. To carry September over: in the Claude copy,
**Plan → Import & export → Expense log (CSV)**; in this one, **Plan → Import & export → Import
statement**, and paste it. The columns line up, and re-importing the same file skips rows
already there.

## Changing the app later

Edit `index.html`, bump `VERSION` in `sw.js` so installed phones take the new version instead of
the cached one, and drop the folder on Netlify again.

### Or connect it to GitHub, so changes deploy themselves

Worth doing once you've edited the app more than twice, or if you want a history you can roll
back. After this, every saved change goes live on its own and every phone picks it up.

1. **Make the repo.** At github.com → **New repository** → name it `beit-budget` → **Private** →
   Create. Don't add a README, it wants to be empty.
2. **Put these files in it.** Easiest with no command line: on the empty repo page click
   **uploading an existing file**, drag in everything from this folder *including the `netlify`
   folder*, and Commit.

   With the command line, from inside this folder:
   ```bash
   git init
   git add .
   git commit -m "Beit Budget"
   git branch -M main
   git remote add origin https://github.com/YOUR-NAME/beit-budget.git
   git push -u origin main
   ```
3. **Point Netlify at it.** In your site → **Site configuration → Build & deploy → Link to a
   repository** (on a brand new site: **Add new site → Import an existing project → GitHub**).
   Authorise Netlify, pick `beit-budget`.
4. **Build settings.** Leave the build command **empty**, set publish directory to `.` and
   functions directory to `netlify/functions` — `netlify.toml` already says all of this, so the
   defaults it offers should be right. Deploy.

From then on: edit a file on github.com (pencil icon) or push from your machine, and Netlify
rebuilds within a minute. Your address, household code and everything logged all stay put — the
data lives in Netlify Blobs, not in the files.

Two habits worth keeping: bump `VERSION` in `sw.js` whenever `index.html` changes, and keep the
repo **private** — not because it holds secrets (it doesn't; the household code lives only on
your devices) but because there's no reason for your budget structure to be public.

### Deploy previews

Once GitHub is connected, a change made on a branch instead of `main` gets its own preview
address, so you can try something without touching the app on your phone. Merge the branch when
you're happy with it.

One outside dependency: the two typefaces load from Google Fonts. Offline, or if that's blocked,
the app falls back to the system font stack and everything still works.

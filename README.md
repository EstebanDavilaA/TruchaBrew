# TruchaBrew

## What is TruchaBrew?

TruchaBrew is a self-hosted homebrewing companion: recipes, batches, water chemistry,
inventory and brew-day tracking, all in one app that runs on your own computer. There
are no accounts and nothing is ever uploaded anywhere — your data stays in a single file
on the machine you run it on.

## What You Need

- A Windows, macOS or Linux computer.
- **Node.js 24 or newer.** Download it from [https://nodejs.org/](https://nodejs.org/) —
  pick the installer for your operating system and run it; the default options are
  fine.
- A phone (or any other device) on the **same wifi network** as the computer, if you
  want to reach TruchaBrew from the brewery floor instead of just the desktop.

## Get the Files

Download this repository from GitHub — click the green **Code** button, then
**Download ZIP** — and unzip it somewhere on your computer. If you're comfortable with
git, `git clone` works just as well.

## The One Command

Open a terminal (Command Prompt or PowerShell on Windows, Terminal on macOS/Linux) in
the folder you just unzipped, and run:

```
npm run brew
```

That's it — one command installs everything it needs, builds the app, and starts the
server. The very first run takes a few minutes while it downloads and builds; every run
after that is much faster.

## Open It

Once it's running, TruchaBrew prints one or more addresses to the terminal, for example:

```
TruchaBrew server: http://localhost:5177
TruchaBrew server: http://192.168.1.42:5177
```

Open the `http://localhost:…` address in a browser **on the same computer**. Open the
`http://192.168.x.x:…` address on your phone or any other device on the same wifi.

## Put It on Your Phone's Home Screen

- **Android / Chrome:** open the address above, tap the **⋮** menu, then
  **Add to Home screen** (or **Install app**).
- **iOS / Safari:** open the address above, tap the **Share** icon, then
  **Add to Home Screen**.

Either way you get an app-like icon that opens straight into TruchaBrew, full-screen,
with no browser address bar.

## Your Data

Everything you enter lives in one file on your own machine, at:

```
apps/api/data/truchabrew.db
```

Nothing is ever uploaded anywhere. To back it up, or move it to another computer, open
**Settings → Database Backup & Export** inside the app and download a full snapshot.

## Security — Please Read

TruchaBrew is built for a trusted home network, not the open internet. Please read this
before you brew:

- There is **no login, no password, and no encryption** — the app trusts whoever can
  reach it.
- **Anyone on the same wifi network can open it**, see your recipes and batches, and
  change your settings.
- **Never port-forward it or expose it to the internet.** Doing so would let anyone,
  anywhere, reach your data with no protection at all.

## Stopping and Restarting

Press **Ctrl+C** in the terminal to stop the server. To start it again later, run
`npm run brew` — it's still fast and safe to run even after the first time, since it
only reinstalls or rebuilds what actually changed. Once it's already been built,
`npm start` is a quicker way to restart without reinstalling or rebuilding anything.

## If It Doesn't Work

- **Phone can't connect:** on Windows, the first time Node asks to communicate over the
  network, make sure you tick **Private networks** on the Windows Defender Firewall
  prompt (not Public). Also double-check both devices are on the *same* wifi network —
  a guest network usually can't see other devices on it.
- **`npm` is not recognized:** Node.js isn't installed yet, or your terminal was opened
  before you installed it — close and reopen the terminal (or restart your computer)
  and try again.
- **Port already in use:** something else on your computer is already using the default
  port. Set a different one with `PORT=5178 npm run brew` (macOS/Linux) or
  `set PORT=5178 && npm run brew` (Windows).

## For Developers

- `npm run dev` — run the API and web app together in watch mode.
- `npm test` — run every workspace's tests plus the root packaging test suite.
- `npm run typecheck` — typecheck every workspace.
- `npm run build` — build the production web and API bundles.
- `npm run lint` — lint the whole repo.
- `npm run smoke` — start the real built artifact and verify it serves correctly, then
  shut it down and clean up after itself.

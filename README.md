# Hello, Fellow Voter! 👋

A small, static web app that makes it easier to hand-write get-out-the-vote (GOTV) postcards and letters — no account, no sign-up, and nothing ever leaves your browser.

If you volunteer with an organization that mails postcards to voters (e.g. [Vote Forward](https://votefwd.org/get-involved), [Signs of Justice](https://www.signsofjustice.com/products/voter-postcard-kit)), you already know the drill: you get a list of names and addresses, and you need to hand-copy each one onto a postcard while keeping track of which ones you've finished. This app exists to make that process faster and less error-prone.

<img width="545" height="300" alt="demo-03" src="https://github.com/user-attachments/assets/2a9463e9-146e-4483-a11d-6ac8f54fd1bb" />

**No account required.** Just open the app and start importing your voter list — there's nothing to sign up for and nothing to configure.

**Your data never leaves your browser.** Everything — your voter lists, your progress, your columns — is stored locally in your browser's `localStorage`. The app makes no network requests other than loading its own code, so no server, and no volunteer organization, ever sees your data or your progress. (Since organizations *do* want to know who was contacted, the app includes a PDF export so you can report your progress back to them yourself.)

## Why this exists

Copying names and addresses by hand from a PDF or spreadsheet is tedious and easy to lose your place in. This app turns that list into a simple board you can work through:

- See one address at a time, in large, easy-to-copy type.
- Track each voter's progress through your own writing workflow (To Do → Writing → Written → Stamped → Mailed, or whatever columns you set up).
- Pick up right where you left off, even across sessions, since your board is saved automatically.

## Features

- **Import your voter list** by uploading the PDF you received from your organization, or by pasting raw text — no need to reformat anything yourself. Lines that look like they might be an address but can't be parsed automatically are queued for manual review instead of silently dropped, and duplicate voters are detected automatically.
- **Kanban-style board** for tracking progress, with fully customizable columns per project (add, rename, reorder, or delete columns to match your own workflow).
- **Postcard-style address view** — click a voter to see their mailing address in large type on a postcard-back layout, ready to copy. Press the right arrow key (or click "Next Voter") to move straight to the next address.
- **Multi-select and group drag-and-drop** — select several voters at once (checkbox, Ctrl/Cmd-click, or Shift-click for a range) and move them between columns together.
- **Undo/redo** for every board change (`Ctrl/Cmd+Z`, `Ctrl/Cmd+Shift+Z` or `Ctrl+Y`).
- **Multiple projects** — keep separate voter lists (e.g. for different campaigns) side by side.
- **PDF status export** — generate a report of every voter and their current status, to send back to the organization you're volunteering with so they know who's actually been contacted.
- **Helpful reminders**, like a tip that a postcard stamp is cheaper than a letter stamp.

## Getting started

```bash
npm install
npm run dev
```

Then open the local dev URL Vite prints in your terminal. Click the **?** button any time to reopen the in-app walkthrough and see keyboard shortcuts.

### Other scripts

```bash
npm run build      # type-check and build a static production bundle to dist/
npm run preview    # preview the production build locally
npm run test        # run the unit test suite (Vitest)
npm run typecheck   # type-check only
```

## How it works

This is a static, framework-free TypeScript app built with [Vite](https://vitejs.dev/) — there's no backend and no database. All state (projects, voters, columns, progress) is persisted to `localStorage` in your browser. Voter lists are parsed client-side, either from an uploaded PDF (using `pdfjs-dist`) or from pasted text, and status reports are generated client-side as PDFs (using `jsPDF`).

Because everything is static, the app is deployed to GitHub Pages automatically on every push to `main`.

## A note on scope

This app is an independent volunteer productivity tool and isn't affiliated with any specific GOTV organization. It just helps you stay organized while you write postcards for whichever campaign or organization you're volunteering with — remember to report your finished postcards back to that organization directly, since this app never contacts them for you.

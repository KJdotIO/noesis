# Noesis

Noesis is a browser companion for reading articles on
`plato.stanford.edu/entries/*`. Its a personal project thats useful to me.

It does not republish Stanford Encyclopedia of Philosophy content, mirror SEP
entries, or serve article text from another server. You read the original page
on the original site. Noesis just keeps track of your own reading state:
bookmarked entries, reading position, highlights, and notes.

Noesis is unofficial and is not affiliated with Stanford University or the
Stanford Encyclopedia of Philosophy.

## What it does

- saves the current entry from the browser extension
- remembers reading position per entry
- saves highlights and optional notes
- restores highlights when you reopen an entry
- keeps data local by default
- lets you sign in with an email code if you want account backup and sync

## SEP content

Noesis is designed around a simple boundary: SEP entries should be read from SEP
itself, not copied into a separate public reader. SEP entries are copyrighted by
their authors and published through the SEP. Noesis does not scrape the full
site, redistribute entries, cache full article prose, or make a public app that
presents copied SEP content in its own reader.

The extension stores small pieces of user-created reading data: the entry URL,
slug, title, scroll position, short selected quotes, and notes. Those records
link back to the original SEP page, so reading still happens on SEP and SEP
still receives the normal page views.

## Privacy

You can use Noesis without signing in. In that mode, saved entries, reading
positions, highlights, and notes stay in your browser's extension storage.

That also means the data is only as durable as that browser profile. If you
clear extension storage, reset the browser profile, or remove the extension, you
could lose local Noesis data.

Account sync is optional. If you sign in, Noesis stores your saved entries,
reading positions, highlights, and notes in Supabase so they can be pulled into
another browser session. Noesis stores links and short user-created notes or
quotes. Again, it does not store full SEP article prose.

There is a fuller privacy note in [`docs/privacy.md`](docs/privacy.md).

## Current limits

- Highlights should stay within a single paragraph or display block. Cross-block
  selections are blocked because they can change the SEP page structure.
- The popup is meant for the current page.
- Export/import is not included in this version.

## Version

`0.1.0`

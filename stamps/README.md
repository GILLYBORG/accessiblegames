# Symbol Stamps (beta)

Students pick a picture symbol and stamp it onto a page. Live at
`https://gillyborg.github.io/accessiblegames/stamps/`.

## Playing

- **Touch / mouse:** tap a stamp on the side (or underneath), then tap the page where it should go.
- **Keyboard:** number keys 1 to 9 choose a stamp. Tab to the page, move the ring with the arrow keys
  (hold Shift for small steps), Enter or Space stamps.
- **Switch:** turn on **Switch scanning** in Settings (or add `&scan=1` to the link). The stamps light up
  one at a time and their names are said. Press to stamp the lit one. **Where the stamp goes**:
  - *Next space, in rows* (default): stamps fill the page neatly, left to right.
  - *Anywhere (surprise)*: a random empty-ish spot.
  - *Student chooses the spot*: after picking a stamp, rows light up, then spots in the row.
  An **Undo** tile joins the stamps while scanning and in full screen. Two-switch step scanning
  (Space moves, Enter picks) and an "ignore extra presses" gap for tremor are in Settings.
- **Screen readers:** stamps are toggle buttons with their names; the page is one button that says
  what is on it ("On the page: 2 dogs and 1 cat"). Each stamp is announced.
- **Undo**, **New page** (press twice to clear), **Save picture** (a PNG of the page), **Full screen**.

Nothing the student makes is stored: a refresh gives a fresh page. There are no uploads.

## Teacher setup

Search the **Mulberry** symbols (built in) or **ARASAAC** pictograms (online), browse Mulberry groups,
or start from a quick set (Pets, Farm, Feelings, Weather...). Up to 12 stamps. Change the word for any
stamp, set stamp size, paper colour and words under stamps, then copy a link.

Link parameters:

| Parameter | Meaning |
| --- | --- |
| `s` | stamps, separated by `|`. `m:dog` is Mulberry, `a:2517~dog` is ARASAAC. `~word` sets the word said. |
| `size` | `s`, `m` (default), `l`, `xl` |
| `bg` | `white` (default), `cream`, `sky`, `grass`, `black` |
| `words=1` | show the word under each stamp |
| `lock=1` | hide Teacher setup |
| `scan=1` | switch scanning on (also `spot=next|random|choose`, `scanmode=auto|step`, `speed=2`) |
| `setup=1` | open Teacher setup straight away |

## Symbols and licences

- **Mulberry Symbols** 3.6.1 by Steve Lee, CC BY-SA 4.0, stored in `symbols/mulberry/` (see its
  `LICENSE.txt`). The 6 symbols Mulberry marks as "rated" (adult body parts) are left out. Rebuild with
  `python3 tools/build-mulberry.py <mulberry-symbols checkout>`.
- **ARASAAC** pictograms (Sergio Palao, Government of Aragón), CC BY-NC-SA 4.0. They are **not**
  stored here: they load from `api.arasaac.org` / `static.arasaac.org` while playing. Free for
  non-commercial (school) use. A school web filter could block them; Mulberry always works.
  Pictograms ARASAAC flags as sexual or violent are hidden from search.
- The credit line under the page names whichever libraries the current stamps use.
- Do not add Boardmaker (PCS) symbols: they are owned by Tobii Dynavox.

# Science Lab

Science simulators for Ontario Science and Technology (2022), grades 1 to 6.
Live at `gillyborg.github.io/accessiblegames/science/`. The games home page links here with a small "Science Lab" button.

| Grade | Simulator | Folder | Curriculum |
|---|---|---|---|
| 1 | Sun and Shadows | `sun-shadows/` | Daily and Seasonal Changes |
| 2 | Hot and Cold | `hot-cold/` | Properties of Liquids and Solids; Air and Water |
| 3 | Plant Lab | `plant-lab/` | Growth and Changes in Plants; Soils |
| 4 | Food Chains (coming soon) | | Habitats and Communities |
| 5 | Bridge Builder (coming soon) | | Forces Acting on Structures |
| 6 | Circuit Builder (coming soon) | | Electrical Phenomena |

## How they are built

- No build step, no libraries. Each simulator is `index.html` + one `.js` file, and they share `common/sim.css` and `common/sim.js`.
- Pictures are drawn in SVG by code, so there are no image files to swap.
- Every change is written to a live region (VoiceOver / ChromeVox read it) and spoken when **Talk** is on.
- Controls are big buttons (no sliders), so touch, keyboard and switches all work. Settings has one-switch and two-switch scanning, high contrast and bigger text.
- Every graph has a data table beside it, and results can be saved as a CSV file.
- Full screen hides everything at the top except an Exit full screen button.
- Only settings are saved on the device (`localStorage` key `ag-science`). Nothing is uploaded and results are gone after a refresh.

## Links

Add to any simulator link: `?talk=1` (talk on), `?hc=1` (high contrast), `?big=1` (bigger text), `?scan=one` or `?scan=two` (switch scanning), `&speed=3` (seconds per step).

When you change a css or js file, change the `?v=` number in the page so iPads load the new version.

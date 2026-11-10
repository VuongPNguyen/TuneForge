- Optimize interaction between AI-autofill and configuration autofill.
  - Struggles with covers of songs.
  - Does quickly save albums.
- Fix container issue for docker. Does not seem permanent.
- Fix save album
- Bad image link gives bad error.
- Change the Covers, Singles, Album widget.
  - Either can make a widget on the side in the margins or keep at top of screen
  - Should follow the user as they move down the page.

Complete:
- 11/09/2026
  - Multiple Artists are separated by a slash "/"
    - Artist and album artist from YouTube's artist list are joined with "/" (e.g. "Artist A/Artist B"); AI autofill follows the same format.
    - Artist mappings apply to each artist individually, after first checking for a mapping of the full value.
    - The filename lists multiple artists comma-separated, since "/" isn't allowed in filenames.

- 11/09/2026
  - Add sorting options to artist mapping
    - Original or display name A–Z / Z–A, or newest / oldest first; the choice is remembered.
  - Add sorting options to genre
    - A–Z / Z–A; the choice is remembered.
  - Add search features for artist mapping and genre
    - Mapping search matches both original and display names; genre search matches the name.
  - Have memory to remember previous "page" since last download.
    - The last selected tab (Default or Music) is stored in localStorage and reopened on the next download.

- 11/09/2026
  - Add an additional tags button with popup.
    - Toggle extra ID3 tags (composer, disc number, compilation, lyricist, BPM, lyrics, etc.) onto the main page.
    - Reorder any field, including the defaults, by dragging or with the arrow buttons.
    - Layout is saved to the account when signed in, otherwise for the browser session.

- 09/29/2026
  - Add trimming feature
    - Dual-thumb range slider plus start/end mm:ss inputs in TagEditor.
    - Trimming applied on save via ffmpeg (original temp file kept for re-trims).

- 09/28/2026
  - Change thumbnail display to have entire image in frame.
    - A rectangular image should have width fit the frame.
  - Change artist mapping UI.
    - The mapping fields of original name and display name should be visible without opening mappings tab.
    - Change mapping tab to popup. similar to genres, rather than dropdown.
      - Dropdown takes up too much space.
    - If a mapping already exists, show it in the input fields.
      - Changing the mapping there will update rather than add new.

- 04/08/2026
  - Streamline artist mapping.
    - Autofill the current mapping without the manual part.
    - Auto-apply the mapping on creation.
  - The file name is linked to artist which causes issues when there are multiple artists.
  - Add auto-complete on genres.
  - Put the youtube link in the comments.
  - Change locking fields to having them synced but able to edit after the fact.
    - Big issue when a cover has a custom name.
  - Extract the desired youtube link from an untrimmed link.
    - A playlist has list=, so the webapp should auto crop the link.
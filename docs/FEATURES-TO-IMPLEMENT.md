- Optimize interaction between AI-autofill and configuration autofill.
  - Struggles with covers of songs.
  - Does quickly save albums.
- Fix container issue for docker. Does not seem permanent.
- Fix save album
- Multiple Artists should be separated by a slash "/"
- Bad image link gives bad error.

Complete:
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
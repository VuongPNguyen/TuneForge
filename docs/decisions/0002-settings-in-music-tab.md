# ADR-0002: Co-locate artist and album settings inside the Music tab

**Status:** Accepted
**Date:** 2026-02-25

## Context

The artist name mappings and saved albums features needed a management UI — somewhere users can add, edit, and delete entries. Two placements were considered: a gear icon in the top navigation bar, or somewhere within the tag editor itself.

The initial implementation placed a gear icon in the navbar that opened a separate settings modal. This was then raised as confusing: the settings are music-tagging-specific and have no relationship to the rest of the app, so surfacing them globally felt misleading.

A second iteration added a dedicated "Settings" third tab alongside "Default" and "Music" in the tag editor. This was also identified as awkward because it separated the settings from the mode controls they relate to.

## Decision

Embed the artist mappings and saved albums management as **collapsible sections inside the Music tab**, directly below the Mode card (Covers / Singles / Albums buttons).

- Both sections are **collapsed by default** to keep the interface compact.
- A **count badge** on each section header signals at a glance how many entries are saved.
- The "Saved Albums" section description references "use Albums mode above to save an album", linking the two features contextually.

## Consequences

### Positive
- Settings are co-located with the features they control — Albums mode saves an album, Saved Albums shows what's saved.
- Collapsed by default means the Music tab doesn't feel cluttered for users who never use these features.
- Removes the need for a separate settings modal or tab, reducing overall UI surface area.
- The tag form remains fully visible and accessible below, regardless of what is expanded.

### Negative / Trade-offs
- Settings are only accessible when the tag editor is open (i.e. after a download has been initiated). A user cannot pre-configure mappings before their first download.
- This is acceptable because: (a) the typical workflow is to notice a mapping is needed *after* seeing the wrong name in the editor, and (b) the next download will apply the newly added mapping.

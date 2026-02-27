# Frontend — TuneForge (YT to Music)

React 19 + TypeScript + Vite frontend for TuneForge (YT to Music).

For full project documentation and setup instructions, see the [root README](../README.md).

---

## Development

```bash
npm install
npm run dev          # dev server on http://localhost:5173 (proxies /api → :8000)
npm run build        # production build → dist/
npm run preview      # preview the production build locally
```

## Testing

```bash
npm test             # unit + component tests (vitest)
npm run test:e2e     # Playwright end-to-end tests (requires dev server running)
```

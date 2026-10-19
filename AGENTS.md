<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Automatic Git Commit & Push Rule
Whenever you finish making code changes in this project, you MUST automatically stage all changes, commit them with a descriptive message, and push them to the `main` branch (`git add -A && git commit -m "..." && git push origin main`). This ensures the live Vercel website automatically triggers a new deployment and updates in real-time.

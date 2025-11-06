# Repository Guidelines

## Project Structure & Module Organization
We anchor active development in `herakoi_web_three_channels/html`, which serves the production UI and bundles the MediaPipe-based interaction logic. The sibling `dev.docker-compose.yml` and `prod.docker-compose.yml` files orchestrate our NGINX layers for preview and release builds. Legacy proofs of concept live in `herakoi_web_test`, while shared static assets (favicons, logos) sit under `public/assets`. Use `test_imgs` when we need ready-made samples for demoing the image upload path, and keep `src/` available for future TypeScript or component work.

## Build, Test, and Development Commands
We lean on Docker Compose so everyone gets the same NGINX + static build. Spin up the hot-reloading preview with:
```bash
docker-compose -f herakoi_web_three_channels/dev.docker-compose.yml up --build
```
It mounts the HTML bundle locally, so edits refresh without rebuilding the container. For a release-like image, run:
```bash
docker-compose -f herakoi_web_three_channels/prod.docker-compose.yml up --build
```
This copies the compiled site into `/usr/share/nginx/html`, matching how our production host serves files. Tear down either stack with the matching `down` command.

## Coding Style & Naming Conventions
We favor plain HTML, CSS, and vanilla JavaScript, indented with two spaces to mirror the existing markup. When we introduce new assets, keep filenames lowercase with hyphens (`hand-tracking.js`) so Docker and NGINX stay case-safe. Inline scripts should group DOM queries, MediaPipe setup, and rendering helpers in that order, each separated by narrative comments that explain why the block exists, what it does, and how teammates should expect it to behave.

## Testing Guidelines
No automated harness ships yet, so we validate changes through manual runs. After starting the dev stack, confirm webcam capture, image upload rendering, and frequency slider updates in the browser console. When we touch asset loading, retest using the samples in `test_imgs` to ensure cross-origin handling stays intact. If a change alters MediaPipe usage, document follow-up checks so the next person can reproduce them.

## Commit & Pull Request Guidelines
Our short Git history uses imperative subjects (“Add dev docker compose”), so keep that voice and front-load the area (`ui:`, `docker:`) where it clarifies scope. Pull requests should include: a concise summary, a note on manual verification (which docker command, which browser), and screenshots or GIFs when UI behavior shifts. Link issues when relevant and call out any TODOs we intentionally defer.

## Agent-Specific Instructions
When adding scripts or configs, start with a brief overview comment so future agents know the mission. Before substantial logic blocks, narrate the why/what/how, highlight expected side effects, and flag risks we still need to manage. This keeps our documentation and automation aligned and makes every handoff smoother for the whole team.

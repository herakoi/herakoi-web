# ADR 006: Simple Analytics Integration for Privacy-Friendly Usage Tracking

## Status
Accepted – 6 February 2026

## Context
Herakoi is an experimental sonification tool that tracks hand movements and converts them to audio. To understand how users interact with the application, identify common usage patterns, and detect potential issues, we need basic analytics capabilities. However, traditional analytics solutions like Google Analytics raise privacy concerns due to:

- Cookie tracking and user fingerprinting
- GDPR compliance complexity requiring explicit consent banners
- Data sharing with third-party advertising networks
- Excessive data collection beyond our actual needs

Our analytics requirements are minimal:
1. **Page view tracking** - Understand overall usage and traffic patterns
2. **Custom event tracking** - Monitor key interactions (camera start, image uploads, pipeline errors)
3. **Privacy-first approach** - No cookies, no personal data collection, GDPR-compliant by default
4. **Lightweight implementation** - Minimal performance impact and simple integration

Simple Analytics emerged as the ideal solution. It's a privacy-focused analytics platform that:
- Does **not** use cookies or track personal information
- Is **GDPR-compliant by default** (no consent banner needed)
- Provides a **lightweight script** (~3KB) with minimal performance overhead
- Uses **domain-based identification** (no API keys to manage)
- Supports **custom event tracking** via a global `sa_event` function
- Offers a clean, minimal dashboard focused on insights rather than surveillance

The project currently has no analytics infrastructure, making this a greenfield integration.

## Decision
Integrate Simple Analytics for privacy-friendly usage tracking with the following architecture:

### 1. Script Integration
Add the Simple Analytics script to `index.html` in the `<head>` section using the `defer` attribute:

```html
<script defer src="https://scripts.simpleanalyticscdn.com/latest.js"></script>
```

**Key choices**:
- **Auto-detect domain**: No `data-hostname` attribute, letting Simple Analytics automatically detect the domain from the browser's hostname
- **Single entry point**: Add script only to `index.html` (main React app), not to deprecated pages (`one-channel.html`, `three-channel.html`, `modular.html`)
- **Defer loading**: Use `defer` attribute to avoid blocking page render while ensuring script execution after DOM parsing

### 2. TypeScript Wrapper Module
Create a type-safe wrapper at `src/app/lib/analytics.ts` that:

- **Declares global `sa_event` type** via TypeScript ambient declaration
- **Provides environment-aware tracking** using `import.meta.env.DEV` (Vite built-in)
  - Development mode: Log events to console only, suppress network requests
  - Production mode: Send events to Simple Analytics dashboard
- **Offers domain-specific helper functions** for common events:
  - `trackCameraStart()` / `trackCameraStop()`
  - `trackImageUpload(source: string)`
  - `trackImageSelect(imageId: string, collection?: string)`
  - `trackPipelineError(error: string)`
  - `trackPipelineRestart()`
  - `trackImageCoverToggle(enabled: boolean)`
- **Handles graceful degradation** if Simple Analytics script fails to load or is blocked by ad blockers

### 3. Environment Detection Pattern
Follow the existing pattern from `src/debug/index.ts` using Vite's built-in `import.meta.env.DEV` constant for development detection. This ensures consistency across the codebase without introducing custom environment variables.

### 4. Optional Event Integration
The wrapper is ready for use but event tracking calls are **not mandatory** in this initial integration. Teams can add tracking calls to key user interactions in `App.tsx` and other components as needed:

```typescript
import { trackCameraStart, trackImageUpload } from './lib/analytics';

const handleStart = () => {
  trackCameraStart();
  void start();
};
```

Recommended tracking points:
- Pipeline start/stop/restart actions
- Image selection and uploads
- Error states
- Settings changes (cover mode toggle, audio parameters)

## Consequences

### Positive
- **Privacy-first analytics**: No cookies, no personal data collection, GDPR-compliant by default
- **Type safety**: TypeScript wrapper prevents runtime errors from typos in event names
- **Development-friendly**: Console logging in dev mode, no pollution of production analytics
- **Minimal implementation**: Single script tag + ~80-line TypeScript module
- **No build changes**: Vite handles everything automatically, no configuration needed
- **Graceful degradation**: App continues to function if script is blocked or fails to load
- **Domain-based identification**: No API keys or secrets to manage in environment variables
- **Lightweight**: ~3KB script size, minimal performance impact
- **Future-ready**: Helper functions make it easy to add event tracking across the codebase

### Negative
- **External script dependency**: Adds reliance on `simpleanalyticscdn.com` CDN (mitigated by `defer` attribute and graceful degradation)
- **Paid service for high traffic**: Simple Analytics has usage limits on free tier, though generous for experimental projects
- **Limited customization**: Less feature-rich than Google Analytics (but this is intentional for privacy)

### Neutral
- **Manual event tracking**: Developers must remember to add tracking calls for new features (documented in README and code comments)
- **Single-page app limitation**: Automatic page view tracking less useful for SPAs without routing (custom events are primary value)
- **Dashboard access**: Requires Simple Analytics account setup and domain configuration to view analytics (script works immediately, data appears once configured)

## Alternatives Considered

### Google Analytics 4 (GA4)
**Rejected** due to:
- Cookie-based tracking requires GDPR consent banners
- Complex setup and configuration
- Privacy concerns around data sharing with Google
- Overly complex dashboard for our minimal needs

### Plausible Analytics
**Considered** as similar privacy-first alternative to Simple Analytics.
**Not chosen** because:
- Simple Analytics has cleaner API and better TypeScript support
- Slightly higher pricing for similar feature set
- Simple Analytics' domain auto-detection is simpler than Plausible's configuration

### Self-hosted Matomo
**Rejected** due to:
- Requires server infrastructure and maintenance
- Overkill for a static site hosted on GitHub Pages
- Higher operational complexity

### No Analytics
**Rejected** because:
- Loss of valuable insights into user behavior and usage patterns
- Inability to identify and prioritize common issues or features
- Missed opportunity for data-driven improvements

## References
- Simple Analytics documentation: https://docs.simpleanalytics.com/
- Simple Analytics script installation guide: https://docs.simpleanalytics.com/script
- Simple Analytics events API: https://docs.simpleanalytics.com/events
- GDPR compliance overview: https://docs.simpleanalytics.com/gdpr
- Vite environment variables: https://vite.dev/guide/env-and-mode.html
- TypeScript ambient declarations: https://www.typescriptlang.org/docs/handbook/declaration-files/introduction.html

# Claude Instructions for leet-canvas

## About this project
Infinite collaborative canvas. Frontend is Vite + React + TypeScript + Tailwind v4. Backend is Spring Boot + Maven (Java 21).

## About me
- Learning Java, distributed systems, and real-time systems through this project
- Comfortable with TypeScript/React, newer to Java and backend architecture

## Code style
- Backend comments should **teach**, not just describe — explain *why* a design decision was made, not just what the line does
- Call out distributed systems concepts when they appear (concurrency, race conditions, fan-out, statefulness, etc.)
- Keep frontend code concise, no over-engineering
- No unnecessary abstractions — solve the current problem, not hypothetical future ones

## Tech choices (don't change without asking)
- Raw WebSocket on the backend, no STOMP — we want explicit control over the message flow
- Immutables library for Java value/message types
- `crypto.randomUUID()` for ID generation — no external library needed
- Tailwind utility classes only — no CSS modules, no inline style except for dynamic values

## Styling
- Keep it **minimal** — structure and readability yes, decorative polish no
- Keep: dark background, dot grid, basic typography (sizes/weights for legibility), layout/spacing, cursor styles, structural borders
- Strip: shadows, color accents on labels/buttons, hover transitions, backdrop blur, gradients, rounded corners
- Full styling pass comes later when features are complete

## Workflow preferences
- Talk through architecture before coding when the design isn't clear
- Don't use superpower skills / subagent planning tools — just implement directly
- When something isn't working, diagnose step by step before touching code

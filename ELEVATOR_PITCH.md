# Elevator Pitch

Napkin turns rough sketches, voice, and text into polished diagrams in seconds — an AI canvas powered by Gemini that bridges messy ideas and clear visuals.

---

# Project Story

## Inspiration

Every developer, designer, and student knows the friction: you have an idea in your head — an architecture, a flowchart, a system design — and the fastest way to get it out is to scribble it on a napkin or whiteboard. But those scribbles stay messy. Cleaning them up in a proper diagramming tool takes longer than the thinking itself.

I asked myself: **what if the napkin could clean itself up?** What if you could sketch freely, speak naturally, or just type a sentence, and an AI would turn that raw input into a polished, structured diagram — instantly, right on the same canvas?

That question became Napkin.

## What I Learned

- **Prompt engineering is the real product.** Getting Gemini to output valid, non-overlapping diagram JSON required dozens of iterations. I learned that strict grid-layout rules, explicit spacing constraints (550px horizontal / 450px vertical minimum), and one-word arrow labels were essential to prevent visual chaos. Small changes in prompt wording caused dramatic differences in output quality.

- **Multimodal AI unlocks new interaction paradigms.** Gemini's ability to understand both text prompts *and* canvas screenshots simultaneously meant I could build context-aware generation — the AI sees what's already on your canvas and adds to it rather than replacing it. This felt genuinely magical to use.

- **tldraw is an incredible foundation.** The tldraw library gave me a full-featured infinite canvas with shape bindings, arrow connections, and coordinate systems out of the box. Mapping Gemini's JSON output to tldraw's shape API (with `createShapeId`, `createBindingId`, and `toRichText`) was the key integration challenge.

- **Bidirectional arrows are surprisingly hard.** When two shapes have arrows going both directions, the arrows overlap perfectly and become unreadable. I had to build a custom anchor-offset algorithm that detects bidirectional pairs and spreads them apart — checking whether the connection is horizontal or vertical to offset on the correct axis.

## How I Built It

Napkin has two layers connected by a REST API:

**Frontend** — React 19 + TypeScript + Vite, built on top of the [tldraw](https://tldraw.com) canvas library. The frontend captures canvas snapshots as base64 PNG images, sends them to the backend, and renders AI responses directly as tldraw shapes with proper bindings. Key custom hooks:
- `useShapeGenerator` — the core engine that parses Gemini's JSON, creates shapes in three passes (deletes, edits, adds), handles arrow bindings, and manages bidirectional arrow offsets
- `useCanvasSnapshot` — captures the current canvas state as a base64 image for Gemini's vision input
- `useVoiceInput` — browser Speech Recognition API integration for hands-free diagram generation
- `useGeminiAnalysis` — runs four parallel AI analyses (label, cleanup, suggest, explain) on the canvas content

**Backend** — Python + FastAPI, acting as a thin orchestration layer between the frontend and Google Gemini. Each feature has its own carefully engineered prompt:
- **Generate** — takes a text description and outputs a JSON array of shapes on a strict grid layout
- **Transform** — takes a canvas screenshot and converts rough sketches into clean digital shapes
- **Analyze** — runs multiple analysis modes in parallel (labeling, Mermaid conversion, suggestions, explanations)
- **GitHub Import** — fetches a repo's structure via the GitHub API, feeds it to Gemini, and gets back a color-coded architecture diagram

The AI layer uses **Gemini 3 Flash Preview** (with Gemini 2.5 Flash as fallback) for its speed and multimodal capabilities — it can process both text prompts and canvas images in the same request.

## Challenges I Faced

1. **JSON reliability from LLMs.** Gemini occasionally wraps responses in markdown fences or adds commentary. I built a `cleanJsonResponse` utility to strip fences and extract pure JSON, but edge cases kept appearing. Strict prompt instructions ("Return ONLY valid JSON, no markdown fences") helped but didn't eliminate the problem entirely.

2. **Shape overlap prevention.** Early versions produced diagrams where boxes piled on top of each other. The solution was enforcing a mandatory grid system in the prompt — fixed column positions at $x \in \{100, 650, 1200, 1750\}$ and row positions at $y \in \{150, 600, 1050, 1500\}$ — with explicit minimum spacing rules.

3. **Context-aware editing.** When the canvas already has shapes and the user asks for modifications, the AI needs to understand what exists and produce targeted add/edit/delete operations rather than regenerating everything. I built a two-pass shape serialization system (`buildExistingShapeInfo`) that maps tldraw's internal IDs to simple integers the AI can reference, handling non-arrow shapes first and then resolving arrow bindings in a second pass.

4. **Region-scoped generation.** Letting users draw a rectangle and scope AI changes to just that area required converting screen coordinates to page coordinates (accounting for UI chrome offsets), filtering shapes by AABB intersection, capturing region-only snapshots, and augmenting prompts with spatial constraints — all while keeping the rest of the canvas untouched.

5. **Arrow binding mechanics.** tldraw arrows connect to shapes through a binding system with normalized anchors, precision flags, and snap modes. Translating Gemini's simple `{"from": 0, "to": 1}` format into proper `createBinding` calls with correct terminal types, anchor positions, and edge snapping required careful reverse-engineering of tldraw's internals.

---

# Built With

- **Google Gemini 3 Flash Preview** — multimodal AI for diagram generation, sketch interpretation, and canvas analysis (Gemini 2.5 Flash as fallback)
- **React 19** — frontend UI framework
- **TypeScript** — type-safe frontend development
- **Vite** — frontend build tool and dev server
- **tldraw** — infinite canvas library for drawing, shapes, and arrow bindings
- **Mermaid.js** — diagram rendering for the cleanup/analysis output
- **Python** — backend language
- **FastAPI** — backend REST API framework
- **uvicorn** — ASGI server
- **GitHub REST API** — repository structure fetching for architecture diagram generation
- **Web Speech API** — browser-native speech-to-text for voice input

---

# Demo Transcript

> Read this while recording/presenting. Actions in **[brackets]** are what you do on screen.

---

Hey, my name is Artur and this is Napkin.

You know the feeling — you sketch an architecture on a napkin or sketchbook, and then spend twice as long redrawing it in a proper tool. I wanted to skip that step entirely. What if you could just describe, sketch, or speak — and AI turns it into a clean diagram instantly?

That's Napkin. It's an infinite canvas powered by Google Gemini 3 Flash Preview. Gemini understands both text and images, so it sees what's already on your canvas and builds on top of it powered with AI.

Let me show you how it works.

### 3. Text-to-Diagram Generation

I'll start with a blank canvas. I just type a description of what I want into the prompt bar — something like "microservices architecture with an API gateway, authentication service, user service, notification service, and a PostgreSQL database. also an auth db connected to the auth service"

**[Type the prompt and press Enter. Wait for the diagram to appear.]**

And just like that, Gemini generates a full architecture diagram — color-coded, properly connected with arrows, laid out on a clean grid. All directly on the canvas.

### 1. Region Select — Scoped Editing

Starting with a blank canvas is boring, so I prepared an architecture diagram for you already. But now, let's say I want to change just one part of this diagram without touching the rest. I press this button to enter region select mode, and I draw a rectangle around the area I want to modify.

**[Press G, drag a rectangle around a section of the diagram.]**

A prompt field appears scoped to this region. I type what I want to change — for example "make it orange."

**[Type the instruction and submit.]**

Only the shapes inside my selection are affected. Everything outside stays exactly as it was. This is context-aware — Gemini sees a snapshot of just the selected region and applies targeted edits.

### 2. Sketch and Transform — Hand-drawn to Clean

Now here's where it gets fun. I'm going to draw by hand — I'll scribble out the auth database and draw a line connecting the authentication service to this database.

**[Use the draw tool to sketch a rough rectangle labeled "Auth DB" and draw a rough arrow from the Auth service to it.]**

It's messy, but that's the point. Now I hit Transform.

**[Click the Transform button.]**

Napkin sends a screenshot of the entire canvas to Gemini, which interprets every hand-drawn element — the rough shapes, the scribbled text, the connections — and converts them into clean, structured digital shapes. My sketch becomes a proper diagram.

### 4. Insights — Optimization Recommendations

Now let's get some AI feedback on this architecture. I'll click insights to run the full analysis.

**[Click the Analyze button. Wait for the report modal to open.]**

Gemini evaluates the architecture for performance bottlenecks, security gaps, scalability issues, and structural improvements, and gives prioritized recommendations.

**[Scroll to the optimization/suggestions section in the report.]**

### 5. Explain — Architecture Breakdown

In the same tab, there's the Explain. This gives a full markdown explanation of what's on the canvas — the overall purpose, what each component does, how they connect, and the data flow between them.

**[Show the Explain section in the report.]**

This is great for onboarding someone new to a system or just getting a second opinion on whether your diagram communicates what you think it does.

### 7. GitHub Import — Repo to Architecture Diagram

Finally, let me show the GitHub import. I click the GitHub button and paste a repository URL.

**[Click the GitHub button, paste a public repo URL, click Generate Architecture.]**

Napkin fetches the repo's file structure and configuration through the GitHub API, sends that context to Gemini, and generates a color-coded architecture diagram — blue for frontend, green for backend, orange for databases, violet for external services.

**[Wait for the diagram to appear.]**

From a repo URL to a full architecture diagram, in seconds.

---

That's Napkin. Sketch it, say it, type it — and let Gemini turn it into something you'd actually put in a presentation. Thanks for watching.

---

*Built with Gemini at the Gemini 3 Hackathon.*

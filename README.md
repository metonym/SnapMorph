# SnapMorph

SnapMorph is a browser extension and backend service for analyzing the accessibility of web page elements using OpenAI's GPT models. It provides instant, concise, and actionable accessibility recommendations for selected DOM elements, with a modern, streaming UI.

## Features

- **DOM Snapshot**: Select any element on a web page to capture its markup, text, and color styles.
- **Accessibility Analysis**: Instantly streams concise accessibility recommendations (max 320 chars) using OpenAI's GPT-4o-mini model.
- **Streaming Output**: See LLM feedback appear live in a blue-themed right pane.
- **Modern UI**: Responsive, two-column layout with live preview and JSON snapshot on the left, and LLM output on the right.
- **Apify Integration**: (Optional) Example endpoint for scraping web pages using Apify.

## Setup

### Prerequisites
- [Node.js](https://nodejs.org/) (preferably v22+)
- [Bun](https://bun.sh/) (for backend/dev scripts)
- OpenAI API key (set as `OPENAI_API_KEY` in `constants.ts` or your environment)

### Install dependencies

```sh
bun install
```

### Running the Backend

```sh
bun dev:server
```
The backend will start on `http://localhost:8000` by default.

### Running the Frontend (Extension)

```sh
bun dev
```
This uses [WXT](https://wxt.dev/) for Svelte-based browser extension development. Load the extension in your browser as instructed by WXT.

## Usage

1. **Open the SnapMorph extension popup.**
2. **Select an element** on any web page. The extension will:
   - Capture a snapshot of the element's DOM, styles, and text.
   - Immediately send the snapshot to the backend for analysis.
3. **View results:**
   - **Left pane:** Live HTML preview and JSON snapshot of the selected element.
   - **Right pane:** Streaming, markdown-formatted accessibility recommendations from the LLM.
   - **Header:** Blue SnapMorph logo and a "New selection" button to reset and select another element.

## Project Structure

- `server.ts` — Express backend, OpenAI streaming, Apify integration.
- `src/entrypoints/popup/App.svelte` — Main Svelte UI for the extension popup.
- `src/entrypoints/content.ts` — Content script for DOM selection and snapshotting.
- `src/entrypoints/background.ts` — Background script for message passing.
- `constants.ts` — API keys and config.

## Customization
- **OpenAI Model:** Change the model in `server.ts` if needed.
- **Prompt/Token Limits:** The backend uses an optimized, color-style-only DOM snapshot to avoid token overflows.
- **UI Styling:** TailwindCSS and custom classes for a blue, modern look.

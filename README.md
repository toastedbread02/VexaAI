# Vexa

A dark, responsive web interface for the experimental Vexa language model.

## Chat backend

This repository contains only the static website. The interface expects same-origin `/status`, `/models`, and `/chat` endpoints. In the full Vexa project, run the FastAPI app from the project root to provide them. Static hosting such as GitHub Pages can display the site, but cannot run the Python model; chat replies require a separately hosted backend.

The local API lists compatible checkpoints at `/models`. The current choices are Bloom 1.0 and Bloom 1.0 Instruct. The Effort slider changes the maximum generated response budget (40, 80, 128, or 192 tokens); it does not add a separate reasoning process to this small model.

Conversation history is stored in this browser. The UI keeps its thinking animation visible for at least three seconds while waiting for the backend.

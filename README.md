# Vexa

A dark, responsive web interface for the experimental Vexa language model.

## Chat backend

This repository contains only the static website. The interface expects same-origin `/status` and `/chat` endpoints. In the full Vexa project, run the FastAPI app from the project root to provide them. Static hosting such as GitHub Pages can display the site, but cannot run the Python model; chat replies require a separately hosted backend.

Conversation history is stored in this browser. The UI keeps its thinking animation visible for at least three seconds while waiting for the backend.

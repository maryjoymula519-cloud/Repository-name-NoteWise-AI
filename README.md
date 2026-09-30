# NoteWise AI

AI-integrated meeting and lecture notes summarizer for the AD-ET 101 Final Project.

## Features

- Real Gemini AI summarization
- Clean summary paragraph
- Key points extraction
- Action items with owner and deadline
- Important topic tags
- Local browser history
- Copy and download results
- Responsive polished UI
- Health-check endpoint
- Deployment-ready for Render

## Requirements

- Node.js 20+
- A Gemini API key

## Run locally

1. Open this folder in VS Code.
2. Run `npm install`.
3. Copy `.env.example` to `.env`.
4. Put your Gemini key in `GEMINI_API_KEY`.
5. Run `npm start`.
6. Open `http://localhost:3000`.

Never commit `.env` to GitHub.

## Deploy on Render

Create a Web Service connected to this repository.

- Build Command: `npm install`
- Start Command: `npm start`
- Environment Variable: `GEMINI_API_KEY` = your key
- Environment Variable: `GEMINI_MODEL` = `gemini-3.8-flash`
- *(Optional)* Environment Variable: `FALLBACK_API_KEY` = your fallback provider API key
- *(Optional)* Environment Variable: `FALLBACK_MODEL` = e.g., `gpt-4o-mini`
- *(Optional)* Environment Variable: `FALLBACK_API_URL` = e.g., `https://api.openai.com/v1/chat/completions`

The app listens on the `PORT` environment variable and `0.0.0.0`, as required for a public Render web service.

## Project structure

```text
notewise-ai/
├── public/
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── .env.example
├── .gitignore
├── .node-version
├── package.json
├── render.yaml
├── server.js
└── README.md
```

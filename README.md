# Money Clarity

This project already has a complete Python backend and SQLite database.

Do NOT create another backend.

Your job is only to build a polished frontend that consumes the API described in API.md and openapi.json.

The backend base URL for local development is:

http://127.0.0.1:8000/api

The backend already handles:

- manual transaction logging

- CSV imports

- duplicate detection

- import history

- transaction review

- merchant rules

- categorisation

- editable budgets

- simplified shared expenses

- reminders

- weekly reviews

- budget scores

- category scores

- recommendations

- insights

The frontend goal is to make the app simple enough that a new user understands their money in 30 seconds.

Do not invent fake data.

Do not create placeholder controls.

Every visible control must call a real API endpoint or be visibly disabled with an explanation.

Wait for my next instruction before building pages.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://ledgerv1.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/0e8e632d-1758-42eb-b36f-c1d4f1e77a2d).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

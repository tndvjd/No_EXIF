# Contributing

Thanks for taking a look at No EXIF Pro.

## Development Setup

```powershell
npm install
npm run build
npm run test:js
npm run test:py
```

The Python tests use a local virtual environment when available. If dependencies are missing, the project helper script installs the required Python packages into `.venv`.

## Pull Request Checklist

Before opening a pull request:

- Keep image processing local unless the change explicitly documents otherwise.
- Do not commit tokens, auth files, generated outputs, downloads, or private images.
- Run `npm run test:js` for frontend and Electron security changes.
- Run `npm run test:py` for Python bridge or image-processing changes.
- Run `npm run build` for React or Vite changes.
- Add or update tests when changing behavior.

## Code Style

- Prefer small pure helper functions for reusable behavior.
- Keep Electron IPC as the filesystem boundary.
- Keep UI copy short and action-oriented.
- Avoid decorative AI-gradient styling; the app should feel like a private workbench.

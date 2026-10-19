# Automatic Git Commit & Push Rule

Whenever you finish making code changes in this project, you MUST automatically stage all changes, commit them with a descriptive commit message, and push to `origin main`:
```bash
git add -A
git commit -m "<concise descriptive summary of changes>"
git push origin main
```
This guarantees that the live Vercel production website receives all updates immediately and deploys automatically.

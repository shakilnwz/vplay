# VR Player

A web-based VR video player built with React, Three.js, and TypeScript.

## Development

```bash
# Install dependencies
yarn install

# Start development server
yarn dev

# Build for production
yarn build
```

## Deployment to GitHub Pages

This project uses a manual deployment workflow for GitHub Pages. Follow these steps to deploy:

### Initial Setup

1. **Enable GitHub Pages in your repository**:
   - Go to Settings > Pages > Source
   - Select "GitHub Actions" as the source

### Deploying Updates

1. **Build the project locally**:
   ```bash
   yarn build
   ```

2. **Switch to the gh-pages branch** (create it if it doesn't exist):
   ```bash
   git checkout -b gh-pages
   ```

3. **Copy the built files to the root of the gh-pages branch**:
   ```bash
   cp -r dist/* .
   ```

4. **Commit and push to gh-pages**:
   ```bash
   git add .
   git commit -m "Deploy build"
   git push origin gh-pages
   ```

5. **Monitor the deployment**:
   - Go to the "Actions" tab in your GitHub repository
   - The "Deploy to GitHub Pages" workflow will run automatically
   - Once complete, your site will be live at `https://<username>.github.io/<repository-name>/`

### Notes

- The `dist` folder remains in `.gitignore` on the main branch to keep the source code clean
- The `gh-pages` branch only contains the built artifacts
- The GitHub Actions workflow (`.github/workflows/deploy.yml`) handles the deployment automatically when you push to `gh-pages`

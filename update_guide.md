# Game Update Guide

This guide explains how to update your GitHub repository when you release a new version of ShooterX.

## 1. Prepare Your Update Files

1. Make your code changes locally
2. Test thoroughly
3. Update version numbers in your code:
   - In `index.html`
   - In any version display in the game
   - In any config files

## 2. Update Your Repository

```bash
# Pull latest changes (if working with teammates)
git pull origin main

# Add your updated files
git add .

# Don't forget to exclude large files
# Make sure your .gitignore contains:
# node_modules/
# *.exe
# *.zip

# Commit with version number in message
git commit -m "Update to version X.X.X"

# Push to GitHub
git push origin main
```

## 3. Update Your Build Files

1. Create new build files:
   ```bash
   # Run your build scripts
   ./build-all.bat
   ```

2. Create new installer/zip:
   ```bash
   # Create installer
   ./build-installer.bat
   
   # Create zip file
   ./create-zip.bat
   ```

## 4. Handle Download Files

Since GitHub has a 100MB file size limit, host your large files elsewhere:

1. Upload your new `.exe` and `.zip` files to a file hosting service:
   - Google Drive
   - Dropbox
   - itch.io
   - Your own web hosting

2. Update download links in your website:
   ```html
   <!-- In Website/download.html -->
   <a href="https://your-file-host.com/ShooterX-Setup-X.X.X.exe">Download Installer</a>
   <a href="https://your-file-host.com/ShooterX-vX.X.X.zip">Download ZIP</a>
   ```

3. Update the website files in your repository:
   ```bash
   git add Website/
   git commit -m "Update download links for version X.X.X"
   git push origin main
   ```

## 5. Create a Release on GitHub

1. Go to your repository on GitHub
2. Click on "Releases" in the right sidebar
3. Click "Create a new release"
4. Tag version: `vX.X.X` (e.g., v1.2.1)
5. Title: "ShooterX vX.X.X"
6. Description: Add release notes and changes
7. Add links to your externally hosted download files
8. Click "Publish release"

## 6. Update GitHub Pages

Your GitHub Pages site will automatically update with your latest changes after you push.

To check:
1. Go to your GitHub repository
2. Click on Settings → Pages
3. Verify the deployment status

## 7. Working with Development Branches

### Setting Up a Dev Branch

```bash
# Create and switch to a new dev branch
git checkout -b dev

# Push the dev branch to GitHub
git push -u origin dev
```

### Development Workflow

1. Always develop new features on the dev branch:
   ```bash
   # Switch to dev branch
   git checkout dev
   
   # Make your changes
   # ...
   
   # Commit changes
   git add .
   git commit -m "Add new feature"
   
   # Push to dev branch
   git push origin dev
   ```

2. When ready to release, merge dev into main:
   ```bash
   # Switch to main branch
   git checkout main
   
   # Merge changes from dev branch
   git merge dev
   
   # Push to main
   git push origin main
   ```

3. Keep dev branch updated with main:
   ```bash
   # Switch to dev branch
   git checkout dev
   
   # Merge changes from main
   git merge main
   
   # Push updated dev branch
   git push origin dev
   ```

### Branch Management Tips

- Use dev for ongoing development
- Use main for stable releases only
- Create feature branches from dev for major features:
  ```bash
  git checkout dev
  git checkout -b feature/new-weapons
  ```
- Test thoroughly before merging to main
- GitHub Pages will use the main branch, not dev

## Version Numbering Best Practices

Follow semantic versioning:
- MAJOR.MINOR.PATCH (e.g., 1.2.1)
- MAJOR: Breaking changes
- MINOR: New features, backward compatible
- PATCH: Bug fixes, backward compatible

## Update Checklist

- [ ] Update code and test
- [ ] Update version numbers
- [ ] Commit and push code changes
- [ ] Build new executable/installer
- [ ] Upload large files to external host
- [ ] Update website download links
- [ ] Create GitHub release
- [ ] Test GitHub Pages site 
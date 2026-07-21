# GitHub Setup Guide for Game Projects

## Creating a GitHub Account
1. Go to [GitHub.com](https://github.com)
2. Click "Sign up" and follow the registration process
3. Verify your email address

## Setting Up a Repository
1. Click the "+" icon in the upper right corner
2. Select "New repository"
3. Name your repository (e.g., "ShooterX")
4. Add a description (optional)
5. Choose public or private
6. Check "Add a README file" 
7. Click "Create repository"

## Setting Up Git on Your Computer
1. Download and install Git from [git-scm.com](https://git-scm.com/)
2. Open a terminal or command prompt
3. Configure Git with your name and email:
   ```
   git config --global user.name "Your Name"
   git config --global user.email "your.email@example.com"
   ```

## Cloning Your Repository
1. On GitHub, click the green "Code" button
2. Copy the HTTPS URL
3. In your terminal:
   ```
   git clone https://github.com/Whitpro/ShooterX.git
   ```
4. Change into the repository directory:
   ```
   cd REPOSITORY-NAME
   ```

## Adding Your Game Files
1. Copy your game files into the repository folder
2. Stage your files:
   ```
   git add .
   ```
3. Commit your changes:
   ```
   git commit -m "Add game files"
   ```
4. Push to GitHub:
   ```
   git push
   ```

## Handling Large Files (Over 100MB)
GitHub has a 100MB file size limit. For larger files:

### Option 1: Remove Large Files
1. Remove large files from Git tracking:
   ```
   git rm --cached path/to/large/file
   ```
2. Add to .gitignore:
   ```
   echo "path/to/large/file" >> .gitignore
   ```
3. Commit and push:
   ```
   git add .
   git commit -m "Remove large files"
   git push
   ```

### Option 2: Use Git LFS
1. Install Git LFS:
   ```
   git lfs install
   ```
2. Track large file types:
   ```
   git lfs track "*.exe"
   git lfs track "*.zip"
   ```
3. Add .gitattributes:
   ```
   git add .gitattributes
   ```
4. Add and commit files:
   ```
   git add .
   git commit -m "Add large files with LFS"
   git push
   ```

## Resetting GitHub Repositories

### Option 1: Reset to a Clean State (Keep Repository)
To remove all files and history but keep the repository:

1. Create an orphan branch (branch with no history):
   ```
   git checkout --orphan temp_branch
   ```

2. Add all files to the new branch:
   ```
   git add .
   ```

3. Commit the changes:
   ```
   git commit -m "Initial commit"
   ```

4. Delete the main branch:
   ```
   git branch -D main
   ```

5. Rename the current branch to main:
   ```
   git branch -m main
   ```

6. Force push to GitHub:
   ```
   git push -f origin main
   ```

### Option 2: Delete and Recreate Repository
If you want to completely start over:

1. On GitHub, go to repository settings
2. Scroll to the bottom "Danger Zone"
3. Click "Delete this repository"
4. Type the repository name to confirm
5. Create a new repository with the same name
6. Initialize locally and push:
   ```
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/Whitpro/ShooterX.git
   git push -u origin main
   ```

### Option 3: Reset to a Specific Commit
To reset to a previous state:

1. Find the commit ID you want to reset to:
   ```
   git log --oneline
   ```

2. Reset to that commit:
   ```
   git reset --hard COMMIT_ID
   ```

3. Force push to GitHub:
   ```
   git push -f origin main
   ```

## Setting Up GitHub Pages
1. Go to your repository on GitHub
2. Click "Settings"
3. Scroll down to "Pages" (in the left sidebar)
4. Under "Source", select your branch (usually "main")
5. Click "Save"
6. Wait a few minutes for your site to deploy
7. Access your site at: https://YOUR-USERNAME.github.io/REPOSITORY-NAME/

## Common Issues and Solutions

### "Rejected non-fast-forward"
```
git pull --rebase origin main
git push
```

### "Detached HEAD state"
```
git checkout -b new-branch
git push -u origin new-branch
```

### Force Push (use with caution)
```
git push -f origin main
```

### Line Ending Warnings (CRLF/LF)
These are just warnings, not errors. To stop seeing them:
```
git config --global core.autocrlf true
```

## Best Practices
1. Make small, frequent commits
2. Use clear commit messages
3. Create a .gitignore file for files you don't want to track
4. Use branches for new features
5. Always pull before pushing when collaborating 
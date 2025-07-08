# ShooterX Bug Reporter Backend

This is a simple Node.js server that receives bug reports from the ShooterX game and creates GitHub issues.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a GitHub Personal Access Token:
   - Go to [GitHub Personal Access Tokens](https://github.com/settings/tokens)
   - Click "Generate new token (classic)"
   - Give it a descriptive name like "ShooterX Bug Reporter"
   - Select the "repo" scope (to create issues)
   - Click "Generate token"
   - **Copy the token immediately** - you won't be able to see it again!

3. Configure environment variables:
   - Copy the `.env.example` file to `.env`
   - Set your GitHub token: `GITHUB_TOKEN=your_token_here`
   - Verify the repository owner and name are correct
   - Add any additional allowed origins if needed

## Running the server

For development with auto-restart:
```bash
npm run dev
```

For production:
```bash
npm start
```

## API Endpoints

### Health Check
```
GET /api/health
```
Returns the status of the API.

### Submit Bug Report
```
POST /api/report-bug
```

Request body:
```json
{
  "title": "Bug title",
  "description": "Detailed bug description",
  "steps": "Steps to reproduce (optional)",
  "systemInfo": "System information (automatically collected)"
}
```

Response:
```json
{
  "success": true,
  "message": "Bug report submitted successfully",
  "issueUrl": "https://github.com/username/repo/issues/123",
  "issueNumber": 123
}
```

## Deployment

This server can be deployed to:
- Render.com
- Vercel Serverless Functions
- Heroku
- Any Node.js hosting platform

## Connecting the Game Client

Update the `src/bugReport.js` file in the game client to point to your deployed API endpoint. 
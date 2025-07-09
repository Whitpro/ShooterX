require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Octokit } = require('@octokit/rest');
const rateLimit = require('express-rate-limit');

// Debug logging for environment variables
console.log('GITHUB_OWNER:', process.env.GITHUB_OWNER);
console.log('GITHUB_REPO:', process.env.GITHUB_REPO);
console.log('ALLOWED_ORIGINS:', process.env.ALLOWED_ORIGINS);

// --- BEGIN: Read GitHub token from file if not set in env ---
const fs = require('fs');
const path = require('path');
if (!process.env.GITHUB_TOKEN) {
  const tokenPath = path.join(__dirname, 'github_token.txt');
  if (fs.existsSync(tokenPath)) {
    const fileToken = fs.readFileSync(tokenPath, 'utf8').trim();
    if (fileToken) {
      process.env.GITHUB_TOKEN = fileToken;
      console.log('GITHUB_TOKEN: ***SET FROM FILE***');
    } else {
      console.log('GITHUB_TOKEN: ***NOT SET (FILE EMPTY)***');
    }
  } else {
    console.log('GITHUB_TOKEN: ***NOT SET (NO ENV OR FILE)***');
  }
} else {
  console.log('GITHUB_TOKEN:', process.env.GITHUB_TOKEN ? '***SET***' : '***NOT SET***');
}
// --- END: Read GitHub token from file if not set in env ---

// Initialize Express app
const app = express();

// Middleware
app.use(express.json());
app.use(cors({
  origin: (origin, callback) => {
    const allowedOrigins = process.env.ALLOWED_ORIGINS.split(',');
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  }
}));

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: 'Too many bug reports from this IP, please try again after 15 minutes'
});

// Apply rate limiting to the bug report endpoint
app.use('/api/report-bug', apiLimiter);

// Create GitHub issue from bug report
async function createGitHubIssue(bugData) {
  if (!process.env.GITHUB_TOKEN) {
    throw new Error('GitHub token not configured');
  }

  const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN
  });
  
  const issueBody = `
## Description
${bugData.description}

## Steps to Reproduce
${bugData.steps || 'Not provided'}

## System Information
${bugData.systemInfo}

*Reported via in-game bug reporter*
`;

  return octokit.issues.create({
    owner: process.env.GITHUB_OWNER,
    repo: process.env.GITHUB_REPO,
    title: `[BUG] ${bugData.title}`,
    body: issueBody,
    labels: ['bug', 'user-reported']
  });
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'ShooterX Bug Reporter API is running' });
});

// API endpoint for bug reports
app.post('/api/report-bug', async (req, res) => {
  try {
    // Input validation
    const { title, description, steps, systemInfo } = req.body;
    
    if (!title || !description) {
      return res.status(400).json({ 
        success: false, 
        message: 'Title and description are required' 
      });
    }
    
    console.log('Received bug report:', { title });
    
    try {
      // Create GitHub issue
      const response = await createGitHubIssue({
        title,
        description,
        steps,
        systemInfo
      });
      
      console.log('GitHub issue created:', response.data.html_url);
      
      // Return success response with issue URL
      res.json({
        success: true,
        message: 'Bug report submitted successfully',
        issueUrl: response.data.html_url,
        issueNumber: response.data.number
      });
    } catch (githubError) {
      console.error('GitHub API error:', githubError.message);
      res.status(502).json({
        success: false,
        message: 'Failed to create GitHub issue',
        error: 'GitHub API error'
      });
    }
    
  } catch (error) {
    console.error('Server error processing bug report:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: 'Server error processing request'
    });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Bug reporter server running on port ${PORT}`);
  console.log(`GitHub repository target: ${process.env.GITHUB_OWNER}/${process.env.GITHUB_REPO}`);
}); 
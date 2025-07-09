require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { 
  Client, 
  GatewayIntentBits, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  StringSelectMenuBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require('discord.js');
const rateLimit = require('express-rate-limit');

// Debug logging for environment variables
console.log('DISCORD_TOKEN:', process.env.DISCORD_TOKEN ? '***SET***' : '***NOT SET***');
console.log('DISCORD_CHANNEL_ID:', process.env.DISCORD_CHANNEL_ID);
console.log('ALLOWED_ORIGINS:', process.env.ALLOWED_ORIGINS);

// Initialize Express app
const app = express();

// Initialize Discord client
const client = new Client({ 
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages
  ]
});

// Store for active interactions (forms, etc.)
const activeInteractions = new Map();

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

// Discord bot login
let discordReady = false;
client.once('ready', () => {
  console.log(`Discord bot logged in as ${client.user.tag}`);
  discordReady = true;
});

// Handle button and select menu interactions
client.on('interactionCreate', async interaction => {
  try {
    // Handle button clicks
    if (interaction.isButton()) {
      const buttonId = interaction.customId;
      console.log(`Button clicked: ${buttonId}`);
      
      // Check if this is a form button
      if (buttonId.startsWith('form_')) {
        const formId = buttonId.split('_')[1];
        
        // Show modal based on form type
        if (activeInteractions.has(formId)) {
          const formData = activeInteractions.get(formId);
          
          // Create modal
          const modal = new ModalBuilder()
            .setCustomId(`modal_${formId}`)
            .setTitle(formData.title || 'Form Submission');
          
          // Add form fields
          const rows = [];
          
          if (formData.fields && Array.isArray(formData.fields)) {
            formData.fields.forEach((field, index) => {
              const input = new TextInputBuilder()
                .setCustomId(`field_${index}`)
                .setLabel(field.label)
                .setStyle(field.multiline ? TextInputStyle.Paragraph : TextInputStyle.Short)
                .setPlaceholder(field.placeholder || '')
                .setRequired(field.required !== false);
                
              if (field.minLength) input.setMinLength(field.minLength);
              if (field.maxLength) input.setMaxLength(field.maxLength);
              if (field.value) input.setValue(field.value);
              
              const row = new ActionRowBuilder().addComponents(input);
              rows.push(row);
            });
          }
          
          modal.addComponents(rows);
          await interaction.showModal(modal);
        } else {
          await interaction.reply({ content: 'This form is no longer active.', ephemeral: true });
        }
      } else {
        // Generic response for other buttons
        await interaction.reply({ content: 'Button clicked!', ephemeral: true });
      }
    }
    
    // Handle modal submissions
    else if (interaction.isModalSubmit()) {
      const modalId = interaction.customId;
      console.log(`Modal submitted: ${modalId}`);
      
      if (modalId.startsWith('modal_')) {
        const formId = modalId.split('_')[1];
        
        if (activeInteractions.has(formId)) {
          const formData = activeInteractions.get(formId);
          
          // Get values from form fields
          const responses = {};
          if (formData.fields && Array.isArray(formData.fields)) {
            formData.fields.forEach((field, index) => {
              const value = interaction.fields.getTextInputValue(`field_${index}`);
              responses[field.label] = value;
            });
          }
          
          // Create response embed
          const responseEmbed = new EmbedBuilder()
            .setColor(formData.color || 0x00FF00)
            .setTitle(`📝 Form Response: ${formData.title}`)
            .setDescription('A user has submitted the form.')
            .setTimestamp();
          
          // Add fields to the embed
          Object.entries(responses).forEach(([key, value]) => {
            responseEmbed.addFields({ name: key, value: value || 'Not provided' });
          });
          
          // Send to the response channel (or the same channel)
          const responseChannelId = formData.responseChannelId || process.env.DISCORD_CHANNEL_ID;
          const responseChannel = await client.channels.fetch(responseChannelId);
          
          if (responseChannel) {
            await responseChannel.send({ embeds: [responseEmbed] });
          }
          
          // Acknowledge the submission
          await interaction.reply({ 
            content: formData.successMessage || 'Your response has been submitted. Thank you!', 
            ephemeral: true 
          });
        } else {
          await interaction.reply({ content: 'This form is no longer active.', ephemeral: true });
        }
      }
    }
    
    // Handle select menus
    else if (interaction.isStringSelectMenu()) {
      const selectId = interaction.customId;
      const values = interaction.values;
      console.log(`Select menu ${selectId} values:`, values);
      
      await interaction.reply({ content: `You selected: ${values.join(', ')}`, ephemeral: true });
    }
  } catch (error) {
    console.error('Error handling interaction:', error);
    try {
      // Try to respond if we haven't already
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ 
          content: 'There was an error processing your interaction.', 
          ephemeral: true 
        });
      }
    } catch (replyError) {
      console.error('Error sending error response:', replyError);
    }
  }
});

// Login to Discord
try {
  if (process.env.DISCORD_TOKEN) {
    client.login(process.env.DISCORD_TOKEN)
      .catch(error => {
        console.error('Failed to login to Discord:', error.message);
        console.log('Server will continue running without Discord integration');
      });
  } else {
    console.log('No Discord token provided. Discord integration disabled.');
  }
} catch (error) {
  console.error('Failed to login to Discord:', error);
  console.log('Server will continue running without Discord integration');
}

// Send bug report to Discord
async function sendDiscordBugReport(bugData) {
  if (!process.env.DISCORD_TOKEN) {
    throw new Error('Discord token not configured');
  }
  
  if (!process.env.DISCORD_CHANNEL_ID) {
    throw new Error('Discord channel ID not configured');
  }
  
  if (!discordReady) {
    throw new Error('Discord bot not ready');
  }
  
  const channel = await client.channels.fetch(process.env.DISCORD_CHANNEL_ID);
  if (!channel) {
    throw new Error('Discord channel not found');
  }
  
  // Create a rich embed for the bug report
  const embed = new EmbedBuilder()
    .setColor(0xFF0000)
    .setTitle(`🐛 Bug Report: ${bugData.title}`)
    .setDescription(bugData.description)
    .addFields(
      { name: 'Steps to Reproduce', value: bugData.steps || 'Not provided' },
      { name: 'System Information', value: bugData.systemInfo }
    )
    .setTimestamp()
    .setFooter({ text: 'Reported via in-game bug reporter' });
  
  // Send the embed to the channel
  const message = await channel.send({ embeds: [embed] });
  
  return {
    messageUrl: message.url,
    messageId: message.id
  };
}

// Send a custom post to Discord
async function sendDiscordPost(postData) {
  if (!process.env.DISCORD_TOKEN) {
    throw new Error('Discord token not configured');
  }
  
  if (!process.env.DISCORD_CHANNEL_ID) {
    throw new Error('Discord channel ID not configured');
  }
  
  if (!discordReady) {
    throw new Error('Discord bot not ready');
  }
  
  const channel = await client.channels.fetch(process.env.DISCORD_CHANNEL_ID);
  if (!channel) {
    throw new Error('Discord channel not found');
  }
  
  let messageOptions = {};
  
  // If the post has embed data, create a rich embed
  if (postData.useEmbed) {
    const embed = new EmbedBuilder()
      .setColor(postData.color || 0x0099FF)
      .setTitle(postData.title || '')
      .setDescription(postData.content || '');
      
    if (postData.fields && Array.isArray(postData.fields)) {
      embed.addFields(postData.fields);
    }
    
    if (postData.imageUrl) {
      embed.setImage(postData.imageUrl);
    }
    
    if (postData.thumbnailUrl) {
      embed.setThumbnail(postData.thumbnailUrl);
    }
    
    if (postData.footerText) {
      embed.setFooter({ text: postData.footerText });
    }
    
    if (postData.timestamp !== false) {
      embed.setTimestamp();
    }
    
    messageOptions.embeds = [embed];
  } else {
    // Otherwise just send a plain text message
    messageOptions.content = postData.content || '';
  }
  
  // Send the message to the channel
  const message = await channel.send(messageOptions);
  
  return {
    messageUrl: message.url,
    messageId: message.id
  };
}

// Create a form in Discord
async function createDiscordForm(formData) {
  if (!process.env.DISCORD_TOKEN) {
    throw new Error('Discord token not configured');
  }
  
  if (!process.env.DISCORD_CHANNEL_ID) {
    throw new Error('Discord channel ID not configured');
  }
  
  if (!discordReady) {
    throw new Error('Discord bot not ready');
  }
  
  const channel = await client.channels.fetch(process.env.DISCORD_CHANNEL_ID);
  if (!channel) {
    throw new Error('Discord channel not found');
  }
  
  // Generate a unique ID for this form
  const formId = `form_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  
  // Store form data for later retrieval when button is clicked
  activeInteractions.set(formId, formData);
  
  // Create embed for the form
  const embed = new EmbedBuilder()
    .setColor(formData.color || 0x0099FF)
    .setTitle(formData.title || 'Form')
    .setDescription(formData.description || 'Please fill out the form below.');
  
  if (formData.fields && Array.isArray(formData.fields)) {
    // Show a preview of fields if desired
    if (formData.showFieldsPreview) {
      const fieldsList = formData.fields.map(field => `• ${field.label}${field.required === false ? ' (optional)' : ''}`).join('\n');
      embed.addFields({ name: 'Fields', value: fieldsList });
    }
  }
  
  if (formData.footerText) {
    embed.setFooter({ text: formData.footerText });
  }
  
  if (formData.timestamp !== false) {
    embed.setTimestamp();
  }
  
  // Create button for the form
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`form_${formId}`)
      .setLabel(formData.buttonText || 'Open Form')
      .setStyle(ButtonStyle.Primary)
  );
  
  // Send the message with the form
  const message = await channel.send({
    embeds: [embed],
    components: [row]
  });
  
  // Set timeout to remove the form from memory after expiration (default: 24 hours)
  const timeout = formData.expiresIn || 24 * 60 * 60 * 1000; // 24 hours in ms
  setTimeout(() => {
    activeInteractions.delete(formId);
    console.log(`Form ${formId} expired and removed from memory`);
  }, timeout);
  
  return {
    messageUrl: message.url,
    messageId: message.id,
    formId: formId
  };
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'ShooterX Bug Reporter API is running',
    discordStatus: discordReady ? 'connected' : 'disconnected'
  });
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
    
    // Check if Discord integration is available
    if (!process.env.DISCORD_TOKEN || !discordReady) {
      console.log('Discord integration not available. Storing bug report locally.');
      
      // In a real app, you might want to store this in a database
      // For now, we'll just return a success response
      return res.json({
        success: true,
        message: 'Bug report received (Discord integration not available)',
        localOnly: true
      });
    }
    
    try {
      // Send bug report to Discord
      const response = await sendDiscordBugReport({
        title,
        description,
        steps,
        systemInfo
      });
      
      console.log('Discord message sent:', response.messageUrl);
      
      // Return success response with message URL
      res.json({
        success: true,
        message: 'Bug report submitted successfully',
        messageUrl: response.messageUrl,
        messageId: response.messageId
      });
    } catch (discordError) {
      console.error('Discord API error:', discordError.message);
      res.status(502).json({
        success: false,
        message: 'Failed to send Discord message',
        error: 'Discord API error'
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

// API endpoint for creating custom posts
app.post('/api/create-post', async (req, res) => {
  try {
    // Input validation
    const { content, title, useEmbed = false } = req.body;
    
    if (!content && !title) {
      return res.status(400).json({ 
        success: false, 
        message: 'Either content or title is required' 
      });
    }
    
    console.log('Received post request:', { title: title || 'Untitled post' });
    
    // Check if Discord integration is available
    if (!process.env.DISCORD_TOKEN || !discordReady) {
      console.log('Discord integration not available. Post request cannot be processed.');
      return res.status(503).json({
        success: false,
        message: 'Discord integration not available',
        error: 'Discord service unavailable'
      });
    }
    
    try {
      // Send post to Discord
      const response = await sendDiscordPost(req.body);
      
      console.log('Discord post sent:', response.messageUrl);
      
      // Return success response with message URL
      res.json({
        success: true,
        message: 'Post created successfully',
        messageUrl: response.messageUrl,
        messageId: response.messageId
      });
    } catch (discordError) {
      console.error('Discord API error:', discordError.message);
      res.status(502).json({
        success: false,
        message: 'Failed to create Discord post',
        error: 'Discord API error'
      });
    }
    
  } catch (error) {
    console.error('Server error creating post:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: 'Server error processing request'
    });
  }
});

// API endpoint for creating forms
app.post('/api/create-form', async (req, res) => {
  try {
    // Input validation
    const { title, fields } = req.body;
    
    if (!title || !fields || !Array.isArray(fields) || fields.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Title and at least one field are required' 
      });
    }
    
    // Validate fields
    for (const field of fields) {
      if (!field.label) {
        return res.status(400).json({
          success: false,
          message: 'Each field must have a label'
        });
      }
    }
    
    console.log('Received form creation request:', { title });
    
    // Check if Discord integration is available
    if (!process.env.DISCORD_TOKEN || !discordReady) {
      console.log('Discord integration not available. Form request cannot be processed.');
      return res.status(503).json({
        success: false,
        message: 'Discord integration not available',
        error: 'Discord service unavailable'
      });
    }
    
    try {
      // Create form in Discord
      const response = await createDiscordForm(req.body);
      
      console.log('Discord form created:', response.messageUrl);
      
      // Return success response with message URL
      res.json({
        success: true,
        message: 'Form created successfully',
        messageUrl: response.messageUrl,
        messageId: response.messageId,
        formId: response.formId
      });
    } catch (discordError) {
      console.error('Discord API error:', discordError.message);
      res.status(502).json({
        success: false,
        message: 'Failed to create Discord form',
        error: 'Discord API error'
      });
    }
    
  } catch (error) {
    console.error('Server error creating form:', error);
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
  console.log(`Discord integration ${discordReady ? 'active' : 'pending'}`);
}); 
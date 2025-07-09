# Qori for Design: Slack-Native Implementation

## Overview

Qori for Design extends the research-to-insight pipeline by automatically generating USWDS-compliant wireframes from research findings. This implementation uses a Slack-native approach - no separate web interface required. Teams get visual wireframes, working HTML code, and live previews delivered directly in their Slack workspace.

## Core Concept

**Research Insights → HMW Statements → USWDS Wireframes → Developer-Ready Code**

Instead of building a complex design review interface, we leverage Slack's native capabilities:
- **Screenshots** for visual feedback
- **Code blocks** for developer handoff  
- **Interactive buttons** for team decision-making
- **Simple preview links** for stakeholder review

---

## User Workflow

### Step 1: Trigger Design Generation
```
Designer: /design study-123 "Benefits application form flow"
```

### Step 2: Processing Notification
```
🔄 Generating wireframe options from research insights...
⏱️ This usually takes 30-45 seconds
```

### Step 3: Design Options Posted
Qori posts a comprehensive message with 3 wireframe options, each including:
- **Rationale** tied to specific research quotes
- **Screenshot** of the wireframe  
- **Component breakdown** showing USWDS elements used
- **Working HTML code** ready for development
- **Live preview link** for interactive testing
- **Action buttons** for team feedback

### Step 4: Team Review & Selection
Team members:
- View screenshots to understand the design direction
- Click preview links to interact with live wireframes
- React with emojis or use buttons to vote on options
- Add threaded comments for refinements

### Step 5: Automatic Handoff
Once a design is selected:
- GitHub issue created with chosen wireframe
- Development-ready code included
- Research context and rationale documented
- Design decisions trackable through audit trail

---

## Technical Implementation

### Architecture Overview
```
Slack Command → YAML Workflow → Gemini 2.5 → USWDS Validation → Screenshot Generation → Slack Response
```

### Core Services

#### 1. Design Generation Service
```javascript
// services/design-generator.js
class DesignGenerator {
  async generateFromResearch(studyId, designBrief) {
    // Extract research insights and HMW statements
    const study = await this.getResearchStudy(studyId);
    const insights = await this.extractKeyInsights(study);
    const hmwStatements = await this.generateHMWStatements(insights);
    
    // Generate wireframes using Gemini 2.5
    const wireframes = await this.callGeminiForWireframes(
      insights, 
      hmwStatements, 
      designBrief
    );
    
    // Validate USWDS compliance
    const validatedWireframes = await this.validateUSWDSCompliance(wireframes);
    
    // Generate screenshots and preview links
    const enrichedWireframes = await this.generateVisualAssets(validatedWireframes);
    
    return {
      study,
      insights,
      hmwStatements,
      wireframes: enrichedWireframes
    };
  }

  async callGeminiForWireframes(insights, hmws, brief) {
    const prompt = `
Research Insights:
${insights.map(i => `- "${i.quote}" (Theme: ${i.theme}, Pain Point: ${i.pain_point})`).join('\n')}

How Might We Statements:
${hmws.map(hmw => `- ${hmw}`).join('\n')}

Design Brief: ${brief}

Generate 3 distinct wireframe options using USWDS components. Each should address different aspects of the research insights.

Requirements:
- Use only USWDS 3.0 components and patterns
- Include proper accessibility attributes (ARIA labels, roles, etc.)
- Follow government form and content patterns
- Address specific user pain points identified in research
- Output valid HTML with USWDS CSS classes

Format response as JSON:
{
  "wireframes": [
    {
      "title": "Descriptive option name",
      "rationale": "Why this addresses the research insights (reference specific quotes)",
      "html": "Working HTML with USWDS classes",
      "components_used": ["usa-form", "usa-button"],
      "accessibility_features": ["Screen reader support", "Keyboard navigation"],
      "addresses_insights": ["Insight ID 1", "Insight ID 2"]
    }
  ]
}
    `;

    const response = await this.gemini.generateContent(prompt);
    return JSON.parse(response.text());
  }
}
```

#### 2. Screenshot Generation Service
```javascript
// services/screenshot-generator.js
const puppeteer = require('puppeteer');

class ScreenshotGenerator {
  async generateWireframeScreenshot(html, wireframeId) {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    
    // Set government-appropriate viewport
    await page.setViewport({ width: 1200, height: 800 });
    
    // Load USWDS CSS and wireframe HTML
    const fullHTML = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link rel="stylesheet" href="${process.env.USWDS_CSS_URL}">
        <title>Wireframe Preview</title>
        <style>
          body { margin: 20px; font-family: 'Source Sans Pro', sans-serif; }
          .wireframe-container { max-width: 1024px; margin: 0 auto; }
        </style>
      </head>
      <body>
        <div class="wireframe-container">
          ${html}
        </div>
      </body>
      </html>
    `;
    
    await page.setContent(fullHTML, { waitUntil: 'networkidle0' });
    
    // Generate screenshot
    const screenshot = await page.screenshot({
      type: 'png',
      fullPage: true,
      clip: { x: 0, y: 0, width: 1200, height: 800 }
    });
    
    await browser.close();
    
    // Upload to agency's file storage
    const screenshotUrl = await this.uploadScreenshot(screenshot, wireframeId);
    return screenshotUrl;
  }

  async uploadScreenshot(buffer, wireframeId) {
    // Upload to agency's S3 bucket or file storage
    const fileName = `wireframes/${wireframeId}-${Date.now()}.png`;
    
    await this.s3Client.upload({
      Bucket: process.env.AGENCY_ASSETS_BUCKET,
      Key: fileName,
      Body: buffer,
      ContentType: 'image/png',
      ACL: 'private'
    }).promise();
    
    return `${process.env.ASSETS_BASE_URL}/${fileName}`;
  }
}
```

#### 3. Preview Page Generator
```javascript
// services/preview-generator.js
class PreviewGenerator {
  async createPreviewPage(wireframe, sessionId, optionNumber) {
    const previewId = `${sessionId}-option${optionNumber}`;
    
    // Store wireframe data in database for preview access
    await this.db.wireframe_previews.create({
      id: previewId,
      html: wireframe.html,
      title: wireframe.title,
      components_used: wireframe.components_used,
      created_at: new Date(),
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
    });
    
    return `${process.env.QORI_BASE_URL}/preview/${previewId}`;
  }
}

// Simple express route for previews
app.get('/preview/:id', async (req, res) => {
  const preview = await db.wireframe_previews.findById(req.params.id);
  
  if (!preview || preview.expires_at < new Date()) {
    return res.status(404).send('Preview not found or expired');
  }
  
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <link rel="stylesheet" href="/assets/uswds.css">
      <title>${preview.title} - Qori Preview</title>
      <style>
        body { margin: 20px; font-family: 'Source Sans Pro', sans-serif; }
        .preview-header { 
          background: #f0f0f0; 
          padding: 15px; 
          border-radius: 4px; 
          margin-bottom: 20px; 
        }
        .preview-content { max-width: 1024px; margin: 0 auto; }
      </style>
    </head>
    <body>
      <div class="preview-content">
        <div class="preview-header">
          <h1>${preview.title}</h1>
          <p><strong>Components:</strong> ${preview.components_used.join(', ')}</p>
          <p><em>This is a wireframe preview generated by Qori for Design</em></p>
        </div>
        ${preview.html}
      </div>
    </body>
    </html>
  `);
});
```

#### 4. Slack Integration Service
```javascript
// slack/design-commands.js
app.command('/design', async ({ ack, command, respond, client }) => {
  await ack();
  
  try {
    const [studyId, ...briefParts] = command.text.split(' ');
    const designBrief = briefParts.join(' ') || "Generate wireframes based on research insights";
    
    // Initial response
    await respond({
      response_type: "in_channel",
      text: "🔄 Generating wireframe options from research insights...\n⏱️ This usually takes 30-45 seconds"
    });
    
    // Generate wireframes (async)
    const generator = new DesignGenerator();
    const result = await generator.generateFromResearch(studyId, designBrief);
    
    // Post comprehensive results
    await client.chat.postMessage({
      channel: command.channel_id,
      thread_ts: command.ts,
      blocks: await this.buildDesignResultsBlocks(result)
    });
    
  } catch (error) {
    await respond(`❌ Error generating wireframes: ${error.message}`);
  }
});

async function buildDesignResultsBlocks(result) {
  const blocks = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `🎨 Wireframes: ${result.study.title}`
      }
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Research Context:* ${result.insights.length} insights analyzed\n*HMW Statements Generated:* ${result.hmwStatements.length}\n*Wireframe Options:* ${result.wireframes.length}`
      }
    },
    { type: "divider" }
  ];

  // Add each wireframe option
  for (let i = 0; i < result.wireframes.length; i++) {
    const wireframe = result.wireframes[i];
    
    blocks.push(
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Option ${i + 1}: ${wireframe.title}*\n${wireframe.rationale}`
        }
      },
      {
        type: "image",
        image_url: wireframe.screenshot_url,
        alt_text: `Wireframe option ${i + 1}: ${wireframe.title}`
      },
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*Components Used:*\n${wireframe.components_used.join(', ')}`
          },
          {
            type: "mrkdwn", 
            text: `*Accessibility Features:*\n${wireframe.accessibility_features.join(', ')}`
          }
        ]
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `\`\`\`html\n${wireframe.html.length > 500 ? wireframe.html.substring(0, 500) + '...\n[Code truncated - see preview link for full HTML]' : wireframe.html}\n\`\`\``
        }
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "👍 Select This Option" },
            style: "primary",
            action_id: "select_wireframe",
            value: JSON.stringify({
              wireframe_id: wireframe.id,
              study_id: result.study.id,
              option_number: i + 1
            })
          },
          {
            type: "button",
            text: { type: "plain_text", text: "🔗 Live Preview" },
            url: wireframe.preview_url
          },
          {
            type: "button",
            text: { type: "plain_text", text: "💬 Feedback" },
            action_id: "wireframe_feedback",
            value: wireframe.id
          }
        ]
      },
      { type: "divider" }
    );
  }

  return blocks;
}
```

### YAML Workflow Configuration
```yaml
# workflows/design-generation.yaml
name: "research-to-wireframes"
description: "Generate USWDS wireframes from research insights"

trigger:
  type: "slack_command"
  command: "/design"
  
inputs:
  - name: "study_id"
    type: "string"
    required: true
    description: "Research study identifier"
  - name: "design_brief"
    type: "string"
    required: false
    default: "Generate wireframes based on research insights"

steps:
  - name: "extract_insights"
    service: "research-service"
    action: "get_study_insights"
    inputs:
      study_id: "${inputs.study_id}"
    outputs:
      insights: "study_insights"
      
  - name: "generate_hmw_statements"
    service: "ai-service"
    action: "generate_hmw"
    inputs:
      insights: "${steps.extract_insights.outputs.insights}"
    outputs:
      hmw_statements: "generated_hmws"
      
  - name: "generate_wireframes"
    service: "design-service"
    action: "generate_wireframes"
    inputs:
      insights: "${steps.extract_insights.outputs.insights}"
      hmw_statements: "${steps.generate_hmw_statements.outputs.hmw_statements}"
      design_brief: "${inputs.design_brief}"
    outputs:
      wireframes: "generated_wireframes"
      
  - name: "create_screenshots"
    service: "screenshot-service" 
    action: "generate_screenshots"
    inputs:
      wireframes: "${steps.generate_wireframes.outputs.wireframes}"
    outputs:
      screenshots: "wireframe_screenshots"
      
  - name: "create_previews"
    service: "preview-service"
    action: "create_preview_links"
    inputs:
      wireframes: "${steps.generate_wireframes.outputs.wireframes}"
    outputs:
      preview_links: "preview_urls"
      
  - name: "post_to_slack"
    service: "slack-service"
    action: "post_design_results"
    inputs:
      channel: "${trigger.channel_id}"
      study_data: "${steps.extract_insights.outputs}"
      wireframes: "${steps.generate_wireframes.outputs.wireframes}"
      screenshots: "${steps.create_screenshots.outputs.screenshots}"
      previews: "${steps.create_previews.outputs.preview_links}"

error_handling:
  - step: "generate_wireframes"
    on_error: "post_error_message"
    message: "Failed to generate wireframes. Please check research study data."
  - step: "create_screenshots"
    on_error: "continue_without_screenshots"
    fallback_message: "Screenshots unavailable - check preview links"

notifications:
  on_start:
    message: "🔄 Generating wireframe options from research insights..."
  on_complete:
    message: "✅ Wireframe generation complete"
  on_error:
    message: "❌ Error in wireframe generation process"
```

---

## Expected Slack Output

### Example: Benefits Application Wireframes

```
🎨 Wireframes: VA Benefits Application Research

Research Context: 8 insights analyzed
HMW Statements Generated: 4  
Wireframe Options: 3

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Option 1: Progressive Multi-Step Form

Addresses research insight: "I felt overwhelmed seeing all the questions at once" and "I didn't know how much more I had to fill out"

[SCREENSHOT: Shows a clean multi-step form with progress indicator, current step highlighted, clear "Next" and "Back" buttons]

Components Used: usa-step-indicator, usa-form-group, usa-button, usa-alert

Accessibility Features: Screen reader progress announcements, Keyboard navigation between steps, Clear error messaging

```html
<div class="usa-step-indicator">
  <ol class="usa-step-indicator__segments">
    <li class="usa-step-indicator__segment usa-step-indicator__segment--current">
      <span class="usa-step-indicator__segment-label">Personal Information</span>
    </li>
    <li class="usa-step-indicator__segment">
      <span class="usa-step-indicator__segment-label">Military Service</span>
    </li>
    <li class="usa-step-indicator__segment">
      <span class="usa-step-indicator__segment-label">Benefits Selection</span>
    </li>
  </ol>
</div>

<form class="usa-form usa-form--large">
  <div class="usa-form-group">
    <label class="usa-label" for="first-name">First name *</label>
    <input class="usa-input" id="first-name" name="first-name" type="text" required>
  </div>
  
  <div class="usa-form-group">
    <label class="usa-label" for="last-name">Last name *</label>
    <input class="usa-input" id="last-name" name="last-name" type="text" required>
  </div>
  
  <div class="usa-button-group">
    <button class="usa-button usa-button--outline" type="button">Back</button>
    <button class="usa-button" type="submit">Continue to Military Service</button>
  </div>
</form>
```

[👍 Select This Option] [🔗 Live Preview] [💬 Feedback]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Option 2: Smart Defaults with Review Summary

Addresses research insight: "I had to enter information the VA already knows about me" and "I want to see everything before I submit"

[SCREENSHOT: Shows form with pre-filled fields marked as "Verified" and a summary panel on the right]

Components Used: usa-summary-box, usa-form-group, usa-tag, usa-accordion

Accessibility Features: Clear labeling of pre-filled data, Summary section with proper headings, Expandable details for verification

```html
<div class="grid-row grid-gap">
  <div class="grid-col-8">
    <form class="usa-form">
      <div class="usa-form-group">
        <label class="usa-label" for="ssn">Social Security Number</label>
        <div class="usa-input-group">
          <input class="usa-input" id="ssn" value="***-**-1234" readonly>
          <span class="usa-tag usa-tag--big">Verified</span>
        </div>
      </div>
      
      <div class="usa-form-group">
        <label class="usa-label" for="service-dates">Service Dates</label>
        <div class="usa-input-group">
          <input class="usa-input" id="service-dates" value="2010-2018" readonly>
          <span class="usa-tag usa-tag--big">From Military Records</span>
        </div>
      </div>
    </form>
  </div>
  
  <div class="grid-col-4">
    <div class="usa-summary-box">
      <div class="usa-summary-box__body">
        <h3 class="usa-summary-box__heading">Application Summary</h3>
        <div class="usa-summary-box__text">
          <ul class="usa-list usa-list--unstyled">
            <li>✓ Personal Information (Verified)</li>
            <li>✓ Military Service (From Records)</li>
            <li>→ Benefits Selection (In Progress)</li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</div>
```

[👍 Select This Option] [🔗 Live Preview] [💬 Feedback]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Option 3: Guided Interview Style

Addresses research insight: "I didn't understand what some of the questions were asking" and "I need help knowing what benefits I qualify for"

[SCREENSHOT: Shows conversational interface with one question at a time, clear explanations, and progress indication]

Components Used: usa-card, usa-radio, usa-alert--info, usa-button

Accessibility Features: Single question focus, Clear explanations and examples, Contextual help without overwhelming

```html
<div class="usa-card">
  <div class="usa-card__container">
    <div class="usa-card__header">
      <h2 class="usa-card__heading">Question 3 of 12</h2>
    </div>
    <div class="usa-card__body">
      <h3>What type of military service did you complete?</h3>
      
      <div class="usa-alert usa-alert--info usa-alert--slim">
        <div class="usa-alert__body">
          <p class="usa-alert__text">This helps us determine which benefits you may qualify for.</p>
        </div>
      </div>
      
      <fieldset class="usa-fieldset">
        <div class="usa-radio">
          <input class="usa-radio__input" id="active-duty" type="radio" name="service-type" value="active">
          <label class="usa-radio__label" for="active-duty">
            Active Duty
            <span class="usa-hint">Full-time military service</span>
          </label>
        </div>
        
        <div class="usa-radio">
          <input class="usa-radio__input" id="reserves" type="radio" name="service-type" value="reserves">
          <label class="usa-radio__label" for="reserves">
            Reserves/National Guard
            <span class="usa-hint">Part-time military service</span>
          </label>
        </div>
      </fieldset>
    </div>
    
    <div class="usa-card__footer">
      <button class="usa-button usa-button--outline" type="button">Previous</button>
      <button class="usa-button" type="button">Next Question</button>
    </div>
  </div>
</div>
```

[👍 Select This Option] [🔗 Live Preview] [💬 Feedback]
```

---

## Implementation Steps

### Phase 1: Core Infrastructure (Weeks 1-2)
1. **USWDS Component Database**
   - Scrape/parse USWDS documentation
   - Build component templates and validation rules
   - Create component usage guidelines

2. **Gemini 2.5 Integration**
   - Set up API integration with proper error handling
   - Create USWDS-specific prompts and constraints
   - Build response validation and formatting

3. **Screenshot Generation Service**
   - Set up Puppeteer with USWDS CSS
   - Create screenshot generation pipeline
   - Implement image upload and storage

### Phase 2: Slack Integration (Weeks 3-4)
1. **Command Processing**
   - Implement `/design` command handler
   - Add parameter parsing and validation
   - Create interactive button handlers

2. **Message Formatting**
   - Build rich Slack message blocks
   - Implement screenshot embedding
   - Add action buttons and responses

3. **Preview Page System**
   - Simple Express server for wireframe previews
   - HTML generation with USWDS styling
   - Temporary storage and expiration handling

### Phase 3: Workflow Integration (Weeks 5-6)
1. **YAML Workflow Engine**
   - Integrate with existing Qori Research workflows
   - Add design generation steps to pipeline
   - Implement error handling and notifications

2. **Research Connection**
   - Pull insights from completed research studies
   - Generate HMW statements from insights
   - Link wireframes back to research context

3. **GitHub Integration**
   - Auto-create issues for selected wireframes
   - Include full HTML code and research context
   - Add design review and approval workflows

### Phase 4: Testing & Refinement (Weeks 7-8)
1. **Quality Validation**
   - USWDS compliance checking
   - Accessibility validation
   - Code quality and output formatting

2. **User Testing**
   - Test with design teams
   - Gather feedback on wireframe quality
   - Refine prompts and output formatting

3. **Documentation**
   - User guides for design teams
   - Technical documentation for developers
   - Integration guides for new agencies

---

## Configuration for GOTS Deployment

### Environment Variables
```bash
# Design service configuration
GEMINI_API_KEY=your_gemini_api_key
USWDS_VERSION=3.0.0
USWDS_CSS_URL=https://cdn.jsdelivr.net/npm/uswds@3.0.0/dist/css/uswds.min.css

# Screenshot and preview configuration  
AGENCY_ASSETS_BUCKET=agency-design-assets
ASSETS_BASE_URL=https://assets.agency.gov
QORI_BASE_URL=https://qori.agency.gov

# Puppeteer configuration
CHROME_EXECUTABLE_PATH=/usr/bin/chromium-browser
SCREENSHOT_TIMEOUT=30000
MAX_SCREENSHOT_SIZE=2048x2048
```

### Agency Customization
```yaml
# config/design-config.yaml
design_generation:
  enabled: true
  max_wireframes_per_request: 3
  
  uswds_customization:
    version: "3.0.0"
    theme_colors:
      primary: "#005ea2"      # Default USWDS blue
      secondary: "#fa9441"    # Default USWDS gold
    
    agency_overrides:
      header_component: "custom"  # Use agency custom header
      footer_component: "custom"  # Use agency custom footer
      
  screenshot_settings:
    viewport_width: 1200
    viewport_height: 800
    quality: 90
    format: "png"
    
  preview_settings:
    expiration_days: 30
    max_previews_per_study: 10
    include_agency_branding: true

slack_integration:
  design_channel: "#design-review" 
  notifications:
    mention_design_team: true
    thread_responses: true
    
github_integration:
  auto_create_issues: true
  issue_labels: ["design", "uswds", "research-driven"]
  assign_to_team: "design-team"
```

---

## Success Metrics

### Technical Performance
- **Generation Speed**: < 45 seconds from command to Slack post
- **USWDS Compliance**: 95%+ valid component usage
- **Screenshot Quality**: Clear, professional wireframe images
- **Preview Uptime**: 99%+ availability for preview links

### User Adoption
- **Command Usage**: 80%+ of research studies generate wireframes
- **Team Engagement**: Average 3+ team members interact per wireframe set
- **Selection Rate**: 90%+ of wireframe sets result in option selection
- **GitHub Integration**: 85%+ selected wireframes become development issues

### Quality Measures
- **Research Alignment**: Wireframes address specific research insights
- **Accessibility**: All generated wireframes include proper ARIA attributes
- **Component Validity**: Generated HTML passes USWDS validation
- **Developer Handoff**: Code requires minimal modification for implementation

---

This Slack-native approach delivers the power of AI-generated wireframes without the complexity of building and maintaining a separate web interface. Teams get visual design concepts, working code, and seamless integration with their existing workflows - all within the Slack environment they already use daily.
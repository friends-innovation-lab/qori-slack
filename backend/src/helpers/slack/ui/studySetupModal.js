/* eslint-disable max-len */
/* eslint-disable quotes */

// Modal for /plan-study command (cancel only)
const studySetupModalPlanStudy = {
  type: "modal",
  callback_id: "plan_study_modal",
  title: {
    type: "plain_text",
    text: "Plan your study",
  },
  submit: {
    type: "plain_text",
    text: "Done",
  },
  close: {
    type: "plain_text",
    text: "Close",
  },
  blocks: [
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: "Select a study, then create documents or upload files.",
        },
      ],
    },
    {
      type: "divider",
    },
    {
      type: "input",
      block_id: "study_selection",
      label: {
        type: "plain_text",
        text: "Select study:",
      },
      hint: {
        type: "plain_text",
        text: "Choose which study these planning documents will be added to.",
      },
      element: {
        type: "static_select",
        action_id: "study_select",
        placeholder: {
          type: "plain_text",
          text: "Select a study...",
        },
        options: [
          {
            text: {
              type: "plain_text",
              text: "Loading studies...",
            },
            value: "loading",
          },
        ],
      },
    },
    {
      type: "divider",
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "*📝 Create Documents*",
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "*Research brief*\nDefine scope, objectives, and methodology",
      },
      accessory: {
        type: "button",
        text: {
          type: "plain_text",
          text: "Create",
        },
        action_id: "create_research_brief",
        value: "research_brief",
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "*Stakeholder guide*\nQuestions for PMs, engineers, policy SMEs",
      },
      accessory: {
        type: "button",
        text: {
          type: "plain_text",
          text: "Create",
        },
        action_id: "create_stakeholder_guide",
        value: "stakeholder_guide",
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "*Research plan*\nTimeline, logistics, and session schedule",
      },
      accessory: {
        type: "button",
        text: {
          type: "plain_text",
          text: "Create",
        },
        action_id: "create_research_plan",
        value: "research_plan",
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "*Discussion guide*\nConversation guide for user research sessions",
      },
      accessory: {
        type: "button",
        text: {
          type: "plain_text",
          text: "Create",
        },
        action_id: "create_discussion_guide",
        value: "discussion_guide",
      },
    },
    {
      type: "divider",
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "*📎 Upload Files*",
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "*Desk research*\nReports, competitive analysis, background docs",
      },
      accessory: {
        type: "button",
        text: {
          type: "plain_text",
          text: "Upload",
        },
        action_id: "upload_desk_research",
        value: "desk_research",
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "*Stakeholder notes*\nTranscripts from internal interviews",
      },
      accessory: {
        type: "button",
        text: {
          type: "plain_text",
          text: "Upload",
        },
        action_id: "upload_stakeholder_notes",
        value: "stakeholder_notes",
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "*Survey data*\nSurvey exports (CSV, Excel) for synthesis",
      },
      accessory: {
        type: "button",
        text: {
          type: "plain_text",
          text: "Upload",
        },
        action_id: "upload_survey_data",
        value: "survey_data",
      },
    },
    {
      type: "divider",
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: "💡 Upload stakeholder notes to unlock Service Blueprint analysis",
        },
      ],
    },
  ],
};

// Modal for /start-research command (skip only)
const studySetupModalStartResearch = {
  type: "modal",
  callback_id: "study-setup-modal-start-research",
  title: {
    type: "plain_text",
    text: "Plan Your Study",
  },
  submit: {
    type: "plain_text",
    text: "Skip for Now",
  },
  blocks: [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "🎉 *Study Created Successfully!*\nYour GitHub folder structure is ready. Choose a planning document to create next, or skip to add these later.",
      },
    },
    {
      type: "divider",
    },
    {
      type: "input",
      block_id: "study_selection",
      label: {
        type: "plain_text",
        text: "Select study:",
      },
      hint: {
        type: "plain_text",
        text: "Choose which study these planning documents will be added to.",
      },
      element: {
        type: "static_select",
        action_id: "study_select",
        placeholder: {
          type: "plain_text",
          text: "Select a study...",
        },
        options: [
          {
            text: {
              type: "plain_text",
              text: "Loading studies...",
            },
            value: "loading",
          },
        ],
      },
    },
    {
      type: "divider",
    },
    // 📝 Generate Section
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "*📝 Generate*",
      },
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: "‎", // empty spacer
        },
      ],
    },
    // Research Plan
    {
      type: "section",
      block_id: "research_plan_block",
      text: {
        type: "mrkdwn",
        text: "*📄 Create Research Plan*\nMethodology, timeline, and study structure",
      },
      accessory: {
        type: "button",
        text: {
          type: "plain_text",
          text: "Create",
        },
        style: "primary",
        action_id: "create_research_plan",
      },
    },
    {
      type: "context",
      elements: [
        {
          type: "plain_text",
          text: "RECOMMENDED",
          emoji: true,
        },
      ],
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: "‎", // empty spacer
        },
      ],
    },
    // Discussion Guide
    {
      type: "section",
      block_id: "discussion_guide_block",
      text: {
        type: "mrkdwn",
        text: "*💬 Create Discussion Guide*\nConversation guide for user research sessions",
      },
      accessory: {
        type: "button",
        text: {
          type: "plain_text",
          text: "Create",
        },
        action_id: "create_discussion_guide",
      },
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: "‎", // empty spacer
        },
      ],
    },
    // Stakeholder Interview Guide (NEW)
    {
      type: "section",
      block_id: "stakeholder_interview_guide_block",
      text: {
        type: "mrkdwn",
        text: "*🏛️ Create Stakeholder Interview Guide*\nInterview guide for PMs, engineers, policy SMEs",
      },
      accessory: {
        type: "button",
        text: {
          type: "plain_text",
          text: "Create",
        },
        action_id: "create_stakeholder_interview_guide",
      },
    },
    {
      type: "divider",
    },
    // 📁 Upload Section
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "*📁 Upload*",
      },
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: "‎", // empty spacer
        },
      ],
    },
    // Upload Desk Research
    {
      type: "section",
      block_id: "desk_research_block",
      text: {
        type: "mrkdwn",
        text: "*📁 Upload Desk Research*\nReports, competitive analysis, background docs",
      },
      accessory: {
        type: "button",
        text: {
          type: "plain_text",
          text: "Upload",
        },
        action_id: "upload_desk_research",
      },
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: "‎", // empty spacer
        },
      ],
    },
    // Upload Survey Data (NEW)
    {
      type: "section",
      block_id: "survey_data_block",
      text: {
        type: "mrkdwn",
        text: "*📊 Upload Survey Data*\nSurvey exports (CSV, Excel) for synthesis",
      },
      accessory: {
        type: "button",
        text: {
          type: "plain_text",
          text: "Upload",
        },
        action_id: "upload_survey_data",
      },
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: "‎", // empty spacer
        },
      ],
    },
    // Upload Stakeholder Notes (NEW)
    {
      type: "section",
      block_id: "stakeholder_notes_block",
      text: {
        type: "mrkdwn",
        text: "*🎙️ Upload Stakeholder Notes*\nTranscripts from internal interviews (Otter, Fireflies)",
      },
      accessory: {
        type: "button",
        text: {
          type: "plain_text",
          text: "Upload",
        },
        action_id: "upload_stakeholder_notes",
      },
    },
    {
      type: "divider",
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: "⚡ *Pro tip:* Upload stakeholder interview notes to unlock the Service Blueprint analysis — it fills in the \"backstage\" layer showing why user pain points exist.",
        },
      ],
    }
  ],
};

// Keep the original for backward compatibility
const studySetupModal = studySetupModalStartResearch;

module.exports = { studySetupModal, studySetupModalPlanStudy, studySetupModalStartResearch };

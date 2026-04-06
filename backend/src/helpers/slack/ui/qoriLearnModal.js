// Qori Learn - Interactive Tutorial UI Components

// Topic mapping configuration
const QORI_LEARN_TOPICS = {
  request: {
    label: "Research Requests",
    command: "request",
    slug: "request",
    emoji: "📥",
    phase: "Study Setup",
    description: "submit and manage research requests from stakeholders"
  },
  plan: {
    label: "Study Planning",
    command: "plan",
    slug: "plan",
    emoji: "📋",
    phase: "Study Setup",
    description: "create research briefs, plans, discussion guides, and more"
  },
  participants: {
    label: "Participants",
    command: "participants",
    slug: "participants",
    emoji: "👥",
    phase: "Sessions",
    description: "add, track, and manage study participants"
  },
  outreach: {
    label: "Outreach",
    command: "outreach",
    slug: "outreach",
    emoji: "📬",
    phase: "Sessions",
    description: "generate recruitment emails, confirmations, and reminders"
  },
  observe: {
    label: "Observing",
    command: "observe",
    slug: "observe",
    emoji: "👀",
    phase: "Sessions",
    description: "request observer spots for upcoming research sessions"
  },
  notes: {
    label: "Note Taking",
    command: "notes",
    slug: "notes",
    emoji: "📝",
    phase: "Sessions",
    description: "capture and organize session notes with timestamps"
  },
  analyze: {
    label: "Analysis",
    command: "analyze",
    slug: "analyze",
    emoji: "🔬",
    phase: "Analysis",
    description: "run AI-powered analysis on session data and transcripts"
  },
  synthesis: {
    label: "Synthesis",
    command: "synthesis",
    slug: "synthesis",
    emoji: "🔍",
    phase: "Analysis",
    description: "find patterns and themes across multiple sessions"
  },
  report: {
    label: "Reports",
    command: "report",
    slug: "report",
    emoji: "📊",
    phase: "Analysis",
    description: "generate stakeholder-ready research reports"
  }
};

const QORI_LEARN_BASE_URL = "https://friends-from-the-city.github.io/Qori-Slack-AI-Bot/learn";

// Helper function to build welcome message blocks
function buildWelcomeMessage() {
  return {
    response_type: "ephemeral",
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "👋 Welcome to Qori!",
          emoji: true
        }
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "Your AI research assistant. I help VA research teams manage studies, participants, and synthesis — all from Slack.\n\n*Ready to learn?* Take a 2-minute interactive tour to see what I can do."
        }
      },
      {
        type: "actions",
        block_id: "welcome_actions",
        elements: [
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "🎓 Start Tutorial",
              emoji: true
            },
            style: "primary",
            action_id: "learn_start_tutorial"
          },
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "📚 View All Commands",
              emoji: true
            },
            url: `${QORI_LEARN_BASE_URL}/`,
            action_id: "learn_view_all"
          },
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "✕ Dismiss",
              emoji: true
            },
            action_id: "learn_dismiss"
          }
        ]
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: "💡 You can also type */qori* anytime to see available commands"
          }
        ]
      }
    ]
  };
}

// Helper function to build topic picker message blocks
function buildTopicPickerMessage() {
  return {
    replace_original: true,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "*What would you like to learn?*\nPick a topic and I'll open an interactive walkthrough."
        }
      },
      {
        type: "divider"
      },
      {
        type: "section",
        block_id: "topic_section_setup",
        text: {
          type: "mrkdwn",
          text: "*Study Setup*"
        }
      },
      {
        type: "actions",
        block_id: "topics_setup",
        elements: [
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "📥 Research Requests",
              emoji: true
            },
            action_id: "topic_request",
            value: "request"
          },
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "📋 Study Planning",
              emoji: true
            },
            action_id: "topic_plan",
            value: "plan"
          }
        ]
      },
      {
        type: "section",
        block_id: "topic_section_sessions",
        text: {
          type: "mrkdwn",
          text: "*Sessions*"
        }
      },
      {
        type: "actions",
        block_id: "topics_sessions",
        elements: [
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "👥 Participants",
              emoji: true
            },
            action_id: "topic_participants",
            value: "participants"
          },
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "📬 Outreach",
              emoji: true
            },
            action_id: "topic_outreach",
            value: "outreach"
          },
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "👀 Observing",
              emoji: true
            },
            action_id: "topic_observe",
            value: "observe"
          },
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "📝 Note Taking",
              emoji: true
            },
            action_id: "topic_notes",
            value: "notes"
          }
        ]
      },
      {
        type: "section",
        block_id: "topic_section_analysis",
        text: {
          type: "mrkdwn",
          text: "*Analysis*"
        }
      },
      {
        type: "actions",
        block_id: "topics_analysis",
        elements: [
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "🔬 Analysis",
              emoji: true
            },
            action_id: "topic_analyze",
            value: "analyze"
          },
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "🔍 Synthesis",
              emoji: true
            },
            action_id: "topic_synthesis",
            value: "synthesis"
          },
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "📊 Reports",
              emoji: true
            },
            action_id: "topic_report",
            value: "report"
          }
        ]
      },
      {
        type: "divider"
      },
      {
        type: "actions",
        block_id: "topic_nav",
        elements: [
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "← Back",
              emoji: true
            },
            action_id: "learn_back_to_welcome"
          }
        ]
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: "Opens in your browser · Takes about 2 minutes"
          }
        ]
      }
    ]
  };
}

// Helper function to build confirmation message blocks
function buildConfirmationMessage(topic) {
  const tutorialUrl = `${QORI_LEARN_BASE_URL}/${topic.slug}/`;
  
  return {
    replace_original: true,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `🎓 *Tutorial: ${topic.label}*\n\nLearn how to use \`/qori-${topic.command}\` — ${topic.description}`
        }
      },
      {
        type: "divider"
      },
      {
        type: "actions",
        block_id: "confirmation_actions",
        elements: [
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "🔗 Open Tutorial",
              emoji: true
            },
            style: "primary",
            url: tutorialUrl,
            action_id: "learn_open_tutorial"
          },
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "← Pick Another Topic",
              emoji: true
            },
            action_id: "learn_back_to_topics"
          },
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "✕ Dismiss",
              emoji: true
            },
            action_id: "learn_dismiss"
          }
        ]
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `Opens in your browser · <${tutorialUrl}|friends-from-the-city.github.io>`
          }
        ]
      }
    ]
  };
}

module.exports = {
  QORI_LEARN_TOPICS,
  QORI_LEARN_BASE_URL,
  buildWelcomeMessage,
  buildTopicPickerMessage,
  buildConfirmationMessage
};


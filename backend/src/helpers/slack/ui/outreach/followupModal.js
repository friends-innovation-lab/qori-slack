const followupModal = {
  type: "modal",
  callback_id: "outreach_follow_up_modal",
  title: {
    type: "plain_text",
    text: "Follow-up",
  },
  submit: {
    type: "plain_text",
    text: "Generate",
  },
  close: {
    type: "plain_text",
    text: "Back",
  },
  blocks: [
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: "Gentle check-in when a participant hasn't responded. Includes easy opt-out.",
        },
      ],
    },
    {
      type: "divider",
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "*👤 Participant*",
      },
    },
    {
      type: "input",
      block_id: "participant_id_block",
      label: {
        type: "plain_text",
        text: "Participant ID or alias *",
      },
      hint: {
        type: "plain_text",
        text: "Use ID (e.g., P001) or alias (e.g., Alex M.) — no full names for privacy",
      },
      element: {
        type: "plain_text_input",
        action_id: "participant_id",
        placeholder: {
          type: "plain_text",
          text: "e.g., P001 or Alex M.",
        },
      },
    },
  ],
};

module.exports = { followupModal };

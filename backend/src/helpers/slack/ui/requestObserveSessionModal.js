const requestObserveSessionModal = (sessions = [], studyName = "", studyResearcherName = "", userName = "") => {
  // Build session options for dropdown
  const sessionOptions = sessions.map((session) => {
    // Keep value short to respect Slack's 75-char limit
    const value = `${session.id}|${session.participantId}`;
    
    // Format: PT001 - Oct 27, 2025 at 10:00 AM
    const formattedDate = session.date || 'TBD';
    const formattedTime = session.time || 'TBD';
    const displayText = `${session.id} - ${formattedDate} at ${formattedTime}`;

    return {
      text: { type: "plain_text", text: displayText },
      value
    };
  });

  // Format first session details for display
  const firstSession = sessions[0] || {};

  return {
    type: "modal",
    callback_id: "request_observe_session_modal",
    title: { type: "plain_text", text: "Observer Request" },
    close: { type: "plain_text", text: "Cancel" },
    submit: { type: "plain_text", text: "Submit Request" },
    blocks: [
    
      // Requesting User (auto-populated, display only)
      {
        type: "section",
        block_id: "requesting_user_display",
        text: {
          type: "mrkdwn",
          text: `*👤 Requesting user*\n${userName || "N/A"}`,
        },
      },
      {
        type: "context",
        elements: [
          { type: "mrkdwn", text: "Your Slack profile." },
        ],
      },

      { type: "divider" },

      // Session Selection
      { type: "section", text: { type: "mrkdwn", text: "📅 *Select Session*" } },
      {
        type: "input",
        block_id: "session_selection_block",
        label: { type: "plain_text", text: "Session to observe *" },
        element: {
          type: "static_select",
          action_id: "selected_session",
          placeholder: { type: "plain_text", text: "Select a session..." },
          options: sessionOptions.length > 0 ? sessionOptions : [
            { text: { type: "plain_text", text: "No sessions available" }, value: "none" }
          ],
          ...(sessionOptions.length > 0 && sessionOptions[0] ? { initial_option: sessionOptions[0] } : {}),
        },
      },

      // Session Details Box (display info about selected session)
      // {
      //   type: "section",
      //   block_id: "session_details_display",
      //   fields: [
      //     { type: "mrkdwn", text: `*Study*\n${studyName || "N/A"}` },
      //     { type: "mrkdwn", text: `*Participant*\n${firstSession.id || "N/A"}` },
      //     { type: "mrkdwn", text: `*Date & Time*\n${firstSession.date || "TBD"} at ${firstSession.time || "TBD"}` },
      //     { type: "mrkdwn", text: `*Lead Researcher*\n${studyResearcherName || "N/A"}` },
      //   ],
      // },

      { type: "divider" },

      // Observer Role Selection
    
      {
        type: "input",
        block_id: "observer_role_block",
        label: { type: "plain_text", text: "Observer role *" },
        element: {
          type: "radio_buttons",
          action_id: "observer_role",
          options: [
            {
              text: { type: "plain_text", text: "📝 Note-taker" },
              value: "note_taker",
            },
            {
              text: { type: "plain_text", text: "👁️ Silent Observer" },
              value: "silent_observer",
            },
            {
              text: { type: "plain_text", text: "📊 PM Observer" },
              value: "pm_observer",
            },
            {
              text: { type: "plain_text", text: "🏛️ Stakeholder" },
              value: "stakeholder",
            },
          ],
          initial_option: {
            text: { type: "plain_text", text: "📝 Note-taker" },
            value: "note_taker",
          },
        },
      },

      // { type: "divider" },

      // // Additional Details
      // { type: "section", text: { type: "mrkdwn", text: "📝 *Additional Details*" } },
      // { type: "context", elements: [ { type: "mrkdwn", text: "Help the researcher understand your request." } ] },
      // {
      //   type: "input",
      //   block_id: "observation_reason_block",
      //   label: { type: "plain_text", text: "Why do you want to observe this session? *" },
      //   element: {
      //     type: "plain_text_input",
      //     action_id: "observation_reason",
      //     multiline: true,
      //     max_length: 300,
      //     placeholder: {
      //       type: "plain_text",
      //       text: "e.g., Want to understand user pain points for upcoming feature planning, Learning session facilitation techniques",
      //     },
      //   },
      //   hint: { type: "plain_text", text: "Brief explanation of your interest in observing. Max 300 characters." },
      // },
    ],
  };
};

module.exports = { requestObserveSessionModal };

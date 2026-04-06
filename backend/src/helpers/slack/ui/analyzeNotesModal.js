const { generateFileCheckboxOptions } = require("../../generateFileCheckboxOptions");

const analyzeNotesModal = (researchStudies = [], noteFiles = [], sessions = [], options = {}) => {
  const {
    showStudy = true,
    showSession = false,
    showNotes = false,
    selectedStudy = null,
    selectedSession = null,
  } = options;

  // Build research study options dynamically (limit to 10 to avoid Slack's limit)
  const studyOptions = researchStudies.slice(0, 10).map((study) => ({
    text: {
      type: "plain_text",
      text: study.name,
      emoji: true,
    },
    value: study.id.toString(),
  }));

  // Find selected study option for initial_option
  const selectedStudyOption = selectedStudy
    ? studyOptions.find(opt => opt.value === selectedStudy.toString())
    : null;

  // Build session options dynamically (limit to 10 to avoid Slack's limit)
  const sessionOptions = sessions.slice(0, 10).map((session) => ({
    text: {
      type: "plain_text",
      text: `${session.participant?.participant_name || 'Unknown Participant'} - ${session.participant?.scheduled_date || 'No Date'} ${session.participant?.scheduled_time || ''}`.trim(),
      emoji: true,
    },
    value: session.id.toString(),
  }));

  // Find selected session option for initial_option
  const selectedSessionOption = selectedSession
    ? sessionOptions.find(opt => opt.value === selectedSession.toString())
    : null;

  // Build note file options dynamically (limit to 10 to avoid Slack's limit)
  const fileOptions = noteFiles.slice(0, 10).map((file) => ({
    key: file.id || file.filename,
    label: `${file.filename}\n${file.participant_name} • ${file.session_date} • ${file.session_time}`,
  }));

  const blocks = [];

  // Section 1: Select Research Study (always shown if showStudy is true)
  if (showStudy) {
    blocks.push({
      type: "section",
      block_id: "research_study_header",
      text: {
        type: "mrkdwn",
        text: "*📂 Research Study*",
      },
    });

    const studySelectElement = {
      type: "static_select",
      action_id: "study_select_test",
      placeholder: {
        type: "plain_text",
        text: "Choose a research study...",
      },
      options: studyOptions.length > 0 ? studyOptions : [
        {
          text: {
            type: "plain_text",
            text: "No research studies found",
          },
          value: "no_studies",
        },
      ],
    };

    // Preserve selection if study was already selected
    if (selectedStudyOption) {
      studySelectElement.initial_option = selectedStudyOption;
    }

    // Use input block with dispatch_action: true on the block (not element) for full-width + auto-trigger
    blocks.push({
      type: "input",
      block_id: "study_select_block",
      dispatch_action: true,  // Fire  immediately on select - goes on input block, not element!
      label: {
        type: "plain_text",
        text: "Study *",
        emoji: false,
      },
      element: studySelectElement,
    });

    // Show message if there are more than 10 studies
    if (researchStudies.length > 10) {
      blocks.push({
        type: "context",
        block_id: "studies_limit_warning",
        elements: [
          {
            type: "mrkdwn",
            text: `⚠️ *Note:* Showing first 10 of ${researchStudies.length} available studies. Contact support if you need access to all studies.`,
          },
        ],
      });
    }
  }

  // Section 2: Select Session (shown when showSession is true)
  if (showSession) {
    blocks.push({
      type: "divider",
    });

    blocks.push({
      type: "section",
      block_id: "session_header",
      text: {
        type: "mrkdwn",
        text: "*📅 Session*",
      },
    });

    const sessionSelectElement = {
      type: "static_select",
      action_id: "analyze_notes_session_select",
      placeholder: {
        type: "plain_text",
        text: sessions.length > 0 ? "Choose a session..." : "No sessions available",
      },
      options: sessionOptions.length > 0 ? sessionOptions : [
        {
          text: {
            type: "plain_text",
            text: "No sessions available",
          },
          value: "no_sessions",
        },
      ],
    };

    // Preserve selection if session was already selected
    if (selectedSessionOption) {
      sessionSelectElement.initial_option = selectedSessionOption;
    }

    // Use input block with dispatch_action: true on the block (not element) for full-width + auto-trigger
    blocks.push({
      type: "input",
      block_id: "session_select_block",
      dispatch_action: true,  // Fire immediately on select - goes on input block, not element!
      label: {
        type: "plain_text",
        text: "Session *",
        emoji: false,
      },
      element: sessionSelectElement,
    });

    // Show message if there are more than 10 sessions
    if (sessions.length > 10) {
      blocks.push({
        type: "context",
        block_id: "sessions_limit_warning",
        elements: [
          {
            type: "mrkdwn",
            text: `⚠️ *Note:* Showing first 10 of ${sessions.length} available sessions.`,
          },
        ],
      });
    }
  }

  // Section 3: Select Notes to Analyze (shown when showNotes is true)
  if (showNotes) {
    blocks.push({
      type: "divider",
    });

    blocks.push({
      type: "section",
      block_id: "notes_selection_header",
      text: {
        type: "mrkdwn",
        text: `:pencil2: *Select Notes to Analyze*\n${noteFiles.length > 0 ? 'Choose note files to generate a quick summary with key pain points, quotes, and observations.' : 'No notes available for this session.'}`,
      },
    });

    blocks.push({
      type: "context",
      block_id: "notes_meta_block",
      elements: [
        {
          type: "mrkdwn",
          text: noteFiles.length > 0
            ? `*Available Note Files* :white_check_mark: ${noteFiles.length} files found`
            : "*Available Note Files* :white_check_mark: No notes available for this session",
        },
      ],
    });

    blocks.push({
      type: "input",
      block_id: "notes_select_block",
      label: {
        type: "plain_text",
        text: "Note Files",
        emoji: false,
      },
      element: {
        type: "checkboxes",
        action_id: "notes_select",
        options: fileOptions.length > 0 ? generateFileCheckboxOptions(fileOptions) : [
          {
            text: {
              type: "plain_text",
              text: "No notes available",
            },
            value: "no_files",
          },
        ],
      },
    });

    // Show message if there are more than 10 files
    if (noteFiles.length > 10) {
      blocks.push({
        type: "context",
        block_id: "files_limit_warning",
        elements: [
          {
            type: "mrkdwn",
            text: `⚠️ *Note:* Showing first 10 of ${noteFiles.length} available files. Select a study with fewer files or contact support for analysis of all files.`,
          },
        ],
      });
    }
  }

  // Section 4: What you'll get (always shown at the end if notes are shown)
  // if (showNotes) {
  //   blocks.push({
  //     type: "divider",
  //   });

  //   blocks.push({
  //     type: "context",
  //     block_id: "benefits_header",
  //     elements: [
  //       {
  //         type: "mrkdwn",
  //         text: "*What you'll get* :bar_chart:",
  //       },
  //     ],
  //   });

  //   blocks.push({
  //     type: "context",
  //     block_id: "benefits_description",
  //     elements: [
  //       {
  //         type: "mrkdwn",
  //         text: "A concise summary perfect for sharing with your team, including:",
  //       },
  //     ],
  //   });

  //   blocks.push({
  //     type: "context",
  //     block_id: "benefits_list",
  //     elements: [
  //       {
  //         type: "mrkdwn",
  //         text: "• Top 3 pain points from the session\n• Key participant quotes with context\n• Notable observations and behaviors\n• Quick action items for the team",
  //       },
  //     ],
  //   });
  // }

  // Submit button text based on state
  const submitButtonText = showNotes && noteFiles.length > 0 
    ? "Analyze" 
    : showSession 
      ? "Continue" 
      : "Continue";

  return {
    type: "modal",
    callback_id: "analyze_notes_submit",
    title: {
      type: "plain_text",
      text: "Analyze Notes",
      emoji: false,
    },
    close: {
      type: "plain_text",
      text: "Cancel",
      emoji: false,
    },
    submit: {
      type: "plain_text",
      text: submitButtonText,
      emoji: false,
    },
    private_metadata: "{\"source\":\"slack\"}",
    blocks,
  };
};

module.exports = { analyzeNotesModal };

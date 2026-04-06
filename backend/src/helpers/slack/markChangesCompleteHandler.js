const { getStudyStatusById, addStudyStatus } = require('../../services/study-status.service');
const { markChangesCompleteModal } = require('./ui/markChangesCompleteModal');

const handleMarkChangesCompleteAction = async ({ ack, body, client }) => {
  await ack();
  const action = body.actions[0];
  const { fileName, statusId } = JSON.parse(action.value);
  const status = await getStudyStatusById(statusId);
  let requestedBy = null;
  if (status && status.requested_by) {
    try {
      const userInfo = await client.users.info({ user: status.requested_by });
      requestedBy = userInfo.user.real_name || userInfo.user.name;
    } catch (error) {
      requestedBy = status.requested_by;
    }
  }
  const filePath = status.path;
  await client.views.open({
    trigger_id: body.trigger_id,
    view: markChangesCompleteModal(fileName, filePath, statusId, requestedBy)
  });
};

const handleMarkChangesCompleteModal = async ({ ack, body, view, client }) => {
  await ack();
  const { fileName, statusId } = JSON.parse(view.private_metadata);
  const values = view.state.values;
  const changesMade = values.changes_made_block?.changes_made?.value || '';
  const status = await getStudyStatusById(statusId);

  if (!status) {
    console.error('Status not found for ID:', statusId);
    return;
  }

  // Send notification to the user who requested changes
  if (status.requested_by) {
    try {
      console.log('Attempting to send notification to user:', status.requested_by);

      // First, verify the user exists and is accessible
      let userInfo;
      try {
        userInfo = await client.users.info({ user: status.requested_by });
        console.log('User info retrieved:', userInfo.user.name);
      } catch (userError) {
        console.error('User not found or not accessible:', status.requested_by, userError.message);
        return; // Exit early if user is not accessible
      }

      // Get the name of the user who completed the changes
      let completerName = '';
      try {
        const completerInfo = await client.users.info({ user: body.user.id });
        completerName = completerInfo.user.real_name || completerInfo.user.name;
      } catch (e) {
        completerName = `<@${body.user.id}>`;
      }

      // Compose the message blocks
      const filePath = status.path;
      const blocks = [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `✅ *${completerName} completed your requested changes*`
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*${status.study_name}* • Iteration #1` // You can adjust iteration logic if needed
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Changes made:* ${changesMade}`
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Files updated:* ${status.file_name}`
          }
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `<${filePath}|📖 View Changes>`
          }
        },
        {
          type: 'actions',
          elements: [
            {
              type: "button",
              text: {
                type: "plain_text",
                text: "✅ Approve"
              },
              style: "primary",
              value: JSON.stringify({ statusId: status.id, studyName: status.study_name, fileName: status.file_name, path: status.path, user: body.user.id }),
              action_id: 'approve_changes',
            },
            {
              type: 'button',
              text: { type: 'plain_text', text: '📝 Request More Changes' },
              value: JSON.stringify({ statusId: status.id }),
              action_id: 'request_more_changes',
            }
          ]
        }
      ];

      // Open DM channel with requested_by user
      const imRes = await client.conversations.open({ users: status.requested_by });
      const channelId = imRes.channel.id;
      await client.chat.postMessage({
        channel: channelId,
        text: `${completerName} completed your requested changes for ${status.study_name}`,
        blocks
      });

      console.log('Notification sent successfully to user:', status.requested_by);
    } catch (error) {
      console.error('Error sending notification:', error);
    }
  } else {
    console.log('No requested_by user found for status:', status.id);
  }
  // Send confirmation message to the user who completed the changes (optional, unchanged)
};

// Approve button handler
const handleApproveChanges = async ({ ack, body, action, client }) => {
  await ack();
  let payload;
  try {
    payload = JSON.parse(action.value);
  } catch (e) {
    return;
  }
  // Call addStudyStatus with status: 'approve'
  await addStudyStatus({
    approved_by: body.user.id,
    status: 'approve',
    file_name: payload.fileName,
  });

  // Notify the user who created the changes (status.created_by)
  const status = await getStudyStatusById(payload.statusId);
  if (status && status.created_by) {
    let approverName = '';
    try {
      const userInfo = await client.users.info({ user: body.user.id });
      approverName = userInfo.user.real_name || userInfo.user.name;
    } catch (e) {
      approverName = `<@${body.user.id}>`;
    }
    const blocks = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `✅ *Your changes have been approved by ${approverName}*`
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${status.study_name}* • File: ${status.file_name}`
        }
      }
    ];
    // Open DM channel with created_by user
    const imRes = await client.conversations.open({ users: status.created_by });
    const channelId = imRes.channel.id;
    await client.chat.postMessage({
      channel: channelId,
      text: `Your changes have been approved by ${approverName}`,
      blocks
    });
  }

  // Optionally, update the message or notify the approver
  // await client.chat.postEphemeral({
  //   channel: body.channel.id,
  //   user: body.user.id,
  //   text: '✅ You have approved the changes.'
  // });
};

module.exports = {
  handleMarkChangesCompleteAction,
  handleMarkChangesCompleteModal,
  handleApproveChanges,
}; 

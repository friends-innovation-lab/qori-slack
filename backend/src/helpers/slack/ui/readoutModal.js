const buildReadoutModal = (state = {}) => {
  console.log("🚀 ~ buildReadoutModal ~ state:", state);

  const selectedStudy = state.selectedStudy || null;
  const reportType = state.reportType || 'research_readout';
  const targetAudience = state.targetAudience || 'Design Team';
  const teamMembers = state.teamMembers || '';
  const timeline = state.timeline || 'Immediate (1-2 weeks)';
  const researchFiles = state.researchFiles || [];

  // Create minimal state for private metadata to avoid size limits
  const minimalState = {
    selectedStudyId: selectedStudy?.id || null,
    reportType,
    targetAudience,
    teamMembers,
    timeline,
    origin: state.origin
  };

  const getReportTypeCards = () => {
    const cards = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Select a Report Type* :bar_chart:'
        }
      },
      {
        type: 'actions',
        block_id: 'report_type_selection',
        elements: [
          {
            type: 'button',
            action_id: 'select_research_readout',
            text: { type: 'plain_text', text: 'Research Readout' },
            style: reportType === 'research_readout' ? 'primary' : undefined,
            value: 'research_readout'
          },
          {
            type: 'button',
            action_id: 'select_targeted_readouts',
            text: { type: 'plain_text', text: 'Targeted Readouts' },
            style: reportType === 'targeted_readouts' ? 'primary' : undefined,
            value: 'targeted_readouts'
          },
          {
            type: 'button',
            action_id: 'select_github_issues',
            text: { type: 'plain_text', text: 'GitHub Issues' },
            style: reportType === 'github_issues' ? 'primary' : undefined,
            value: 'github_issues'
          }
        ]
      }
    ];

    // Add description cards
    cards.push(
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${reportType === 'research_readout' ? 'Research Readout' : reportType === 'targeted_readouts' ? 'Targeted Readouts' : 'GitHub Issues'}*\n${getReportDescription(reportType)}`
        }
      }
    );

    return cards;
  };

  const getReportDescription = (type) => {
    switch (type) {
      case 'research_readout':
        return 'Complete analysis with findings and insights';
      case 'targeted_readouts':
        return '';
      case 'github_issues':
        return 'Actionable development tasks';
      default:
        return '';
    }
  };

  const getTargetedReadoutsConfig = () => {
    if (reportType !== 'targeted_readouts') return [];

    return [
      {
        type: 'input',
        block_id: 'target_audience',
        label: { type: 'plain_text', text: 'Target Audience' },
        element: {
          type: 'static_select',
          action_id: 'target_audience_change',
          placeholder: { type: 'plain_text', text: 'Select target audience...' },
          option_groups: [
            {
              label: { type: 'plain_text', text: 'Team Audiences' },
              options: [
                { text: { type: 'plain_text', text: 'Design Team' }, value: 'Design Team' },
                { text: { type: 'plain_text', text: 'Engineering Team' }, value: 'Engineering Team' },
                { text: { type: 'plain_text', text: 'Content Team' }, value: 'Content Team' },
                { text: { type: 'plain_text', text: 'Product Team' }, value: 'Product Team' },
                { text: { type: 'plain_text', text: 'Accessibility Team' }, value: 'Accessibility Team' }
              ]
            },
            {
              label: { type: 'plain_text', text: 'Stakeholder Audiences' },
              options: [
                { text: { type: 'plain_text', text: 'Executive Leadership' }, value: 'Executive Leadership' },
                { text: { type: 'plain_text', text: 'Product Leadership' }, value: 'Product Leadership' },
                { text: { type: 'plain_text', text: 'Design Leadership' }, value: 'Design Leadership' },
                { text: { type: 'plain_text', text: 'Congressional Briefing' }, value: 'Congressional Briefing' }
              ]
            }
          ],
          initial_option: {
            text: { type: 'plain_text', text: targetAudience },
            value: targetAudience
          }
        }
      },
      // {
      //   type: 'section',
      //   text: {
      //     type: 'mrkdwn',
      //     text: '*TEAM IMPLEMENTATION SETTINGS* :gear:'
      //   }
      // },
      // {
      //   type: 'input',
      //   block_id: 'team_members',
      //   label: { type: 'plain_text', text: 'Team Members to Notify' },
      //   element: {
      //     type: 'multi_static_select',
      //     action_id: 'team_members_input',
      //     placeholder: { type: 'plain_text', text: 'Select team members by role...' },
      //     options: [
      //       { text: { type: 'plain_text', text: 'Stakeholder' }, value: 'stakeholder' },
      //       { text: { type: 'plain_text', text: 'PM' }, value: 'pm' },
      //       { text: { type: 'plain_text', text: 'Tech Lead' }, value: 'tech_lead' },
      //       { text: { type: 'plain_text', text: 'Designer' }, value: 'designer' },
      //       { text: { type: 'plain_text', text: 'Researcher' }, value: 'researcher' }
      //     ]
      //   }
      // },
      // {
      //   type: 'input',
      //   block_id: 'timeline',
      //   label: { type: 'plain_text', text: 'Implementation Timeline' },
      //   element: {
      //     type: 'static_select',
      //     action_id: 'timeline_change',
      //     placeholder: { type: 'plain_text', text: 'Select timeline...' },
      //     options: [
      //       { text: { type: 'plain_text', text: 'Immediate (1-2 weeks)' }, value: 'Immediate (1-2 weeks)' },
      //       { text: { type: 'plain_text', text: 'Short-term (1 month)' }, value: 'Short-term (1 month)' },
      //       { text: { type: 'plain_text', text: 'Medium-term (2-3 months)' }, value: 'Medium-term (2-3 months)' },
      //       { text: { type: 'plain_text', text: 'Long-term (3+ months)' }, value: 'Long-term (3+ months)' }
      //     ],
      //     initial_option: {
      //       text: { type: 'plain_text', text: timeline },
      //       value: timeline
      //     }
      //   }
      // }
    ];
  };


  const getResearchFilesSection = () => {
    if (!researchFiles || researchFiles.length === 0) return [];

    const fileItems = researchFiles.map(file => `• ${file.name}`).join('\n');

    return [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Research Files Detected:*\n${fileItems}`
        }
      }
    ];
  };

  const getSummaryText = () => {
    const reportTypeName = reportType === 'research_readout' ? 'Research Readout' :
      reportType === 'targeted_readouts' ? 'Targeted Readouts' :
        'GitHub Issues';

    let summary = `${reportTypeName} from ${selectedStudy?.name || 'Selected Study'}`;

    if (reportType === 'targeted_readouts') {
      summary += ` (${timeline})`;
    }

    return summary;
  };

  return {
    type: 'modal',
    callback_id: 'readout_modal_submit',
    private_metadata: JSON.stringify(minimalState),
    title: { type: 'plain_text', text: 'Research Reports' },
    submit: { type: 'plain_text', text: 'Generate Report' },
    close: { type: 'plain_text', text: 'Cancel' },
    blocks: [
  
      // Study Selection
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: ':file_folder: *Research Study*'
        }
      },
      {
        type: 'input',
        block_id: 'study_selection',
        label: { type: 'plain_text', text: 'Study' },
        element: {
          type: 'static_select',
          action_id: 'study_selection_change',
          placeholder: { type: 'plain_text', text: 'Choose a research study...' },
          options: (state.availableStudies || []).slice(0, 10).map(study => ({
            text: { type: 'plain_text', text: study.name },
            value: study.id.toString()
          })),
          initial_option: selectedStudy ? {
            text: { type: 'plain_text', text: selectedStudy.name },
            value: selectedStudy.id.toString()
          } : undefined
        }
      },

      // Research Files Section
      ...getResearchFilesSection(),

      // Report Type Selection
      ...getReportTypeCards(),

      // Targeted Readouts Configuration
      ...getTargetedReadoutsConfig(),

      // Summary (only for Research Readout and GitHub Issues)
      ...(reportType !== 'targeted_readouts' ? [
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: '📄 *Research Readout* — Complete findings and insights\n🎯 *Targeted Readouts* — Audience-specific summaries\n🐙 *GitHub Issues* — Create issues from findings'
            }
          ]
        }
      ] : [])
    ]
  };
};

module.exports = { buildReadoutModal };

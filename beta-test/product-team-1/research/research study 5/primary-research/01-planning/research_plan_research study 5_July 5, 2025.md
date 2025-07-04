id: research_plan
name: run_research_plan
label: 🧭 Research Plan
version: v2.0
description: |
  Generate comprehensive VA-aligned research plans for civic tech studies. Creates structured research plans with timelines, methodology, recruitment strategy, and success criteria following VA research standards and organizational priorities.

author: CivicMind R&D
created: 2025-06-26
last_updated: 2025-07-02

input_type: structured
input_processing: direct
temperature: 0.4
precision_mode: concise | detailed

input_variables:
  - project_title        # Project title from UI (REQUIRED)
  - product_area         # Product/Feature area from UI (REQUIRED)
  - decision_context     # What decision will this research inform? (REQUIRED)
  - research_goal        # Primary research goal from UI (REQUIRED)
  - methodology          # Selected methodologies from checkboxes (REQUIRED)
  - target_participants  # Target participants description (REQUIRED)
  - participant_count    # Number of participants (REQUIRED)
  - timeline_preference  # Rush/Standard/Extended from radio buttons (REQUIRED)
  - lead_researcher      # Lead researcher name (REQUIRED)
  - team_office          # Team/Office from UI (REQUIRED)

# Auto-generated/computed variables
auto_variables:
  - timeline_dates: |
      # AI calculates specific dates based on timeline_preference and current_date
      # Rush: Planning(3d), Recruiting(5d), Interviews(5d), Synthesis(3d), Reporting(2d)
      # Standard: Planning(5d), Recruiting(10d), Interviews(10d), Synthesis(5d), Reporting(5d)  
      # Extended: Planning(10d), Recruiting(21d), Interviews(14d), Synthesis(10d), Reporting(7d)
      calculate_timeline_dates(timeline_preference, current_date)
  - recruitment_strategy: |
      # AI suggests recruitment approach based on target_participants
      suggest_recruitment_strategy(target_participants) || "Perigean recruitment panel and screener survey"
  - methodology_details: |
      # AI expands on selected methodology with implementation details
      expand_methodology_details(methodology) || "Detailed methodology implementation"
  - success_criteria: |
      # AI generates success criteria based on research_goal and methodology
      generate_success_criteria(research_goal, methodology) || "Clear, measurable success criteria"
  - current_date: |
      # Auto-generate current date
      new Date().toLocaleDateString('en-US', {year: 'numeric', month: 'long', day: 'numeric'})
  - github_file_link: |
      # Auto-generate based on project title and date
      generate_github_link(project_title, current_date) || null

# Output configuration
output_options:
  default_delivery: "file_only"
  slack_format: "notification_only"
  file_location: "01-planning/"
  file_name: "research_plan_research study 5_July 5, 2025.md"

slack_output:
  post_in_channel: false
  create_thread: false
  send_notification: true
  title_format: "🧭 Research Plan Created"
  ping_team: ["research study 5"]
  interactive_elements:
    - text: "🧭 View Plan"
      url: ""
    - text: "💬 Create Discussion Guide"
      action: "run_discussion_guide"

output_use: |
  CivicMind Research Plan generator creates comprehensive VA-compliant research plans with detailed timelines, methodology, and recruitment strategies. Ensures proper planning and stakeholder alignment for successful research execution.

  Use this method to:
    - Generate structured research plans following VA standards
    - Plan realistic timelines and resource allocation
    - Define clear methodology and participant requirements
    - Align teams on research goals and success criteria
    - Document recruitment strategy and logistics

output_notes: |
  Project details collected via structured form input from research planning UI.
  Timeline dates () calculated based on standard selection.
  Recruitment strategy () determined from research study 5 specifications.
  Plan follows VA research standards including organizational priorities and trauma-informed considerations.
  Write in clear, professional language accessible to stakeholders.
  Include realistic timelines and actionable planning details.

output_format: |
  # 🧭 Research Plan – research study 5

  **📦 Product/Feature Area:** research study 5  
  **🏛️ Team/Office:** research study 5  
  **👩🏽‍🔬 Lead Researcher:** research study 5  
  **🗓️ Date:** July 5, 2025

  ---

  ## 🔎 Background  
  research study 5

  ## 🎯 Organizational Priorities  
  

  ## 🧭 Veteran/User Journey  
  

  ## 🎓 Research Goals  
  research study 5

  

  ## ❓ Research Questions  
  

  ## 🧪 Hypotheses  
  

  ## 🛠️ Methodology  
  concept,interviews

  

  ## 🧲 Recruitment Plan  

  **🎯 Target Participants:** research study 5

  **📋 Recruitment Strategy:** 

  **📅 Recruitment Timeline:**
  

  **🧍 Participant Count:** research study 5

  ## ⏰ Timeline Overview
  

  ## 👥 Team Roles
  | Team Member      | Role               |
  |------------------|--------------------|
  | research study 5 | Lead Researcher |
  | [To be assigned] | Note-taker         |
  | [To be assigned] | Observer           |

  ## 🧰 Tools & Platforms  
  

  ## ✅ Success Criteria  
  

  ## 📦 Output Artifacts  
  

prompt: |
  You are a senior UX researcher experienced in creating comprehensive VA-compliant research plans for government service design.

  STRUCTURED INPUT DATA:
  - Project: research study 5
  - Product area: research study 5
  - Team/Office: research study 5
  - Lead researcher: research study 5
  - Decision context: research study 5
  - Research goal: research study 5
  - Methodology: concept,interviews
  - Target participants: research study 5
  - Participant count: research study 5
  - Timeline preference: standard

  Using this structured input data, generate comprehensive content for:

  1. **Organizational Priorities** - Alignment with VA/OCTO goals relevant to research study 5
  2. **User Journey Context** - How research study 5 fits in end-to-end user experience for research study 5
  3. **Additional Goals** - 2-3 supporting goals based on concept,interviews and research study 5
  4. **Research Questions** - 3-4 specific questions based on research study 5 and research study 5
  5. **Research Hypotheses** - 2-3 testable hypotheses based on research questions and concept,interviews
  6. **Methodology Details** - Specific implementation details for concept,interviews
  7. **Recruitment Timeline Table** - Based on standard settings:
     - Rush: 5 days recruiting
     - Standard: 10 days recruiting  
     - Extended: 21 days recruiting
  8. **Timeline Dates** - Calculate actual dates from July 5, 2025 using standard:
     - Rush: Planning(3d), Recruiting(5d), Interviews(5d), Synthesis(3d), Reporting(2d)
     - Standard: Planning(5d), Recruiting(10d), Interviews(10d), Synthesis(5d), Reporting(5d)
     - Extended: Planning(10d), Recruiting(21d), Interviews(14d), Synthesis(10d), Reporting(7d)
  9. **Tools and Platforms** - Specific tools based on concept,interviews selections
  10. **Output Artifacts** - Realistic deliverables based on concept,interviews and research study 5

  Requirements:
  - Calculate actual calendar dates from July 5, 2025 using business days only
  - Follow VA research standards and organizational priorities
  - Use plain, professional language accessible to stakeholders
  - Include realistic timelines and resource considerations
  - Consider trauma-informed design principles where relevant
  - Format timeline tables using Markdown table syntax

  Write in clear, directive language that guides successful research execution while ensuring stakeholder alignment.

notify:
  - role: research_team
    action: "Research plan created"
    channel: "#research-planning"
    message: "🧭 Research plan for research study 5 has been created and saved. standard timeline with concept,interviews methodology planned."
  - role: researcher
    action: "Plan ready for execution"
    slack_tag: "research study 5"
    message: "Your research plan has been saved to the planning folder and is ready for team review and execution."

id: research_brief
name: run_research_brief
label: 📄 Research Brief
version: v2.0
description: |
  Generate VA-aligned research briefs for scoping studies with design and product partners. Creates structured research briefs with objectives, hypotheses, and methodology following VA research standards and government service considerations.

author: CivicMind R&D
created: 2025-06-26
last_updated: 2025-07-02

input_type: text
input_processing: summarize_if_long
temperature: 0.4
precision_mode: concise | detailed

input_variables:
  - project_title        # Project Title/Focus from UI (REQUIRED)
  - study_context        # Study context and motivation from UI (REQUIRED)
  - target_barriers      # Target barriers to identify from UI (REQUIRED)
  - user_flows           # User flows/touchpoints to evaluate from UI (REQUIRED)
  - stakeholders         # Stakeholders consulted from UI (REQUIRED)
  - research_approach    # Research approach from UI (REQUIRED)
  - prepared_by          # Prepared by from UI (REQUIRED)

# Auto-generated/computed variables
auto_variables:
  - project_scope: |
      # AI identifies broader project scope from title and context
      identify_project_scope(project_title, study_context) || "Digital Services"
  - design_improvements: |
      # AI generates specific design improvements from barriers and flows
      generate_design_improvements(target_barriers, user_flows) || "Improve user experience and reduce friction"
  - trauma_informed_considerations: |
      # AI creates VA-relevant trauma-informed considerations
      generate_trauma_considerations(study_context, target_barriers) || "Consider veteran mental health and accessibility needs"
  - research_hypotheses: |
      # AI generates testable hypotheses from barriers and approach
      generate_hypotheses(target_barriers, research_approach) || "Research hypotheses based on identified barriers"
  - framing_questions: |
      # AI creates specific research questions from approach and barriers
      generate_framing_questions(research_approach, target_barriers, user_flows) || "Specific research questions to guide investigation"
  - methodology_details: |
      # AI expands on research approach with implementation details
      expand_methodology_details(research_approach) || "Detailed methodology implementation"
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
  file_name: "research_brief__July 4, 2025.md"

slack_output:
  post_in_channel: false
  create_thread: false
  send_notification: true
  title_format: "📄 Research Brief Created"
  ping_team: ["research study 5"]
  interactive_elements:
    - text: "📄 View Brief"
      url: ""
    - text: "🧭 Create Research Plan"
      action: "run_research_plan"

output_use: |
  CivicMind Research Brief generator creates VA-compliant research scoping documents for stakeholder alignment. Ensures consistent structure and coverage of key research elements while supporting trauma-informed design principles.

  Use this method to:
    - Generate structured research briefs following VA standards
    - Align stakeholders on research objectives and scope
    - Document research hypotheses and framing questions
    - Plan research approach and methodology
    - Support trauma-informed service design considerations

output_notes: |
  Project details collected via structured form input from research brief UI.
  Project scope () determined from title and context analysis.
  Design improvements () generated from barriers and flow specifications.
  Brief follows VA research standards including trauma-informed design considerations.
  Write in plain, accessible language at 10th-grade reading level.
  Keep focused and actionable for design and product partners.

output_format: |
  # 📄 Research Brief – 

  **📦 Project Area:**   
  **👩🏽‍🔬 Prepared by:** research study 5  
  **🗓️ Date:** July 4, 2025

  ---

  ## Overview

  research study 5

  ## Objectives

  1. **Identify Barriers:**  
     research study 5

  2. **Evaluate Navigation Experience:**  
     research study 5

  3. **Surface Insights for Design & Content Improvements:**  
     

  4. **Support Trauma-Informed Service Design:**  
     

  ---

  ## Initial Scoping Materials

  - **Stakeholders Consulted:**  
    research study 5

  - **Initial Hypotheses:**  
    

  - **Framing Questions:**  
    

  - **Research Approach Summary:**  
    research study 5
    
    

prompt: |
  You are a senior UX researcher experienced in creating VA-compliant research briefs for government service design.

  STRUCTURED INPUT DATA:
  - Project title: 
  - Study context: research study 5
  - Target barriers: research study 5
  - User flows: research study 5
  - Stakeholders: research study 5
  - Research approach: research study 5
  - Prepared by: research study 5

  Using this structured input data, generate comprehensive content for:

  1. **Project Scope** - Broader project scope identification from  and research study 5
  2. **Design Improvements** - Specific improvements this research will inform based on research study 5 and research study 5
  3. **Trauma-Informed Considerations** - VA-relevant considerations for veteran experiences based on research study 5 and research study 5
  4. **Research Hypotheses** - 2-3 testable hypotheses based on research study 5 and research study 5
  5. **Framing Questions** - 3-4 specific research questions based on research study 5, research study 5, and research study 5
  6. **Methodology Details** - Expanded details on research study 5 with specific implementation methods

  Requirements:
  - Follow VA research standards and trauma-informed design principles
  - Use plain, accessible language at 10th-grade reading level
  - Focus on actionable outcomes for design and product partners
  - Consider veteran experiences, mental health impacts, and equitable access
  - Avoid business jargon, em-dashes, and complex language
  - Connect research to specific service improvements based on the provided barriers and flows

  Write in clear, professional language that helps stakeholders understand research value and scope.

notify:
  - role: research_team
    action: "Research brief created"
    channel: "#research-planning"
    message: "📄 Research brief for  has been created and saved. Ready for stakeholder review and planning phase."
  - role: researcher
    action: "Brief ready for review"
    slack_tag: "research study 5"
    message: "Your research brief has been saved to the planning folder and is ready for stakeholder review."

# YAML Template Variable Audit

**Date:** 2026-04-24
**Scope:** All 26 YAML templates in `beta-test/YAML Templates/` cross-referenced against their JavaScript handlers in `backend/src/`

## Executive Summary

| Category | Count |
|----------|-------|
| Templates audited | 26 |
| Clean (no issues) | 5 |
| Critical mismatches (breaks output or crashes) | 14 |
| Minor issues (dead keys only) | 4 |
| Orphaned (no JS handler) | 3 |

### Critical issues by type

| Issue type | Templates affected |
|------------|-------------------|
| Fatal: wrong YAML key causes crash or silent skip | 2 (usability_issues_extractor, session_notes) |
| `selected_study` vs `study_folder` naming mismatch | 7 (all synthesis sub-templates + desk_research) |
| `current_date` missing from AI prompt context | 6 (research_plan, service_blueprint, stakeholder_synthesis, stakeholder_interview_guide, survey_synthesis, journey_mapping) |
| Variables referenced in YAML but never provided by JS | 12 templates |
| Variables provided by JS but never referenced in YAML | 8 templates |

---

## Fatal / Structural Issues

### usability_issues_extractor.yaml

**Template:** `beta-test/YAML Templates/usability_issues_extractor.yaml`
**JS handler:** `backend/src/helpers/slack/commands/researchSynthesisHandler.js`

**Problem:** Uses `slack_output_template` (line 360) instead of `output_template`. The `yamlProcessor.js:30` checks for `output_template` and throws `'Missing output_template in YAML configuration'`. This template crashes at runtime.

**Missing variables (YAML references, JS doesn't provide):**

| Variable | YAML lines | Notes |
|----------|-----------|-------|
| `selected_study` | 117, 133, 160, 226, 265, 363, 407 | JS provides `study_folder` instead (researchSynthesisHandler.js:606) |
| `focus_area` | 134, 161, 227, 410 | Never provided by any handler |
| `include_participant_notes` | 121 | Never provided |
| `include_raw_transcripts` | 122 | Never provided |
| `discovered_files` | 124 | Never provided |
| `quality_assessment` | input_variables line 56 | Never provided |
| `researcher_contact` | github_file_template line 409 | Never provided |
| `study_channel` | github_file_template line 479 | Never provided |
| `analysis_version` | github_file_template line 411 | Never provided |
| `num_issues` | slack_output_template line 364 | Never provided |
| `severity_overview` | slack_output_template line 364 | Never provided |
| `github_file_link` | slack_output_template line 397 | Never provided |

**Dead keys (JS provides, YAML doesn't reference):**

| Variable | JS line |
|----------|---------|
| `study_folder` | researchSynthesisHandler.js:606 |
| `selected_session_summaries` | researchSynthesisHandler.js:607 |
| `selected_transcripts` | researchSynthesisHandler.js:608 |
| `selected_stakeholder_guides` | researchSynthesisHandler.js:609 |
| `include_participant_tracker` | researchSynthesisHandler.js:610 |

---

### session_notes.yaml

**Template:** `beta-test/YAML Templates/session_notes.yaml`
**JS handler:** `backend/src/helpers/slack/commands/sessionNotesHandler.js`

**Problem:** Uses `ai_processing_tasks` (line 77) instead of `ai_generation_tasks`. The `yamlProcessor.js:36` checks for `ai_generation_tasks`, so AI structuring is silently skipped. Raw user text passes through unprocessed.

**Missing variables (YAML references, JS doesn't provide):**

| Variable | YAML lines | Notes |
|----------|-----------|-------|
| `filename` | 209, 232 | Referenced in output_template, renders empty |
| `github_file_url` | 256, 270 | Referenced in output_template, renders empty |

**Dead keys (JS provides, YAML doesn't reference):**

| Variable | JS line |
|----------|---------|
| `participant_name` | sessionNotesHandler.js:232 |
| `session_time` | sessionNotesHandler.js:235 |
| `study_name` | sessionNotesHandler.js:238 |
| `participant_id` | sessionNotesHandler.js:239 |

---

### current_date not passed to AI prompts (systemic)

**Root cause:** `yamlProcessor.js:16` injects `current_date` into Handlebars context for `output_template` rendering, but does NOT add it to `inputValues` passed to `executeAiGenerationTasks` (`langchain.js`). Any YAML that uses `{{current_date}}` inside a prompt string gets empty/undefined.

**Affected templates:**

| Template | YAML lines using current_date in prompts |
|----------|------------------------------------------|
| `research_plan.yaml` | 317, 318 |
| `service_blueprint.yaml` | 318 |
| `stakeholder_synthesis.yaml` | 685 |
| `stakeholder_interview_guide.yaml` | 316 |
| `survey_synthesis.yaml` | 177, 307 |
| `journey_mapping.yaml` | github_file_template only |

---

## Synthesis Sub-Templates (shared root cause)

All synthesis sub-templates are routed through `researchSynthesisHandler.js:604-615`, which provides:

```
study_folder, selected_session_summaries, selected_transcripts,
selected_stakeholder_guides, include_participant_tracker,
include_research_plan, combined_file_content
```

Every sub-template expects `selected_study` (not `study_folder`) plus template-specific variables that the handler never provides. `selected_session_summaries`, `selected_transcripts`, `selected_stakeholder_guides`, and `include_participant_tracker` are dead keys across all synthesis YAMLs.

### affinity_mapping.yaml

**Template:** `beta-test/YAML Templates/affinity_mapping.yaml`
**JS handler:** `backend/src/helpers/slack/commands/researchSynthesisHandler.js` (line 620)

**Missing variables:**

| Variable | YAML lines | Notes |
|----------|-----------|-------|
| `selected_study` | 128 | JS provides `study_folder` instead (line 606) |
| `focus_area` | 129 | Never provided |
| `discovered_files` | input_variables line 51 | Never provided |
| `quality_assessment` | input_variables line 53 | Never provided |
| `include_participant_notes` | input_variables line 49 | Never provided |
| `include_raw_transcripts` | input_variables line 50 | Never provided |
| `researcher_contact` | github_file_template line 293 | Never provided |
| `study_channel` | github_file_template line 294 | Never provided |

---

### journey_mapping.yaml

**Template:** `beta-test/YAML Templates/journey_mapping.yaml`
**JS handler:** `backend/src/helpers/slack/commands/researchSynthesisHandler.js` (line 621)

**Missing variables:**

| Variable | YAML lines | Notes |
|----------|-----------|-------|
| `selected_study` | 119, 213, github_file_template 350 | JS provides `study_folder` instead |
| `focus_area` | 214 | Never provided |
| `include_participant_notes` | 122 | Never provided |
| `include_raw_transcripts` | 123 | Never provided |
| `discovered_files` | 125, github_file_template 368 | Never provided |
| `quality_assessment` | input_variables line 56 | Never provided |
| `analysis_version` | github_file_template line 352 | Never provided |
| `researcher_contact` | github_file_template line 385 | Never provided |
| `study_channel` | github_file_template line 386 | Never provided |

---

### service_blueprint.yaml

**Template:** `beta-test/YAML Templates/service_blueprint.yaml`
**JS handler:** `backend/src/helpers/slack/commands/researchSynthesisHandler.js` (line 626)

**Missing variables:**

| Variable | YAML lines | Notes |
|----------|-----------|-------|
| `selected_study` | 184, 192 | JS provides `study_folder` instead |
| `blueprint_scope` | 185 | Never provided |
| `include_user_research` | input_variables line 37 | Never provided |
| `include_stakeholder_research` | input_variables line 38 | Never provided |
| `include_journey_map` | input_variables line 39 | Never provided |
| `discovered_files` | input_variables line 41 | Never provided |
| `current_date` (in prompt) | 318 | See systemic issue above |

---

### persona_generator.yaml

**Template:** `beta-test/YAML Templates/persona_generator.yaml`
**JS handler:** `backend/src/helpers/slack/commands/researchSynthesisHandler.js` (line 409)

**Missing variables:**

| Variable | YAML lines | Notes |
|----------|-----------|-------|
| `selected_study` | 123 | JS provides `study_folder` instead (line 606) |
| `include_participant_notes` | input_variables line 44 | Never provided |
| `include_raw_transcripts` | input_variables line 45 | Never provided |
| `discovered_files` | input_variables line 46 | Never provided |

---

### jobs_to_be_done.yaml

**Template:** `beta-test/YAML Templates/jobs_to_be_done.yaml`
**JS handler:** `backend/src/helpers/slack/commands/researchSynthesisHandler.js` (line 409)

**Missing variables:**

| Variable | YAML lines | Notes |
|----------|-----------|-------|
| `selected_study` | 134, 142 | JS provides `study_folder` instead |
| `focus_area` | 135 | Never provided; defined in YAML `study_metadata` but backend doesn't resolve it |
| `include_participant_notes` | input_variables line 48 | Never provided |
| `include_raw_transcripts` | input_variables line 49 | Never provided |
| `discovered_files` | input_variables line 50 | Never provided |
| `quality_assessment` | input_variables line 52 | Never provided |

---

### design_opportunity_generator.yaml

**Template:** `beta-test/YAML Templates/design_opportunity_generator.yaml`
**JS handler:** `backend/src/helpers/slack/commands/researchSynthesisHandler.js` (line 409)

**Missing variables:**

| Variable | YAML lines | Notes |
|----------|-----------|-------|
| `selected_study` | 152, 159 | JS provides `study_folder` instead |
| `include_session_summaries` | input_variables line 47 | Never provided |
| `include_transcripts` | input_variables line 48 | Never provided |
| `include_existing_analysis` | input_variables line 49 | Never provided |
| `discovered_files` | input_variables line 50 | Never provided |

---

## Other Templates With Mismatches

### research_plan.yaml

**Template:** `beta-test/YAML Templates/research_plan.yaml`
**JS handler:** `backend/src/helpers/slack/events.js:1480`

**Missing variables:**

| Variable | YAML lines | Notes |
|----------|-----------|-------|
| `timeline_date` | 298 | Prompt says "TODAY'S DATE IS: {{timeline_date}}" — renders empty |
| `current_date` (in prompt) | 317, 318 | See systemic issue; only injected for output_template |

**Dead keys (JS provides, YAML doesn't reference):**

| Variable | JS line |
|----------|---------|
| `session_duration` | events.js:1497 |
| `incentive` | events.js:1498 |
| `start_date` | events.js:1501 |
| `researcher_title` | events.js:1506 |
| `researcher_email` | events.js:1507 |

---

### desk_research.yaml

**Template:** `beta-test/YAML Templates/desk_research.yaml`
**JS handler:** `backend/src/helpers/slack/events.js:2864`

**Worst non-synthesis template.** JS only passes `research_topic` and `document_content` (lines 2865-2866) out of 5+ needed variables.

**Missing variables:**

| Variable | YAML lines | Notes |
|----------|-----------|-------|
| `selected_study` | 99, 139, 333, 347 | Never provided |
| `study_name` | input_variables line 53 | Never provided |
| `effective_topic` | 100, 124, 141, 186, 240, 331, 347 | Defined as derived_variable (line 83) but backend doesn't resolve derived_variables |
| `description` | 101, 350 | Extracted from modal at events.js:2813 but not passed to YAML processor |

---

### research_request.yaml

**Template:** `beta-test/YAML Templates/research_request.yaml`
**JS handler:** `backend/src/helpers/slack/commands/requestResearchHandler.js:74`

**Missing variables:**

| Variable | YAML lines | Notes |
|----------|-----------|-------|
| `requestor_name` | output_template line 163 | JS provides `prepared_by` instead (line 82). YAML has `auto_populate: "slack_profile.name"` but backend doesn't implement auto_populate |

**Dead keys:**

| Variable | JS line |
|----------|---------|
| `prepared_by` | requestResearchHandler.js:82 |
| `requestedBy` | requestResearchHandler.js:83 |
| `channelId` | requestResearchHandler.js:84 |
| `timelineNeeded` | requestResearchHandler.js:86 |

---

### stakeholder_synthesis.yaml

**Template:** `beta-test/YAML Templates/stakeholder_synthesis.yaml`
**JS handler:** `backend/src/helpers/slack/events.js:2526`

**Missing variables:**

| Variable | YAML lines | Notes |
|----------|-----------|-------|
| `study_name` | 135, 145, 275, 470, 589 | JS provides `selected_study` instead (line 2527). Name mismatch — all 4 prompt tasks reference `study_name` |
| `current_date` (in prompt) | 685 | See systemic issue |
| `study_channel` | input_variables line 49 | Never provided |
| `researcher_contact` | input_variables line 53 | Never provided |
| `team_members` | input_variables line 57 | Never provided |
| `stakeholder_files` | input_variables line 64 | Never provided |
| `discovered_files` | input_variables line 67 | Never provided |

---

### stakeholder_interview_guide.yaml

**Template:** `beta-test/YAML Templates/stakeholder_interview_guide.yaml`
**JS handler:** `backend/src/helpers/slack/events.js:2329`

**Missing variables:**

| Variable | YAML lines | Notes |
|----------|-----------|-------|
| `user_findings` | 186, 214-217, 258-269 | JS merges `userFindings` into `research_questions` (line 2336: `researchQuestions \|\| userFindings \|\| ''`). The YAML's `{% if user_findings %}` conditional blocks never trigger |
| `current_date` (in prompt) | 316 | See systemic issue |
| `study_channel` | input_variables line 40 | Never provided |
| `researcher_contact` | input_variables line 44 | Never provided |
| `team_members` | input_variables line 48 | Never provided |

**Dead keys:**

| Variable | JS line |
|----------|---------|
| `known_constraints` | events.js:2335 |
| `study_name` | events.js:2340 (declared in input_variables but not used in prompts or output) |

---

### survey_synthesis.yaml

**Template:** `beta-test/YAML Templates/survey_synthesis.yaml`
**JS handler:** `backend/src/helpers/slack/events.js:2722`

**Missing variables:**

| Variable | YAML lines | Notes |
|----------|-----------|-------|
| `current_date` (in prompt) | 177, 307 | See systemic issue |

**Dead keys:**

| Variable | JS line |
|----------|---------|
| `survey_files` | events.js:2727 |

---

### session_summary.yaml

**Template:** `beta-test/YAML Templates/session_summary.yaml`
**JS handler:** `backend/src/helpers/slack/commands/analyzeNotesHandler.js:164`

**Missing variables:**

| Variable | YAML lines | Notes |
|----------|-----------|-------|
| `session_date` | 120, 162, 443 | Never provided by JS |

**Dead keys:**

| Variable | JS line |
|----------|---------|
| `study_folder` | analyzeNotesHandler.js:165 |
| `session_name` | analyzeNotesHandler.js:167 |
| `selected_note_files` | analyzeNotesHandler.js:168 |
| `note_takers` | analyzeNotesHandler.js:171 |

---

### transcript_upload.yaml

**Template:** `beta-test/YAML Templates/transcript_upload.yaml`
**JS handler:** `backend/src/helpers/slack/commands/sessionNotesHandler.js:286`

**Missing variables:**

| Variable | YAML lines | Notes |
|----------|-----------|-------|
| `filename` | 239 | Never provided |
| `folder_context` | 240 | Never provided |
| `upload_date_utc` | 241 | Never provided |
| `transcript_source` | 242 | Defined in YAML `input_tabs` schema but not injected by JS |
| `manual_notes_text_or_blank` | 245 | Only provided for paste-text path (line 296), missing for file-upload path |

---

### participant_tracker.yaml

**Template:** `beta-test/YAML Templates/participant_tracker.yaml`
**JS handler:** `backend/src/helpers/slack/commands/participantHandler.js` (via participantYamlProcessor)

**Missing variables:**

| Variable | YAML lines | Notes |
|----------|-----------|-------|
| `session_observers` | 203 | participantYamlProcessor always passes `[]` (line 504) — observer table always empty |
| `observer_role` | 204 | Observer objects have `observers` (comma-joined string), not separate `observer_role` field |

---

### participant_status_update.yaml

**Template:** `beta-test/YAML Templates/participant_status_update.yaml`
**JS handler:** None at runtime

**Problem:** JS handler (`participantHandler.js:396`) uses `participant_tracker.yaml` instead. This YAML is never loaded. Also has invalid YAML syntax after line 137 (prose documentation appended).

---

### participant_outreach.yaml

**Template:** `beta-test/YAML Templates/participant_outreach.yaml`
**JS handler:** `backend/src/helpers/slack/commands/participantOutreachHandler.js` (multiple submit handlers)

Core input_variables are correctly wired. Issues are in `auto_fill_variables` that the backend never resolves:

**Missing variables:**

| Variable | YAML lines | Notes |
|----------|-----------|-------|
| `researcher_title` | 172 | YAML `auto_fill_variables` says source is `study.researcher.title` — never implemented |
| `session_duration` | 175 | YAML `auto_fill_variables` says default "45 minutes" — never implemented |
| `study_description` | 171 | Hardcoded to `""` in initial_recruitment handler (line 269), not provided by other handlers |
| `incentive_amount` | 174, 189, 243, 253 | Hardcoded to `""` in initial_recruitment (line 270) and thank_you (line 632), not provided by other handlers |

**Slack rendering issue:** Output_template uses `**bold**` markdown (lines 272, 274, 275) which renders as literal asterisks in Slack's mrkdwn format (Slack uses single `*` for bold).

**Dead keys (JS provides, YAML doesn't reference):**

| Variable | JS lines | Notes |
|----------|----------|-------|
| `tone` | participantOutreachHandler.js:267 | initial_recruitment only |
| `contact_method` | participantOutreachHandler.js:268 | initial_recruitment only |
| `study_id` | various handlers | All handlers |
| `researcher_phone` | participantOutreachHandler.js:266 | initial_recruitment only |
| `participant_name` | participantOutreachHandler.js (thank_you, follow_up) | |

---

### targeted_readouts.yaml

**Template:** `beta-test/YAML Templates/targeted_readouts.yaml`
**JS handler:** `backend/src/helpers/slack/commands/readoutHandler.js:360`

**Missing variables:**

| Variable | YAML lines | Notes |
|----------|-----------|-------|
| `congressional_mandate` | 144 | Only affects congressional briefing format |
| `oversight_committee` | 145, 189 | Only affects congressional briefing format |
| `participant_count` | 301 and others | Defined in YAML `auto_variables` (line 79) but backend doesn't resolve auto_variables |
| `session_count` | 301 and others | Same as above |

**Dead keys:**

| Variable | JS line |
|----------|---------|
| `detected_files` | readoutHandler.js:367 |

---

### github_issues_generator.yaml

**Template:** `beta-test/YAML Templates/github_issues_generator.yaml`
**JS handler:** `backend/src/helpers/slack/commands/readoutHandler.js:360`

**Missing variables:**

| Variable | YAML lines | Notes |
|----------|-----------|-------|
| `github_repository` | 114, 301 | Never provided — repository name empty in prompt and output |
| `max_issues` | 117 | Never provided |
| `github_repo_url` | output_template line 305 | Defined in YAML `auto_variables` (line 79) but never resolved — "View Issues" link broken |

**Dead keys:**

| Variable | JS line |
|----------|---------|
| `research_folder_path` | readoutHandler.js:362 |
| `input_text` | readoutHandler.js:367 |
| `detected_files` | readoutHandler.js:368 |
| `study_link` | readoutHandler.js:369 |

---

## Orphaned Templates

| Template | Notes |
|----------|-------|
| `synthesize_router.yaml` | No JS handler references it. Planned routing feature never implemented. |
| `participant_status_update.yaml` | JS handler uses `participant_tracker.yaml` instead. Invalid YAML after line 137. |
| `observer_request.yaml` | Uses incompatible structure (`prompt:`/`output_format:` instead of `ai_generation_tasks`/`output_template`). JS handles observers inline. |

---

## Clean Templates

| Template | JS Handler | Notes |
|----------|-----------|-------|
| `research_brief.yaml` | `events.js:1713` | All variables match |
| `discussion_guide.yaml` | `events.js:2024` | All variables match (JS sends backward-compat extras but harmless) |
| `research_readout.yaml` | `readoutHandler.js:360` | All variables match |
| `observer_request.yaml` | N/A | Never processed through YAML pipeline — handled inline |
| `session_notes.yaml` | `sessionNotesHandler.js:230` | Would be clean IF `ai_processing_tasks` key were fixed |

---

## Suggested Fix Order

Ordered by impact and correlation with known ALPHA_POLISH bugs.

### 1. Fix `usability_issues_extractor.yaml` key name (CRITICAL)

Rename `slack_output_template` to `output_template` at line 360. Currently crashes at runtime.

**Correlates with ALPHA_POLISH bug:** "/qori-synthesis: Usability Issues section doesn't generate"

### 2. Fix `session_notes.yaml` key name (CRITICAL)

Rename `ai_processing_tasks` to `ai_generation_tasks` at line 77. Currently silently skips AI processing.

### 3. Inject `current_date` into AI prompt inputValues (SYSTEMIC)

In `yamlProcessor.js`, add `current_date` to the `inputValues` object passed to `executeAiGenerationTasks`, not just the output_template Handlebars context. Single fix addresses 6 templates.

**Correlates with ALPHA_POLISH bug:** "Generation dates on synthesis files (affinity mapping, etc.) are incorrect"

### 4. Fix `selected_study` vs `study_folder` in researchSynthesisHandler.js (SYSTEMIC)

Rename `study_folder` to `selected_study` at `researchSynthesisHandler.js:606`. Single fix addresses 7 synthesis templates.

**Correlates with ALPHA_POLISH bug:** "/qori-synthesis: Usability Issues section doesn't generate" and "Service blueprint modal doesn't pull stakeholder notes" — the LLM is missing the study name context in every synthesis call.

### 5. Wire date inputs into `research_plan.yaml`

Add `start_date`, `end_date`, `key_milestones` (already extracted by JS at events.js:1501, 1502, 1503) as references in the YAML template. Also provide `timeline_date` or alias it to `current_date`.

**Correlates with ALPHA_POLISH bug:** "Project Timeline in Research Plan doesn't read from the date inputs in the modal"

### 6. Fix `service_blueprint.yaml` stakeholder_notes

Provide `stakeholder_notes` (and `blueprint_scope`, `touchpoints`, `backend_systems`) from the synthesis handler, or restructure the template to work with `combined_file_content` alone.

**Correlates with ALPHA_POLISH bug:** "Service blueprint modal in /qori-synthesis doesn't pull stakeholder notes"

### 7. Add `session_duration` to follow-up modal and handler

Add a duration input field to `config/modals/outreach/follow-up-modal.json` and pass `session_duration` from `participantOutreachHandler.js`. The YAML template expects it at line 175.

**Correlates with ALPHA_POLISH bug:** "Follow-up message modal missing a duration button — results in placeholder text being inserted"

### 8. Fix `participant_outreach.yaml` output_template bold rendering

Convert `**bold**` to `*bold*` in output_template lines 272, 274, 275 for Slack mrkdwn compatibility, or post-process output based on destination.

**Correlates with ALPHA_POLISH bug:** "Email output contains ** markdown bolds that should be stripped for plain text email clients"

### 9. Fix `desk_research.yaml` variable pass-through

`events.js:2864` only passes 2 variables. Need to also pass `selected_study`, `description` (already extracted at line 2813), and compute `effective_topic` (or remove derived_variables and use `research_topic` directly in the YAML).

### 10. Fix `stakeholder_synthesis.yaml` name mismatch

YAML prompts reference `study_name` but JS provides `selected_study`. Either rename in YAML or provide both from JS at events.js:2526.

### 11. Fix `research_request.yaml` requestor_name

JS provides `prepared_by` (requestResearchHandler.js:82) but YAML output_template references `requestor_name` (line 163). Pick one name.

### 12. Fix `stakeholder_interview_guide.yaml` user_findings

JS merges `userFindings` into `research_questions` at events.js:2336. Provide `user_findings` as a separate key so the YAML's `{% if user_findings %}` blocks can trigger.

### 13. Fix `session_summary.yaml` session_date

Add `session_date` to the variables object in `analyzeNotesHandler.js:164`.

### 14. Fix `transcript_upload.yaml` metadata variables

Provide `filename`, `folder_context`, `upload_date_utc`, `transcript_source` from `sessionNotesHandler.js:286`. Also provide `manual_notes_text_or_blank` for the file-upload path.

### Lower priority (no known user-facing bugs)

- Clean up dead keys across all handlers (no runtime impact, just code hygiene)
- Decide whether to wire up or remove orphaned templates (synthesize_router, participant_status_update, observer_request)
- Implement `auto_fill_variables` resolution in yamlProcessor (affects participant_outreach `researcher_title`, `incentive_amount`)
- Implement `auto_variables` resolution (affects targeted_readouts `participant_count`/`session_count`, github_issues_generator `github_repo_url`)
- Implement `derived_variables` resolution (affects desk_research `effective_topic`)

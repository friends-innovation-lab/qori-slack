# 💡 Design Opportunities: 

> **Generated:** February 11, 2026 | **8 opportunities** from **3 participants**

---

## Overview

| Priority | Opportunity | From Problem | Evidence |
|:--------:|-------------|--------------|----------|
| 🔴 | Critical Accessibility Barriers | Unlabeled buttons block task completion | PT001, PT003 |
| 🔴 | Claims Status Buried in Navigation | Daily task requires excessive navigation | PT002 |
| 🔴 | Session Timeout Disrupts Tasks | Lost work and forced re-authentication | PT003 |
| 🟡 | Search Function Failure | Complete task abandonment | PT002 |
| 🟡 | Touch Targets Too Small | Multiple miss-taps and strain | PT003 |
| 🟡 | Confusing Status Terminology | User anxiety about claim progress | PT002 |
| 🟡 | Inconsistent Text Scaling | Reduced readability despite settings | PT003 |
| 🟡 | Hidden Interface Elements | Nearly missed critical buttons | PT001 |

---

## Opportunity 1: Critical Accessibility Barriers

**The Problem:**

> "There's a button that just says 'Button' without any descriptive text. That's not helpful at all." — PT001

> "Text is still too small in some places even with the large text setting." — PT003

Veterans using assistive technology or accessibility features encounter fundamental barriers that prevent task completion.

**How Might We...**

> How might we **ensure all interface elements are properly labeled and accessible** for **veterans using assistive technology** when **navigating the app with screen readers or accessibility settings** so that **they can complete critical tasks independently**?

**Why This Matters:**

| User Impact | Evidence Strength |
|:------------|:------------------|
| Complete task failure for veterans with disabilities | Strong — 2 participants with different accessibility needs |

**Design Direction:** Comprehensive accessibility audit and implementation of WCAG standards

**Success Looks Like:** All buttons have descriptive labels, text scales consistently, screen reader navigation works seamlessly

| Scope | Priority |
|:------|:---------|
| 🔵🔵🔵 Large | 🔴 High |

---

## Opportunity 2: Claims Status Buried in Navigation

**The Problem:**

> "Why is claims under Benefits and not on the main screen? I check that every day." — PT002

> "I had to tap like five times to get to my claim status." — PT002

Veterans who check claims daily face excessive navigation friction to reach this critical information.

**How Might We...**

> How might we **surface claims status information** for **veterans who check daily** when **they open the app** so that **they can quickly see their claim progress without multiple taps**?

**Why This Matters:**

| User Impact | Evidence Strength |
|:------------|:------------------|
| Daily frustration and inefficient task completion for active claimants | Strong — Daily user explicitly requested home screen access |

**Design Direction:** Customizable home screen widgets or elevated claims visibility

**Success Looks Like:** Claims status visible in 1-2 taps from home screen

| Scope | Priority |
|:------|:---------|
| 🔵🔵⚪ Medium | 🔴 High |

---

## Opportunity 3: Session Timeout Disrupts Tasks

**The Problem:**

> "Why does this keep logging me out? I was just using it an hour ago." — PT003

Session timeout occurred during active use, causing loss of message draft and forced re-authentication.

**How Might We...**

> How might we **maintain user sessions appropriately** for **veterans actively using the app** when **they are in the middle of tasks like composing messages** so that **their work is preserved and they don't lose progress**?

**Why This Matters:**

| User Impact | Evidence Strength |
|:------------|:------------------|
| Lost work and significant frustration during critical tasks | Moderate — Observed twice in single session with draft loss |

**Design Direction:** Extended session timeout for active users or draft auto-save functionality

**Success Looks Like:** No work lost due to session timeouts, seamless re-authentication

| Scope | Priority |
|:------|:---------|
| 🔵🔵⚪ Medium | 🔴 High |

---

## Opportunity 4: Search Function Failure

**The Problem:**

> "The search doesn't find what I'm looking for. I typed 'claim' and got nothing useful." — PT002

Veterans abandon tasks when search fails to return relevant results for common queries.

**How Might We...**

> How might we **provide relevant search results** for **veterans looking for specific information** when **they use common terms like 'claim' or 'appointment'** so that **they can find what they need without manual navigation**?

**Why This Matters:**

| User Impact | Evidence Strength |
|:------------|:------------------|
| Task abandonment when navigation fails | Moderate — 1 participant gave up entirely on search |

**Design Direction:** Contextual search with common VA terminology and synonyms

**Success Looks Like:** Search returns relevant results for common veteran queries

| Scope | Priority |
|:------|:---------|
| 🔵🔵⚪ Medium | 🟡 Medium |

---

## Opportunity 5: Touch Targets Too Small

**The Problem:**

> "I need bigger buttons. These are hard to tap with my fingers." — PT003

Veterans with motor difficulties experience multiple miss-taps due to small touch targets.

**How Might We...**

> How might we **provide appropriately sized touch targets** for **veterans with motor difficulties or age-related changes** when **they need to tap buttons and interface elements** so that **they can interact confidently without miss-taps**?

**Why This Matters:**

| User Impact | Evidence Strength |
|:------------|:------------------|
| Physical strain and interaction errors during app use | Moderate — Observed multiple miss-taps in single session |

**Design Direction:** Increase minimum touch target sizes to meet accessibility guidelines

**Success Looks Like:** No miss-taps observed, comfortable interaction for users with motor difficulties

| Scope | Priority |
|:------|:---------|
| 🔵🔵⚪ Medium | 🟡 Medium |

---

## Opportunity 6: Confusing Status Terminology

**The Problem:**

> "I don't understand what 'Evidence gathering' means. Is that good or bad?" — PT002

Veterans experience anxiety and confusion when claim status uses technical jargon instead of plain language.

**How Might We...**

> How might we **communicate claim status clearly** for **veterans tracking their disability claims** when **status updates use technical terminology** so that **they understand their claim progress and next steps**?

**Why This Matters:**

| User Impact | Evidence Strength |
|:------------|:------------------|
| Anxiety and confusion about critical benefit status | Moderate — 1 participant expressed confusion about claim progress |

**Design Direction:** Plain language explanations with context about what each status means

**Success Looks Like:** Veterans understand their claim status and know what to expect next

| Scope | Priority |
|:------|:---------|
| 🔵⚪⚪ Small | 🟡 Medium |

---

## Opportunity 7: Inconsistent Text Scaling

**The Problem:**

> "Text is still too small in some places even with the large text setting." — PT003

Veterans with vision needs find accessibility settings don't work consistently across all interface elements.

**How Might We...**

> How might we **ensure consistent text scaling** for **veterans using large text accessibility settings** when **they navigate different sections of the app** so that **all text remains readable throughout their experience**?

**Why This Matters:**

| User Impact | Evidence Strength |
|:------------|:------------------|
| Reduced effectiveness of accessibility accommodations | Moderate — 1 participant noted inconsistent scaling despite settings |

**Design Direction:** Comprehensive text scaling implementation across all UI components

**Success Looks Like:** All text scales consistently when accessibility settings are enabled

| Scope | Priority |
|:------|:---------|
| 🔵🔵⚪ Medium | 🟡 Medium |

---

## Opportunity 8: Hidden Interface Elements

**The Problem:**

> "There was no way for me to know that's what that button did." — PT001

Critical interface elements positioned at bottom of screens are nearly missed during screen reader navigation.

**How Might We...**

> How might we **make important interface elements discoverable** for **veterans using screen readers** when **critical buttons are positioned at the bottom of long pages** so that **they don't miss essential functionality**?

**Why This Matters:**

| User Impact | Evidence Strength |
|:------------|:------------------|
| Nearly missed critical functionality during task completion | Moderate — 1 participant nearly missed edit button entirely |

**Design Direction:** Improved information hierarchy and navigation landmarks

**Success Looks Like:** All critical functions discoverable within reasonable navigation time

| Scope | Priority |
|:------|:---------|
| 🔵🔵⚪ Medium | 🟡 Medium |

---

## Prioritization

> **Impact:** 🔴 High | 🟡 Medium | 🟢 Low — **Effort:** 🔵🔵🔵 High | 🔵🔵⚪ Med | 🔵⚪⚪ Low

| # | Opportunity | Impact | Effort | When |
|:--|:------------|:------:|:------:|:----:|
| 1 | Critical Accessibility Barriers | 🔴 High | 🔵🔵🔵 | Now |
| 2 | Claims Status Navigation | 🔴 High | 🔵🔵⚪ | Now |
| 3 | Session Timeout Disruption | 🔴 High | 🔵🔵⚪ | Next |
| 4 | Search Function Failure | 🟡 Med | 🔵🔵⚪ | Next |
| 5 | Touch Target Size | 🟡 Med | 🔵🔵⚪ | Next |
| 6 | Status Terminology | 🟡 Med | 🔵⚪⚪ | Later |
| 7 | Text Scaling Consistency | 🟡 Med | 🔵🔵⚪ | Later |
| 8 | Hidden Interface Elements | 🟡 Med | 🔵🔵⚪ | Later |

---

## Methodology

<details>
<summary><strong>Framework & References</strong></summary>

**Framework:** How Might We (HMW) Opportunity Framing

**Approach:** Transform research-grounded problems into open questions that invite solution exploration without prescribing answers.

**Data Sources:** PT001, PT002, PT003

### References

This analysis follows established opportunity framing methods:

- **IDEO** — Design Thinking, HMW framework origin
- **Stanford d.school** — "How Might We" question methodology
- **Nielsen Norman Group** — From research insights to design opportunities
- **Vijay Kumar** — "101 Design Methods" (Opportunity framing)

</details>

---

*Generated by Qori • AI-assisted opportunity framing from user research data*

# 💡 Design Opportunities: 

> **Generated:** January 28, 2026 | **8 opportunities** from **3 participants**

---

## Overview

| Priority | Opportunity | From Problem | Evidence |
|:--------:|-------------|--------------|----------|
| 🔴 | Critical Accessibility Barriers | Unlabeled buttons blocking screen reader users | PT001 |
| 🔴 | Extreme Loading Performance | 45+ second loading times making app unusable | PT003 |
| 🔴 | Search Function Abandonment | Hidden, irrelevant search driving users to phone support | PT002 |
| 🟡 | Historical Claims Information Gap | Veterans can't find completed claim status | PT003 |
| 🟡 | Messaging Category Barriers | Complex categories blocking simple doctor communication | PT002 |
| 🟡 | Hidden Action Button Discovery | Important buttons placed where users can't find them | PT001, PT003 |
| 🟡 | Benefits Information Depth | High-level information insufficient for user tasks | PT002 |
| 🟡 | Navigation Label Confusion | Duplicate options creating decision paralysis | PT002 |

---

## Opportunity 1: Critical Accessibility Barriers

**The Problem:**

> "There's a button that just says 'Button' without any descriptive text. That's not helpful at all." — PT001

Multiple interactive elements throughout the app lack proper labels for screen readers, creating fundamental accessibility barriers that prevent veterans with vision disabilities from completing basic tasks.

**How Might We...**

> How might we **ensure every interactive element is properly labeled** for **veterans using screen readers** when **navigating the app interface** so that **they can understand button functions and complete tasks independently**?

**Why This Matters:**

| User Impact | Evidence Strength |
|:------------|:------------------|
| Complete inability to use core app functions for blind/visually impaired veterans | Strong — Expert VoiceOver user with 12 years military service |

**Design Direction:** Comprehensive accessibility audit and systematic labeling implementation

**Success Looks Like:** Every button announces its function clearly to screen readers

| Scope | Priority |
|:------|:---------|
| 🔵🔵⚪ Medium | 🔴 High |

---

## Opportunity 2: Extreme Loading Performance

**The Problem:**

> "By the time this app loads what I need, I could have talked to a person and gotten my answer." — PT003

Loading times of 45+ seconds consistently block basic task completion, making the app nearly unusable even for veterans accustomed to slower rural internet connections.

**How Might We...**

> How might we **optimize app performance** for **veterans with limited bandwidth** when **accessing basic functions** so that **they can complete tasks without excessive waiting or timeouts**?

**Why This Matters:**

| User Impact | Evidence Strength |
|:------------|:------------------|
| App abandonment and increased phone support dependency | Strong — Rural veteran with high patience tolerance exceeded |

**Design Direction:** Low-bandwidth optimization, progressive loading, and offline functionality

**Success Looks Like:** Basic tasks load within 10 seconds on slow connections

| Scope | Priority |
|:------|:---------|
| 🔵🔵🔵 High | 🔴 High |

---

## Opportunity 3: Search Function Abandonment

**The Problem:**

> "The search is hard to find and the results aren't great. I'd probably give up and call someone instead." — PT002

Search functionality is hidden and provides irrelevant generic articles instead of actionable forms, causing veterans to abandon self-service and resort to phone support.

**How Might We...**

> How might we **make search discoverable and relevant** for **veterans looking for specific forms or information** when **they need to complete tasks** so that **they can find what they need without calling support**?

**Why This Matters:**

| User Impact | Evidence Strength |
|:------------|:------------------|
| Increased call center load and user frustration with self-service | Strong — Experienced user would abandon feature entirely |

**Design Direction:** Prominent search placement with task-oriented results

**Success Looks Like:** Users find relevant forms/info in first 3 search results

| Scope | Priority |
|:------|:---------|
| 🔵🔵⚪ Medium | 🔴 High |

---

## Opportunity 4: Historical Claims Information Gap

**The Problem:**

> "Where would a completed claim show up?" — PT003

Veterans cannot locate information about processed claims, with the system only showing "No active claims" instead of providing access to historical claim status and decisions.

**How Might We...**

> How might we **provide access to historical claim information** for **veterans tracking benefit decisions** when **their claims have been processed** so that **they can review outcomes and status history**?

**Why This Matters:**

| User Impact | Evidence Strength |
|:------------|:------------------|
| Task failure and inability to track important benefit decisions | Moderate — 20-year veteran couldn't complete expected task |

**Design Direction:** Comprehensive claims history section with clear status progression

**Success Looks Like:** Veterans can access both active and completed claim information

| Scope | Priority |
|:------|:---------|
| 🔵🔵⚪ Medium | 🟡 Medium |

---

## Opportunity 5: Messaging Category Barriers

**The Problem:**

> "I just want to ask my doctor a simple question, but I have to navigate through all these categories first." — PT002

Complex category systems create unnecessary barriers for veterans who want to send simple messages to their healthcare providers.

**How Might We...**

> How might we **streamline doctor communication** for **veterans with simple healthcare questions** when **they need quick answers** so that **they can message providers without navigating complex categories**?

**Why This Matters:**

| User Impact | Evidence Strength |
|:------------|:------------------|
| Delayed healthcare communication and user frustration | Strong — Regular user with 2+ years app experience |

**Design Direction:** Direct messaging option alongside categorized system

**Success Looks Like:** Simple questions can be sent in under 3 taps

| Scope | Priority |
|:------|:---------|
| 🔵🔵⚪ Medium | 🟡 Medium |

---

## Opportunity 6: Hidden Action Button Discovery

**The Problem:**

> "Important buttons are hidden at the bottom of screens where they're easy to miss." — PT001

Critical action buttons like "Edit" are positioned at the bottom of screens where they're difficult to discover, especially for screen reader users and those with large text settings.

**How Might We...**

> How might we **make primary action buttons discoverable** for **veterans using assistive technology** when **they need to edit or update information** so that **they can find and use key functions without extensive searching**?

**Why This Matters:**

| User Impact | Evidence Strength |
|:------------|:------------------|
| Extended task completion time and potential task abandonment | Strong — Both accessibility and large text users affected |

**Design Direction:** Standardized placement of primary actions in predictable locations

**Success Looks Like:** Users find edit buttons within first 5 seconds of looking

| Scope | Priority |
|:------|:---------|
| 🔵⚪⚪ Small | 🟡 Medium |

---

## Opportunity 7: Benefits Information Depth

**The Problem:**

> Task noted as "⚠️ Partial completion: 6 minutes" with "Information display too basic, lacked important details." — PT002 observer notes

Benefits information is too high-level and doesn't provide the comprehensive details veterans need to understand their benefits and take appropriate actions.

**How Might We...**

> How might we **provide comprehensive benefits details** for **veterans researching their benefits** when **they need actionable information** so that **they can make informed decisions without calling support**?

**Why This Matters:**

| User Impact | Evidence Strength |
|:------------|:------------------|
| Incomplete task completion and continued uncertainty about benefits | Moderate — Experienced user couldn't get needed information |

**Design Direction:** Layered information architecture with drill-down details

**Success Looks Like:** Veterans can access detailed benefit information in the app

| Scope | Priority |
|:------|:---------|
| 🔵🔵🔵 High | 🟡 Medium |

---

## Opportunity 8: Navigation Label Confusion

**The Problem:**

> "Nothing clearly says 'File new claim.' Oh wait, there's 'Claims' and also 'File a Claim' - those are two separate things? That's confusing." — PT002

Multiple similar navigation options with unclear distinctions create decision paralysis and confusion about the correct path for completing tasks.

**How Might We...**

> How might we **clarify navigation labels** for **veterans trying to complete specific tasks** when **multiple similar options exist** so that **they can choose the correct path without confusion**?

**Why This Matters:**

| User Impact | Evidence Strength |
|:------------|:------------------|
| Decision paralysis and potential wrong path selection | Moderate — Regular user confused by similar options |

**Design Direction:** Clear, distinct labeling with task-oriented language

**Success Looks Like:** Users select correct navigation path on first attempt

| Scope | Priority |
|:------|:---------|
| 🔵⚪⚪ Small | 🟡 Medium |

---

## Prioritization

> **Impact:** 🔴 High | 🟡 Medium | 🟢 Low — **Effort:** 🔵🔵🔵 High | 🔵🔵⚪ Med | 🔵⚪⚪ Low

| # | Opportunity | Impact | Effort | When |
|:--|:------------|:------:|:------:|:----:|
| 1 | Critical Accessibility Barriers | 🔴 High | 🔵🔵⚪ | Now |
| 2 | Search Function Abandonment | 🔴 High | 🔵🔵⚪ | Now |
| 3 | Hidden Action Button Discovery | 🟡 Med | 🔵⚪⚪ | Now |
| 4 | Navigation Label Confusion | 🟡 Med | 🔵⚪⚪ | Now |
| 5 | Messaging Category Barriers | 🟡 Med | 🔵🔵⚪ | Next |
| 6 | Historical Claims Information Gap | 🟡 Med | 🔵🔵⚪ | Next |
| 7 | Extreme Loading Performance | 🔴 High | 🔵🔵🔵 | Next |
| 8 | Benefits Information Depth | 🟡 Med | 🔵🔵🔵 | Later |

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

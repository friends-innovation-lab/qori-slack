# 💡 Design Opportunities: VA Health and Benefits Mobile App

> **Generated:** January 28, 2026 | **8 opportunities** from **3 participants**

---

## Overview

| Priority | Opportunity | From Problem | Evidence |
|:--------:|-------------|--------------|----------|
| 🔴 | Button Accessibility Crisis | Unlabeled interactive elements | PT001 |
| 🔴 | Performance Barrier for Rural Users | Extreme loading times blocking tasks | PT003 |
| 🔴 | Search Function Abandonment | Hidden and irrelevant search results | PT002 |
| 🟡 | Historical Claims Information Gap | Cannot locate completed claim status | PT003 |
| 🟡 | Messaging Communication Barriers | Complex categories for simple questions | PT002 |
| 🟡 | Hidden Action Button Discovery | Edit buttons positioned at bottom | PT001, PT003 |
| 🟡 | Benefits Information Depth | Too high-level for user needs | PT002 |
| 🟢 | Navigation Label Confusion | Duplicate options create decision paralysis | PT002 |

---

## Opportunity 1: Button Accessibility Crisis

**The Problem:**

> "There's a button that just says 'Button' without any descriptive text. That's not helpful at all." — PT001

Multiple interactive elements throughout the app are announced only as "Button" by screen readers, creating fundamental accessibility barriers that prevent veterans with vision loss from understanding interface functions.

**How Might We...**

> How might we **ensure every interactive element has meaningful labels** for **veterans using screen readers** when **navigating the app interface** so that **they can understand button functions without guessing**?

**Why This Matters:**

| User Impact | Evidence Strength |
|-------------|-------------------|
| Complete inability to use core app functions for blind veterans | Strong — Expert VoiceOver user with 12+ years experience |

**Design Direction:** Comprehensive accessibility audit and systematic button labeling implementation

**Success Looks Like:** Every button announces its function clearly to screen readers on first encounter

| Scope | Priority |
|:-----:|:--------:|
| 🔵🔵⚪ Medium | 🔴 High |

---

## Opportunity 2: Performance Barrier for Rural Users

**The Problem:**

> "By the time this app loads what I need, I could have talked to a person and gotten my answer." — PT003

Loading screens consistently take 45+ seconds with multiple timeout warnings, making the app nearly unusable for veterans in rural areas with limited internet connectivity.

**How Might We...**

> How might we **optimize app performance** for **veterans with slow internet connections** when **accessing basic VA services** so that **tasks complete within acceptable timeframes**?

**Why This Matters:**

| User Impact | Evidence Strength |
|-------------|-------------------|
| App abandonment and increased phone support dependency | Strong — Rural user with high patience tolerance still frustrated |

**Design Direction:** Low-bandwidth optimization, offline caching, and progressive loading strategies

**Success Looks Like:** Core tasks complete in under 30 seconds on slow connections

| Scope | Priority |
|:-----:|:--------:|
| 🔵🔵🔵 Large | 🔴 High |

---

## Opportunity 3: Search Function Abandonment

**The Problem:**

> "The search is hard to find and the results aren't great. I'd probably give up and call someone instead." — PT002

Search functionality is hidden in a tiny icon and returns generic articles instead of actionable forms, leading to task abandonment and phone support reliance.

**How Might We...**

> How might we **make search discoverable and relevant** for **veterans looking for specific forms or information** when **they need to complete VA tasks** so that **they find what they need without calling support**?

**Why This Matters:**

| User Impact | Evidence Strength |
|-------------|-------------------|
| Increased call center load and user frustration with self-service | Strong — Experienced user would abandon search entirely |

**Design Direction:** Prominent search placement with task-oriented results prioritization

**Success Looks Like:** Users find relevant forms and information through search without fallback to phone

| Scope | Priority |
|:-----:|:--------:|
| 🔵🔵⚪ Medium | 🔴 High |

---

## Opportunity 4: Historical Claims Information Gap

**The Problem:**

> "Where would a completed claim show up?" — PT003

Veterans cannot locate information about processed claims, with the system showing "No active claims" instead of providing historical claim status and decisions.

**How Might We...**

> How might we **provide access to historical claim information** for **veterans tracking benefit decisions** when **their claims have been processed** so that **they can review past decisions and outcomes**?

**Why This Matters:**

| User Impact | Evidence Strength |
|-------------|-------------------|
| Task failure requiring phone support for historical information | Moderate — Single participant but represents common user need |

**Design Direction:** Expand information architecture to include completed claims section

**Success Looks Like:** Veterans can access both active and historical claim information in one interface

| Scope | Priority |
|:-----:|:--------:|
| 🔵🔵⚪ Medium | 🟡 Medium |

---

## Opportunity 5: Messaging Communication Barriers

**The Problem:**

> "I just want to ask my doctor a simple question, but I have to navigate through all these categories first." — PT002

Simple doctor communication requires navigating complex category systems that don't match user mental models, creating unnecessary barriers for basic healthcare questions.

**How Might We...**

> How might we **streamline doctor communication** for **veterans with simple healthcare questions** when **they need quick medical guidance** so that **they can reach their care team without categorical barriers**?

**Why This Matters:**

| User Impact | Evidence Strength |
|-------------|-------------------|
| Delayed healthcare communication and user frustration | Moderate — Regular app user with clear communication needs |

**Design Direction:** Direct messaging option alongside categorized system for simple questions

**Success Looks Like:** Veterans can send basic questions to doctors in under 3 taps

| Scope | Priority |
|:-----:|:--------:|
| 🔵🔵⚪ Medium | 🟡 Medium |

---

## Opportunity 6: Hidden Action Button Discovery

**The Problem:**

> Edit button positioned at bottom of screen, nearly missed during contact information update task — PT001 observer notes

Important action buttons are placed at the bottom of screens where they're difficult to discover through screen reader navigation and visual scanning.

**How Might We...**

> How might we **make primary action buttons discoverable** for **veterans using assistive technology** when **they need to edit or update information** so that **critical functions are found without extensive searching**?

**Why This Matters:**

| User Impact | Evidence Strength |
|-------------|-------------------|
| Extended task completion time and potential task abandonment | Moderate — Observed in accessibility and rural user sessions |

**Design Direction:** Standardize action button placement in predictable, accessible locations

**Success Looks Like:** Users find edit and action buttons within first few interface elements

| Scope | Priority |
|:-----:|:--------:|
| 🔵⚪⚪ Small | 🟡 Medium |

---

## Opportunity 7: Benefits Information Depth

**The Problem:**

> Task noted as "⚠️ Partial completion: 6 minutes" with "Information display too basic, lacked important details." — PT002 observer notes

Benefits section provides high-level information that doesn't meet user needs for comprehensive details about their benefits and eligibility.

**How Might We...**

> How might we **provide comprehensive benefits information** for **veterans researching their entitlements** when **they need detailed benefit details** so that **they can make informed decisions without additional research**?

**Why This Matters:**

| User Impact | Evidence Strength |
|-------------|-------------------|
| Incomplete task completion and need for additional information sources | Moderate — Single participant but represents information-seeking behavior |

**Design Direction:** Expand benefits information with actionable details and next steps

**Success Looks Like:** Veterans find complete benefit information needed for decision-making

| Scope | Priority |
|:-----:|:--------:|
| 🔵🔵⚪ Medium | 🟡 Medium |

---

## Opportunity 8: Navigation Label Confusion

**The Problem:**

> "Nothing clearly says 'File new claim.' Oh wait, there's 'Claims' and also 'File a Claim' - those are two separate things? That's confusing." — PT002

Multiple similar navigation options with unclear distinctions create decision paralysis and confusion about the correct path for completing tasks.

**How Might We...**

> How might we **clarify navigation labels** for **veterans choosing between similar options** when **filing claims or accessing services** so that **the correct path is obvious without trial and error**?

**Why This Matters:**

| User Impact | Evidence Strength |
|-------------|-------------------|
| User confusion and potential wrong path selection | Moderate — Clear example but limited to navigation labeling |

**Design Direction:** Audit and simplify navigation labels to eliminate duplicates and clarify distinctions

**Success Looks Like:** Veterans choose correct navigation path on first attempt

| Scope | Priority |
|:-----:|:--------:|
| 🔵⚪⚪ Small | 🟢 Low |

---

## Prioritization

| # | Opportunity | Impact | Effort | When |
|---|-------------|:------:|:------:|:----:|
| 1 | Button Accessibility Crisis | 🔴 High | 🔵🔵⚪ | Now |
| 2 | Search Function Abandonment | 🔴 High | 🔵🔵⚪ | Now |
| 3 | Performance Barrier for Rural Users | 🔴 High | 🔵🔵🔵 | Next |
| 4 | Hidden Action Button Discovery | 🟡 Med | 🔵⚪⚪ | Next |
| 5 | Historical Claims Information Gap | 🟡 Med | 🔵🔵⚪ | Next |
| 6 | Messaging Communication Barriers | 🟡 Med | 🔵🔵⚪ | Later |
| 7 | Benefits Information Depth | 🟡 Med | 🔵🔵⚪ | Later |
| 8 | Navigation Label Confusion | 🟢 Low | 🔵⚪⚪ | Later |

> **Impact:** 🔴 High | 🟡 Medium | 🟢 Low — **Effort:** 🔵🔵🔵 High | 🔵🔵⚪ Med | 🔵⚪⚪ Low

<br>

---

## Methodology

**Framework:** How Might We (HMW) Opportunity Framing

**Approach:** Transform research-grounded problems into open questions that invite solution exploration without prescribing answers.

**Data Sources:** PT001, PT002, PT003

<br>

---

### References

This analysis follows established opportunity framing methods:

- **IDEO** — Design Thinking, HMW framework origin
- **Stanford d.school** — "How Might We" question methodology
- **Nielsen Norman Group** — From research insights to design opportunities
- **Vijay Kumar** — "101 Design Methods" (Opportunity framing)

---

*Generated by Qori • January 28, 2026*

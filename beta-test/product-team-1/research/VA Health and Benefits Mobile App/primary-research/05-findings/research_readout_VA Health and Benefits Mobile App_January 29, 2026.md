<div align="center">

# 📊 Research Report
## VA Health and Benefits Mobile App Navigation Research

**January 28, 2026**

---

| Participants | Sessions | Methodology | Lead Researcher |
|:------------:|:--------:|:-----------:|:---------------:|
| 3 | 3 | User Interviews | lapedra@cityfriends.tech |

</div>

---

## 📌 Executive Summary

> [!IMPORTANT]
> **Bottom Line:** Critical accessibility violations and search functionality failures are forcing Veterans to abandon the VA mobile app and rely on phone support, undermining the goal of expanding digital service adoption.

### Key Takeaways

| Priority | Finding | Impact | Action Required |
|:--------:|:--------|:-------|:----------------|
| 🔴 | Unlabeled buttons block screen reader users from basic functions | Complete task failure for accessibility users | Immediate accessibility audit and remediation |
| 🟡 | Search function hidden and provides irrelevant results | Users abandon digital tasks for phone support | Redesign search placement and algorithm |
| 🟢 | Prescription and appointment features work smoothly | High user satisfaction and regular usage | Maintain and expand successful patterns |

---

## 📊 Findings at a Glance

<table>
<tr>
<td width="33%" valign="top">

### 🔴 Critical Issues
**4 findings**

- Unlabeled interactive elements
- Search function nearly unusable
- Extreme loading times (45+ seconds)
- Unable to locate completed claims

</td>
<td width="33%" valign="top">

### 🟡 Improvements Needed
**4 findings**

- Messaging system barriers
- Benefits section lacks detail
- Edit buttons too small
- Confusing duplicate navigation

</td>
<td width="33%" valign="top">

### 🟢 Working Well
**3 findings**

- Prescription management
- Appointment checking
- Large text accessibility (when applied)

</td>
</tr>
</table>

---

## 🔍 Detailed Findings

### Finding 1: Unlabeled Interactive Elements Create Accessibility Barriers

<table>
<tr>
<td width="70%" valign="top">

#### What We Observed

Multiple buttons throughout the VA mobile app interface are announced only as "Button" by VoiceOver, providing no indication of their purpose or function. This creates fundamental accessibility barriers that completely prevent screen reader users from understanding available actions.

#### Supporting Evidence

> "There's a button that just says 'Button' without any descriptive text. That's not helpful at all."
> 
> — **PT001** *Expert VoiceOver user during navigation*

> "I shouldn't have to guess what buttons do. That's basic accessibility."
> 
> — **PT001** *Expressing frustration with unlabeled elements*

</td>
<td width="30%" valign="top">

**Severity**

`🔴 CRITICAL`

**Frequency**

1 of 3 participants
(33%)

**Participants**

PT001

</td>
</tr>
</table>

<details>
<summary><strong>💡 Recommendation</strong></summary>

**Suggested Action:** Conduct comprehensive accessibility audit and implement proper ARIA labels for all interactive elements

**Rationale:** Screen reader users require meaningful labels to understand interface functionality - without them, the app becomes completely unusable

**Owner:** Development Team

**Effort Estimate:** Medium

</details>

---

### Finding 2: Search Function Nearly Unusable Due to Poor Discoverability and Results

<table>
<tr>
<td width="70%" valign="top">

#### What We Observed

The search functionality is hidden in a tiny magnifying glass icon that's difficult to discover, and when found, provides irrelevant generic articles instead of actionable forms needed for tasks. This leads users to abandon search entirely and resort to phone support.

#### Supporting Evidence

> "There's a tiny magnifying glass icon in the top right corner"
> 
> — **PT002** *Describing difficulty finding search*

> "I'd probably give up and call someone instead."
> 
> — **PT002** *Response to poor search results*

</td>
<td width="30%" valign="top">

**Severity**

`🔴 CRITICAL`

**Frequency**

1 of 3 participants
(33%)

**Participants**

PT002

</td>
</tr>
</table>

<details>
<summary><strong>💡 Recommendation</strong></summary>

**Suggested Action:** Redesign search with prominent placement and improved result relevance focusing on actionable content

**Rationale:** Hidden search functionality effectively doesn't exist for users, driving them to alternative support channels

**Owner:** UX Design Team

**Effort Estimate:** High

</details>

---

### Finding 3: Extreme Loading Times Block Basic Task Completion

<table>
<tr>
<td width="70%" valign="top">

#### What We Observed

Loading screens consistently took 45+ seconds with multiple timeout warnings, extending simple tasks to 6-10 minutes and making the app nearly unusable even for users adapted to slower rural internet connections.

#### Supporting Evidence

> "By the time this app loads what I need, I could have talked to a person and gotten my answer."
> 
> — **PT003** *Rural Alabama resident with patience for slow connections*

> "Well, I'm used to things being a bit slow out here in rural Alabama, but this is taking a while even for me."
> 
> — **PT003** *Performance exceeding even rural user tolerance*

</td>
<td width="30%" valign="top">

**Severity**

`🔴 CRITICAL`

**Frequency**

1 of 3 participants
(33%)

**Participants**

PT003

</td>
</tr>
</table>

<details>
<summary><strong>💡 Recommendation</strong></summary>

**Suggested Action:** Implement low-bandwidth optimization and better loading states for rural users

**Rationale:** When app performance exceeds rural internet expectations, it signals critical optimization needs

**Owner:** Engineering Team

**Effort Estimate:** High

</details>

---

### Finding 4: Messaging System Creates Unnecessary Barriers for Simple Communication

<table>
<tr>
<td width="70%" valign="top">

#### What We Observed

Users wanting to ask simple questions to their doctors must navigate through confusing category systems that don't match their mental model, turning straightforward communication into a complex multi-step process.

#### Supporting Evidence

> "I just want to ask my doctor a simple question, but I have to navigate through all these categories first."
> 
> — **PT002** *Frustrated with categorical barriers*

> "What if my question doesn't fit neatly into these categories?"
> 
> — **PT002** *Questioning system organization*

</td>
<td width="30%" valign="top">

**Severity**

`🟡 HIGH`

**Frequency**

1 of 3 participants
(33%)

**Participants**

PT002

</td>
</tr>
</table>

<details>
<summary><strong>💡 Recommendation</strong></summary>

**Suggested Action:** Simplify messaging interface with direct doctor communication option

**Rationale:** Simple tasks should remain simple - categorical barriers prevent efficient communication

**Owner:** UX Design Team

**Effort Estimate:** Medium

</details>

---

## ✅ What's Working Well

> [!TIP]
> These elements should be preserved and potentially expanded in future iterations.

| Positive Finding | Evidence | Participant(s) |
|:-----------------|:---------|:---------------|
| **Prescription Management** | "That's probably the smoothest part of the app. I do this all the time and it just works." | PT002 |
| **Appointment Checking** | Straightforward navigation completed in 2 minutes with no issues | PT002 |
| **Large Text Accessibility** | "Actually, this looks pretty good. The text is nice and large, and everything fits on the screen properly." | PT003 |

---

## 👥 Participant Overview

| ID | Context | Key Contribution | Notable Quotes |
|:---|:--------|:-----------------|:---------------|
| **PT001** | Marine veteran, expert VoiceOver user, regular app user (3-4x weekly) | Critical accessibility violations blocking core functionality | "Just remember that some of us can't see the screen. We rely entirely on these labels and descriptions." |
| **PT002** | Navy veteran, experienced app user (2+ years), night shift worker | Search and messaging system failures driving phone support usage | "Maybe keep the phone number handy for when you get stuck." |
| **PT003** | Army veteran (20 years service), rural Alabama, uses large text settings | Performance issues exceeding even rural user tolerance | "I have patience, but this app tests it." |

<details>
<summary><strong>📋 Sample Characteristics</strong></summary>

| Characteristic | Distribution |
|:---------------|:-------------|
| Total Participants | 3 |
| Service Branch | Marine (1), Navy (1), Army (1) |
| Accessibility Needs | Vision impairment (2), None (1) |
| Location Type | Rural (1), Suburban (1), Urban (1) |

> [!NOTE]
> Small sample size limits generalizability, but findings represent diverse user contexts including accessibility needs and geographic distribution.

</details>

---

## 🔬 Methodology

| Aspect | Details |
|:-------|:--------|
| **Research Type** | User Interviews |
| **Sessions Conducted** | 3 |
| **Session Duration** | 60 minutes |
| **Research Focus** | VA Mobile App navigation structure, information architecture, and search functionality |
| **Recruitment Method** | Recruitment agency (67%), referral (33%) |
| **Data Collection** | Observer notes, screen sharing, task observation |

---

## 🚀 Recommended Actions

### 🔴 Immediate Priority (Next 2 Weeks)

| # | Action | Addresses Finding | Owner | Effort |
|:-:|:-------|:------------------|:------|:------:|
| 1 | **Conduct accessibility audit and fix unlabeled buttons** | Unlabeled Interactive Elements | Development Team | M |
| 2 | **Implement low-bandwidth optimization** | Extreme Loading Times | Engineering Team | H |

### 🟡 Short-Term (1-2 Months)

| # | Action | Addresses Finding | Owner | Effort |
|:-:|:-------|:------------------|:------|:------:|
| 1 | **Redesign search with prominent placement** | Search Function Nearly Unusable | UX Design Team | H |
| 2 | **Simplify messaging interface** | Messaging System Barriers | UX Design Team | M |

### 🟢 Future Considerations

| # | Action | Addresses Finding | Notes |
|:-:|:-------|:------------------|:------|
| 1 | **Add historical claims section** | Unable to Locate Completed Claims | Information architecture enhancement |

### 🔍 Follow-Up Research Needed

> [!NOTE]
> These gaps emerged during analysis and warrant further investigation.

- [ ] Broader accessibility testing with diverse assistive technology users
- [ ] Performance testing across different network conditions and devices
- [ ] Card sorting study to validate information architecture improvements

---

## 📎 Appendix

<details>
<summary><strong>📁 Related Artifacts</strong></summary>

| Artifact | Location | Status |
|:---------|:---------|:-------|
| Session Summaries | [beta-test/product-team-1%2Fresearch/VA%20Health%20and%20Benefits%20Mobile%20App/](beta-test/product-team-1%2Fresearch/VA%20Health%20and%20Benefits%20Mobile%20App/) | ✅ Complete |
| Research Plan | VA Health and Benefits Mobile App Navigation Research | ✅ Available |
| Participant Tracker | VA Health and Benefits Mobile App_participant_tracker.md | ✅ Complete |

</details>

<details>
<summary><strong>✅ Research Validity Checklist</strong></summary>

| Criterion | Status | Notes |
|:----------|:------:|:------|
| All quotes verbatim from source | ✅ | Verified |
| All participant IDs match source | ✅ | PT001, PT002, PT003 format preserved |
| Participant count accurate

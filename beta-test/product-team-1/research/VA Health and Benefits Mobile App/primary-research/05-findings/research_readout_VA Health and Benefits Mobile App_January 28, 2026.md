<div align="center">

# 📊 Research Readout
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
> **Bottom Line:** Critical accessibility violations and performance issues are forcing veterans to abandon the VA mobile app and rely on phone support for basic healthcare and benefits tasks.

### Key Takeaways

| Priority | Finding | Impact | Action Required |
|:--------:|:--------|:-------|:----------------|
| 🔴 | Unlabeled buttons and hidden search functionality create complete task failures | Veterans cannot complete basic tasks independently | Immediate accessibility audit and search redesign |
| 🟡 | Extreme loading times (45+ seconds) exceed even rural internet user tolerance | App abandonment for time-sensitive healthcare needs | Performance optimization for low-bandwidth connections |
| 🟢 | Prescription management and logical menu structure work effectively | High user satisfaction and regular usage for core functions | Maintain and expand successful patterns |

---

## 📊 Findings at a Glance

<table>
<tr>
<td width="33%" valign="top">

### 🔴 Critical Issues
**4 findings**

- Unlabeled interactive elements blocking screen reader users
- Search function nearly unusable due to poor discoverability
- Extreme loading times making app unusable
- Missing historical claims information architecture

</td>
<td width="33%" valign="top">

### 🟡 Improvements Needed
**4 findings**

- Messaging system creates unnecessary categorical barriers
- Edit buttons too small despite accessibility settings
- Benefits section lacks actionable detail
- Confusing duplicate navigation options

</td>
<td width="33%" valign="top">

### 🟢 Working Well
**3 findings**

- Prescription management smooth and efficient
- Logical main menu structure enables navigation
- Large text accessibility properly implemented

</td>
</tr>
</table>

---

## 🔍 Detailed Findings

### Finding 1: Critical Accessibility Violations Block Core Functionality

<table>
<tr>
<td width="70%" valign="top">

#### What We Observed

Multiple interactive elements throughout the VA mobile app lack proper accessibility labels, making them completely unusable for screen reader users. PT001, an expert VoiceOver user, encountered buttons that were announced only as "Button" without any indication of their function, creating fundamental barriers to task completion.

#### Supporting Evidence

> "There's a button that just says 'Button' without any descriptive text. That's not helpful at all."
> 
> — **PT001** *Expert VoiceOver user attempting to navigate interface*

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

**Rationale:** Screen reader users cannot function without descriptive labels, making this a compliance and usability blocker

**Owner:** Development Team

**Effort Estimate:** Medium

</details>

---

### Finding 2: Search Functionality Nearly Unusable Due to Poor Design

<table>
<tr>
<td width="70%" valign="top">

#### What We Observed

The search feature is hidden in a tiny magnifying glass icon that's difficult to discover, and when found, returns irrelevant generic articles instead of actionable forms or information needed for tasks. PT002 indicated they would abandon search entirely and call phone support instead.

#### Supporting Evidence

> "There's a tiny magnifying glass icon in the top right corner"
> 
> — **PT002** *Describing difficulty finding search function*

> "The search is hard to find and the results aren't great. I'd probably give up and call someone instead."
> 
> — **PT002** *Explaining task abandonment strategy*

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

**Suggested Action:** Redesign search with prominent placement and improve result relevance algorithms

**Rationale:** Hidden search functionality drives users to alternative support channels, increasing operational costs

**Owner:** UX/Development Team

**Effort Estimate:** High

</details>

---

### Finding 3: Extreme Loading Times Exceed User Tolerance

<table>
<tr>
<td width="70%" valign="top">

#### What We Observed

Loading screens consistently took 45+ seconds with multiple timeout warnings, making basic tasks extend to 6-10 minutes. PT003, a rural Alabama resident adapted to slower internet, noted the performance exceeded even their high tolerance for delays.

#### Supporting Evidence

> "By the time this app loads what I need, I could have talked to a person and gotten my answer."
> 
> — **PT003** *Expressing frustration with loading times*

> "Well, I'm used to things being a bit slow out here in rural Alabama, but this is taking a while even for me."
> 
> — **PT003** *Contextualizing performance expectations*

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

**Suggested Action:** Implement low-bandwidth optimization and better loading states

**Rationale:** Performance issues make app unusable for rural veterans and time-sensitive healthcare needs

**Owner:** Engineering Team

**Effort Estimate:** High

</details>

---

### Finding 4: Messaging System Creates Unnecessary Barriers for Simple Communication

<table>
<tr>
<td width="70%" valign="top">

#### What We Observed

Veterans wanting to ask simple questions to their doctors must navigate through complex category systems that don't match their mental models. PT002 expressed frustration with the categorical barriers preventing straightforward communication.

#### Supporting Evidence

> "I just want to ask my doctor a simple question, but I have to navigate through all these categories first."
> 
> — **PT002** *Describing messaging system complexity*

> "What if my question doesn't fit neatly into these categories?"
> 
> — **PT002** *Questioning system flexibility*

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

**Rationale:** Reduces friction for essential healthcare communication

**Owner:** UX Team

**Effort Estimate:** Medium

</details>

---

## ✅ What's Working Well

> [!TIP]
> These elements should be preserved and potentially expanded in future iterations.

| Positive Finding | Evidence | Participant(s) |
|:-----------------|:---------|:---------------|
| **Prescription Management** | "That's probably the smoothest part of the app. I do this all the time and it just works." | PT002 |
| **Logical Menu Structure** | "The main menu structure makes sense - Health, Benefits, Payments, Profile. That's logical." | PT001 |
| **Large Text Accessibility** | "Actually, this looks pretty good. The text is nice and large, and everything fits on the screen properly." | PT003 |

---

## 👥 Participant Overview

| ID | Context | Key Contribution | Notable Quotes |
|:---|:--------|:-----------------|:---------------|
| **PT001** | Marine veteran, expert VoiceOver user, regular app user | Identified critical accessibility violations | "Just remember that some of us can't see the screen. We rely entirely on these labels and descriptions." |
| **PT002** | Navy veteran, experienced app user, works night shifts | Revealed search and messaging system failures | "Maybe keep the phone number handy for when you get stuck." |
| **PT003** | Army veteran, rural Alabama resident, uses accessibility features | Highlighted performance issues exceeding rural tolerance | "I have patience, but this app tests it." |

<details>
<summary><strong>📋 Sample Characteristics</strong></summary>

| Characteristic | Distribution |
|:---------------|:-------------|
| Total Participants | 3 |
| Service Branch | Army (1), Navy (1), Marine (1) |
| Location Type | Rural (1), Suburban (1), Urban (1) |
| Accessibility Needs | Vision impairment (1), Large text user (1), None noted (1) |

> [!NOTE]
> Small sample size limits generalizability, but findings represent critical user segments including accessibility users and rural veterans.

</details>

---

## 🔬 Methodology

| Aspect | Details |
|:-------|:--------|
| **Research Type** | User Interviews |
| **Sessions Conducted** | 3 |
| **Session Duration** | 60 minutes (planned) |
| **Research Focus** | VA Mobile App navigation structure, information architecture, and search functionality |
| **Recruitment Method** | Recruitment agency (2), Referral (1) |
| **Data Collection** | Observer notes, participant feedback |

---

## 🚀 Recommended Actions

### 🔴 Immediate Priority (Next 2 Weeks)

| # | Action | Addresses Finding | Owner | Effort |
|:-:|:-------|:------------------|:------|:------:|
| 1 | **Conduct accessibility audit and fix unlabeled buttons** | Critical accessibility violations | Development | M |
| 2 | **Redesign search with prominent placement** | Search function abandonment | UX/Dev | H |

### 🟡 Short-Term (1-2 Months)

| # | Action | Addresses Finding | Owner | Effort |
|:-:|:-------|:------------------|:------|:------:|
| 1 | **Implement low-bandwidth optimization** | Extreme loading times | Engineering | H |
| 2 | **Simplify messaging interface** | Categorical barriers | UX | M |
| 3 | **Add historical claims section** | Missing information architecture | Product | M |

### 🟢 Future Considerations

| # | Action | Addresses Finding | Notes |
|:-:|:-------|:------------------|:------|
| 1 | **Expand successful prescription management patterns** | Build on what works | Apply to other app sections |

### 🔍 Follow-Up Research Needed

> [!NOTE]
> These gaps emerged during analysis and warrant further investigation.

- [ ] Broader accessibility testing with diverse assistive technology users
- [ ] Performance testing across different network conditions and devices
- [ ] Mental model research for information architecture redesign

---

## 📎 Appendix

<details>
<summary><strong>📁 Related Artifacts</strong></summary>

| Artifact | Location | Status |
|:---------|:---------|:-------|
| Session Summaries | [beta-test/product-team-1%2Fresearch/VA%20Health%20and%20Benefits%20Mobile%20App/](beta-test/product-team-1%2Fresearch/VA%20Health%20and%20Benefits%20Mobile%20App/) | ✅ Complete |
| Research Plan | VA Health and Benefits Mobile App Navigation Research | ✅ Complete |
| Participant Tracker | VA Health and Benefits Mobile App_participant_tracker.md | ✅ Complete |

</details>

<details>
<summary><strong>✅ Research Validity Checklist</strong></summary>

| Criterion | Status |

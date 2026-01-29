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
> **Bottom Line:** Critical accessibility violations and poor search functionality are forcing veterans to abandon the VA mobile app and rely on phone support, undermining the app's core mission to provide streamlined digital access to VA services.

### Key Takeaways

| Priority | Finding | Impact | Action Required |
|:--------:|:--------|:-------|:----------------|
| 🔴 | Unlabeled buttons block screen reader users from basic functions | Complete task failure for accessibility users | Immediate accessibility audit and button labeling |
| 🟡 | Search function is hidden and provides irrelevant results | Users abandon digital tasks for phone support | Redesign search placement and result relevance |
| 🟢 | Prescription and appointment features work smoothly | High user satisfaction and regular usage | Maintain current functionality and expand patterns |

---

## 📊 Findings at a Glance

<table>
<tr>
<td width="33%" valign="top">

### 🔴 Critical Issues
**4 findings**

- Unlabeled interactive elements
- Extreme loading times (45+ seconds)
- Search function nearly unusable
- Missing historical claims data

</td>
<td width="33%" valign="top">

### 🟡 Improvements Needed
**4 findings**

- Hidden action buttons
- Complex messaging barriers
- Inconsistent accessibility scaling
- Confusing duplicate navigation

</td>
<td width="33%" valign="top">

### 🟢 Working Well
**3 findings**

- Prescription management efficiency
- Logical menu structure
- Proper form labeling

</td>
</tr>
</table>

---

## 🔍 Detailed Findings

### Finding 1: Unlabeled Interactive Elements Block Screen Reader Users

<table>
<tr>
<td width="70%" valign="top">

#### What We Observed

Multiple buttons throughout the VA mobile app interface are announced only as "Button" by VoiceOver, providing no indication of their purpose or function. This creates fundamental accessibility barriers that prevent screen reader users from understanding or using critical app features.

#### Supporting Evidence

> "There's a button that just says 'Button' without any descriptive text. That's not helpful at all."
> 
> — **PT001** *Marine veteran with expert VoiceOver skills*

> "I shouldn't have to guess what buttons do. That's basic accessibility."
> 
> — **PT001**

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

**Owner:** Development Team + Accessibility Specialist

**Effort Estimate:** Medium

</details>

---

### Finding 2: Search Function Nearly Unusable Due to Poor Discoverability and Results

<table>
<tr>
<td width="70%" valign="top">

#### What We Observed

The search functionality is hidden behind a tiny magnifying glass icon that's difficult to discover, and when found, provides irrelevant generic articles instead of actionable forms or information needed for user tasks. This leads to task abandonment and reliance on phone support.

#### Supporting Evidence

> "There's a tiny magnifying glass icon in the top right corner"
> 
> — **PT002** *Navy veteran describing search discovery difficulty*

> "The search is hard to find and the results aren't great. I'd probably give up and call someone instead."
> 
> — **PT002**

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

**Suggested Action:** Redesign search with prominent placement and improve result relevance to surface actionable content

**Rationale:** Hidden search functionality effectively doesn't exist for users, driving them to alternative support channels

**Owner:** UX Design Team + Search Engineering

**Effort Estimate:** High

</details>

---

### Finding 3: Extreme Loading Times Block Basic Task Completion

<table>
<tr>
<td width="70%" valign="top">

#### What We Observed

Loading screens consistently took 45+ seconds with multiple timeout warnings, extending simple tasks to 6-10 minutes and making the app nearly unusable. Even users adapted to rural internet connectivity found the performance unacceptable.

#### Supporting Evidence

> "By the time this app loads what I need, I could have talked to a person and gotten my answer."
> 
> — **PT003** *Army veteran from rural Alabama*

> "Well, I'm used to things being a bit slow out here in rural Alabama, but this is taking a while even for me."
> 
> — **PT003**

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

**Suggested Action:** Implement low-bandwidth optimization and better loading states for rural connectivity

**Rationale:** When app performance exceeds even rural internet user expectations, it signals critical optimization needs

**Owner:** Performance Engineering Team

**Effort Estimate:** High

</details>

---

### Finding 4: Messaging System Creates Unnecessary Barriers for Simple Communication

<table>
<tr>
<td width="70%" valign="top">

#### What We Observed

Veterans wanting to ask simple questions to their doctors must navigate through confusing category systems that don't match their mental models, turning straightforward communication into a complex multi-step process.

#### Supporting Evidence

> "I just want to ask my doctor a simple question, but I have to navigate through all these categories first."
> 
> — **PT002** *Navy veteran describing messaging frustration*

> "What if my question doesn't fit neatly into these categories?"
> 
> — **PT002**

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
| **Prescription Management Efficiency** | "That's probably the smoothest part of the app. I do this all the time and it just works." | PT002 |
| **Logical Menu Structure** | "The main menu structure makes sense - Health, Benefits, Payments, Profile. That's logical." | PT001 |
| **Large Text Accessibility Implementation** | "Actually, this looks pretty good. The text is nice and large, and everything fits on the screen properly." | PT003 |

---

## 👥 Participant Overview

| ID | Context | Key Contribution | Notable Quotes |
|:---|:--------|:-----------------|:---------------|
| **PT001** | Marine veteran with vision loss, expert VoiceOver user | Identified critical accessibility violations | "Just remember that some of us can't see the screen. We rely entirely on these labels and descriptions." |
| **PT002** | Navy veteran, regular app user for 2+ years | Revealed search and messaging barriers | "Maybe keep the phone number handy for when you get stuck." |
| **PT003** | Army veteran from rural Alabama, uses large text settings | Highlighted performance issues exceeding rural expectations | "I have patience, but this app tests it." |

<details>
<summary><strong>📋 Sample Characteristics</strong></summary>

| Characteristic | Distribution |
|:---------------|:-------------|
| Total Participants | 3 |
| Service Branch | Marine (1), Navy (1), Army (1) |
| Accessibility Needs | Vision impairment (1), Large text user (1), None noted (1) |
| Geographic Distribution | Rural (1), Urban/Suburban (2) |

> [!NOTE]
> Small sample size limits generalizability, but findings represent diverse accessibility needs and usage patterns among veterans.

</details>

---

## 🔬 Methodology

| Aspect | Details |
|:-------|:--------|
| **Research Type** | User Interviews with Navigation Focus |
| **Sessions Conducted** | 3 |
| **Session Duration** | 60 minutes (planned) |
| **Research Focus** | Main navigation structure, information architecture, and search functionality |
| **Recruitment Method** | Recruitment agency (2), Referral (1) |
| **Data Collection** | Observer notes, screen sharing, task observation |

---

## 🚀 Recommended Actions

### 🔴 Immediate Priority (Next 2 Weeks)

| # | Action | Addresses Finding | Owner | Effort |
|:-:|:-------|:------------------|:------|:------:|
| 1 | **Conduct accessibility audit and fix unlabeled buttons** | Unlabeled Interactive Elements | Accessibility Team | M |
| 2 | **Implement low-bandwidth optimization** | Extreme Loading Times | Performance Engineering | H |

### 🟡 Short-Term (1-2 Months)

| # | Action | Addresses Finding | Owner | Effort |
|:-:|:-------|:------------------|:------|:------:|
| 1 | **Redesign search with prominent placement** | Search Function Issues | UX Design | H |
| 2 | **Simplify messaging interface** | Messaging Barriers | UX Design | M |
| 3 | **Add historical claims information architecture** | Missing Claims Data | Product Team | M |

### 🟢 Future Considerations

| # | Action | Addresses Finding | Notes |
|:-:|:-------|:------------------|:------|
| 1 | **Expand successful patterns from prescription management** | Leverage What Works | Apply smooth UX patterns to other features |

### 🔍 Follow-Up Research Needed

> [!NOTE]
> These gaps emerged during analysis and warrant further investigation.

- [ ] Broader accessibility testing with diverse assistive technology users
- [ ] Search behavior analysis with larger sample to validate redesign priorities
- [ ] Performance testing across different connectivity conditions

---

## 📎 Appendix

<details>
<summary><strong>📁 Related Artifacts</strong></summary>

| Artifact | Location | Status |
|:---------|:---------|:-------|
| Session Summaries | [beta-test/product-team-1%2Fresearch/VA%20Health%20and%20Benefits%20Mobile%20App/](beta-test/product-team-1%2Fresearch/VA%20Health%20and%20Benefits%20Mobile%20App/) | ✅ Complete |
| Research Plan | [research_plan_VA Health and Benefits Mobile App Navigation Research_January 26, 2026.md](beta-test/product-team-1%2Fresearch/VA%20Health%20and%20Benefits%20Mobile%20App/) | ✅ Available |
| Participant Tracker | [VA Health and Benefits Mobile App_participant_tracker.md](beta-test/product-team-1%2Fresearch/VA%20Health%

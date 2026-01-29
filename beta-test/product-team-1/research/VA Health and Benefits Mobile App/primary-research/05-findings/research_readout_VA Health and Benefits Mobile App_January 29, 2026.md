<div align="center">

# 📊 Research Report
## VA Health and Benefits Mobile App Navigation Research

**January 26, 2026**

---

| Participants | Sessions | Methodology | Lead Researcher |
|:------------:|:--------:|:-----------:|:---------------:|
| 3 | 3 | User Interviews | lapedra@cityfriends.tech |

</div>

---

## 📌 Executive Summary

> [!IMPORTANT]
> **Bottom Line:** Critical accessibility violations and search functionality failures are forcing veterans to abandon the VA mobile app and rely on phone support, undermining the app's core mission to provide streamlined digital access to VA services.

### Key Takeaways

| Priority | Finding | Impact | Action Required |
|:--------:|:--------|:-------|:----------------|
| 🔴 | Unlabeled buttons and hidden search functionality create complete task failures | Veterans cannot complete basic tasks independently | Immediate accessibility audit and search redesign |
| 🟡 | Extreme loading times and messaging barriers frustrate regular users | Task abandonment and phone support dependency | Performance optimization and interface streamlining |
| 🟢 | Prescription management and appointment checking work smoothly | High user satisfaction and regular usage for these features | Maintain current functionality and apply patterns elsewhere |

---

## 🎯 Research Overview

### Why We Conducted This Research

This research was conducted to inform the VA Mobile App product team's decisions on restructuring the main navigation menu, enhancing search functionality, and reorganizing information hierarchy for the Q1 2026 redesign. The study aimed to address the 45% task abandonment rate and 4.2/10 satisfaction score among veterans by identifying specific usability barriers.

### Research Objectives

- **Identify** specific navigation pathways, information architecture flaws, and search functionality issues that contribute to task abandonment
- **Understand** veteran mental models and expectations for organizing health, benefits, and administrative information within the mobile app
- **Evaluate** the effectiveness and discoverability of search functionality, menu structures, and information categorization
- **Document** the top 5 usability barriers with clear severity rankings and user impact metrics

### Research Questions

1. What specific navigation elements or search results cause confusion or frustration during critical tasks like benefits checking or appointment scheduling?
2. How do veteran mental models for organizing VA services differ from the current app categorization and labeling?
3. Which navigation pathways and search functionality issues directly contribute to the high task abandonment rate?
4. What are the most effective ways to reorganize content hierarchy to improve findability and task completion rates?

---

## 📊 Findings at a Glance

<table>
<tr>
<td width="33%" valign="top">

### 🔴 Critical Issues
**3 findings**

- Unlabeled interactive elements blocking accessibility
- Search function nearly unusable
- Extreme loading times preventing task completion

</td>
<td width="33%" valign="top">

### 🟡 Improvements Needed
**4 findings**

- Messaging system creates unnecessary barriers
- Benefits information lacks actionable details
- Edit buttons too small despite accessibility settings
- Navigation labels create confusion

</td>
<td width="33%" valign="top">

### 🟢 Working Well
**3 findings**

- Prescription management is smooth and efficient
- Appointment checking works well
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

Multiple interactive elements throughout the VA mobile app are announced only as "Button" by VoiceOver, providing no indication of their purpose or function. This creates fundamental accessibility barriers that prevent screen reader users from understanding or using critical app features.

#### Supporting Evidence

> "There's a button that just says 'Button' without any descriptive text. That's not helpful at all."
> 
> — **PT001** *Expert VoiceOver user attempting to navigate the app*

> "I shouldn't have to guess what buttons do. That's basic accessibility."
> 
> — **PT001** *Expressing frustration with unlabeled interface elements*

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

**Rationale:** Screen reader users require every interactive element to have meaningful labels to understand app functionality

**Owner:** Development Team

**Effort Estimate:** Medium

</details>

---

### Finding 2: Search Functionality Nearly Unusable Due to Poor Discoverability and Relevance

<table>
<tr>
<td width="70%" valign="top">

#### What We Observed

The search feature is hidden with a tiny magnifying glass icon that's difficult to discover, and when found, provides irrelevant generic articles instead of actionable forms needed for tasks. This leads participants to abandon search entirely and resort to phone support.

#### Supporting Evidence

> "There's a tiny magnifying glass icon in the top right corner"
> 
> — **PT002** *Describing difficulty finding the search function*

> "The search is hard to find and the results aren't great. I'd probably give up and call someone instead."
> 
> — **PT002** *Explaining why search failures lead to phone support dependency*

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

**Suggested Action:** Redesign search with prominent placement and improved result relevance algorithms

**Rationale:** Hidden search functionality effectively doesn't exist for users, driving them to alternative support channels

**Owner:** UX Design Team

**Effort Estimate:** High

</details>

---

### Finding 3: Extreme Loading Times Make App Nearly Unusable

<table>
<tr>
<td width="70%" valign="top">

#### What We Observed

Loading screens consistently took 45+ seconds with multiple timeout warnings, extending simple tasks to 6-10 minutes and making the app nearly unusable even for users adapted to slower rural internet connections.

#### Supporting Evidence

> "By the time this app loads what I need, I could have talked to a person and gotten my answer."
> 
> — **PT003** *Rural Alabama resident expressing frustration with loading times*

> "Well, I'm used to things being a bit slow out here in rural Alabama, but this is taking a while even for me."
> 
> — **PT003** *Indicating performance issues exceed even rural internet expectations*

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

**Rationale:** When app performance exceeds rural internet expectations, it signals critical optimization needs

**Owner:** Engineering Team

**Effort Estimate:** High

</details>

---

### Finding 4: Messaging System Creates Barriers for Simple Communication

<table>
<tr>
<td width="70%" valign="top">

#### What We Observed

Participants wanting to ask simple questions to their doctors had to navigate through confusing category systems that didn't match their mental model, turning straightforward communication into a complex multi-step process.

#### Supporting Evidence

> "I just want to ask my doctor a simple question, but I have to navigate through all these categories first."
> 
> — **PT002** *Describing frustration with categorical barriers in messaging*

> "What if my question doesn't fit neatly into these categories?"
> 
> — **PT002** *Questioning the rigid categorization system*

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

**Rationale:** Simple tasks should stay simple - categorical barriers prevent natural communication flow

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
| **Appointment Checking** | "This part actually works really well. It shows when I last refilled it, how many refills I have left, and the request button is obvious." | PT002 |
| **Large Text Accessibility** | "Actually, this looks pretty good. The text is nice and large, and everything fits on the screen properly." | PT003 |

---

## 👥 Participant Overview

| ID | Context | Key Contribution | Notable Quotes |
|:---|:--------|:-----------------|:---------------|
| **PT001** | Marine veteran with vision loss, expert VoiceOver user | Identified critical accessibility violations | "Just remember that some of us can't see the screen. We rely entirely on these labels and descriptions." |
| **PT002** | Navy veteran, regular app user for 2+ years | Highlighted search and messaging barriers | "Maybe keep the phone number handy for when you get stuck." |
| **PT003** | Army veteran from rural Alabama, uses accessibility features | Revealed performance issues exceeding rural expectations | "I have patience, but this app tests it." |

<details>
<summary><strong>📋 Sample Characteristics</strong></summary>

| Characteristic | Distribution |
|:---------------|:-------------|
| Total Participants | 3 |
| Service Branch | Army (1), Navy (1), Marine (1) |
| Geographic Location | Rural (1), Suburban (1), Urban (1) |
| Accessibility Needs | Vision impairment (1), Large text user (1) |

> [!NOTE]
> Small sample size limits generalizability, but findings represent diverse veteran experiences across accessibility needs and geographic contexts.

</details>

---

## 🔬 Methodology

| Aspect | Details |
|:-------|:--------|
| **Research Type** | User Interviews |
| **Sessions Conducted** | 3 |
| **Session Duration** | 60 minutes |
| **Research Focus** | Navigation structure, information architecture, and search functionality |
| **Recruitment Method** | Recruitment agency (67%), referral (33%) |
| **Data Collection** | Screen sharing, think-aloud protocols, mental model mapping |

---

## 🚀 Recommended Actions

### 🔴 Immediate Priority (Next 2 Weeks)

| # | Action | Addresses Finding | Owner | Effort |
|:-:|:-------|:------------------|:------|:------:|
| 1 | **Conduct accessibility audit and fix unlabeled buttons** | Critical accessibility violations | Development Team | M |
| 2 | **Redesign search with prominent placement** | Search function abandonment | UX Design Team | H |

### 🟡 Short-Term (1-2 Months)

| # | Action | Addresses Finding | Owner | Effort |
|:-:|:-------|:------------------|:------|:------:|
| 1 | **Implement low-bandwidth optimization** | Extreme loading times | Engineering Team | H |
| 2 | **Simplify messaging interface** | Communication barriers | UX Design Team | M |
| 3 | **Ensure consistent accessibility button sizing** | Edit buttons too small | Development Team | L |

### 🟢 Future Considerations

| # | Action | Addresses Finding | Notes |
|:-:|:-------|:------------------|:------|
| 1 | **Add historical claims information architecture** | Unable

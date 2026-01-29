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
| 🔴 | Unlabeled buttons and hidden search functionality create complete task failures | Veterans cannot complete basic tasks, forcing phone support dependency | Immediate accessibility audit and search redesign |
| 🟡 | Performance issues and complex navigation create user frustration | Extended task times and user abandonment in rural areas | Optimize for low-bandwidth and streamline workflows |
| 🟢 | Prescription management and logical menu structure work effectively | High user satisfaction and regular usage for core health tasks | Maintain and expand successful patterns |

---

## 🎯 Research Overview

### Why We Conducted This Research

This research informed the VA Mobile App product team's decisions on restructuring the main navigation menu, enhancing search functionality, and reorganizing information hierarchy for the Q1 2026 redesign. The findings help create a more intuitive app experience that allows Veterans to quickly find and access the services they need, reducing frustration and time spent navigating the app.

### Research Objectives

- **Identify** specific navigation pathways, information architecture flaws, and search functionality issues that contribute to the 45% task abandonment rate
- **Understand** veteran mental models and expectations for organizing health, benefits, and administrative information within the mobile app
- **Evaluate** the effectiveness and discoverability of search functionality, menu structures, and information categorization
- **Prioritize** the top 5 usability barriers with clear severity rankings to guide immediate redesign priorities

### Research Questions

1. Which navigation elements or search results cause confusion or frustration during critical tasks like benefits checking or appointment scheduling?
2. What gaps exist between user expectations and current categorization, labeling, and content hierarchy?
3. How do veterans expect VA services to be organized and grouped in navigation?
4. What specific recommendations will measurably reduce task abandonment and increase user satisfaction scores?

---

## 📊 Findings at a Glance

<table>
<tr>
<td width="33%" valign="top">

### 🔴 Critical Issues
**3 findings**

- Unlabeled interactive elements blocking screen reader users
- Search function nearly unusable with hidden placement
- Extreme loading times making app nearly unusable

</td>
<td width="33%" valign="top">

### 🟡 Improvements Needed
**4 findings**

- Messaging system creates unnecessary barriers
- Benefits section lacks actionable information
- Edit buttons too small despite accessibility settings
- Confusing duplicate navigation options

</td>
<td width="33%" valign="top">

### 🟢 Working Well
**3 findings**

- Prescription management smooth and efficient
- Logical main menu structure
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

Multiple interactive elements throughout the VA mobile app are announced only as "Button" by screen readers, providing no indication of their purpose or function. This creates fundamental accessibility barriers where users with vision impairments cannot understand what actions buttons will perform, making the interface completely unusable for critical tasks.

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

**Rationale:** Screen reader users require meaningful labels for every interactive element - without them, the interface becomes completely unusable regardless of visual design quality

**Owner:** Development Team

**Effort Estimate:** Medium

</details>

---

### Finding 2: Search Functionality Creates Task Abandonment

<table>
<tr>
<td width="70%" valign="top">

#### What We Observed

The search function is hidden with a tiny magnifying glass icon that's difficult to discover, and when found, provides irrelevant generic articles instead of actionable forms needed for tasks. This leads participants to abandon search entirely and rely on phone support instead.

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

**Rationale:** Hidden or poorly integrated features effectively don't exist for users, driving them to alternative support channels

**Owner:** UX Design Team

**Effort Estimate:** High

</details>

---

### Finding 3: Performance Issues Exceed Rural User Tolerance

<table>
<tr>
<td width="70%" valign="top">

#### What We Observed

Loading screens consistently took 45+ seconds with multiple timeout warnings, extending simple tasks to 6-10 minutes and making the app nearly unusable. Even users adapted to slower rural internet connections found the performance unacceptable.

#### Supporting Evidence

> "By the time this app loads what I need, I could have talked to a person and gotten my answer."
> 
> — **PT003** *Army veteran with rural internet access*

> "Well, I'm used to things being a bit slow out here in rural Alabama, but this is taking a while even for me."
> 
> — **PT003** *Expressing that performance exceeded even rural expectations*

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

**Rationale:** When app performance exceeds rural internet expectations, it signals critical optimization needs that affect a significant veteran population

**Owner:** Engineering Team

**Effort Estimate:** High

</details>

---

### Finding 4: Messaging System Creates Unnecessary Complexity

<table>
<tr>
<td width="70%" valign="top">

#### What We Observed

Users wanting to ask simple questions to their doctors must navigate through confusing category systems that don't match their mental models, turning straightforward communication into complex multi-step processes.

#### Supporting Evidence

> "I just want to ask my doctor a simple question, but I have to navigate through all these categories first."
> 
> — **PT002** *Describing messaging barriers*

> "What if my question doesn't fit neatly into these categories?"
> 
> — **PT002** *Questioning the categorical approach*

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

**Rationale:** Simple tasks should stay simple - users expect straightforward communication without categorical barriers

**Owner:** Product Team

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
| **PT001** | Marine veteran, expert VoiceOver user, regular app user (3-4x weekly) | Identified critical accessibility violations | "Just remember that some of us can't see the screen." |
| **PT002** | Navy veteran, 2+ years app experience, night shift worker | Revealed search and messaging system failures | "Maybe keep the phone number handy for when you get stuck." |
| **PT003** | Army veteran, 20 years service, rural Alabama with accessibility needs | Exposed performance issues exceeding rural tolerance | "I have patience, but this app tests it." |

<details>
<summary><strong>📋 Sample Characteristics</strong></summary>

| Characteristic | Distribution |
|:---------------|:-------------|
| Total Participants | 3 |
| Service Branch | Marine (1), Navy (1), Army (1) |
| Location Type | Rural (1), Suburban (1), Urban (1) |
| Accessibility Needs | Vision impairment (2), None noted (1) |

> [!NOTE]
> All participants were confirmed veterans with direct VA mobile app experience, representing diverse geographic and accessibility contexts.

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
| 1 | **Conduct accessibility audit and fix unlabeled buttons** | Critical accessibility violations | Development | M |
| 2 | **Redesign search with prominent placement** | Search function abandonment | UX Design | H |

### 🟡 Short-Term (1-2 Months)

| # | Action | Addresses Finding | Owner | Effort |
|:-:|:-------|:------------------|:------|:------:|
| 1 | **Implement low-bandwidth optimization** | Performance issues | Engineering | H |
| 2 | **Simplify messaging interface** | Messaging system barriers | Product | M |
| 3 | **Enhance benefits section detail** | Insufficient actionable information | Content | M |

### 🟢 Future Considerations

| # | Action | Addresses Finding | Notes |
|:-:|:-------|:------------------|:------|
| 1 | **Standardize action button placement** | Hidden interface elements | Establish design system patterns

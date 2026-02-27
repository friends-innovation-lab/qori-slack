# Observer Notes — VA Mobile App Navigation Study

---

## Session 1: Chuck Berry (PT001)
**62-year-old Navy veteran, iPhone 11, no assistive technology**
**Observer: Marcus Kim, Engineering Lead**

### Notes

Immediately went to the hamburger menu when asked to refill a prescription. Scrolled the full menu list twice before finding Health. Said "there's too much stuff in here" while scrolling. Tapped Health, then seemed confused by the sub-menu — paused for about 8 seconds staring at the screen before tapping Pharmacy.

Once in Pharmacy, found Prescriptions quickly but then struggled to identify WHICH prescription to refill. The list shows medication names in small type with no visual hierarchy. He squinted at the screen and held the phone closer. Tapped the wrong medication first (Lisinopril instead of Metformin), backed out, tried again.

The refill confirmation was buried below the fold on the prescription detail screen. He scrolled past it twice. When he finally found the Refill button, he said "why is this all the way down here?"

**Total taps for prescription refill: 8.** Home → Menu → Health → Pharmacy → Prescriptions → Wrong med → Back → Correct med → Scroll → Refill.

When asked to check claim status: went straight to hamburger again. This time chose Benefits on the first try but then got stuck at the Claims list. His active claim showed "Evidence Gathering Phase" as the status. He said "what does that even mean? Is that good or bad?" Tapped into the claim detail looking for a plain-English explanation. There wasn't one. He read the status description out loud slowly and said "I still don't know what this means."

**Technical note:** I watched the network tab during the claims screen load. Three sequential API calls to vets-api before content rendered. Total load time 2.4 seconds. The screen showed a blank white page with a spinner for the full duration. On his iPhone 11 the spinner animation was also choppy — looks like a main thread blocking issue during the JSON parse.

Back button behavior was correct in this session — no back stack corruption. But he did tap the hardware back button (swipe from left edge on iOS) at one point and it closed the hamburger instead of going back a screen. He looked confused and had to re-open the menu.

He never attempted to use search. When I asked about it afterward (during the debrief), he said "there's a search? Where?"

**Quick tags: Pain Point, Workaround, Quote**

---

## Session 2: Thom David Jones (PT002)
**34-year-old Army veteran, Samsung Galaxy S23, tech-savvy, no assistive technology**
**Observer: Tamara Tolson, Product Designer**

### Notes

Very different from PT001. Thom navigated confidently and fast. Found the hamburger immediately, scanned the menu quickly, went straight to Health → Pharmacy → Prescriptions. Completed the refill task in 6 taps and about 40 seconds. When I asked if it felt easy, he shrugged and said "I mean, I figured it out, but I shouldn't need to go through 4 screens to refill a pill I refill every month."

**Key quote:** "I've been using this app for two years. I've memorized where everything is. But if my dad tried to use this he'd give up in 30 seconds."

Claims status: found it quickly but had the SAME confusion about "Evidence Gathering Phase" that PT001 had. Different participant, same reaction. He said "they need a progress bar or something. Like a package tracker. Step 1, Step 2, Step 3. This legal language doesn't tell me anything."

**This is the second participant in a row confused by claim status labels. Pattern forming.**

Direct deposit task: this is where it got interesting. He went to Benefits first (logical guess). Didn't find it. Went back to hamburger, tried Profile. Found Personal Information but didn't see Direct Deposit immediately — it was below the fold. Scrolled down, found it. Said "why is my bank account under Personal Information? That's not personal information, that's financial information."

He tried search for the first time during the travel reimbursement task. Typed "travel" — got zero results. Tried "reimbursement" — zero results. Tried "travel pay" — zero results. Laughed and said "okay, search is useless." Found it eventually through Benefits → Additional Benefits → Travel Reimbursement. 4 taps. Then hit the BTSSS web view redirect and his whole demeanor changed. "Wait, why does it look different now? Am I still in the app?"

**The BTSSS redirect is jarring even for a tech-savvy user.** He noticed the URL bar appeared at the top, the VA app UI disappeared, and the web view had completely different styling. He completed the task but said "that felt like I left the app and went somewhere else." Which is exactly what happened.

Navigation recovery: tested what happens when he gets "lost." He navigated 4 levels deep into Health, then tried to get back to home. Used the back button 4 times (correct). But on one of those backs, the tab bar disappeared. He noticed immediately: "the bottom bar is gone." Had to close and reopen the app to get it back.

**I reproduced the disappearing tab bar bug.** It happened when navigating from a nested stack (Health → Pharmacy → Prescriptions → Detail) back to the Health root. The tab bar did not reappear. Jane's React Navigation 6 bug — confirmed in the wild.

He used the app confidently but was critical throughout. "This app works fine if you already know where everything is. The problem is the first 6 months. I almost gave up on it when I first downloaded it."

**Quick tags: Quote, Pain Point, Surprise, A11y**

---

## Session 3: Amanda Foster (PT003)
**62-year-old Navy veteran, iPhone SE (2nd gen), VoiceOver user, low vision + motor difficulties**
**Observer: Marcus Kim, Engineering Lead**

### Notes

This session was difficult to watch. Amanda has the app configured with VoiceOver, large text (accessibility size), and bold text enabled. Her iPhone SE screen is small (4.7 inches) and with large text, only about 3-4 UI elements are visible at a time. The hamburger menu items require extensive scrolling.

**VoiceOver navigation through the hamburger menu:** Amanda activated the menu by double-tapping. VoiceOver announced "Navigation menu" but did NOT announce how many items were in the list or the current position. She began swiping right to move through items. VoiceOver read each item: "Home. Health. Claims and appeals. Disability rating..." She swiped through 14 items before reaching Pharmacy (which is nested under Health, but VoiceOver doesn't indicate the hierarchy). She swiped past it because VoiceOver read "Pharmacy" without indicating it was a sub-item of Health.

She eventually found Prescriptions after about 2 minutes of swiping. Once in the prescriptions list, VoiceOver read medication names but NOT dosage or refill status. She had to tap into each medication to hear the details. With 6 active prescriptions, she opened 4 of them before finding the one she needed to refill.

**Key moment:** The Refill button on the prescription detail screen was not reachable via VoiceOver swipe navigation on the first attempt. Amanda swiped through the entire screen and VoiceOver jumped from the prescription details to the bottom tab bar, skipping the Refill button entirely. I believe the Refill button is rendered dynamically after the prescription data loads, and VoiceOver's accessibility tree doesn't update to include it.

She found the button on her second pass by using VoiceOver's explore-by-touch (dragging her finger across the screen). This is a workaround, not a solution. Total time for prescription refill: 4 minutes 38 seconds. Compare to PT002's 40 seconds.

**Technical note:** The Refill button appears to be injected into the DOM after the initial render via a useEffect that checks refill eligibility. VoiceOver captures the accessibility tree on initial render and doesn't re-scan unless focus changes. This is a known React Native accessibility issue — dynamically rendered interactive elements need to post an accessibility notification to trigger a re-scan. We're not doing that.

Claims status task: Amanda navigated to Claims via the hamburger. VoiceOver correctly read "Claims and appeals." She found her claim. But the status label "Evidence Gathering Phase" was even more problematic with VoiceOver — it was read as a flat text string with no additional context. She said "evidence gathering? What evidence? My evidence?" The status description paragraph was read as one continuous block with no pausing — roughly 45 seconds of unbroken speech. She couldn't parse it auditorily.

**Key quote:** "When it reads me a whole paragraph like that, I can't remember what the beginning said by the time it gets to the end. I need it broken up."

Direct deposit task: she went to Profile but VoiceOver's focus order inside Profile was wrong. It read: "Profile header. Back button. Settings gear icon. Your name, Amanda Foster." Then jumped to the bottom tab bar instead of continuing through the profile items. The content between the header and the tab bar — including Personal Information, Direct Deposit, Notification Settings — was completely skipped.

**The entire middle content area of the Profile screen is invisible to VoiceOver.** I suspect the content container is missing an accessible role or is overlapping with another element that captures focus.

She could not complete the direct deposit task with VoiceOver. After 3 minutes of trying, she turned VoiceOver off and used the screen visually with her face very close to the phone (low vision). Found Direct Deposit in about 30 seconds with vision but had difficulty tapping the correct items due to motor difficulties — the touch targets are 36x36px, below the 44x44px minimum recommended by Apple.

Travel reimbursement: did not attempt. Amanda was visibly fatigued after the direct deposit failure. We ended the session early per protocol.

**Post-session:** Amanda was gracious but clearly frustrated. She said: "I know they try. But sometimes I feel like this app wasn't made for people like me. I end up calling the VA number instead because at least a person can understand what I need."

**Technical observations:**
- VoiceOver focus order is broken on at least 3 screens (hamburger menu, Profile, prescription detail)
- Dynamic content (Refill button) is not posting accessibility notifications
- Touch targets throughout the app are 36px, below Apple's 44px minimum
- Large text mode causes horizontal text truncation on navigation labels — "Prescriptions" becomes "Prescript..." which VoiceOver reads as "prescript dot dot dot"
- The BTSSS web view redirect would be completely disorienting for a VoiceOver user — we didn't test it because the session ended early, but the context switch between native app and web view with different accessibility implementations would likely be a complete blocker

**This session alone justifies prioritizing accessibility in the navigation redesign. The app is functionally unusable for this participant.**

**Quick tags: A11y, Pain Point, Quote, Surprise**


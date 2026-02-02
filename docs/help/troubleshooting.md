# Troubleshooting Qori

Common issues and how to resolve them.

---

## Modal Issues

### Modal doesn't open

**Symptoms:** You run a slash command but no modal appears.

**Possible causes:**
1. Slack app permissions issue
2. Bot not installed in channel
3. Network timeout

**Solutions:**
1. Try running the command in a different channel
2. Check if you can see the Qori bot in the channel member list
3. Wait 30 seconds and try again
4. Ask admin to reinstall the Slack app

### Modal closes unexpectedly

**Symptoms:** Modal disappears before you submit.

**Possible causes:**
1. Session timeout (modals expire after 30 minutes)
2. Network interruption
3. Slack app restarted

**Solutions:**
1. Re-run the command and work faster
2. Copy your text to a note before submitting
3. Check #qori-support for any maintenance notices

### Form validation errors

**Symptoms:** Red error messages appear when trying to submit.

**Common errors:**
- "This field is required" - Fill in the missing field
- "Text is too long" - Shorten your input
- "Invalid format" - Check the placeholder text for expected format

---

## Output Issues

### Output not appearing in GitHub

**Symptoms:** You submitted the form but can't find the output.

**Possible causes:**
1. GitHub sync delay
2. Wrong repository selected
3. File path issue

**Solutions:**
1. Wait 2-3 minutes and refresh GitHub
2. Check you're looking in the correct study folder
3. Check your Slack DMs for the confirmation message with file link
4. Ask Sam: `/qori-sam where did my research plan go?`

### AI-generated content is incorrect

**Symptoms:** The generated document has wrong information or bad formatting.

**Possible causes:**
1. Input fields were unclear
2. AI interpretation error
3. Template formatting issue

**Solutions:**
1. Review your inputs - were they clear and complete?
2. Edit the output directly in GitHub
3. Regenerate with more specific inputs
4. Report to Sam if it's a consistent issue

### Wrong study selected

**Symptoms:** Output went to the wrong study folder.

**Solutions:**
1. Copy the content to the correct location
2. Delete the misplaced file
3. Re-run the command with the correct study selected

---

## Session Notes Issues

### Notes not structured correctly

**Symptoms:** AI didn't extract quotes, timestamps, or organize sections properly.

**Possible causes:**
1. Notes didn't include clear markers (quotes in "", timestamps)
2. Notes too short for meaningful extraction

**Solutions:**
1. Use quote marks around participant quotes: `"This is confusing"`
2. Include timestamps: `Minute 5: User struggled with...`
3. Be explicit about emotions: `User became frustrated when...`

### Session not appearing in dropdown

**Symptoms:** Can't find your session when trying to take notes.

**Possible causes:**
1. Session not added to participant tracker
2. Session date is outside the 7-day window
3. Sync delay

**Solutions:**
1. Add the session via `/qori-participants`
2. Enter session ID manually
3. Wait a few minutes and reload the modal

---

## Participant Outreach Issues

### Wrong participant info auto-filled

**Symptoms:** Email shows wrong name, study, or details.

**Possible causes:**
1. Participant data out of date in tracker
2. Wrong participant selected

**Solutions:**
1. Update participant info in tracker first
2. Edit the generated email before sending

### Email tone doesn't match needs

**Symptoms:** Email is too formal/informal for your context.

**Solutions:**
1. Edit the generated email directly
2. Regenerate with different inputs
3. Request tone adjustment from Sam

---

## Synthesis Issues

### Not enough data for synthesis

**Symptoms:** Synthesis output is thin or generic.

**Possible causes:**
1. Too few sessions analyzed
2. Session notes lack detail
3. Methodology mismatch

**Solutions:**
1. Ensure at least 5 sessions are complete
2. Enrich session notes with more detail
3. Choose a synthesis type that matches your data

### Journey map stages don't match product

**Symptoms:** Generic stages that don't reflect your specific product.

**Solutions:**
1. Re-run with more specific product context
2. Edit the output to match your journey
3. Provide stage names in your inputs

---

## Connection Issues

### "Something went wrong" error

**Symptoms:** Generic error message after submitting.

**Possible causes:**
1. Backend service temporarily unavailable
2. Network timeout
3. Rate limiting

**Solutions:**
1. Wait 1 minute and try again
2. Check #qori-support for service status
3. Escalate to Sam if persistent

### Slow response times

**Symptoms:** Commands take a long time to respond.

**Possible causes:**
1. High system load
2. Large AI processing task
3. Network latency

**Solutions:**
1. Wait for completion - don't resubmit
2. Try again during off-peak hours
3. Report persistent slowness to Sam

---

## Getting More Help

### Ask Sam

For any issue, try asking Sam first:

```
/qori-sam [describe your issue]
```

Sam can:
- Diagnose common problems
- Check configuration files
- Escalate to the team

### Support Channel

Post in `#qori-support` with:
1. What command you ran
2. What you expected to happen
3. What actually happened
4. Any error messages

### Bug Reports

For bugs, include:
1. Steps to reproduce
2. Screenshots if possible
3. Your Slack username
4. Approximate time it happened

Post in `#qori-bugs` or tell Sam to escalate.

---

## Prevention Tips

1. **Save your work** - Copy long text inputs before submitting
2. **Check your study** - Make sure you've selected the right study
3. **Review outputs** - Always review AI-generated content
4. **Keep inputs clear** - More specific inputs = better outputs
5. **Report issues** - Help us improve by reporting problems

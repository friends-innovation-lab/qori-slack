# Three Changes to Apply to Your Existing App.jsx

## CHANGE 1: Add helper function (after line ~280, after formatUSD)

```javascript
// Helper to calculate billed rate from cost + markup %
const calculateBilledRate = (costRate, markupPercent) => {
  return costRate * (1 + markupPercent / 100);
};
```

## CHANGE 2: Update role initialization (everywhere roles are created)

Replace:
```javascript
subBilledRate: 0,
```

With:
```javascript
subMarkupPercent: 0,
```

## CHANGE 3: Update RoleDrawer subcontractor fields (around line 2050)

Find this section:
```javascript
{role.company !== "Prime" && (
  <>
    <div>
      <label>Sub Cost Rate ($/hr)</label>
      <Input ... />
    </div>
    <div>
      <label>Gov Billed Rate ($/hr)</label>
      <Input
        value={role.subBilledRate || ""}
        onChange={(e) => onChange({ ...role, subBilledRate: Number(e.target.value) })}
      />
    </div>
  </>
)}
```

Replace with:
```javascript
{role.company !== "Prime" && (
  <>
    <div>
      <label className="text-xs text-gray-400 font-bold uppercase mb-2 block">
        Sub Cost Rate ($/hr)
      </label>
      <Input
        type="number"
        step="0.01"
        value={role.subCostRate || ""}
        onChange={(e) =>
          onChange({ ...role, subCostRate: Number(e.target.value) })
        }
        placeholder="What we pay sub"
      />
    </div>
    <div>
      <label className="text-xs text-gray-400 font-bold uppercase mb-2 block">
        Prime Markup %
      </label>
      <Input
        type="number"
        step="0.5"
        min="0"
        value={role.subMarkupPercent ?? ""}
        onChange={(e) => {
          const value = e.target.value;
          onChange({
            ...role,
            subMarkupPercent: value ? Number(value) : 0,
          });
        }}
        placeholder="e.g., 15"
      />
      <div className="text-[10px] text-gray-500 mt-1">
        Gov rate = Cost × (1 + Markup%)
        {role.subCostRate && role.subMarkupPercent != null && (
          <div className="text-[#4ECDC4] mt-1">
            → ${calculateBilledRate(role.subCostRate, role.subMarkupPercent).toFixed(2)}/hr billed to gov
          </div>
        )}
      </div>
    </div>
  </>
)}
```

## CHANGE 4: Update all calculations that use subBilledRate

Find every instance of:
```javascript
role.subBilledRate
```

Replace with:
```javascript
calculateBilledRate(role.subCostRate, role.subMarkupPercent)
```

OR for conditional checks:
```javascript
const billedRate = role.subCostRate && role.subMarkupPercent != null
  ? calculateBilledRate(role.subCostRate, role.subMarkupPercent)
  : 0;
```

## CHANGE 5: Add deduplication (in Main App component, before filtered)

Add this useMemo hook around line 4200:
```javascript
// Deduplicate roles by key
const deduplicatedRoles = useMemo(() => {
  const roleMap = new Map();
  
  roles.forEach((role) => {
    const displayName = role.customRoleName || (mode === "gsa" ? role.gsaRole : role.role);
    const key = `${displayName}-${role.level}-${role.company}-${role.subName || ''}-${role.subCostRate || 0}-${role.subMarkupPercent || 0}`;
    
    if (!roleMap.has(key)) {
      roleMap.set(key, {
        ...role,
        dedupKey: key,
        originalRoles: [role],
      });
    } else {
      const existing = roleMap.get(key);
      existing.originalRoles.push(role);
    }
  });
  
  return Array.from(roleMap.values());
}, [roles, mode]);
```

Then update the filtered useMemo to use deduplicatedRoles:
```javascript
const filtered = useMemo(() => {
  const q = search.trim().toLowerCase();
  if (!q) return deduplicatedRoles;  // Changed from 'roles'
  return deduplicatedRoles.filter((r) =>  // Changed from 'roles'
    [r.role, r.level, r.company, r.subName || ""]
      .join(" ")
      .toLowerCase()
      .includes(q)
  );
}, [deduplicatedRoles, search]);  // Changed dependency
```

## CHANGE 6: Update RoleRow to show total hours

In the RoleRow rendering section, calculate total hours:
```javascript
filtered.map((r, i) => {
  const firstOriginalRole = r.originalRoles ? r.originalRoles[0] : r;
  const actualIndex = roles.findIndex(
    (role) => role.id === firstOriginalRole.id
  );
  
  // Calculate total hours across all periods
  let totalHours = 0;
  if (r.originalRoles) {
    r.originalRoles.forEach(role => {
      role.allocations.filter(a => a.active).forEach(allocation => {
        const period = periods.find(p => p.id === allocation.periodId);
        if (period) {
          totalHours += (bidHours / 12) * period.duration * allocation.fte;
        }
      });
    });
  }
  
  const preview = calculateRolePreview(r);
  
  return (
    <RoleRow
      key={r.dedupKey || r.id}
      role={r}
      mode={mode}
      onEdit={() => handleEditRole(actualIndex)}
      // ... other props
      totalHours={totalHours}  // NEW PROP
    />
  );
})
```

Update RoleRow component signature to accept totalHours:
```javascript
function RoleRow({
  role,
  onEdit,
  onRemove,
  onDuplicate,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
  ratePreview,
  mode,
  totalHours,  // NEW
}) {
```

And display it:
```javascript
{ratePreview && (
  <div className="text-right mr-2">
    <div className="text-[#4ECDC4] font-bold">
      ${ratePreview.bidRate}/hr
    </div>
    <div className="text-xs text-gray-400">
      {formatUSD(totalHours)} hrs total  {/* Changed from periodHours */}
    </div>
  </div>
)}
```

## CHANGE 7: Add Auto-Negotiation Panel

Add this new component before ResultsPanel (around line 2850):
```javascript
function AutoNegotiationPanel({
  roles,
  setRoles,
  targetBid,
  currentTotal,
  bidHours,
  periods,
  onCalculate,
}) {
  if (!targetBid || targetBid === 0 || !currentTotal) return null;

  const diff = currentTotal - targetBid;
  const isOverBudget = diff > 0;
  const isOnTarget = Math.abs(diff) < targetBid * 0.01;

  if (isOnTarget || !isOverBudget) return null;

  const applyStrategy = (strategy) => {
    const updated = roles.map((role) => {
      if (role.company === "Prime") return role;
      
      const currentMarkup = role.subMarkupPercent || 0;
      let newMarkup = currentMarkup;
      
      if (strategy === "aggressive") {
        newMarkup = currentMarkup * 0.5;  // -50%
      } else if (strategy === "balanced") {
        newMarkup = currentMarkup * 0.75; // -25%
      } else if (strategy === "conservative") {
        newMarkup = currentMarkup * 0.85; // -15%
      }
      
      return {
        ...role,
        subMarkupPercent: Math.max(0, newMarkup),
      };
    });
    
    setRoles(updated);
    setTimeout(() => onCalculate(), 100);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-[#4ECDC4]" />
          <CardTitle>Auto-Negotiation</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-3 bg-[#FF6B6B]/10 rounded-lg border border-[#FF6B6B]/30">
          <div className="text-white font-bold text-sm mb-1">
            Over Budget by ${formatUSD(diff)}
          </div>
          <div className="text-xs text-gray-400">
            Click a strategy below to auto-adjust sub markups
          </div>
        </div>

        <div className="space-y-2">
          <button
            onClick={() => applyStrategy("aggressive")}
            className="w-full p-3 rounded-xl border-2 border-[#FF6B6B]/30 hover:border-[#FF6B6B]/60 bg-[#363855] hover:bg-[#FF6B6B]/10 transition-all text-left group"
          >
            <div className="flex items-center justify-between mb-1">
              <div className="text-white font-semibold text-sm flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-[#FF6B6B]" />
                Aggressive
              </div>
              <div className="text-[#FF6B6B] text-xs font-bold">-50% markup</div>
            </div>
            <div className="text-xs text-gray-400">
              Cut all sub markups in half. Use when you must hit target.
            </div>
          </button>

          <button
            onClick={() => applyStrategy("balanced")}
            className="w-full p-3 rounded-xl border-2 border-[#4ECDC4]/30 hover:border-[#4ECDC4]/60 bg-[#363855] hover:bg-[#4ECDC4]/10 transition-all text-left group"
          >
            <div className="flex items-center justify-between mb-1">
              <div className="text-white font-semibold text-sm flex items-center gap-2">
                <Target className="w-4 h-4 text-[#4ECDC4]" />
                Balanced
              </div>
              <div className="text-[#4ECDC4] text-xs font-bold">-25% markup</div>
            </div>
            <div className="text-xs text-gray-400">
              Reasonable reduction while maintaining decent margins.
            </div>
          </button>

          <button
            onClick={() => applyStrategy("conservative")}
            className="w-full p-3 rounded-xl border-2 border-[#45B8AC]/30 hover:border-[#45B8AC]/60 bg-[#363855] hover:bg-[#45B8AC]/10 transition-all text-left group"
          >
            <div className="flex items-center justify-between mb-1">
              <div className="text-white font-semibold text-sm flex items-center gap-2">
                <Check className="w-4 h-4 text-[#45B8AC]" />
                Conservative
              </div>
              <div className="text-[#45B8AC] text-xs font-bold">-15% markup</div>
            </div>
            <div className="text-xs text-gray-400">
              Small adjustment, test if it gets you close enough.
            </div>
          </button>
        </div>

        <div className="p-3 bg-[#363855]/30 rounded-lg border border-[#4A4D6D]/20">
          <div className="text-[10px] text-gray-400">
            💡 <strong>These buttons adjust sub markup %</strong> for all subs proportionally.
            After clicking, rates auto-update. You can fine-tune individual subs in their role cards.
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

Then add it to ResultsPanel:
```javascript
function ResultsPanel({
  results,
  periods,
  justifications,
  roles,
  setRoles,  // NEW
  bidHours,
  profitMargin,
  escalationRate,
  mode,
  targetBid,
  onCalculate,  // NEW
}) {
  // ... existing code ...
  
  return (
    <div className="sticky top-20 max-h-[calc(100vh-96px)] overflow-y-auto space-y-4">
      {/* Target Status */}
      <NegotiationStrategyPanel ... />
      
      {/* NEW: Auto-Negotiation Panel */}
      <AutoNegotiationPanel
        roles={roles}
        setRoles={setRoles}
        targetBid={targetBid}
        currentTotal={results?.totalProjectCost}
        bidHours={bidHours}
        periods={periods}
        onCalculate={onCalculate}
      />
      
      {/* Rest of existing panels */}
      <CompetitiveScenarios ... />
      // ...
    </div>
  );
}
```

And update the ResultsPanel call in Main App:
```javascript
<ResultsPanel
  results={results}
  periods={periods}
  justifications={justifications}
  roles={roles}
  setRoles={setRoles}  // NEW
  bidHours={bidHours}
  profitMargin={profitMargin}
  escalationRate={escalationRate}
  mode={mode}
  targetBid={targetBid}
  onCalculate={calculateBidRates}  // NEW
/>
```

---

## Summary

These 7 changes implement all three requested features:
1. ✅ Sub cost + markup % input (auto-calculates gov rate)
2. ✅ Role deduplication (one card with total hours)
3. ✅ Auto-negotiation buttons (3 strategies)

Apply them in order to your existing file.

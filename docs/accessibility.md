# Accessibility Guidelines

This document outlines accessibility (a11y) standards and practices for the Herakoi web application.

## Keyboard Navigation Patterns

Keyboard navigation is fundamental to web accessibility, enabling users who cannot use a mouse to interact with the application effectively. Herakoi implements two complementary keyboard navigation patterns following WAI-ARIA best practices.

### Tab Key Navigation

The **Tab** key provides **structural navigation** between different interactive elements across the interface.

**Use Tab for:**
- Moving between distinct interactive elements (buttons, links, form fields, custom controls)
- Navigating across different sections or regions of the interface
- Following the document's logical reading order
- Entering and exiting composite components

**Implementation details:**
- Tab moves focus forward through the tab sequence
- Shift+Tab moves focus backward
- The tab order should follow visual layout and logical reading order (left-to-right, top-to-bottom for LTR languages)
- Only one element within a composite component should be in the tab sequence (the active element)
- Use `tabindex="0"` to include custom elements in the natural tab order
- Use `tabindex="-1"` to remove elements from tab sequence while keeping them programmatically focusable
- Never use positive `tabindex` values as they disrupt natural document flow

**Example scenarios in Herakoi:**
- Tab from the "Start" button to the "Image Upload" button
- Tab from image controls to mode selection buttons
- Tab from debug panel toggle to settings controls

### Arrow Key Navigation

**Arrow keys** provide **granular navigation** within composite widgets and related option groups.

**Use Arrow keys for:**
- Navigating between options within the same logical group (radio buttons, tabs, menu items)
- Moving through items in composite components (listboxes, trees, grids)
- Controlling selection within single-focus containers
- Fine-tuned navigation where Tab would be too coarse

**Implementation details:**
- Arrow keys typically move focus within a component without leaving it
- Use roving tabindex pattern: only the active item has `tabindex="0"`, others have `tabindex="-1"`
- Update `tabindex` dynamically as focus moves via arrow keys
- Common patterns:
  - **Left/Right arrows**: horizontal navigation (tabs, horizontal radio groups, sliders)
  - **Up/Down arrows**: vertical navigation (menus, vertical radio groups, listboxes)
  - **All four arrows**: two-dimensional navigation (grids, tree views)
- Home/End keys often jump to first/last item in a group
- Arrow key behavior should be intuitive and match native platform controls

**Example scenarios in Herakoi:**
- Arrow keys to navigate between different oscillator type radio buttons
- Arrow keys to move between tabs in a hypothetical settings panel
- Arrow keys to adjust slider values for frequency range controls

### Navigation Pattern Decision Tree

When implementing a new interactive component, ask:

1. **Is this a single, atomic control?** (button, checkbox, text input)
   - Include it in the Tab sequence
   - No arrow key handling needed

2. **Is this a group of related options where only one can be selected?** (radio buttons, tabs, single-select listbox)
   - Include only the selected/active option in Tab sequence
   - Use arrow keys to navigate between options
   - Implement roving tabindex

3. **Is this a multi-dimensional structure?** (grid, tree view, complex widget)
   - Include only the active cell/node in Tab sequence
   - Use arrow keys for navigation within the structure
   - Consider Home/End/PageUp/PageDown for larger structures

4. **Does this contain multiple independent interactive elements?** (toolbar, form section)
   - Include each element in Tab sequence if they're not part of a roving tabindex pattern
   - Consider whether arrow keys should provide shortcuts between frequently-used items

## ARIA Attributes and Semantic HTML

### Role Assignment

Use semantic HTML elements first, ARIA roles only when necessary:
- Prefer `<button>` over `<div role="button">`
- Prefer `<nav>` over `<div role="navigation">`
- Use ARIA roles for custom widgets without native equivalents (e.g., `role="slider"`, `role="tab"`)

### Essential ARIA Attributes

**For interactive controls:**
- `aria-label`: Provides accessible name when visual label is absent
- `aria-labelledby`: References visible label element(s)
- `aria-describedby`: Links to descriptive text (help text, error messages)
- `aria-disabled="true"`: Indicates disabled state (better than `disabled` attribute for custom controls)
- `aria-pressed`: Indicates toggle button state (`true`, `false`, `mixed`)

**For dynamic content:**
- `aria-live`: Announces changes to screen readers (`polite`, `assertive`, `off`)
- `aria-atomic`: Whether to announce entire region or just changes
- `aria-relevant`: What types of changes to announce (additions, removals, text, all)

**For component state:**
- `aria-expanded`: Indicates expandable element state (true/false)
- `aria-selected`: Indicates selection state in tab lists, listboxes
- `aria-checked`: Indicates checkbox or switch state
- `aria-current`: Marks current item in a set (page, step, location, date, time, true)

### Focus Management

**Visual focus indicators:**
- All interactive elements must have visible focus styles
- Focus outline should have minimum 3:1 contrast ratio against background
- Use `:focus-visible` to show focus only for keyboard navigation (hides focus ring for mouse clicks)
- Never use `outline: none` without providing alternative focus indicator

**Programmatic focus:**
- Use `element.focus()` to move focus after dynamic changes (opening modal, showing error, completing action)
- Trap focus within modal dialogs (Tab at last element wraps to first)
- Restore focus to trigger element when closing dialogs or menus
- Skip links should be the first focusable element, allowing users to bypass repetitive navigation

**Focus order:**
- Follow visual layout and logical reading order
- Group related controls together in tab sequence
- Form fields should follow natural completion order
- Don't create focus traps except in modal contexts

## Screen Reader Considerations

### Meaningful Labels

Every interactive element needs an accessible name:
```html
<!-- Good: visible label -->
<label for="image-upload">Choose Image</label>
<input type="file" id="image-upload" />

<!-- Good: aria-label for icon-only button -->
<button aria-label="Play audio">
  <svg>...</svg>
</button>

<!-- Good: aria-labelledby for multiple label sources -->
<div id="osc-group-label">Oscillator Type</div>
<div role="radiogroup" aria-labelledby="osc-group-label">
  <input type="radio" id="sine" name="osc" />
  <label for="sine">Sine</label>
  <!-- ... -->
</div>
```

### Status Messages and Notifications

Use ARIA live regions for dynamic feedback:
```html
<!-- Polite: waits for screen reader to finish current announcement -->
<div role="status" aria-live="polite" aria-atomic="true">
  Hand detected: tracking index finger
</div>

<!-- Assertive: interrupts current announcement (use sparingly) -->
<div role="alert" aria-live="assertive">
  Error: Camera access denied
</div>
```

### Hidden Content

Control what screen readers perceive:
- `aria-hidden="true"`: Hides decorative elements from assistive tech
- `hidden` attribute: Removes element from both visual and accessibility tree
- `visibility: hidden` / `display: none`: Hides element and removes from accessibility tree
- Visually-hidden pattern: Element visible to screen readers but not sighted users
  ```css
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border-width: 0;
  }
  ```

## Testing Strategy

### Automated Testing

**ESLint jsx-a11y Plugin:**
- Configured in `.eslintrc.cjs` to catch common a11y issues
- Runs via `pnpm lint:a11y`
- Enforces rules for alt text, ARIA usage, keyboard handlers, semantic HTML
- See ADR 005 for rationale on dual-linting approach (Biome + ESLint)

**Limitations of automated testing:**
- Cannot verify focus order makes sense
- Cannot detect misleading or unhelpful labels
- Cannot validate keyboard interaction patterns fully
- Cannot assess cognitive load or content clarity

### Manual Testing

**Keyboard-only testing:**
1. Unplug mouse or don't use trackpad
2. Navigate entire application using only keyboard
3. Verify all functionality is accessible via keyboard
4. Check focus indicators are always visible
5. Ensure no keyboard traps exist (except intentional modal traps)

**Screen reader testing:**
- **macOS**: VoiceOver (Cmd+F5 to enable)
- **Windows**: NVDA (free) or JAWS (paid)
- **Linux**: Orca
- Test with screen reader:
  - Navigate by headings (VoiceOver: VO+Cmd+H)
  - Navigate by landmarks (VoiceOver: VO+U, then use arrow keys)
  - Navigate by form controls
  - Verify all content and controls are announced clearly
  - Check that dynamic changes are announced appropriately

**Browser dev tools:**
- Chrome DevTools Accessibility panel shows:
  - Accessibility tree
  - ARIA attributes
  - Computed accessible name
  - Contrast ratios
- Firefox Accessibility Inspector offers similar features
- Lighthouse accessibility audit provides automated scoring

### Herakoi-Specific Testing Scenarios

Test these critical user flows for accessibility:

1. **Starting the application:**
   - Can user start camera with keyboard only?
   - Is camera permission prompt announced to screen readers?
   - What happens if camera access is denied?

2. **Uploading custom image:**
   - Can file input be triggered via keyboard?
   - Is file name announced after selection?
   - Are upload errors clearly communicated?

3. **Controlling audio:**
   - Can oscillator type be changed via keyboard?
   - Are frequency and volume changes announced?
   - Can audio be started/stopped via keyboard?

4. **Using debug panel:**
   - Can debug panel be toggled via keyboard?
   - Is panel state (open/closed) announced?
   - Can debug controls be accessed via keyboard?

5. **Switching modes:**
   - Can user switch between one-channel and three-channel modes?
   - Is current mode clearly indicated?
   - Are mode-specific controls properly labeled?

## Herakoi Implementation Notes

### Current Accessibility Features

Based on recent work (commits `123549d`, `712f35d`):
- Keyboard navigation support added across UI components
- Accessibility labels implemented for interactive controls
- Focus management for dynamic content
- ARIA attributes for custom widgets

### Areas for Future Improvement

- **Live region for hand tracking state**: Announce when hand enters/exits frame, which finger is active
- **Keyboard shortcuts**: Consider adding shortcuts for common actions (space to start/stop, number keys to switch oscillator type)
- **Reduced motion support**: Respect `prefers-reduced-motion` media query for animations
- **High contrast mode**: Test appearance in Windows High Contrast Mode
- **Zoom support**: Ensure layout remains usable at 200% zoom
- **Focus indicators in video overlay**: Consider how to show focus for controls overlaying camera feed

## Resources

### WAI-ARIA Authoring Practices Guide (APG)
- Comprehensive patterns for common widgets: https://www.w3.org/WAI/ARIA/apg/patterns/
- Keyboard interaction patterns
- Example implementations with code

### WCAG 2.1 Guidelines
- Level A: Minimum accessibility (must meet)
- Level AA: Target standard (should meet) - required for many legal compliance needs
- Level AAA: Enhanced accessibility (optional)

### Testing Tools
- axe DevTools (browser extension)
- WAVE Web Accessibility Evaluation Tool
- Pa11y (command-line automated testing)
- Accessibility Insights for Web

### Further Reading
- WebAIM: https://webaim.org/
- The A11Y Project: https://www.a11yproject.com/
- MDN Accessibility: https://developer.mozilla.org/en-US/docs/Web/Accessibility

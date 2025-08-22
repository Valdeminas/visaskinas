# iPhone + Chrome Keyboard Resizing Fix

This implementation fixes the issue where web pages don't resize properly when the keyboard appears on iPhone devices, particularly in Chrome and Safari.

## Problem Description

On iOS, when the keyboard shows:
- The **visual viewport** shrinks (the actual visible area)
- The **layout viewport** does NOT shrink (the page layout dimensions)
- `window.innerHeight` and `100vh` still report the full screen height
- The browser pans the page upward instead of resizing the layout
- This causes layout issues and poor user experience

## Solution Overview

The fix uses the `window.visualViewport` API (supported in Chrome iOS and Safari iOS) to:
1. Detect when the keyboard appears/disappears
2. Update a custom CSS variable `--vh` with the actual viewport height
3. Use this variable instead of `100vh` in CSS
4. Automatically handle input focus and scrolling

## Implementation Details

### 1. JavaScript Changes (`app.js`)

#### Visual Viewport Handling
```javascript
function setupVisualViewportHandling() {
    if (window.visualViewport) {
        function updateVh() {
            const vh = window.visualViewport.height * 0.01;
            document.documentElement.style.setProperty('--vh', `${vh}px`);
        }
        
        window.visualViewport.addEventListener('resize', updateVh);
        window.visualViewport.addEventListener('scroll', updateVh);
        updateVh(); // Set initial value
    }
}
```

#### Keyboard Detection
```javascript
// Detect keyboard visibility based on viewport height changes
const heightDifference = lastViewportHeight - currentHeight;

if (heightDifference > 150 && !keyboardVisible) {
    keyboardVisible = true;
    document.body.classList.add('keyboard-visible');
} else if (heightDifference < -50 && keyboardVisible) {
    keyboardVisible = false;
    document.body.classList.remove('keyboard-visible');
}
```

#### Input Focus Handling
```javascript
function setupInputFocusHandling() {
    document.querySelectorAll('input, textarea').forEach(el => {
        el.addEventListener('focus', () => {
            setTimeout(() => {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 300); // Wait for keyboard animation
        });
    });
}
```

#### Fallback Support
For browsers that don't support `visualViewport`, a fallback uses `window.resize` events to estimate viewport changes.

### 2. CSS Changes (`styles.css`)

#### Custom Viewport Height Variable
```css
:root {
    --vh: 1vh; /* Fallback value */
}
```

#### Replace 100vh with Custom Variable
```css
/* Before */
body {
    height: 100vh;
    height: 100dvh;
}

/* After */
body {
    height: calc(var(--vh, 1vh) * 100);
}
```

#### Keyboard State Classes
```css
body.keyboard-visible {
    overflow: hidden;
    position: fixed;
    width: 100%;
    height: calc(var(--vh, 1vh) * 100);
}

body.keyboard-visible .main-container {
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    max-height: calc(var(--vh, 1vh) * 100);
}
```

#### Smooth Transitions
```css
body {
    transition: height 0.3s ease-out;
}

.main-container {
    transition: min-height 0.3s ease-out, padding-bottom 0.3s ease-out;
}
```

### 3. Key Features

- **Automatic Detection**: Automatically detects when keyboard appears/disappears
- **Smooth Resizing**: Page resizes smoothly with CSS transitions
- **Input Focus**: Automatically scrolls inputs into view when focused
- **Fallback Support**: Works on browsers without visualViewport API
- **Orientation Handling**: Handles device orientation changes
- **Performance Optimized**: Uses `will-change` and `transform: translateZ(0)` for smooth animations

## Browser Support

- ✅ **Chrome iOS** (iOS 13+)
- ✅ **Safari iOS** (iOS 13+)
- ✅ **Chrome Android** (Android 6+)
- ✅ **Safari macOS** (macOS 10.15+)
- ✅ **Fallback**: Other browsers use window resize events

## Testing

### Test Page
Use `test-keyboard.html` to test the implementation:
1. Open on iPhone with Chrome or Safari
2. Tap the search input
3. Observe smooth page resizing
4. Check console for debugging information

### Manual Testing
1. Open the main app on iPhone
2. Navigate to search mode
3. Tap the search input
4. Verify the page resizes smoothly
5. Check that the sticky bottom element stays visible

## Debugging

The implementation includes console logging:
- Viewport height updates
- Keyboard visibility detection
- Input focus events
- Fallback mode activation

## Performance Considerations

- Uses `requestAnimationFrame` for smooth updates
- CSS transitions for smooth animations
- Minimal DOM manipulation
- Efficient event handling

## Troubleshooting

### Common Issues

1. **Page doesn't resize**: Check if `--vh` variable is being set correctly
2. **Jumpy animations**: Ensure CSS transitions are enabled
3. **Input not visible**: Check z-index values and positioning
4. **Fallback not working**: Verify window resize events are firing

### Debug Steps

1. Check console for error messages
2. Verify `--vh` CSS variable is being updated
3. Test with different input types
4. Check device orientation changes
5. Verify fallback mode activation

## Future Improvements

- Add support for split-screen mode
- Implement virtual keyboard height detection
- Add support for external keyboards
- Optimize for different device sizes
- Add accessibility improvements

## Credits

This implementation is based on the solution proposed by ChatGPT and enhanced with:
- Robust error handling
- Fallback support
- Performance optimizations
- Comprehensive testing
- Detailed documentation

# AquaSense Design System

## Overview
This document defines the complete design system for the AquaSense application - a professional, modern IoT water quality monitoring dashboard for crayfish farming.

## Color Palette

### Primary Colors
- **Primary (Dark Blue)**: `#1E3A8A` - Used for navbar, headings, structure, and primary actions
- **Accent (Aqua/Cyan)**: `#06B6D4` - Used for highlights, buttons, active states, and interactive elements
- **Background (White)**: `#FFFFFF` - Main background for maximum readability
- **Surface (Light Gray)**: `#F8FAFC` - Card backgrounds and section separation

### Semantic Colors
- **Success (Green)**: `#10B981` - Safe/normal states, positive indicators
- **Warning (Yellow)**: `#F59E0B` - Caution alerts and warnings
- **Danger (Red)**: `#EF4444` - Critical alerts and errors
- **Text Primary**: `#1F2937` - Main text color (dark gray/black)
- **Text Secondary**: `#6B7280` - Secondary text and descriptions
- **Text Light**: `#9CA3AF` - Disabled or placeholder text

## Typography

### Font Family
- Primary: `Inter`, `-apple-system`, `BlinkMacSystemFont`, `Segoe UI`, `system-ui`, `sans-serif`

### Heading Hierarchy
- **h1**: 36px (2.25rem), Bold, Primary color
- **h2**: 32px (2rem), Bold, Primary color
- **h3**: 28px (1.75rem), Bold, Primary color
- **h4**: 24px (1.5rem), Semibold, Primary color
- **h5**: 20px (1.25rem), Semibold, Primary color
- **h6**: 16px (1rem), Semibold, Primary color

### Body Text
- **Regular**: 16px (1rem), Regular weight, Secondary text color
- **Small**: 14px (0.875rem), Regular weight
- **Extra Small**: 12px (0.75rem), Regular weight

## Components

### Buttons
```
Default: bg-primary, text-white, hover:bg-blue-800
Secondary: bg-surface, text-primary, border-primary
Success: bg-success, text-white
Danger: bg-danger, text-white
Warning: bg-warning, text-gray-900
Accent: bg-accent, text-white
Ghost: text-primary, hover:bg-surface
```

Sizes:
- Small: px-3 py-1.5, text-sm
- Default: px-4 py-2.5, text-base
- Large: px-6 py-3, text-lg

### Cards
```
card: bg-white, rounded-xl, shadow-md, p-6, border border-gray-200
card-flat: bg-surface, rounded-lg, p-6, border border-gray-200
card-elevated: bg-white, rounded-xl, shadow-lg, p-6
```

### Input Fields
```
input-field: w-full, px-4, py-2.5, border-gray-300, rounded-lg
- Focus: border-accent, ring-accent, ring-opacity-20
- Disabled: bg-gray-100, opacity-60, cursor-not-allowed
```

### Badges
```
badge-primary: bg-blue-100, text-primary
badge-success: bg-green-100, text-green-800
badge-warning: bg-yellow-100, text-amber-800
badge-danger: bg-red-100, text-red-800
badge-accent: bg-cyan-100, text-cyan-800
```

### Alerts
```
alert-success: bg-green-50, border-l-4 border-green-500, text-green-800
alert-warning: bg-yellow-50, border-l-4 border-yellow-500, text-amber-800
alert-danger: bg-red-50, border-l-4 border-red-500, text-red-800
alert-info: bg-blue-50, border-l-4 border-blue-500, text-blue-800
```

### Status Indicators
- **Online**: status-online (g -pulse green background)
- **Offline**: status-offline (animate-pulse red background)
- **Warning**: status-warning (animate-pulse yellow background)

## Layout

### Spacing
- xs: 0.25rem (4px)
- sm: 0.5rem (8px)
- md: 1rem (16px)
- lg: 1.5rem (24px)
- xl: 2rem (32px)
- 2xl: 3rem (48px)

### Border Radius
- sm: 0.375rem (6px)
- md: 0.5rem (8px)
- lg: 0.75rem (12px)
- xl: 1rem (16px)

### Shadows
- sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05)
- md: 0 4px 6px -1px rgba(0, 0, 0, 0.1)
- lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1)
- xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1)
- hover: 0 10px 25px -5px rgba(30, 58, 138, 0.15)

## Page Sections

### Navigation
- Header with logo and navigation links
- Active state underline animation
- Responsive mobile menu (future)
- Sticky positioning with shadow

### Hero Section
- Large headline (h1: 4xl-6xl)
- Supporting copy (lg text, primary color)
- Primary and secondary CTA buttons
- Subtle background decorative elements

### Features Grid
- 4 columns on desktop, 2 on tablet, 1 on mobile
- Icon + title + description
- Card-based layout with hover effects

### Dashboard
- Top status bar with connection status
- Key metrics in grid (Health, Battery, Tank)
- Parameter cards with icons and status colors
- Charts with clean grid lines
- Alerts section with status-based colors

### Forms
- Label above each field
- Clear error messages in red
- Password strength indicator
- Form validation feedback
- Rounded corners (lg)

## Interactions

### Transitions
- Default: 200ms ease-out
- Hover: Scale 95% on button press (active:scale-95)
- Focus: Ring with accent color (focus:ring-accent)

### Animations
- Pulse: Used for status indicators
- Bounce: Used for loading states
- Slide: Used for nav link underlines

## Accessibility

- Minimum contrast ratio: 7:1 for critical information
- Clear focus states on all interactive elements
- Semantic HTML structure
- ARIA labels where needed
- Keyboard navigation support

## Mobile Responsive

### Breakpoints
- Mobile: < 640px (sm)
- Tablet: 640px - 1024px (md, lg)
- Desktop: > 1024px (lg, xl)

### Responsive Patterns
- Single column on mobile
- 2 columns on tablet
- 3-4 columns on desktop
- Hidden elements on mobile (e.g., left sidebar in forms)

## Best Practices

### Color Usage
1. Use primary color for main structure and headings
2. Use accent color to draw attention to important actions
3. Use status colors (green/yellow/red) exclusively for status indication
4. Maintain high contrast for outdoor visibility
5. Avoid bright gradients that distract from data

### Typography
1. Use semibold for labels and form titles
2. Use regular weight for body text
3. Maintain single column for long-form content
4. Keep line-height at 1.5 or higher for readability

### Components
1. Always include hover states on interactive elements
2. Use consistent padding and spacing
3. Group related information in cards
4. Use icons to aid in visual scanning
5. Provide clear feedback for user actions

### Layout
1. Maintain max-width of 7xl (80 rem) for content
2. Use grid gaps of 1.5rem or 2rem between sections
3. Pad sections with 5rem (20px) or more
4. Use visual hierarchy effectively
5. Ensure sufficient whitespace

## Resource Files

- **Tailwind Config**: `tailwind.config.js`
- **Global Styles**: `src/styles/index.css`
- **Typography**: System font stack in tailwind.config.js

## Component Examples

See individual component files for implementation:
- Navigation: `src/components/Navigation.tsx`
- Dashboard: `src/components/WaterQuality/Dashboard.tsx`
- ParameterCard: `src/components/WaterQuality/ParameterCard.tsx`
- Form Pages: `src/pages/LoginPage.tsx`, `src/pages/SignupPage.tsx`

---

**Last Updated**: April 2026
**Version**: 1.0
**Designed for**: Crayfish Farming IoT Monitoring System

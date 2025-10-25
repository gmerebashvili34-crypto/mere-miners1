# MereMiners Design Guidelines

## Design Approach
**Premium Mobile-First Luxury Gaming**: Inspired by high-end mobile games like Clash Royale's polish combined with crypto wallet apps' trustworthy aesthetics (Metamask, Trust Wallet). Reference the tactile, toy-like quality of games like Monument Valley 2 and the premium black/gold aesthetic of luxury brand apps.

## Core Design Principles
1. **Black Gold Luxury**: Deep matte blacks with strategic gold accents create premium feel without gaudiness
2. **Toy-Like Playfulness**: 3D soft miners contrast with sophisticated UI for approachable luxury
3. **Clarity First**: Financial data and earnings must be instantly readable despite rich visuals
4. **Delight Through Motion**: Smooth spring animations and particle effects enhance engagement

## Color System

### Primary Palette
- **Deep Black Base**: `#0B0B0D` (primary background)
- **Elevated Black**: `#111111` (cards, elevated surfaces)
- **Secondary Dark**: `#1A1A1D` (tertiary elevation)

### Gold Accent System
- **Primary Gold**: `#D4AF37` (main accent, CTAs, highlights)
- **Light Gold**: `#FFD86B` (gradients start, hover states)
- **Warm Orange**: `#FF9F1C` (gradients end, earnings highlights)
- **Neon Gold**: `#FFA500` (active miners, live indicators)

### Functional Colors
- **Success Green**: `#10B981` (confirmations, positive earnings)
- **Warning Amber**: `#F59E0B` (alerts, limited items)
- **Error Red**: `#EF4444` (errors, critical actions)
- **Info Blue**: `#3B82F6` (neutral information)

### Surface Hierarchy
- Level 1 (deepest): `#0B0B0D`
- Level 2 (cards): `#111111` with subtle `#D4AF37` border glow
- Level 3 (nested elements): `#1A1A1D`
- Glass effect: `rgba(212, 175, 55, 0.05)` backdrop with blur

## Typography

### Font Families
- **Primary**: Inter or Poppins (body text, UI elements)
- **Display**: Montserrat or similar geometric (headings, numbers)
- **Monospace**: JetBrains Mono (wallet addresses, transaction IDs)

### Type Scale
- **Hero Display**: 48px bold (onboarding headers)
- **H1**: 32px bold (screen titles)
- **H2**: 24px semibold (section headers)
- **H3**: 20px semibold (card titles)
- **Body Large**: 16px regular (primary content)
- **Body**: 14px regular (secondary content)
- **Caption**: 12px medium (labels, metadata)
- **Tiny**: 10px medium (timestamps, fine print)

### Number Display (Critical)
- **Large Earnings**: 36px bold with gold gradient fill
- **Currency Values**: 20px semibold, always show USD and MERE equivalents
- **Stats**: 18px medium with unit labels in 12px

## Layout System

### Spacing Primitives
Use Tailwind spacing: `2, 3, 4, 6, 8, 12, 16, 20, 24` (as in `p-4`, `gap-6`, `mt-8`)
- Tight spacing: 2-4 units (within components)
- Standard spacing: 6-8 units (between sections)
- Generous spacing: 12-20 units (major sections)
- Extra spacing: 24+ units (screen padding)

### Screen Structure
```
Mobile Layout:
- Screen padding: px-4 sm:px-6
- Vertical spacing: py-6 sm:py-8
- Section gaps: gap-6 sm:gap-8
- Card padding: p-4 sm:p-6
```

### Grid System
- Mining Room: 2-column grid on mobile, 3-4 columns on tablet+
- Shop Cards: 2-column on mobile, 3-column on tablet, 4-column desktop
- Leaderboard: Single column stacked cards
- Stats Display: 2x2 grid for key metrics

## Component Library

### Cards
- **Base**: Rounded corners (16px), subtle gold border glow
- **Shadow**: Multi-layer shadow for depth (black with gold rim light)
- **Padding**: 16-24px depending on content density
- **Hover**: Lift effect (translate-y -4px) with increased glow

### Buttons
- **Primary CTA**: Gold gradient background (#FFD86B → #FF9F1C), black text, bold, 48px height on mobile
- **Secondary**: Black with gold border, gold text
- **Tertiary**: Transparent with gold text, subtle gold underline on hover
- **Disabled**: Gray with 40% opacity
- **Icon Buttons**: 44px circular, gold border, centered icon

### Input Fields
- **Background**: `#1A1A1D` with subtle inner shadow
- **Border**: 1px gold at 20% opacity, full gold on focus
- **Height**: 52px for better mobile touch targets
- **Label**: Floating label pattern, 12px gold when focused
- **Error State**: Red border with error message below

### Progress Bars
- **Track**: Dark gray `#1A1A1D`
- **Fill**: Gold gradient with animated shine effect
- **Height**: 8px (standard), 12px (prominent)
- **Rounded**: Full border radius

### Modals/Overlays
- **Backdrop**: Black at 80% opacity with blur
- **Container**: Elevated card style with gold accent border
- **Animation**: Slide up from bottom with spring physics
- **Close Button**: Top-right, white/gold X icon

### Navigation
- **Bottom Tab Bar**: Black background, 5 icons, gold fill for active state
- **Tab Height**: 64px for comfortable tapping
- **Icons**: 24px, simple line icons
- **Labels**: 10px, always visible

## Mining Room Visualization

### Slot Design
- **Empty Slot**: Dashed gold border, subtle pulse animation, "+ Add Miner" centered
- **Occupied Slot**: 3D miner model, glass card background, live stats overlay
- **Size**: 160x180px on mobile, 200x240px on tablet+
- **Spacing**: 12px gap between slots

### Miner Models (3D Style)
- **Appearance**: Toy-like, rounded edges, metallic sheen
- **Animation Loop**: Gentle rotation or breathing effect
- **Skin Variations**: Metal, matte black, neon gold, holographic
- **Particle Effects**: Gold sparks emanating during active mining
- **Status Indicator**: Small pulsing dot (green=active, amber=cooldown)

### Stats Overlay on Miners
- **TH/s Display**: Top-right badge, 14px bold
- **Daily Earnings**: Bottom overlay, gold text with $ and MERE
- **Progress Bar**: Mining progress as circular ring around miner

## Shop/Marketplace

### Product Cards
- **Layout**: Image top (3D miner render), details below
- **Price Display**: Large MERE price, small USD equivalent underneath
- **Discount Badge**: Top-left corner, gold background, red "X% OFF"
- **CTA Button**: Full width at bottom, "Buy Now" or "Purchase"
- **ROI Indicator**: "ROI: ~175 days" with small clock icon

### Bulk Purchase UI
- **Slider**: Gold track, large thumb, shows discount % in real-time
- **Calculation Display**: Shows original price, discount, final price dynamically
- **Visual Feedback**: Confetti animation on purchase completion

## Wallet Screen

### Balance Display
- **Hero Section**: Large MERE balance with gold gradient text
- **USD Equivalent**: Below in smaller gray text
- **Action Buttons**: "Deposit" (gold) and "Withdraw" side-by-side

### Transaction History
- **List Items**: Icon left, details center, amount right
- **Icons**: Color-coded (green deposit, red withdraw, gold purchase)
- **Timestamp**: Small gray text below transaction type
- **Status**: Badge indicating pending/completed/failed

### Deposit Flow
- **QR Code**: Large centered, black border, gold corner accents
- **Address**: Below QR, copyable with gold copy button
- **Instructions**: Step-by-step numbered list
- **Confirmation Tracker**: Shows required confirmations (e.g., "2/6 confirmations")

## Leaderboard

### Rank Cards
- **Top 3**: Special gold/silver/bronze gradient backgrounds, larger size
- **Regular Ranks**: Black cards with rank number in gold circle
- **User Info**: Avatar left, name and stats center, score right
- **Current User**: Highlight with subtle gold glow
- **Season Indicator**: Header showing current season and countdown timer

## Season Pass

### Track Visualization
- **Layout**: Horizontal scrollable track showing rewards
- **Nodes**: Circular checkpoints, unlocked (gold) vs locked (gray)
- **Rewards**: Small preview image with item name
- **Progress Bar**: Shows current level progress between nodes
- **Premium Lane**: Separated by subtle divider, gold accents

## Mini-Games

### Game UI Elements
- **Score Display**: Top-center, large animated numbers
- **Timer**: Top-right, countdown with color change when low
- **Controls**: Bottom-center, large touch-friendly buttons
- **Results Modal**: Shows score, rewards earned, leaderboard position

## Animations & Microinteractions

### Key Animations
- **Purchase Success**: Particle burst, scale bounce, checkmark appear
- **Earnings Count-Up**: Numbers increment smoothly with easing
- **Miner Placement**: Slide-in from bottom, settle with bounce
- **Navigation**: Page transitions with slide (200ms cubic-bezier)
- **Loading States**: Shimmer effect on skeleton screens

### Timing
- Quick actions: 150-200ms
- Standard transitions: 300ms
- Emphasis moments: 500ms (purchases, rewards)
- Spring physics: tension=300, friction=20

## Images & Assets

### Hero Sections
- **Onboarding**: Full-screen gradient background (black to dark gold) with floating 3D miner models
- **Dashboard**: Mining room background - dark industrial aesthetic with subtle grid pattern, rim lighting

### Icon Requirements
- App Icon: Black background with large gold "M" emblem, metallic finish
- Miner Types: 5 distinct 3D toy-like miner models (different sizes/colors)
- UI Icons: Line-style 24px icons for navigation, actions, stats (from Heroicons or similar)

### Decorative Elements
- Particle effects: Small gold dots/sparks for earnings animations
- Background patterns: Subtle hex grids, circuit board textures at 5% opacity
- Glow effects: Radial gradients for depth and focus

## Responsive Breakpoints
- Mobile: 0-640px (primary target)
- Tablet: 641-1024px (optimized)
- Desktop: 1025px+ (supported but not primary focus)

## Accessibility
- Touch targets: Minimum 44x44px
- Contrast: Ensure gold text on black meets WCAG AA (adjust brightness if needed)
- Focus states: Visible gold outline on keyboard navigation
- Screen reader: Proper ARIA labels for all interactive elements

## Sound Design (Optional Toggle)
- Purchase: Metallic chime (250ms)
- Earnings: Soft coin drop (150ms)
- Mining Room: Subtle ambient hum (loopable)
- Navigation: Gentle tap sound (100ms)
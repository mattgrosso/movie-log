# Cinema Roll - Project Summary

## Overview
Cinema Roll is a personal movie rating and tracking application built with Vue.js 3. It allows users to rate movies on multiple criteria, track their viewing history, and gain insights into their viewing patterns.

**Live URL**: [cinema-roll.surge.sh](https://cinema-roll.surge.sh/)

## Technology Stack
- **Frontend**: Vue.js 3 with Options API
- **State Management**: Vuex store
- **Routing**: Vue Router with hash-based routing
- **Styling**: Bootstrap 5 + SCSS
- **Database**: Firebase Realtime Database
- **Authentication**: Google Auth (Firebase)
- **Charts**: Chart.js via vue-chart-3
- **Calendar**: FullCalendar for date-based views
- **Testing**: Vitest with coverage
- **Error Tracking**: Sentry
- **Build Tools**: Vue CLI
- **Deployment**: AWS S3 + CloudFront

## Key Features

### Rating System
- Multi-dimensional rating system with weighted scores:
  - Love (2.8 weight)
  - Overall (2.0 weight)
  - Story (1.25 weight)
  - Direction (1.1 weight)
  - Imagery (0.9 weight)
  - Performance (0.7 weight)
  - Soundtrack (0.3 weight)
  - Stickiness (1.9 weight, divided by 2)
- Calculated total score based on weighted averages

### Data Sources
- **Movie Database**: The Movie Database (TMDb) API for movie information
- **Awards Data**: Academy Award winners integration
- **Letterboxd**: Service for scraping and importing data

### Core Components
- **Home**: Main dashboard with search, advanced filtering, and movie grid
- **RateMovie**: Rating interface with multi-criteria scoring
- **Insights**: Analytics and visualizations of viewing patterns
- **Favorites**: Lists of favorite actors, directors, etc.
- **Charts**: Various data visualizations
- **Settings**: User preferences and configuration

### Advanced Filtering System
- **Search-First Design**: Text input remains primary for adding new ratings
- **Auto-Chip Conversion**: Search terms automatically convert to chips after 2-second delay
- **Manual Chip Conversion**: Arrow button in search bar to manually convert searches
- **Quick Links**: Preserved favorites (Annual Best, Best Picture, This Year, etc.)
- **Combinable Filters**: Add additional filters on top of quick links or search
- **Filter Chips**: Visual display of active filters with easy removal
- **Filter Types**: Search, Director, Year, Genre, Production Company, Tag with searchable dropdowns
- **Mobile-Optimized**: Modal interface for adding filters
- **Intersection Logic**: Multiple chips use AND logic (not OR) for proper filtering
- **Backward Compatibility**: Maintains `this.value` for existing functionality while supporting chips

### Analytics & Insights
- Calendar heatmap of viewing activity
- Yearly averages and trends
- Streaks tracking
- Outliers identification
- Keyword cloud from movie metadata
- Charts for various metrics

### Letterboxd Integration
- **Automatic Detection**: Web scraping service to detect logged movies
- **Manual Overrides**: Subtle plus icon interface for manually marking movies as logged when auto-detection fails
- **Username Configuration**: User can set their Letterboxd username for scraping
- **Special Title Handling**: Enhanced normalization for problematic titles (F1, M, etc.)
- **Filter Integration**: Manual overrides properly excluded from "Not on Letterboxd" quick filter

## Database Structure
Firebase Realtime Database with user-specific data:
```
/{user-email-key}/
  ├── movieLog/          # User's rated movies
  ├── settings/          # User preferences and tags
  └── academyAwardWinners/  # Cached awards data
```

## File Structure
- `src/components/` - Vue components (35+ components)
- `src/store/index.js` - Vuex store with Firebase integration
- `src/router/index.js` - Vue Router configuration
- `src/services/` - Letterboxd scraping services
- `src/assets/javascript/` - Rating calculation utilities
- `src/test/` - Vitest test files including comprehensive chip filtering tests

## Development Commands
- `yarn serve` - Development server with hot reload
- `yarn build` - Production build
- `yarn test` - Run tests
- `yarn test:coverage` - Run tests with coverage
- `yarn lint` - ESLint
- `yarn deploy` - Build and deploy to AWS

## Authentication & Security
- Google OAuth via Firebase Auth
- User-specific database keys (email-based)
- Dev mode toggle for testing different user accounts

## Known Issues (from FeatureRequests.md)
- Issue with rating movies a perfect 10
- Need for database sharding as user base grows
- Missing user tutorial/onboarding

## Recent Development Focus
Based on recent commits and development:

### Chip-Based Filtering System & Search UX
- **Complete Filtering Overhaul**: Visual chip system with auto-conversion after 2-second typing pause
- **Instant Search + Chip Conversion**: Best of both worlds - real-time filtering while typing, converts to organized chips when pausing
- **Auto-Clear for Random Chips**: When random search on load creates a chip, clicking input auto-clears it so user can search immediately
- **Focus-Based Clearing**: Uses `requestAnimationFrame` for responsive auto-clearing without timing delays
- **Smart Search Value Management**: Preserves search context for "Search TMDB" button and "More from" section functionality
- **Filter Intersection Logic**: Multiple chips use AND logic for proper database-style filtering

### Random Search Toggle Feature
- **Complete Toggle Implementation**: User setting to enable/disable automatic random search on page load
- **Settings Integration**: Toggle in Home.vue settings panel with proper Firebase persistence
- **Race Condition Fix**: Resolved timing issues where random search triggered before user's setting loaded from database
- **Null-Safe Logic**: Prevents random search execution until definitive user setting is available

### Header Banner Stabilization
- **Timer-Based Caching**: Header banner images now cached for 30 seconds to prevent constant swapping
- **Filtered Results Integration**: Banner still reflects current search/filter context, just updates less frequently
- **Performance Optimization**: Reduces visual noise while maintaining relevance to user's current view

### Search & Filter Polish
- **Production Companies Integration**: Full support for filtering by production companies
- **Automated Testing**: Comprehensive test suite (99+ tests) for chip functionality to prevent regressions
- **Performance Optimizations**: Eliminated competing debounced functions that caused filtering delays
- **Mobile UX**: Proper focus handling and responsive chip conversion timing

### Recent Bug Fixes
- **Filter Intersection Bug**: Fixed critical bug where multiple chips created union instead of intersection
- **Search Value Persistence**: Fixed "Search TMDB" button losing text when chips are created
- **More From Section**: Fixed inconsistency where "Steven Spielberg" wouldn't show "More from" section but "Francis Ford Coppola" would
- **Settings Loading Race**: Eliminated race conditions in settings loading that caused random search to trigger incorrectly

## Environment Variables Required
- `VUE_APP_GOOGLE_API_KEY` - Firebase/Google API key
- `VUE_APP_TMDB_API_KEY` - The Movie Database API key

This application serves as a comprehensive personal movie tracking system with sophisticated rating algorithms and rich data visualization capabilities.

## Project Development Notes

### Testing Strategy
- Remember to keep our test suite up to date with all new changes. Whenever possible write tests first and use those to power our process. Whenever we wrap up a new feature remember to update existing test, add new ones and remove any that are no longer relevant. You can run tests with 'yarn test:run'

### Development Server Protocol
**NEVER kill or interfere with running development servers.** The user typically has `yarn serve` running in another terminal pane and relies on it for continuous development. 

- **DON'T**: Use `yarn serve`, `pkill`, or any commands that would interfere with existing processes
- **DO**: Use `yarn test:run` for quick syntax/functionality checks
- **DO**: Ask the user to test new features in their existing development server
- **DO**: Focus on code implementation and let the user handle server management

This is critical for maintaining an uninterrupted development workflow.

## Recent Changes - Awards Modal Stability Fixes (Aug 2024)

### Fixed Awards Modal Auto-Close Issue
- **Problem**: Awards modal would unexpectedly disappear when users completed categories, preventing them from continuing work
- **Root Cause #1**: `autoSave()` function automatically set completion date when all categories were filled, causing modal to be hidden by daily limit logic
- **Root Cause #2**: `showAwardsModal` computed property treated any year with awards data as "complete", ignoring partial progress
- **Root Cause #3**: `firstEligibleYear` computed property (banner display) had similar flawed logic, causing missing year in banner
- **Solution**: 
  1. Removed auto-completion behavior from `autoSave()` - users now must explicitly click "Complete Awards" button
  2. Fixed eligibility logic to keep showing modal for years with partial progress (not explicitly completed)
  3. Fixed banner year display logic to include years with partial progress

### Added Awards Resume Functionality
- **New Feature**: "Resume Awards" section in Insights page (`src/components/Insights.vue`)
- **Functionality**: Shows partially completed award years with progress bars and "Resume" buttons
- **Detection Logic**: Identifies years with partial progress (some nominees/winners but not explicitly completed)
- **Resume Method**: Sets daily awards year selection and navigates to Home to trigger modal
- **New Movies Detection**: Highlights years with new movies added since last awards session

### Key Files Modified
- `src/components/PersonalAwardsModal.vue:927-963` - Removed auto-completion from autoSave()
- `src/components/Home.vue:1796-1801` - **CRITICAL FIX**: Added partial progress check to showAwardsModal eligibility logic
- `src/components/PersonalAwardsModal.vue:376-381` - **CRITICAL FIX**: Added partial progress check to firstEligibleYear banner logic
- `src/components/Insights.vue:277-314` - Added Resume Awards section in template
- `src/components/Insights.vue:431-487` - Added partialAwardsYears computed property
- `src/components/Insights.vue:1169-1183` - Added resumeAwards() method

### Technical Details
- Awards modal no longer auto-closes when categories are completed
- Completion date only set when user explicitly clicks "Complete Awards" button
- Resume logic bypasses daily limit by setting `dailyAwardsYear` to specific year
- Progress calculation excludes explicitly completed years (via button) but includes partial work
- All existing functionality preserved, just made less fragile

This fixes the fragility issue where the modal would disappear unexpectedly and provides a reliable way to resume work on partial awards.

### Debug Logging Cleanup (Aug 2024)
- All debug logging (`🏆 AWARDS DEBUG:` messages) has been removed after successful problem resolution
- Core functionality preserved, console noise eliminated
- System now operates cleanly in production

### Awards UI Enhancement - Actor Display (Aug 2024)
- **Improvement**: Split actor nomination display from 2 lines to 3 lines for better readability
- **Before**: Name on line 1, "Movie (Role)" on line 2
- **After**: Name on line 1, Movie on line 2, Role on line 3 (italicized)
- **Files Modified**: `src/components/PersonalAwardsModal.vue` - template, methods, and CSS
- **New Methods**: `getOptionMovie()` and `getOptionRole()` for cleaner data separation
- **Styling**: Role text is smaller, italicized, and slightly more transparent for visual hierarchy

## Important Note for Claude
**Always keep this CLAUDE.md file updated** as you work on the project. When you make changes, add features, or learn new things about the codebase, update the relevant sections of this file to maintain an accurate project summary for future sessions.
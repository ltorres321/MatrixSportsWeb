# Graph Report - SportsWeb  (2026-09-27)

## Corpus Check
- Large corpus: 207 files · ~621,249 words. Semantic extraction will be expensive (many Claude tokens). Consider running on a subfolder.

## Summary
- 704 nodes · 1513 edges · 34 communities (28 shown, 6 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 33 edges (avg confidence: 0.83)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Game Detail UI Components
- Predictions & Schedule Data
- Social Content Generation
- Auth & Site Layout
- Admin & Content Jobs
- Profile & Live Scores
- Game Stats & Injuries
- Python Subscriber Backend
- Email Digest Functions
- Social Share Images
- Static Prototype & Notes
- Weekly Stories Generation
- TypeScript Config
- Static Home Page
- Static Game Page
- PFF Team Grades
- Package Dependencies
- Runtime Dependencies List
- Dev Dependencies List
- gstack Governance Docs
- Static Signup Form
- Contact Form
- Pipeline Check Page
- NPM Scripts
- ESLint Config
- Static Profile Page
- Static Teams Data
- Ad Platform Setup
- Deploy & Legal Notes
- Static Auth Nav
- About Page
- gstack Commit Hook
- PostCSS Config

## God Nodes (most connected - your core abstractions)
1. `next` - 45 edges
2. `getCurrentAdminUserId()` - 23 edges
3. `getMatchupsForSeasonWeek()` - 21 edges
4. `getGameDetail()` - 21 edges
5. `react` - 20 edges
6. `createClient()` - 18 edges
7. `teamByAlias()` - 18 edges
8. `SignedInDashboard()` - 16 edges
9. `query()` - 16 edges
10. `getCurrentSeasonYear()` - 16 edges

## Surprising Connections (you probably didn't know these)
- `gstack Required Install Policy` --conceptually_related_to--> `web/CLAUDE.md agents reference`  [AMBIGUOUS]
  CLAUDE.md → web/CLAUDE.md
- `Email jobs for favorites results (TODO)` --conceptually_related_to--> `Signup page`  [INFERRED]
  notes/WebTodo.txt → static/signup.html
- `Shareable pick-card feature idea` --conceptually_related_to--> `Home/Predictions page`  [INFERRED]
  notes/traffic.txt → static/home.html
- `Email jobs for favorites results (TODO)` --conceptually_related_to--> `Profile page`  [INFERRED]
  notes/WebTodo.txt → static/profile.html
- `Odds datapull + line-change model rerun (TODO)` --conceptually_related_to--> `Monte Carlo prediction methodology (100,000 simulations)`  [INFERRED]
  notes/WebTodo.txt → static/about.html

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Shared Matrix-themed navbar/rain-canvas chrome across pages** — static_about_page, static_game_page, static_home_page, static_index_page, static_profile_page, static_signup_page [INFERRED 0.85]
- **Free-account signup gate for locked prediction content** — static_home_page, static_game_page, static_profile_page, static_signup_page [INFERRED 0.85]
- **Ad monetization setup (todo, platform decision, ads.txt authorization)** — notes_webtodo_ads_setup, notes_traffic_ad_platforms, web_public_ads_adsense_authorization [INFERRED 0.85]

## Communities (34 total, 6 thin omitted)

### Community 0 - "Game Detail UI Components"
Cohesion: 0.05
Nodes (48): react, edgeAccentColor(), EdgeTrack(), EdgeTrackRow, EdgeValue(), EfficiencyStatRow(), espnHeadshotUrl(), fmtPct() (+40 more)

### Community 1 - "Predictions & Schedule Data"
Cohesion: 0.07
Nodes (62): rss-parser, GameDetailPage(), generateMetadata(), teamDisplay(), HomePage(), metadata, HomePage(), SignedInDashboard() (+54 more)

### Community 2 - "Social Content Generation"
Cohesion: 0.08
Nodes (51): AdminSocialPage(), GET(), GET(), GET(), GET(), DAY_ABBRS, dayAbbrFromKickoff(), GET() (+43 more)

### Community 3 - "Auth & Site Layout"
Cohesion: 0.05
Nodes (35): next, react-icons, nextConfig, GET(), ForgotPasswordState, requestPasswordReset(), ForgotPasswordPage(), initialState (+27 more)

### Community 4 - "Admin & Content Jobs"
Cohesion: 0.10
Nodes (39): server-only, AdminStoriesPage(), approve(), reject(), takeDown(), AdminTimePage(), clearOverride(), setOverride() (+31 more)

### Community 5 - "Profile & Live Scores"
Cohesion: 0.08
Nodes (33): @supabase/ssr, ResetPasswordPage(), handleSubmit(), normalizePhoneNumber(), ProfilePage(), handleAppearanceChange(), handleSendCellCode(), handleSignOut() (+25 more)

### Community 6 - "Game Stats & Injuries"
Cohesion: 0.08
Nodes (35): GameStat, PERCENTILE_MAX, PERCENTILE_MIN, GameInjuryReport, getGameInjuryReport(), InjuryEntry, InjuryRow, practiceStatusLabel() (+27 more)

### Community 7 - "Python Subscriber Backend"
Cohesion: 0.08
Nodes (30): BaseModel, fetch_all(), get_connection(), insert_subscriber(), Run a read-only query and return every row as a list of dicts., Insert one row into subscribers, returning its new id. Raises…, dotenv, fastapi (+22 more)

### Community 8 - "Email Digest Functions"
Cohesion: 0.18
Nodes (24): buildDigestHtml(), buildGameRowHtml(), config, alreadySentGameIds(), currentSeasonWeek(), currentSeasonYear(), CurrentWeek, formatKickoff() (+16 more)

### Community 9 - "Social Share Images"
Cohesion: 0.12
Nodes (17): ref_fs, ref_path, alt, Image(), runtime, contentType, logoDataUri(), renderPickCard() (+9 more)

### Community 10 - "Static Prototype & Notes"
Cohesion: 0.12
Nodes (24): Covers.com / OddsShark forum strategy, IndieHackers build-in-public strategy, Shareable pick-card feature idea, Reddit (r/sportsbook, r/nfl, r/NFLbetting) growth strategy, X/Twitter Game of the Week posting strategy, Email jobs for favorites results (TODO), Odds datapull + line-change model rerun (TODO), Oddstrader line-pull feed (TODO) (+16 more)

### Community 11 - "Weekly Stories Generation"
Cohesion: 0.17
Nodes (19): pg, allFinalGamesInSeason(), buildGameFacts(), currentSeasonYear(), FinalGame, finalGamesForWeek(), freezeProjections(), GameFacts (+11 more)

### Community 12 - "TypeScript Config"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 13 - "Static Home Page"
Cohesion: 0.17
Nodes (13): CURRENT_SEASON_MATCHUPS, CURRENT_SEASON_YEAR, matchupCard(), PRIOR_SEASON_1_MATCHUPS, PRIOR_SEASON_2_MATCHUPS, renderGrid(), renderHeader(), renderPremier() (+5 more)

### Community 14 - "Static Game Page"
Cohesion: 0.29
Nodes (14): GAMES, getGameId(), heroTeamBlock(), pct(), render(), renderDevToggle(), renderHero(), renderMarginSection() (+6 more)

### Community 15 - "PFF Team Grades"
Cohesion: 0.23
Nodes (13): buildRankLookup(), EdgeSide, getGameTeamGrades(), rankLookupFor(), row(), side(), getLeagueGrades(), getTeamGrades() (+5 more)

### Community 16 - "Package Dependencies"
Cohesion: 0.15
Nodes (12): react-dom, @supabase/supabase-js, tailwindcss, @tailwindcss/postcss, @types/node, @types/pg, @types/react, @types/react-dom (+4 more)

### Community 17 - "Runtime Dependencies List"
Cohesion: 0.18
Nodes (11): dependencies, next, pg, react, react-dom, react-icons, resend, rss-parser (+3 more)

### Community 18 - "Dev Dependencies List"
Cohesion: 0.20
Nodes (10): devDependencies, eslint, eslint-config-next, tailwindcss, @tailwindcss/postcss, @types/node, @types/pg, @types/react (+2 more)

### Community 19 - "gstack Governance Docs"
Cohesion: 0.22
Nodes (9): gstack Required Install Policy, gstack /browse skill, gstack /investigate skill, gstack /qa skill, gstack /review skill, gstack /ship skill, Next.js agent rules (auto-generated), web/CLAUDE.md agents reference (+1 more)

### Community 20 - "Static Signup Form"
Cohesion: 0.39
Nodes (6): digitsOnly(), handleSubmit(), isValidEmail(), setError(), setSubmitting(), validateForm()

### Community 21 - "Contact Form"
Cohesion: 0.43
Nodes (5): resend, ContactState, sendContactMessage(), ContactPage(), initialState

### Community 22 - "Pipeline Check Page"
Cohesion: 0.48
Nodes (6): bestMarginBucket(), formatKickoff(), formatPercent(), loadUpcomingGames(), MARGIN_BUCKETS, renderGameCard()

### Community 23 - "NPM Scripts"
Cohesion: 0.40
Nodes (5): scripts, build, dev, lint, start

### Community 24 - "ESLint Config"
Cohesion: 0.50
Nodes (3): eslint, eslint-config-next, eslintConfig

### Community 25 - "Static Profile Page"
Cohesion: 0.83
Nodes (3): populateFavoriteTeamSelect(), render(), wireFormPreviewSubmit()

### Community 27 - "Ad Platform Setup"
Cohesion: 1.00
Nodes (3): Ezoic vs AdSense platform decision, Ads setup incomplete (TODO), ads.txt Google AdSense authorization

### Community 28 - "Deploy & Legal Notes"
Cohesion: 0.67
Nodes (3): Deploy to ltorres-1 / Netlify preview, Terms/Privacy footer linking, Terms of Service page rollout

## Ambiguous Edges - Review These
- `gstack Required Install Policy` → `web/CLAUDE.md agents reference`  [AMBIGUOUS]
  CLAUDE.md · relation: conceptually_related_to

## Knowledge Gaps
- **171 isolated node(s):** `check-gstack.sh script`, `GAMES`, `WEEKS`, `CURRENT_SEASON_YEAR`, `CURRENT_SEASON_MATCHUPS` (+166 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 234 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `gstack Required Install Policy` and `web/CLAUDE.md agents reference`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `next` connect `Auth & Site Layout` to `Game Detail UI Components`, `Predictions & Schedule Data`, `Social Content Generation`, `Admin & Content Jobs`, `Profile & Live Scores`, `Social Share Images`, `Package Dependencies`, `Contact Form`?**
  _High betweenness centrality (0.179) - this node is a cross-community bridge._
- **Why does `server-only` connect `Admin & Content Jobs` to `Predictions & Schedule Data`, `Profile & Live Scores`, `Game Stats & Injuries`, `PFF Team Grades`, `Package Dependencies`?**
  _High betweenness centrality (0.036) - this node is a cross-community bridge._
- **Why does `react` connect `Game Detail UI Components` to `Predictions & Schedule Data`, `Auth & Site Layout`, `Profile & Live Scores`, `Package Dependencies`, `Contact Form`?**
  _High betweenness centrality (0.035) - this node is a cross-community bridge._
- **What connects `check-gstack.sh script`, `GAMES`, `WEEKS` to the rest of the system?**
  _171 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Game Detail UI Components` be split into smaller, more focused modules?**
  _Cohesion score 0.05070422535211268 - nodes in this community are weakly interconnected._
- **Should `Predictions & Schedule Data` be split into smaller, more focused modules?**
  _Cohesion score 0.07203219315895372 - nodes in this community are weakly interconnected._
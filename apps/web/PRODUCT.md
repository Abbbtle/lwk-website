# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Adults in the Hare Krishna (Vaisnava) community, from newcomers to long-time practitioners, who want to learn devotional skills at home: singing kirtan, cooking prasadam, Vaisnava etiquette and scripture (sastra) study. They come from many backgrounds and countries, and many use low-end phones on slow or expensive connections. They learn at their own pace, often in short sessions.

Two smaller groups use the same site: instructors, who apply, are approved and then build courses; and families, temples, schools and study groups, who learn together on shared plans.

## Product Purpose

Living With Krishna is an online learning platform for devotional skills. Learners find a course, enrol, follow video, text and PDF lessons, and pick up where they stopped; free talks, recordings, articles and courses sit in Explore, open to everyone. Success is a learner who keeps practising at home and comes back for the next course, and an instructor whose course reaches people they could not teach in person.

## Positioning

- Experienced devotees teach. Every instructor applies and is approved, and every course is reviewed before it is published.
- Practical skills for daily devotional life, taught step by step, rather than lectures alone.
- Fair to every visitor's means: free content and courses marked Free, free courses during early access, and prices set per region (South Africa, India, high-income countries, rest of world).
- The project has organisational backing. The organisation's name and approved wording are not on hand yet, so pages must not name an organisation or present an endorsement until they are supplied.

## Operating Context

- Learners browse categories (currently Kirtan, Prasadam, Vaisnava Etiquette and Sastra Study; more will be added, so nothing may assume these four), search, and take lessons in the lesson player; My Learning shows progress.
- Membership opens every paid course; single courses can be bought and kept; Family and Community plans cover households and groups. Courses joined during early access stay with the learner.
- Instructors build courses (video, PDF and text lessons), use AI study and writing help, and submit courses for review; admins and support staff review applications, courses and support requests.
- Help centre articles, an AI assistant, support requests and a contact form answer questions. Support replies on working days, 08:00-18:00 (UTC+2).

## Capabilities and Constraints

- Next.js 16 App Router web app (apps/web), PostgreSQL, Cognito sign-in with two-step verification for staff; hosted on AWS behind CloudFront.
- Prices follow the visitor's region; card payments come in a later phase (Paystack for South Africa, a merchant of record elsewhere).
- Pages must stay light for slow connections: one eagerly loaded image, lazy loading below the fold, motion code loaded after the page.
- Undecided: native mobile apps, forums, quizzes and certificates are planned for later phases.

## Brand Commitments

- Name: Living With Krishna. Logo: the POC's Krishna drawing with "EST. 2024", black on light backgrounds and white on dark ones.
- Binding look, set by the owner: the earlier POC (https://livingwithkrishna.netlify.app) palette only (saffron orange-500 accent, black primary buttons, grays, white); Poppins; the radius tokens in apps/web/src/app/globals.css; Udemy as the reference for a clean, familiar, professional site.
- The home page banner is full width, with manual arrows and dots and no auto-rotation.
- The japa-mala motif belongs on the contact page only.
- Motion is quick and quiet, never showy.
- Voice: warm and plain ("Hare Krishna!" greetings in the assistant and support), written for a broad audience.

## Evidence on Hand

- No testimonials, learner numbers, ratings, press or endorsements exist yet. Do not invent any.
- The current photos come from the POC and still need usage permission (or replacing) before the public launch.
- Sample courses and sample content in the catalogue are marked as samples and will be replaced by instructors' courses.

## Product Principles

- Familiar before novel: visitors of every background should recognise how to browse, enrol and learn at a glance.
- Light enough for any phone: every page has to work on a low-end device and a slow connection.
- Trust is earned, not claimed: show the real review process and real content, never invented proof.
- Built to grow: categories, courses and instructors will multiply, so structures stay data-driven.

## Accessibility & Inclusion

- WCAG 2.1 AA: visible focus, keyboard access, 44px touch targets, text no smaller than 12px.
- Honour reduced motion; motion must never hide content when scripts are off or fail to load.
- Prices and copy work across regions and currencies; plain language for readers whose first language is not English.

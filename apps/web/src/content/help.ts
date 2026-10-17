// Help centre articles. Kept in the repository so changes are reviewed like code, and used by the
// help centre, the help panel on every page, the support form and (later) the assistant.
// Write in plain language, describe what the site actually does, and keep each article short.

export type HelpAudience = 'everyone' | 'instructor' | 'staff';

export type HelpTopic = { slug: string; title: string; description: string };

export type HelpArticle = {
  slug: string;
  topic: string;
  title: string;
  summary: string;
  /** Who it is for: everyone, instructors, or staff (admins and support). */
  audience: HelpAudience;
  /** Pages where the article is relevant: exact paths, or prefixes ending in "*". */
  paths: string[];
  keywords: string[];
  body: string;
};

export const helpTopics: HelpTopic[] = [
  {
    slug: 'getting-started',
    title: 'Getting started',
    description: 'Creating your account, logging in and finding your way around.',
  },
  {
    slug: 'learning',
    title: 'Learning',
    description: 'Finding courses, free content, lessons and your progress.',
  },
  {
    slug: 'account',
    title: 'Account and security',
    description: 'Your profile, password, two-step verification and your data.',
  },
  {
    slug: 'teaching',
    title: 'Teaching',
    description: 'Applying to teach, building a course and getting it published.',
  },
  {
    slug: 'support',
    title: 'Getting help',
    description: 'Support requests, notifications and reporting a problem.',
  },
  {
    slug: 'staff',
    title: 'For admins and support',
    description: 'Reviews, people and roles, free content and support requests.',
  },
];

export const helpArticles: HelpArticle[] = [
  // ---- Getting started ----------------------------------------------------------------------
  {
    slug: 'creating-your-account',
    topic: 'getting-started',
    title: 'Creating your account',
    summary: 'Sign up with your name, email and a password, then enter the code we email you.',
    audience: 'everyone',
    paths: ['/sign-up', '/'],
    keywords: ['sign up', 'register', 'join', 'verification code', 'email code', 'new account'],
    body: `1. Choose **Sign Up** at the top of any page.
2. Enter your name, email address and a password of at least 12 characters with upper and lower case letters and a number.
3. We email you a 6-digit code. Enter it to confirm your email address, and you are signed in.

## Did not get the code?

- Check your spam or junk folder; the email comes from our sign-in service.
- Choose **Send a new code** on the verification screen.
- Codes expire after a while, so use the newest one.

If you already have an account with that email address, [log in](/login) instead, or [reset your password](/help/resetting-your-password).`,
  },
  {
    slug: 'logging-in-and-out',
    topic: 'getting-started',
    title: 'Logging in and out',
    summary: 'How to log in, stay signed in, and log out on one device or all of them.',
    audience: 'everyone',
    paths: ['/login', '/logged-out'],
    keywords: ['log in', 'login', 'sign in', 'log out', 'logout', 'sign out', 'other devices'],
    body: `## Logging in

Choose **Log In**, then enter your email address and password. If you turned on [two-step verification](/help/two-step-verification), you also enter the code from your authenticator app. You stay signed in on that device for up to 30 days.

## Logging out

Open the menu with your name and choose **Log Out**. We ask you to confirm first, so a stray click never signs you out.

Tick **Also log me out on my other devices** if you used a shared or lost device; every device then needs to log in again. You can also do this any time under [Account > Security](/account/security).

Your learning progress is always saved.`,
  },
  {
    slug: 'resetting-your-password',
    topic: 'getting-started',
    title: 'Forgot your password?',
    summary: 'Reset it with a code sent to your email address.',
    audience: 'everyone',
    paths: ['/login', '/forgot-password'],
    keywords: [
      'forgot password',
      'reset password',
      'cannot log in',
      'locked out',
      'wrong password',
    ],
    body: `1. On the [log in page](/login), choose **Forgot password?**
2. Enter your email address and choose **Send code**.
3. Enter the 6-digit code from the email and choose a new password (at least 12 characters, with upper and lower case letters and a number).

For privacy we show the same message whether or not an account exists for that address. If no email arrives within a few minutes, check your spam folder and make sure you used the address you signed up with.

Too many attempts in a row are paused for a few minutes to protect your account.`,
  },
  {
    slug: 'finding-your-way-around',
    topic: 'getting-started',
    title: 'Finding your way around',
    summary: 'What each part of the site is for, from Explore to My Learning.',
    audience: 'everyone',
    paths: ['/', '/categories'],
    keywords: ['menu', 'navigation', 'where', 'overview', 'tour', 'site'],
    body: `- **Explore**: free courses, videos, audio, articles and PDFs, open to everyone.
- **Courses**: the full course catalogue, with search and a free-only filter.
- **Categories**: kirtan, prasadam, Vaisnava etiquette and sastra study.
- **Plans & Pricing**: subscription plans (every course is free during early access).
- **Become an Instructor**: apply to teach.

Once you are signed in, the menu with your name leads to **My Learning** (your courses and progress), **Notifications**, **Help & support** and your **Account**. Instructors and admins also see their own areas there.

The **Help** button at the bottom of every page shows help for the page you are on.`,
  },

  // ---- Learning -------------------------------------------------------------------------------
  {
    slug: 'finding-courses',
    topic: 'learning',
    title: 'Finding courses',
    summary: 'Search the catalogue, filter by category and find free courses.',
    audience: 'everyone',
    paths: ['/courses', '/courses/*', '/categories'],
    keywords: ['search', 'catalogue', 'catalog', 'find a course', 'category', 'free courses'],
    body: `Open **Courses** in the menu, or type in the search box at the top of any page. Every word you type must appear in the course title, subtitle or category.

- Choose a category to narrow the list.
- Tick **Free courses only** to see courses that are free for everyone.
- Open a course to see what you will learn, its sections and lessons, and who teaches it.

Many courses have a **free preview** lesson you can try before enrolling. Free videos, recordings and articles are in [Explore](/explore).`,
  },
  {
    slug: 'free-content-in-explore',
    topic: 'learning',
    title: 'Free content in Explore',
    summary: 'Free courses, talks, kirtan, articles and recipes, open to everyone.',
    audience: 'everyone',
    paths: ['/explore', '/explore/*'],
    keywords: [
      'explore',
      'free',
      'videos',
      'audio',
      'kirtan recordings',
      'articles',
      'recipes',
      'pdf',
    ],
    body: `[Explore](/explore) collects everything that is free:

- **Free courses**: complete courses you can take today. Enrolling needs a free account so we can save your progress.
- **Watch, Listen and Read**: single videos, audio recordings, articles and PDFs. You can open these without an account.

Use the filters to show one type or one category, or search by title, topic or speaker. Items marked **Sample** are examples used while we test the site.`,
  },
  {
    slug: 'enrolling-in-a-course',
    topic: 'learning',
    title: 'Enrolling in a course',
    summary: 'Enrollment is free during early access; free courses stay free for everyone.',
    audience: 'everyone',
    paths: ['/courses/*'],
    // British spellings too, so either finds the article.
    keywords: [
      'enroll',
      'enrol',
      'enrolment',
      'join course',
      'start course',
      'price',
      'cost',
      'free',
    ],
    body: `Open the course and choose **Enroll now** (or **Sign up to enroll** if you are not signed in yet). The course then appears in [My Learning](/my-learning).

During early access every course is free to enroll in. Courses marked **Free** stay free for everyone, also when [subscription plans](/plans-and-pricing) start.

Not sure yet? Choose **Watch a free preview** when a course offers one.`,
  },
  {
    slug: 'using-the-lesson-player',
    topic: 'learning',
    title: 'Using the lesson player',
    summary: 'Videos resume where you stopped; mark lessons complete and move through the course.',
    audience: 'everyone',
    paths: ['/learn/*'],
    keywords: [
      'player',
      'lesson',
      'video',
      'pdf',
      'resume',
      'mark complete',
      'next lesson',
      'curriculum',
    ],
    body: `- **Videos** save your place every few seconds and when you pause, so you can continue where you stopped on any device. A video counts as complete when it reaches the end.
- **PDF lessons** open on the page; choose **Open the PDF in a new tab** to read or download it full screen.
- **Text lessons** are read on the page.
- Choose **Mark as complete** when you finish a PDF or text lesson (you can undo it).
- Use **Previous** and **Next lesson**, or pick any lesson from the course contents beside the player.

Lessons with a lock need enrollment first. Opening a course from [My Learning](/my-learning) takes you to your first unfinished lesson.`,
  },
  {
    slug: 'tracking-your-progress',
    topic: 'learning',
    title: 'Tracking your progress',
    summary: 'My Learning shows each course with how far you have come.',
    audience: 'everyone',
    paths: ['/my-learning'],
    keywords: ['progress', 'my learning', 'completed', 'percentage', 'continue', 'resume'],
    body: `[My Learning](/my-learning) lists the courses you are enrolled in, most recently used first, with a progress bar for each.

A course is complete when every lesson is marked complete. Your progress is saved to your account, so it is the same on every device.`,
  },
  {
    slug: 'video-or-pdf-will-not-load',
    topic: 'learning',
    title: 'A video or PDF will not load',
    summary: 'Quick fixes for lessons and resources that do not play or open.',
    audience: 'everyone',
    paths: ['/learn/*', '/explore/*'],
    keywords: [
      'not loading',
      'video not playing',
      'pdf not opening',
      'black screen',
      'buffering',
      'error',
      'expired',
    ],
    body: `1. **Reload the page.** For your security, the link to each video or document expires after a few hours, and reloading gets a fresh one.
2. **Check your connection.** Large videos need a steady connection; pausing for a moment lets the video buffer.
3. **Try another browser** (an up-to-date Chrome, Edge, Firefox or Safari).
4. **PDF not showing?** Some phones cannot show PDFs inside a page; choose **Open the PDF in a new tab**.

Still stuck? [Report the problem](/support/new?category=TECHNICAL) and tell us which lesson and which device you use.`,
  },

  // ---- Account and security ------------------------------------------------------------------
  {
    slug: 'two-step-verification',
    topic: 'account',
    title: 'Two-step verification',
    summary: 'Protect your account with a code from an authenticator app as well as your password.',
    audience: 'everyone',
    paths: ['/account/security', '/login'],
    keywords: [
      'two-step',
      '2fa',
      'mfa',
      'authenticator',
      'code',
      'security',
      'lost phone',
      'qr code',
    ],
    body: `With two-step verification on, logging in needs your password **and** a 6-digit code from an authenticator app on your phone, such as Google Authenticator, Microsoft Authenticator or 1Password.

## Turning it on

1. Go to [Account > Security](/account/security) and choose **Turn on two-step verification**.
2. Confirm your password.
3. Scan the QR code with your authenticator app (or type in the setup key).
4. Enter the code the app shows.

**Admins must use two-step verification**; admin tools stay locked until it is on.

## Lost your phone?

[Contact support](/support/new?category=ACCOUNT). After checking it is really you, an admin can reset it so you can log in with your password and set it up again.`,
  },
  {
    slug: 'changing-your-password',
    topic: 'account',
    title: 'Changing your password',
    summary: 'Change it under Account > Security, and optionally log out everywhere.',
    audience: 'everyone',
    paths: ['/account/security'],
    keywords: ['change password', 'new password', 'password'],
    body: `1. Go to [Account > Security](/account/security) and choose **Change password**.
2. Confirm your current password (and code, if two-step verification is on).
3. Enter your new password twice.

Leave **Log out everywhere afterwards** ticked if you think someone else knows your old password; you then log in again with the new one.

Your password is checked by our sign-in service in your browser; we never see it and will never ask for it.`,
  },
  {
    slug: 'your-profile',
    topic: 'account',
    title: 'Your profile and email address',
    summary: 'Change your display name; contact support to change your email address.',
    audience: 'everyone',
    paths: ['/account'],
    keywords: ['name', 'display name', 'profile', 'email address', 'change email'],
    body: `Your display name is shown in the site menu and, if you teach, on your courses. Change it under [Account > Profile](/account); the new name appears straight away.

To change the email address you log in with, [contact support](/support/new?category=ACCOUNT).`,
  },
  {
    slug: 'your-data-and-privacy',
    topic: 'account',
    title: 'Your data and deleting your account',
    summary: 'Download everything we store about you, or delete your account.',
    audience: 'everyone',
    paths: ['/account/privacy'],
    keywords: [
      'privacy',
      'data',
      'download',
      'export',
      'delete account',
      'close account',
      'gdpr',
      'popia',
    ],
    body: `Under [Account > Privacy & data](/account/privacy) you can:

- **Download your data**: your profile, enrollments, progress, applications, support requests and account activity, as a file.
- **Delete your account**: removes your sign-in and your learning history for good. You confirm by typing DELETE and entering your password.

Instructors who teach courses, and the last remaining admin, need to [contact support](/support/new?category=ACCOUNT) first so their courses or duties can be handed over.`,
  },

  // ---- Teaching -------------------------------------------------------------------------------
  {
    slug: 'becoming-an-instructor',
    topic: 'teaching',
    title: 'Becoming an instructor',
    summary: 'Apply with your experience; an admin reviews your application.',
    audience: 'everyone',
    paths: ['/become-an-instructor'],
    keywords: ['teach', 'instructor', 'apply', 'application', 'become an instructor'],
    body: `1. [Log in or sign up](/login?returnTo=%2Fbecome-an-instructor), then open [Become an Instructor](/become-an-instructor).
2. Tell us about your experience, teaching and motivation, and submit the form.
3. An admin reviews your application. You get a notification with the decision.

Once approved, **Instructor** appears in your menu and you can start building courses straight away. If an application is not approved, the note explains why and you can apply again.`,
  },
  {
    slug: 'creating-a-course',
    topic: 'teaching',
    title: 'Creating your first course',
    summary: 'Start a draft, fill in the details and build sections and lessons.',
    audience: 'instructor',
    paths: ['/instructor', '/instructor/*'],
    keywords: [
      'new course',
      'create course',
      'draft',
      'sections',
      'lessons',
      'curriculum',
      'course editor',
    ],
    body: `1. Open **Instructor** in your menu, enter a title, choose a category and create the course.
2. Fill in the **details**: subtitle, level, the name learners see, a description and what learners will learn (one outcome per line).
3. Build the **curriculum**: add sections, then lessons in each section. A lesson is a video, a PDF or text. Use the arrows to reorder.
4. Tick **free preview** on a lesson or two so people can try the course.
5. Add a **cover image** (optional but recommended).

Your course stays a private draft until you [submit it for review](/help/submitting-for-review).`,
  },
  {
    slug: 'uploading-videos-and-pdfs',
    topic: 'teaching',
    title: 'Uploading videos, PDFs and images',
    summary: 'Supported files and sizes, and tips for smooth uploads.',
    audience: 'instructor',
    paths: ['/instructor/courses/*', '/admin/explore/*'],
    keywords: [
      'upload',
      'video',
      'pdf',
      'cover',
      'image',
      'file size',
      'mp4',
      'format',
      'failed upload',
    ],
    body: `- **Videos**: MP4, WebM or MOV, up to 2 GB. MP4 (H.264) plays everywhere.
- **PDFs**: up to 100 MB.
- **Audio** (free resources): MP3, M4A or OGG, up to 500 MB.
- **Cover images**: JPG, PNG or WebP, up to 5 MB. A 16:9 image looks best.

Files go straight from your browser to secure storage. Keep the page open until it says **Uploaded.** A video's length is read automatically.

If an upload fails, check your connection and the file type, then try again. Very large videos upload faster if you export them at 1080p or lower.`,
  },
  {
    slug: 'submitting-for-review',
    topic: 'teaching',
    title: 'Submitting a course for review',
    summary: 'Complete the checklist, submit, and respond to review notes.',
    audience: 'instructor',
    paths: ['/instructor/courses/*'],
    keywords: ['submit', 'review', 'publish', 'checklist', 'returned', 'review note', 'withdraw'],
    body: `The editor shows a checklist of anything missing (for example a description, or a lesson without its video). When it is complete, choose **Submit for review**.

- While a course is in review it cannot be edited. Choose **Withdraw** to take it back to draft.
- An admin either **publishes** it (it appears in the catalogue straight away) or **returns** it with a note explaining what to change. You get a notification either way.
- Once published, only an admin can change a course. Ask one to unpublish it if you need to make larger changes.`,
  },
  {
    slug: 'offering-a-free-course',
    topic: 'teaching',
    title: 'Offering a course for free',
    summary: 'Free courses are listed in Explore and stay free for everyone.',
    audience: 'instructor',
    paths: ['/instructor/courses/*'],
    keywords: ['free course', 'free', 'explore', 'price'],
    body: `Tick **Offer this course for free** in the course details. Once the course is published it appears in [Explore](/explore) with a **Free** badge, and it stays free for everyone when paid plans start.

Free courses are a good way to introduce your teaching; a short free course can lead learners to your longer ones.`,
  },
  {
    slug: 'tips-for-a-great-course',
    topic: 'teaching',
    title: 'Tips for a great course',
    summary: 'Clear outcomes, short lessons and a strong first lesson.',
    audience: 'instructor',
    paths: ['/instructor', '/instructor/*'],
    keywords: ['tips', 'best practices', 'quality', 'good course', 'engagement'],
    body: `- **Start with outcomes.** Write three to six concrete things learners will be able to do.
- **Keep lessons short.** Five to fifteen minutes each is easier to fit into a day.
- **Make the first lesson a free preview.** It shows your teaching style.
- **Add a PDF or text summary** for longer videos, for learners who prefer to read.
- **Use good sound.** Clear audio matters more than video quality.
- **Check facts and quotations** carefully, especially verses and translations.`,
  },

  // ---- Getting help -----------------------------------------------------------------------------
  {
    slug: 'contacting-support',
    topic: 'support',
    title: 'Contacting support',
    summary: 'Send a support request and follow the replies in your account.',
    audience: 'everyone',
    paths: ['/support', '/support/*', '/contact'],
    keywords: ['support', 'help', 'contact', 'request', 'ticket', 'problem', 'response time'],
    body: `If the help articles do not answer your question, [send a support request](/support/new). Choose a category, describe what happened and, for problems, which page you were on and which device you use.

You can follow the conversation under **Help & support** in your menu, and you get a notification when we reply. We reply on working days (Monday to Friday, 08:00 to 18:00 South African time), usually within one working day.

Not signed in? Use the [contact form](/contact) and we reply by email.`,
  },
  {
    slug: 'reporting-a-problem',
    topic: 'support',
    title: 'Reporting a problem or sharing feedback',
    summary: 'Tell us what went wrong, or what could be better.',
    audience: 'everyone',
    paths: ['/support/new'],
    keywords: ['bug', 'report', 'problem', 'feedback', 'suggestion', 'broken', 'error'],
    body: `Choose **Report a problem** in the help panel (the **Help** button at the bottom of every page). The page you were on is filled in for you.

A helpful report says:

1. What you were trying to do.
2. What happened instead (any message on the screen).
3. Your device and browser.

Suggestions are just as welcome: choose the **Feedback** category.`,
  },
  {
    slug: 'notifications',
    topic: 'support',
    title: 'Notifications',
    summary:
      'The bell shows replies from support and decisions about your applications and courses.',
    audience: 'everyone',
    paths: ['/notifications'],
    keywords: ['notifications', 'bell', 'alerts', 'updates', 'messages'],
    body: `The bell at the top of the page shows a number when something new needs your attention, for example:

- A reply to your support request.
- A decision on your instructor application.
- Your course was published or returned with notes.
- You were given a new role.

Open the bell to see recent notifications, or [see them all](/notifications). Opening a notification marks it as read.`,
  },

  // ---- For admins and support -------------------------------------------------------------------
  {
    slug: 'reviewing-courses',
    topic: 'staff',
    title: 'Reviewing courses',
    summary: 'Publish a submitted course, or return it with a note.',
    audience: 'staff',
    paths: ['/admin/courses', '/admin/courses/*'],
    keywords: ['review queue', 'publish', 'return', 'unpublish', 'course review'],
    body: `**Admin > Courses** lists courses awaiting review, longest waiting first. Open one to see its details, curriculum and media.

- **Publish** makes it live in the catalogue (and in Explore if it is free).
- **Return** sends it back to draft with a required note telling the instructor what to change.
- **Unpublish** takes a live course back to draft.

Decisions only apply if the course has not changed since you opened it, so two reviewers cannot overwrite each other. The instructor is notified, and the decision is in the activity log.`,
  },
  {
    slug: 'managing-users-and-roles',
    topic: 'staff',
    title: 'Managing people and roles',
    summary: 'Give roles, disable accounts, sign people out and reset two-step verification.',
    audience: 'staff',
    paths: ['/admin/users', '/admin/users/*'],
    keywords: [
      'users',
      'roles',
      'admin',
      'instructor',
      'support role',
      'disable',
      'sign out',
      'reset two-step',
    ],
    body: `**Admin > Users** lists everyone who has signed in. Search by name or email, or filter by role.

On a person's page you can give or remove the **Admin**, **Instructor** and **Support** roles (changes apply to their current session at once), disable or re-enable the account, sign them out everywhere, and reset their two-step verification if they lost their phone (check it is really them first).

You cannot remove your own admin role or the last admin. Every change is recorded in the **Activity log**.`,
  },
  {
    slug: 'handling-support-requests',
    topic: 'staff',
    title: 'Handling support requests',
    summary: 'Reply, add internal notes, set status and priority, and assign requests.',
    audience: 'staff',
    paths: ['/admin/support', '/admin/support/*'],
    keywords: [
      'support inbox',
      'tickets',
      'requests',
      'reply',
      'internal note',
      'assign',
      'resolve',
    ],
    body: `**Admin > Support** lists requests by status: open, waiting for the person, resolved and closed. Open one to read the conversation, the page it came from and the person's account.

- **Reply** to answer; the person gets a notification. Replying marks the request as waiting for them.
- **Internal note** is only visible to staff.
- Set the **priority** and **assign** it to yourself or a colleague.
- Mark it **resolved** when done. If they reply again, it reopens.

Contact form messages from people without an account are under **Messages**; reply to those by email.`,
  },
  {
    slug: 'managing-free-content',
    topic: 'staff',
    title: 'Managing free content and sample content',
    summary: 'Publish free videos, recordings, articles and PDFs in Explore.',
    audience: 'staff',
    paths: ['/admin/explore', '/admin/explore/*'],
    keywords: ['explore', 'free resources', 'publish', 'sample content', 'articles'],
    body: `In **Admin > Explore**, create a draft with a title and type, fill in the summary and speaker or author, upload the file (or write the article) and publish. Unpublish or delete at any time; deleting also removes the files.

**Sample content** loads short sample courses and articles marked "Sample" so testers have something to try. Remove it all in one step before launch.`,
  },
];

export const staffTopic = 'staff';

/**
 * Seed content for the demo LMS: 8 published courses + 1 draft + 1 archived,
 * across 4 categories. Two published courses (TypeScript, JavaScript) are fully
 * built with sections, videos, articles, a quiz covering all five question types,
 * an assignment and downloadable resources.
 */

export type SeedQuestionType = 'single' | 'multiple' | 'truefalse' | 'short' | 'essay';

export interface SeedQuestion {
  type: SeedQuestionType;
  prompt: string;
  /** choice types: the visible options. truefalse uses ['True', 'False']. */
  options?: string[];
  /** single/multiple: indexes into options. truefalse: [0] or [1]. short: accepted answers. */
  correct?: number[] | string[];
  explanation?: string;
  points?: number;
}

export interface SeedLesson {
  title: string;
  type: 'video' | 'text' | 'quiz' | 'assignment';
  duration: number;
  isPreview?: boolean;
  video?: string;
  captions?: string;
  poster?: string;
  body?: string;
  resources?: { title: string; file: string }[];
  quiz?: { passPercent: number; maxAttempts: number; showAnswers: boolean; questions: SeedQuestion[] };
  assignment?: { brief: string; maxScore: number; allowFiles: boolean };
}

export interface SeedSection {
  title: string;
  lessons: SeedLesson[];
}

export interface SeedCourse {
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  category: string;
  instructor: string;
  instructorBio: string;
  level: 'beginner' | 'intermediate' | 'advanced';
  pricePence: number;
  tags: string[];
  outcomes: string[];
  requirements: string;
  status: 'draft' | 'published' | 'archived';
  featured: boolean;
  certificateEnabled: boolean;
  requiresQuizPass: boolean;
  requiresAssignments: boolean;
  sections: SeedSection[];
}

export const SAMPLE_VIDEO = 'videos/sample.mp4';
export const SAMPLE_CAPTIONS = 'videos/sample.vtt';

const video = (title: string, duration: number, isPreview = false): SeedLesson => ({
  title,
  type: 'video',
  duration,
  isPreview,
  video: SAMPLE_VIDEO,
  captions: SAMPLE_CAPTIONS,
});

const article = (title: string, duration: number, body: string): SeedLesson => ({
  title,
  type: 'text',
  duration,
  body,
});

export const SEED_CATEGORIES = [
  {
    name: 'Software Development',
    slug: 'software-development',
    description: 'TypeScript, JavaScript and modern web engineering.',
  },
  {
    name: 'Data & Analytics',
    slug: 'data-analytics',
    description: 'SQL, reporting and the craft of telling stories with data.',
  },
  {
    name: 'Design',
    slug: 'design',
    description: 'Product design, Figma craft and design systems.',
  },
  {
    name: 'Business & Career',
    slug: 'business-career',
    description: 'Interviews, communication and career growth for technologists.',
  },
];

export const SEED_COURSES: SeedCourse[] = [
  // ------------------------------------------------------------------ 1. TypeScript (fully built)
  {
    slug: 'typescript-for-production-teams',
    title: 'TypeScript for Production Teams',
    subtitle: 'Write TypeScript your reviewers will approve of',
    description:
      'Most teams adopt TypeScript and then fight it for a year. This course is the shortcut: a ' +
      'practical, opinionated path through the type system as it is actually used in production ' +
      'codebases at scale.\n\n' +
      'You will work on real patterns from real repositories — narrowing, generics that stay ' +
      'readable, strict compiler settings, and a migration plan that does not freeze the team.',
    category: 'software-development',
    instructor: 'Dr Amara Osei',
    instructorBio:
      'Principal engineer and TypeScript consultant. Amara has led strict-mode migrations on ' +
      'codebases of over half a million lines and reviews type-heavy pull requests daily.',
    level: 'advanced',
    pricePence: 8900,
    tags: ['typescript', 'strict mode', 'generics', 'refactoring', 'javascript'],
    outcomes: [
      'Configure strict TypeScript so that the compiler catches real bugs',
      'Use narrowing and discriminated unions to model states safely',
      'Write generics that stay readable for the rest of the team',
      'Handle errors and unknowns without falling back to `any`',
      'Plan a gradual, low-risk migration from JavaScript',
    ],
    requirements: 'Comfortable writing JavaScript. No prior TypeScript experience needed.',
    status: 'published',
    featured: true,
    certificateEnabled: true,
    requiresQuizPass: true,
    requiresAssignments: true,
    sections: [
      {
        title: 'Foundations that Scale',
        lessons: [
          {
            ...video('Why TypeScript in production', 12, true),
            resources: [
              { title: 'TypeScript cheat-sheet (PDF)', file: 'resources/typescript-cheatsheet.pdf' },
            ],
          },
          article(
            'Strict mode, properly',
            9,
            '## What `strict` actually turns on\n\n`"strict": true` is not one check, it is a family. ' +
              'It bundles `noImplicitAny`, `strictNullChecks`, `strictFunctionTypes`, ' +
              '`strictBindCallApply`, `strictPropertyInitialization`, `noImplicitThis` and ' +
              '`alwaysStrict`.\n\n' +
              'The two that change how you write code day to day are `noImplicitAny` and ' +
              '`strictNullChecks`.\n\n' +
              '### A compiler you can trust\n\n' +
              'When `strictNullChecks` is on, `null` and `undefined` are no longer assignable to ' +
              'every type. That one change eliminated an entire class of production incidents in ' +
              'every team I have worked with.\n\n' +
              '```ts\n' +
              '// Before: compiles, crashes in production\n' +
              'function initials(name: string) {\n' +
              '  return name.split(" ").map((p) => p[0]).join("");\n' +
              '}\n\n' +
              '// After: the compiler makes you handle the missing value\n' +
              'function initials(name: string | null) {\n' +
              '  if (!name) return "";\n' +
              '  return name.split(" ").map((p) => p[0]).join("");\n' +
              '}\n' +
              '```\n\n' +
              '> Note: enable the family one flag at a time if you are migrating. Start with ' +
              '`strictNullChecks`, end with `exactOptionalPropertyTypes`.',
          ),
          video('Wiring tsconfig for a real app', 9, true),
        ],
      },
      {
        title: 'Types in Anger',
        lessons: [
          video('Narrowing and control flow', 14),
          article(
            'Generics without tears',
            10,
            '## Generics are functions for types\n\n' +
              'A generic is a way to say "this relationship holds, whatever the types turn out to ' +
              'be". If you cannot state the relationship in a sentence, you probably do not need ' +
              'a generic.\n\n' +
              '### The three generics you will actually use\n\n' +
              '1. **Collections** — `Array<T>`, `Map<K, V>`, `Set<T>`. Stay close to these.\n' +
              '2. **Identity-preserving helpers** — `const first = <T>(xs: T[]): T | undefined => xs[0];`\n' +
              '3. **Key-safe lookups** — `function get<T, K extends keyof T>(obj: T, key: K): T[K]`.\n\n' +
              '```ts\n' +
              'function pluck<T, K extends keyof T>(items: T[], key: K): T[K][] {\n' +
              '  return items.map((item) => item[key]);\n' +
              '}\n' +
              '```\n\n' +
              'The third form is where generics earn their keep: the return type is derived from ' +
              'the arguments, so callers get autocomplete instead of `any`.',
          ),
          {
            title: 'Checkpoint: types & narrowing',
            type: 'quiz',
            duration: 15,
            quiz: {
              passPercent: 70,
              maxAttempts: 3,
              showAnswers: true,
              questions: [
                {
                  type: 'single',
                  prompt: 'Which tsconfig flag enables the strictest family of type checks at once?',
                  options: ['strict', 'strictChecks', 'noImplicitAnyOnly', 'alwaysStrict'],
                  correct: [0],
                  explanation: '`strict` turns on the whole family; the others are individual flags.',
                },
                {
                  type: 'multiple',
                  prompt: 'Which statements about the `unknown` type are true? (select all that apply)',
                  options: [
                    'It is the type-safe counterpart of `any`',
                    'You must narrow it before you can use its value',
                    'It is assignable to `string` without a check',
                    'A value of any type can be assigned to `unknown`',
                  ],
                  correct: [0, 1, 3],
                  explanation:
                    'Anything can be assigned to `unknown`, but you must narrow it before use — ' +
                    'that is exactly what makes it safe.',
                },
                {
                  type: 'truefalse',
                  prompt:
                    'Structural typing means a value is compatible if it has the required members, ' +
                    'regardless of where it was declared.',
                  options: ['True', 'False'],
                  correct: [0],
                  explanation: 'TypeScript compares shapes, not declarations.',
                },
                {
                  type: 'short',
                  prompt:
                    'Name the built-in utility type that makes every property of a type optional. ' +
                    '(one word)',
                  correct: ['Partial', 'partial'],
                  explanation: '`Partial<T>` maps every property to `T[K] | undefined`.',
                },
                {
                  type: 'essay',
                  prompt:
                    'You inherit a 10,000-line JavaScript service with no tests. Describe, step by ' +
                    'step, how you would migrate it to strict TypeScript without pausing feature ' +
                    'work. Aim for 150-250 words — this answer is reviewed by the instructor.',
                  points: 3,
                  explanation: 'Reviewed manually. Look for incremental steps, allowJs, and CI gates.',
                },
              ],
            },
          },
        ],
      },
      {
        title: 'Ship it',
        lessons: [
          article(
            'Error handling patterns',
            8,
            '## Errors are values you have not typed yet\n\n' +
              'In strict code, a `catch` binding is `unknown`. That is a feature: it forces you to ' +
              'narrow before touching `.message`.\n\n' +
              '```ts\n' +
              'function toMessage(error: unknown): string {\n' +
              '  if (error instanceof Error) return error.message;\n' +
              '  return String(error);\n' +
              '}\n' +
              '```\n\n' +
              '### Result types for expected failures\n\n' +
              'Reserve exceptions for the exceptional. For expected failures — validation, HTTP ' +
              'errors, parsing — return a discriminated union so callers must handle both paths ' +
              'in code rather than in a comment.',
          ),
          {
            title: 'Assignment: migrate a module to strict TypeScript',
            type: 'assignment',
            duration: 60,
            assignment: {
              brief:
                'Take the JavaScript module in the course resources (a small HTTP client), add ' +
                'types, and enable `strict` for it. Submit the annotated source and a short note ' +
                'explaining the decisions you made — especially any place where you chose a ' +
                'narrower type over `any`. A score out of 100 and written feedback will be ' +
                'returned within the demo.',
              maxScore: 100,
              allowFiles: true,
            },
            resources: [{ title: 'Migration worksheet (PDF)', file: 'resources/migration-worksheet.pdf' }],
          },
          video('Reviewing your migration plan', 11),
        ],
      },
    ],
  },

  // ------------------------------------------------------------------ 2. JavaScript Fundamentals (fully built, free)
  {
    slug: 'javascript-fundamentals',
    title: 'JavaScript Fundamentals: From Zero to Confident',
    subtitle: 'The language, the tooling, and your first real project',
    description:
      'A patient, modern introduction to JavaScript. No frameworks, no jargon walls — you will ' +
      'learn the language itself, the way it behaves in a browser and in Node, and finish by ' +
      'building something you can show people.\n\n' +
      'Every concept comes with a short exercise and a worked solution, so you are never reading ' +
      'code you could have written.',
    category: 'software-development',
    instructor: 'Tom Whitfield',
    instructorBio:
      'Senior front-end engineer and bootcamp instructor. Tom has taught JavaScript fundamentals ' +
      'to over 2,000 career changers.',
    level: 'beginner',
    pricePence: 0,
    tags: ['javascript', 'beginners', 'web development', 'fundamentals'],
    outcomes: [
      'Read and write modern JavaScript with confidence',
      'Understand variables, functions, scope and closures',
      'Work with arrays, objects and the DOM',
      'Debug your own code with the browser tools',
      'Build and share a small interactive project',
    ],
    requirements: 'A computer and a willingness to type code out by hand. No experience required.',
    status: 'published',
    featured: true,
    certificateEnabled: true,
    requiresQuizPass: true,
    requiresAssignments: true,
    sections: [
      {
        title: 'Getting Started',
        lessons: [
          { ...video('Welcome to the course', 4, true) },
          article(
            'Setting up your editor',
            6,
            '## A five-minute setup\n\n' +
              'Install VS Code, then add two extensions: **ESLint** and **Prettier**. That is the ' +
              'whole setup. Open a new file called `playground.js` — that is where you will do ' +
              'every exercise in this course.\n\n' +
              '### Run it in the terminal\n\n' +
              '```bash\nnode playground.js\n```\n\n' +
              'If you see output, you are ready. If `node` is not recognised, install the current ' +
              'LTS release from nodejs.org and reopen your terminal.',
          ),
          { ...video('Your first script', 8, true) },
        ],
      },
      {
        title: 'Core Concepts',
        lessons: [
          video('Variables, types and truthiness', 13),
          video('Functions, scope and closures', 15),
          article(
            'Debugging like a professional',
            7,
            '## Stop reaching for console.log\n\n' +
              'Well — start with `console.log`, then level up:\n\n' +
              '- `console.table(arr)` for arrays of objects\n' +
              '- `console.group()` / `console.groupEnd()` to nest related output\n' +
              '- the **debugger statement** to pause execution and inspect the scope\n\n' +
              '### Read the stack trace\n\n' +
              'The first line tells you the error type. The second tells you the file and line. ' +
              'Everything below is the call path that got you there — read it bottom to top to ' +
              'see how you arrived.',
          ),
          {
            title: 'Fundamentals check',
            type: 'quiz',
            duration: 12,
            quiz: {
              passPercent: 60,
              maxAttempts: 5,
              showAnswers: true,
              questions: [
                {
                  type: 'single',
                  prompt: 'Which keyword declares a variable that cannot be reassigned?',
                  options: ['var', 'let', 'const', 'static'],
                  correct: [2],
                  explanation: '`const` prevents reassignment of the binding.',
                },
                {
                  type: 'multiple',
                  prompt: 'Which of these values are falsy? (select all that apply)',
                  options: ['0', "'' (empty string)", "'0' (string zero)", 'NaN'],
                  correct: [0, 1, 3],
                  explanation: 'The non-empty string `"0"` is truthy — a classic interview trap.',
                },
                {
                  type: 'truefalse',
                  prompt: '`typeof null` returns "object".',
                  options: ['True', 'False'],
                  correct: [0],
                  explanation: 'A famous historical quirk that cannot be fixed without breaking the web.',
                },
                {
                  type: 'short',
                  prompt:
                    'Which array method returns a new array with each element transformed? (one word)',
                  correct: ['map', 'map()', '.map'],
                  explanation: '`map` transforms; `forEach` iterates without returning a new array.',
                },
                {
                  type: 'essay',
                  prompt:
                    'Describe a piece of JavaScript that confused you (or that you expect to ' +
                    'confuse you) and how you would go about understanding it. 100-200 words — ' +
                    'your instructor reads every answer.',
                  points: 2,
                },
              ],
            },
          },
        ],
      },
      {
        title: 'Build Something',
        lessons: [
          video('Building a to-do list, step by step', 18),
          {
            title: 'Assignment: your first small app',
            type: 'assignment',
            duration: 45,
            assignment: {
              brief:
                'Build a small interactive page — a to-do list, a tip calculator or a quiz card. ' +
                'It must store state in variables, update the DOM, and handle one user input. ' +
                'Submit a link or a file plus a paragraph on what was hardest and why.',
              maxScore: 100,
              allowFiles: true,
            },
          },
          article(
            'Where to go next',
            5,
            '## You can write JavaScript now\n\n' +
              'The next step is not another course — it is a project slightly harder than what ' +
              'you can currently do. Pick one:\n\n' +
              '1. A weather page that fetches from a public API\n' +
              '2. A flashcards app that saves to `localStorage`\n' +
              '3. A pomodoro timer with audio\n\n' +
              'Then come back for **TypeScript for Production Teams** when you want types.',
          ),
        ],
      },
    ],
  },

  // ------------------------------------------------------------------ 3. Next.js
  {
    slug: 'ship-your-first-nextjs-app',
    title: 'Ship Your First Next.js App',
    subtitle: 'From idea to deployed product in a weekend',
    description:
      'A focused, practical course on building real products with the Next.js App Router. ' +
      'Routing, data, forms, authentication and deployment — the 20% of the framework that ' +
      'carries 80% of production apps.',
    category: 'software-development',
    instructor: 'Dr Amara Osei',
    instructorBio: 'Principal engineer and Next.js maintainer-adjacent tinkerer with 12 years of production web experience.',
    level: 'intermediate',
    pricePence: 7900,
    tags: ['next.js', 'react', 'full-stack', 'app router'],
    outcomes: [
      'Structure an App Router project that scales past the tutorial',
      'Fetch data on the server without over-fetching',
      'Handle forms and mutations with server actions',
      'Add authentication and protect routes',
      'Deploy with confidence',
    ],
    requirements: 'Solid JavaScript or TypeScript, plus basic React.',
    status: 'published',
    featured: false,
    certificateEnabled: true,
    requiresQuizPass: true,
    requiresAssignments: false,
    sections: [
      {
        title: 'The 20% that matters',
        lessons: [
          video('App Router mental model', 11, true),
          article(
            'Server first, client when needed',
            8,
            '## The default is the server\n\n' +
              'In the App Router every component is a server component until you add ' +
              '`"use client"`. That default is the whole point: data access belongs on the ' +
              'server, interactivity is the exception.\n\n' +
              '### A rule of thumb\n\n' +
              'Push `"use client"` to the leaves of the tree. A page can be a server component ' +
              'that renders a small interactive island.',
          ),
          video('Data fetching without waterfalls', 13),
          {
            title: 'App Router check',
            type: 'quiz',
            duration: 8,
            quiz: {
              passPercent: 60,
              maxAttempts: 3,
              showAnswers: true,
              questions: [
                {
                  type: 'single',
                  prompt: 'Which directive turns a module into a client component?',
                  options: ['"use client"', '"client"', '"use browser"', '"use interactive"'],
                  correct: [0],
                },
                {
                  type: 'truefalse',
                  prompt: 'A server component can import a client component directly.',
                  options: ['True', 'False'],
                  correct: [0],
                  explanation: 'True — but a client component cannot import a server component.',
                },
                {
                  type: 'short',
                  prompt: 'Name the folder convention used for private, non-route files inside `app`.',
                  correct: ['_folder', 'underscore folder', '_'],
                  explanation: 'Folders prefixed with `_` are treated as private and never routed.',
                },
              ],
            },
          },
        ],
      },
    ],
  },

  // ------------------------------------------------------------------ 4. SQL for Analysts (free)
  {
    slug: 'sql-for-analysts',
    title: 'SQL for Analysts',
    subtitle: 'Query, join and summarise real business data',
    description:
      'The SQL course for people who are handed a database and a business question. You will ' +
      'learn to select, join and aggregate with confidence, then turn raw tables into answers ' +
      'your stakeholders trust.',
    category: 'data-analytics',
    instructor: 'Priya Raman',
    instructorBio: 'Analytics lead turned data educator. Priya has built reporting stacks for retail, fintech and the public sector.',
    level: 'beginner',
    pricePence: 0,
    tags: ['sql', 'analytics', 'reporting', 'data'],
    outcomes: [
      'Write SELECT statements with confidence',
      'Join multiple tables without duplicating rows',
      'Aggregate and group data for reporting',
      'Learn to read a schema and ask the right question',
    ],
    requirements: 'No prior SQL. A spreadsheet habit is a bonus.',
    status: 'published',
    featured: false,
    certificateEnabled: true,
    requiresQuizPass: false,
    requiresAssignments: false,
    sections: [
      {
        title: 'Queries',
        lessons: [
          video('Anatomy of a SELECT', 10, true),
          article(
            'Thinking in sets',
            6,
            '## SQL is not step-by-step\n\n' +
              'You describe the result you want; the database decides how to get it. Once you ' +
              'internalise that, `WHERE` and `JOIN` stop feeling arbitrary.\n\n' +
              'Order of evaluation, roughly: `FROM` → `WHERE` → `GROUP BY` → `HAVING` → ' +
              '`SELECT` → `ORDER BY` → `LIMIT`. That order explains why you cannot use a ' +
              '`SELECT` alias inside `WHERE`.',
          ),
        ],
      },
      {
        title: 'Joining the dots',
        lessons: [
          video('INNER, LEFT and the fan-out trap', 14),
          { title: 'Joins check', type: 'quiz', duration: 8, quiz: { passPercent: 60, maxAttempts: 2, showAnswers: true, questions: [
            { type: 'single', prompt: 'Which join returns every row from the left table even when there is no match?', options: ['INNER JOIN', 'LEFT JOIN', 'CROSS JOIN', 'NATURAL JOIN'], correct: [1] },
            { type: 'truefalse', prompt: 'Adding a JOIN can increase the number of rows in the result.', options: ['True', 'False'], correct: [0], explanation: 'Yes — one-to-many joins fan out. That is why aggregating before joining is often correct.' },
            { type: 'short', prompt: 'Which clause filters rows before grouping? (one word)', correct: ['where', 'WHERE'], explanation: '`WHERE` filters rows; `HAVING` filters groups.' },
          ] } },
        ],
      },
    ],
  },

  // ------------------------------------------------------------------ 5. Dashboards (featured)
  {
    slug: 'data-storytelling-dashboards',
    title: 'Data Storytelling & Dashboards',
    subtitle: 'Build reporting people actually read',
    description:
      'Most dashboards fail not because the numbers are wrong, but because nobody acts on them. ' +
      'This course is about the last mile: choosing the right chart, designing a page that ' +
      'answers a question, and writing the commentary that turns a metric into a decision.',
    category: 'data-analytics',
    instructor: 'Priya Raman',
    instructorBio: 'Analytics lead turned data educator, ex-Deliveroo and fintech reporting.',
    level: 'intermediate',
    pricePence: 9900,
    tags: ['dashboards', 'visualisation', 'reporting', 'communication'],
    outcomes: [
      'Choose the right chart for the question',
      'Lay out a dashboard that survives contact with stakeholders',
      'Write commentary that leads to decisions',
      'Avoid the three charts that mislead most often',
    ],
    requirements: 'Some experience building charts or reports is helpful but not required.',
    status: 'published',
    featured: true,
    certificateEnabled: true,
    requiresQuizPass: true,
    requiresAssignments: true,
    sections: [
      {
        title: 'The craft',
        lessons: [
          video('Anatomy of a dashboard people use', 12, true),
          article(
            'Three charts that lie',
            9,
            '## The greatest hits of miscommunication\n\n' +
              '1. **Truncated bar charts.** Starting a bar axis at 90 exaggerates noise. Bars must ' +
              'start at zero; lines may drift from zero when the variation is the story.\n' +
              '2. **Dual axes.** Two y-scales let you imply any correlation you like.\n' +
              '3. **Pie charts beyond four slices.** Human eyes rank angles badly. Use a sorted bar.\n\n' +
              '### What to do instead\n\n' +
              'Sort. Annotate. Show the baseline. State the takeaway in the title: "Checkout ' +
              'drop-off doubled after the 4 March release" beats "Checkout funnel".',
          ),
          video('Layout, hierarchy and the 5-second test', 14),
        ],
      },
      {
        title: 'From metric to decision',
        lessons: [
          {
            title: 'Chart choice check',
            type: 'quiz',
            duration: 10,
            quiz: {
              passPercent: 60,
              maxAttempts: 3,
              showAnswers: true,
              questions: [
                { type: 'single', prompt: 'You need to show change over time for one metric. Which encoding is usually best?', options: ['Pie chart', 'Line chart', 'Stacked 3D bars', 'Treemap'], correct: [1] },
                { type: 'multiple', prompt: 'Which of these make a chart easier to act on? (select all that apply)', options: ['A titled takeaway', 'A zero baseline on bars', 'Two y-axes', 'Annotations for known events'], correct: [0, 1, 3] },
                { type: 'short', prompt: 'Which axis must a bar chart always start from? (one word)', correct: ['zero', '0'] },
                { type: 'essay', prompt: 'Pick a metric from a previous job or project. Sketch the dashboard you would build around it: the headline number, two supporting charts, and the commentary you would write for a busy executive. 150+ words.', points: 3 },
              ],
            },
          },
          {
            title: 'Assignment: design a one-page dashboard',
            type: 'assignment',
            duration: 90,
            assignment: {
              brief:
                'Choose any business question (retail, SaaS, charity — your call). Produce a ' +
                'one-page dashboard: headline metric, up to three supporting views, and written ' +
                'commentary. A sketch is fine. Explain your chart choices and one thing you ' +
                'deliberately left out.',
              maxScore: 100,
              allowFiles: true,
            },
            resources: [{ title: 'Dashboard critique rubric (PDF)', file: 'resources/dashboard-rubric.pdf' }],
          },
        ],
      },
    ],
  },

  // ------------------------------------------------------------------ 6. Figma
  {
    slug: 'clean-product-design-figma',
    title: 'Clean Product Design in Figma',
    subtitle: 'Screens that look designed, not assembled',
    description:
      'A practical design course for product screens: spacing systems, type hierarchy, colour ' +
      'discipline and component craft in Figma. By the end you will look at your own work and ' +
      'know exactly what to fix.',
    category: 'design',
    instructor: 'Elena Marchetti',
    instructorBio: 'Product designer with a decade in European startups; previously design lead at a fintech unicorn.',
    level: 'beginner',
    pricePence: 6900,
    tags: ['figma', 'ui design', 'product design', 'layout'],
    outcomes: [
      'Build a spacing and type system you can reuse',
      'Design components with sane variants',
      'Make screens that read well on mobile and desktop',
      'Give and receive design critique',
    ],
    requirements: 'A free Figma account.',
    status: 'published',
    featured: false,
    certificateEnabled: true,
    requiresQuizPass: false,
    requiresAssignments: false,
    sections: [
      {
        title: 'Foundations',
        lessons: [
          video('Setting up a design file that does not rot', 9, true),
          article(
            'Spacing is the design',
            7,
            '## Pick a scale and obey it\n\n' +
              'A 4-point scale (4, 8, 12, 16, 24, 32, 48, 64) covers almost every need. The magic ' +
              'is not the numbers — it is that you stop inventing new ones.\n\n' +
              '### Proximity beats borders\n\n' +
              'Related things sit closer together. Before you reach for a divider or a card, ' +
              'increase the space around the group instead. Most cluttered screens are spacing ' +
              'problems wearing a costume.',
          ),
        ],
      },
      {
        title: 'Craft',
        lessons: [
          video('Type hierarchy in 20 minutes', 11),
          video('Components and variants that scale', 15),
          { title: 'Design craft check', type: 'quiz', duration: 8, quiz: { passPercent: 60, maxAttempts: 3, showAnswers: true, questions: [
            { type: 'single', prompt: 'Which spacing increment is the usual foundation of a design scale?', options: ['4px', '7px', '13px', '20px'], correct: [0] },
            { type: 'truefalse', prompt: 'Increasing space between unrelated groups is usually better than adding a border.', options: ['True', 'False'], correct: [0] },
            { type: 'short', prompt: 'What is the name of the Figma feature that lets one component have many states? (one word)', correct: ['variants', 'variant'] },
          ] } },
        ],
      },
    ],
  },

  // ------------------------------------------------------------------ 7. Design systems
  {
    slug: 'design-systems-that-scale',
    title: 'Design Systems that Scale',
    subtitle: 'Tokens, components and the politics of consistency',
    description:
      'A design system is 20% components and 80% agreement. This course covers tokens, ' +
      'versioning, documentation and adoption — including what to do when a product team ' +
      'wants to fork your button.',
    category: 'design',
    instructor: 'Elena Marchetti',
    instructorBio: 'Design systems lead; author of an internal system used by 40 product teams.',
    level: 'advanced',
    pricePence: 12900,
    tags: ['design systems', 'tokens', 'figma', 'components', 'governance'],
    outcomes: [
      'Model design tokens that survive a rebrand',
      'Version components without breaking consumers',
      'Document for both designers and engineers',
      'Drive adoption without mandating it',
    ],
    requirements: 'Comfortable with Figma components and a component library in code.',
    status: 'published',
    featured: false,
    certificateEnabled: true,
    requiresQuizPass: false,
    requiresAssignments: false,
    sections: [
      {
        title: 'Tokens & architecture',
        lessons: [
          video('Token architecture in practice', 13, true),
          article(
            'Semantic beats literal',
            8,
            '## Name by role, not by value\n\n' +
              '`color-blue-500` breaks at the first rebrand. `color-action-primary` survives it. ' +
              'Literal tokens exist as a palette layer; semantic tokens point at them.\n\n' +
              '### Three layers\n\n' +
              '1. **Palette** — raw values (`violet-600`)\n' +
              '2. **Semantic** — roles (`action-primary`, `surface-raised`)\n' +
              '3. **Component** — local decisions (`button-primary-background`)\n\n' +
              'Systems fail when components reach into the palette directly.',
          ),
        ],
      },
      {
        title: 'Adoption & governance',
        lessons: [
          video('The adoption curve, and how not to fight it', 12),
          { title: 'Systems check', type: 'quiz', duration: 8, quiz: { passPercent: 60, maxAttempts: 2, showAnswers: true, questions: [
            { type: 'single', prompt: 'Which token name survives a rebrand?', options: ['color-blue-500', 'action-primary', 'hex-5B3DF5', 'blueish'], correct: [1] },
            { type: 'multiple', prompt: 'Which are signs a design system is healthy? (select all that apply)', options: ['Teams adopt it voluntarily', 'It has a public changelog', 'Every team forks components', 'It has documented deprecation policy'], correct: [0, 1, 3] },
            { type: 'truefalse', prompt: 'Components should reference palette tokens directly.', options: ['True', 'False'], correct: [1], explanation: 'They should reference semantic tokens so a palette change does not ripple through every component.' },
            { type: 'short', prompt: 'What do you call a planned, announced removal of an outdated component? (one word)', correct: ['deprecation', 'deprecate'] },
          ] } },
        ],
      },
    ],
  },

  // ------------------------------------------------------------------ 8. Interview skills
  {
    slug: 'interview-skills-for-developers',
    title: 'Interview Skills for Developers',
    subtitle: 'Turn technical ability into offers',
    description:
      'A short, honest course about developer interviews: how to explain your work, structure ' +
      'your answers, handle take-homes, and negotiate without burning goodwill.',
    category: 'business-career',
    instructor: 'Tom Whitfield',
    instructorBio: 'Interview coach and senior engineer who has sat on both sides of 300+ technical interviews.',
    level: 'beginner',
    pricePence: 0,
    tags: ['interviews', 'career', 'communication', 'negotiation'],
    outcomes: [
      'Explain technical work to non-technical interviewers',
      'Structure answers so you do not ramble',
      'Handle take-homes and live coding calmly',
      'Negotiate an offer with specifics, not vibes',
    ],
    requirements: 'None. Useful at any stage of a job search.',
    status: 'published',
    featured: false,
    certificateEnabled: true,
    requiresQuizPass: false,
    requiresAssignments: false,
    sections: [
      {
        title: 'Talking about your work',
        lessons: [
          video('The three-sentence project story', 8, true),
          article(
            'STAR, but shorter',
            5,
            '## Situation, Task, Action, Result\n\n' +
              'The classic structure works because it forces a conclusion. The mistake is ' +
              'spending 90% of the answer on Situation.\n\n' +
              'Aim for: **one sentence of context, one of problem, three of action, one of ' +
              'measurable result.** If you cannot name a result, say what you learned — ' +
              'interviews reward honesty more than polish.',
          ),
          { title: 'Interview craft check', type: 'quiz', duration: 6, quiz: { passPercent: 60, maxAttempts: 3, showAnswers: true, questions: [
            { type: 'single', prompt: 'What does the "R" in STAR stand for?', options: ['Reason', 'Result', 'Review', 'Responsibility'], correct: [1] },
            { type: 'truefalse', prompt: 'Spending most of a STAR answer on context is usually effective.', options: ['True', 'False'], correct: [1] },
            { type: 'short', prompt: 'Which part of STAR should be measurable? (one word)', correct: ['result', 'results'] },
          ] } },
        ],
      },
    ],
  },

  // ------------------------------------------------------------------ 9. Draft
  {
    slug: 'advanced-react-patterns',
    title: 'Advanced React Patterns',
    subtitle: 'Composition, state machines and performance',
    description:
      'A deep, opinionated tour of React patterns that survive production: composition over ' +
      'configuration, explicit state machines, and performance work driven by measurement ' +
      'rather than folklore. (Draft — content still being produced.)',
    category: 'software-development',
    instructor: 'Dr Amara Osei',
    instructorBio: 'Principal engineer and consultant.',
    level: 'advanced',
    pricePence: 10900,
    tags: ['react', 'patterns', 'performance', 'state machines'],
    outcomes: ['Compose components that flex without prop explosion', 'Model UI state explicitly'],
    requirements: 'Production React experience.',
    status: 'draft',
    featured: false,
    certificateEnabled: true,
    requiresQuizPass: false,
    requiresAssignments: false,
    sections: [
      {
        title: 'Composition',
        lessons: [
          video('Composition over configuration', 12, true),
          article('Slots and children', 6, '## Draft notes\n\nThis article is still being written. The final version will cover slots, render props, and when each is a mistake.'),
        ],
      },
      {
        title: 'State',
        lessons: [video('State machines in React', 14)],
      },
    ],
  },

  // ------------------------------------------------------------------ 10. Archived
  {
    slug: 'legacy-jquery-for-beginners',
    title: 'Legacy: jQuery for Beginners',
    subtitle: 'Maintaining older codebases (archived)',
    description:
      'An archived course kept for learners who enrolled previously. Covers DOM selection, ' +
      'events and AJAX with jQuery — still useful when you inherit a codebase written in 2012.',
    category: 'software-development',
    instructor: 'Tom Whitfield',
    instructorBio: 'Senior front-end engineer.',
    level: 'beginner',
    pricePence: 0,
    tags: ['jquery', 'legacy', 'javascript'],
    outcomes: ['Read and maintain jQuery codebases'],
    requirements: 'Basic HTML and JavaScript.',
    status: 'archived',
    featured: false,
    certificateEnabled: false,
    requiresQuizPass: false,
    requiresAssignments: false,
    sections: [
      {
        title: 'The basics',
        lessons: [
          video('Selecting and manipulating the DOM', 10, true),
          article('Events and AJAX', 8, '## jQuery events\n\nStill sealed in every legacy codebase you will inherit. This lesson covers `$(document).on(...)` delegation and the `$.ajax` family.'),
        ],
      },
    ],
  },
];

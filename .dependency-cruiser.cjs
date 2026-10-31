/**
 * Architecture boundaries (ADR 0001 §5/§6.2, implementation plan §2.1).
 * Keeps the PostgreSQL escape hatch viable: domain/application never touch firebase-admin.
 */
// npm packages resolve to node_modules paths (pnpm: node_modules/.pnpm/x/node_modules/pkg/...), so match the path segment.
const npm = (names) => `(^|/)node_modules/(${names})/`;
const NEXT = npm('next');
const REACT = npm('react|react-dom');
const PINO = npm('pino');
const FIREBASE = npm('firebase-admin|firebase|@firebase|@google-cloud');

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'domain-is-pure',
      comment:
        'domain/ is pure: no application, ports of other layers, infrastructure, app, next, react or Firebase.',
      severity: 'error',
      from: { path: '^src/modules/[^/]+/domain/' },
      to: {
        path: [
          '^src/modules/[^/]+/(application|api)/',
          '^src/(infrastructure|app|ui|composition)/',
          '^src/platform/(http|logging|auth)/',
        ],
      },
    },
    {
      name: 'domain-no-sdk',
      severity: 'error',
      from: { path: '^src/modules/[^/]+/domain/' },
      to: {
        path: [NEXT, REACT, FIREBASE, PINO],
        dependencyTypes: [
          'npm',
          'npm-dev',
          'npm-peer',
          'npm-optional',
          'core',
          'unknown',
          'undetermined',
        ],
      },
    },
    {
      name: 'application-no-sdk',
      comment:
        'application/ and ports/ must not import firebase-admin, next, react or infrastructure.',
      severity: 'error',
      from: { path: '^src/modules/[^/]+/(application|ports)/' },
      to: { path: [FIREBASE, NEXT, REACT, '^src/(infrastructure|app|ui|composition)/'] },
    },
    {
      name: 'platform-no-sdk',
      comment: 'platform/ is vendor neutral: adapters live in infrastructure/.',
      severity: 'error',
      from: { path: '^src/platform/' },
      to: { path: [FIREBASE, NEXT, REACT, '^src/(infrastructure|app|ui|composition|modules)/'] },
    },
    {
      name: 'modules-via-public-index-only',
      comment: 'A module may import another module only through its index.ts.',
      severity: 'error',
      from: { path: '^src/modules/([^/]+)/' },
      to: {
        path: '^src/modules/([^/]+)/',
        pathNot: ['^src/modules/$1/', '^src/modules/[^/]+/index\\.ts$'],
      },
    },
    {
      name: 'outside-modules-via-public-index-only',
      comment:
        'Code outside src/modules (app, infrastructure, composition) may only use a module through its index.ts.',
      severity: 'error',
      from: {
        path: '^src/(app|infrastructure|composition|platform|ui)/',
        pathNot: ['\\.test\\.tsx?$'],
      },
      to: { path: '^src/modules/[^/]+/(domain|application|ports|api)/' },
    },
    {
      name: 'modules-no-infrastructure',
      severity: 'error',
      from: { path: '^src/modules/' },
      to: { path: '^src/(infrastructure|app|ui|composition)/' },
    },
    {
      name: 'app-no-infrastructure',
      comment:
        'Next.js pages and route handlers get dependencies from composition/, never from infrastructure/ directly.',
      severity: 'error',
      from: { path: '^src/app/' },
      to: { path: '^src/infrastructure/' },
    },
    {
      name: 'ui-is-browser-safe',
      comment: 'Shared UI components never import server code or Firebase.',
      severity: 'error',
      from: { path: '^src/ui/' },
      to: { path: [FIREBASE, '^src/(infrastructure|composition|modules|platform)/', PINO] },
    },
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'no-firebase-client-sdk',
      comment: 'ADR 0001 R-12: the firebase web SDK must never be a dependency of the app.',
      severity: 'error',
      from: { path: '^(src|scripts)/' },
      to: { path: npm('firebase|@firebase') },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
    exclude: { path: ['^src/app/styles'] },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default'],
    },
  },
};

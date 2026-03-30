# Trips Web Application Constitution

## Core Principles

### I. Test-First Development (NON-NEGOTIABLE)

Every feature implementation follows strict TDD discipline:
- **Specification Phase**: User stories and acceptance criteria written first
- **Test Phase**: Tests written and approved before implementation begins
- **Development Phase**: Implementation proceeds only after tests fail (Red-Green-Refactor cycle)
- **Coverage Minimums**: Unit tests ≥85%, integration tests for all critical paths, E2E tests for user flows
- **Test Maintenance**: Tests updated whenever behavior changes; broken tests block commits

### II. Code Quality Standards

Code must be maintainable, readable, and consistent across the application:
- **Type Safety**: Full TypeScript implementation; strict mode enabled; no `any` types without justification
- **Linting & Formatting**: All code passes eslint and prettier before merge; CI/CD enforces this
- **Code Complexity**: Cyclomatic complexity ≤10 per function; SOLID principles enforced in reviews
- **Documentation**: Public APIs documented with JSDoc; complex logic requires inline comments explaining "why", not "what"
- **Dependency Management**: All external dependencies justified; no unused packages; regular security audits

### III. User Experience Consistency

Users experience a coherent, predictable application:
- **Design System**: All UI components must use the centralized design system; no one-off styles
- **Accessibility**: WCAG 2.1 AA compliance mandatory; all interactive elements keyboard-accessible; semantic HTML required
- **Performance Budget**: Core Web Vitals thresholds — LCP ≤2.5s, FID ≤100ms, CLS ≤0.1; measured in CI and production
- **Responsive Design**: Mobile-first approach; tested on breakpoints (320px, 768px, 1024px, 1440px minimum)
- **Internationalization**: i18n structure ready from day one; UI text never hardcoded; supports RTL languages

### IV. Performance Requirements

The application must be fast, scalable, and resource-efficient:
- **Frontend Bundle**: Main bundle ≤150KB gzipped; code splitting mandatory for routes and heavy features
- **Page Load**: First Contentful Paint (FCP) ≤1.5s on 4G; Time to Interactive (TTI) ≤3.5s
- **API Response Times**: P50 ≤200ms, P95 ≤500ms for standard endpoints; optimized queries required
- **Database Queries**: Explicit N+1 query prevention; indexes required for all common filters and sorts
- **Asset Optimization**: Images lazy-loaded; WebP format with fallbacks; no unminified assets in production

### V. Error Handling & Resilience

Robust error handling at every layer:
- **User-Facing Errors**: Clear, actionable messages; never expose stack traces to users
- **Network Errors**: Graceful degradation; retry logic with exponential backoff for transient failures
- **Monitoring & Alerts**: Error tracking (e.g., Sentry) configured; critical errors trigger alerts
- **Fallback UX**: Skeleton screens, loading states, or graceful failures for all async operations

### VI. Security-First Implementation

Security is built in from the start, not bolted on:
- **Input Validation**: All user input validated and sanitized; XSS prevention enforced
- **Authentication & Authorization**: HTTPS only in production; CSRF tokens required; role-based access control (RBAC) where applicable
- **Secrets Management**: Never commit API keys, tokens, or credentials; use environment variables
- **Dependency Security**: All packages scanned for vulnerabilities; automated updates for critical patches
- **Data Protection**: Sensitive data encrypted at rest and in transit; PII handled according to privacy requirements

## Development Workflow

### Branching Strategy

- Feature branches follow naming: `NNN-feature-description` (matches Speckit sequential numbering)
- All changes go through feature branches; direct main commits prohibited
- Branch protection rules require passing tests and code review before merge

### Quality Gates Before Merge

1. **Automated Checks**: All CI/CD tests pass; linting passes; coverage meets minimum thresholds
2. **Code Review**: At least one approved review from a team member; resolves all conversations
3. **Manual Testing**: Feature tested on multiple devices/browsers; no regressions in existing features
4. **Performance Validation**: Lighthouse or similar tool confirms performance budget compliance

### Documentation Requirements

- Feature branch includes: spec.md (requirements), plan.md (design), tasks.md (implementation breakdown)
- Architectural decisions documented in ADR format (Architecture Decision Records)
- API changes update OpenAPI/Swagger documentation
- README updated with new features or configuration changes

## Additional Standards

### Frontend Architecture

- Component-driven design; all UI as reusable, isolated components
- State management centralized (e.g., Redux, Zustand, or Context); no prop drilling beyond 2 levels
- Hooks for logic reuse; custom hooks documented and exported from utils
- Build tooling supports fast development (HMR) and optimized production builds

### API & Backend Integration

- All APIs versioned; breaking changes increment major version and deprecate old endpoints
- Consistent error response format with HTTP status codes and structured error details
- Request/response schemas documented and validated; generated client code preferred over manual
- Rate limiting and request validation at API boundaries

### Testing Strategy

- **Unit Tests**: Test individual functions and components in isolation; use mocking judiciously
- **Integration Tests**: Test feature workflows end-to-end; cover user journeys and edge cases
- **E2E Tests**: Automated browser tests for critical user paths (sign-up, purchase, core features)
- **Visual Regression**: Screenshot comparison tests for UI-heavy features
- **Performance Tests**: Benchmark critical operations; catch regressions in build pipelines

## Governance

This constitution is the source of truth for development standards. All PRs, reviews, and decisions must verify compliance.

**How changes happen:**
- Amendments proposed as issues with clear rationale for change
- Changes require approval from at least two team members
- Migration path documented if existing code needs updates
- Version number incremented; amendment date logged

**Enforcement:**
- CI/CD blocks non-compliant code; tests must pass
- Code reviews specifically check constitution compliance
- Exceptions granted only with documented justification and team consensus

**Guidance:**
- Use Speckit agents (`speckit.implement`, `speckit.plan`) to generate code following these principles
- Reference this constitution in PR reviews when raising standards concerns
- Update this document when patterns emerge that violate or clarify these principles

**Version**: 1.0.0 | **Ratified**: 2026-03-30 | **Last Amended**: 2026-03-30

# ABLE Health · Free courses

Free, self-paced health courses from ABLE Health, the health-literacy branch of
[ABLE Initiatives](https://ableinitiatives.com), a student-run 501(c)(3)
nonprofit. Live at **https://health.ableinitiatives.com**.

Static site, no build step, no accounts. GitHub Pages deploys it on every push
to `main` (`.github/workflows/static.yml`). It shares its app shell, script
and components with the other ABLE course sites (business.ableinitiatives.com,
prep.ableinitiatives.com).

## Courses

| Course | Views | Progress key |
|---|---|---|
| **Health Literacy: Taking Charge of Your Health**: trustworthy health information; navigating health care; using medicines safely; food labels and nutrition; sleep, stress and mental health; emergencies | `#hl`, `#hl-lesson-1`…`6`, `#hl-certificate` | `able.health.hl.v1` |

Each course has a dashboard, six lessons (goals, worked example, common
mistake, key idea, key terms, "try it yourself", a five-question quiz where
four right completes the lesson) and its own certificate. Shared views: **All
courses** (`#home`), **Calculators** (`#tools`: nutrition label, bedtime) and
**Glossary** (`#glossary`, built at runtime from every lesson's key terms).

## Files

```
index.html               every view of every course (edit lessons here), and
                         <script id="site-config">: this site's name, colours,
                         logo, domain and courses
assets/css/health.css    the shared course-site stylesheet with ABLE Health's
                         colour tokens (reds from the mark; gold swoosh accent)
assets/js/app.js         router, progress, quizzes, calculators, glossary,
                         certificates; identical on every ABLE course site
assets/js/analytics.js   anonymous GoatCounter visit and event counts
assets/images/           ABLE Health mark, ABLE mark (certificate seal), favicon
CNAME                    health.ableinitiatives.com
```

To add a course, copy an existing course's views in `index.html` (dashboard,
lessons, certificate, sidebar group, catalog tile) with a new id prefix, and
add it to `courses` in the site config.

## Health content rules

This is health education for teenagers, so the rules are strict:

- General education only: no diagnosis, no treatment plans, and **no medicine
  doses or dosing numbers**. Students are pointed to a doctor, pharmacist,
  school nurse, or a parent, guardian or trusted adult.
- Only stable, well-established guidance (for example the FDA's 5%/20% Daily
  Value guide, 8–10 hours of sleep for ages 13–18, F.A.S.T. stroke signs,
  hands-only CPR at about 100–120 compressions a minute, 988, 911 and the
  Poison Help line 1-800-222-1222). Only official resources are named (CDC,
  FDA, MedlinePlus, NIH, 988), plus the American Heart Association and Red
  Cross as places to take a CPR class. No brands or products.
- Mental-health content is supportive, never gives self-harm details, and
  always includes 988 and "talk to a trusted adult".
- Every page footer says it is not medical advice, and gives 911 and 988.
- **A health professional should review any new or changed lesson before it
  goes live.**
## Visitor analytics

Anonymous visitor counts come from [GoatCounter](https://www.goatcounter.com)
(`assets/js/analytics.js`): no cookies, no personal data, nothing that
identifies a visitor, so no cookie banner is needed. One GoatCounter site
(code `siddo`, dashboard at https://siddo.goatcounter.com)
covers every ABLE site: ableinitiatives.com, prep. and business.ableinitiatives.com,
and Strands of Life. Each path is prefixed with its host to keep them apart.
The same `analytics.js` is copied into each repo; keep the copies in step.

Besides page views it records, as events: clicks on email links
(`email/…`) and on links to other sites (`outbound/…`), and in the course apps
`window.ableTrack(...)` calls (quizzes passed or failed, calculators used,
courses completed, certificates made, downloaded or printed; SAT sessions
finished). Visits from localhost are not counted.

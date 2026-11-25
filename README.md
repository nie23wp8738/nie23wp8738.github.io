# DR.WANG Mathematics

A bilingual mathematics question bank at <https://nie23wp8738.github.io/>. The default interface is English. Chinese pages live under `/zh/`; both languages share the same worksheet selections.

- `/past-papers/` — find an exam paper by year and browse its individual questions.
- `/esat/` — open official specimen and practice tests by module, or find separately labelled ENGAA and NSAA precursor papers.
- `/tara/` — practise TARA-style questions, try the official tests and guide examples, or browse related BMAT and TSA papers.
- `/topics/` — find questions across papers by subject area and specific concept.
- `/topics/methods/` — find individual worked solutions by the concepts used in each method. A link ending in `#solutions` opens the answer; `#method-2` also opens the second proof.
- `/problems/` — select and reorder questions and download a worksheet or solution/reference PDF.
- `/about/` — education and teaching experience.

## Development

Use Node.js 24. Run `npm ci`, then install Chromium with `npx playwright install chromium` or set `CHROME_BIN` to an installed Chrome executable. Use `npm run dev` for development or `npm run build` to generate `dist/`. Pushes to the main branch are built and published by the GitHub Pages workflow.

## Question sources

Historical records in `src/data/past-*.json` store paper and question references and topics. Each licensed full-text edition has one record in `src/data/editions/`, linked to the same stable question IDs. Each record provides the English source with LaTeX, figure references, attribution, licence and changes. Full-text questions have localized reader pages under `/questions/` and print in the worksheet. Annotated papers use site-authored outlines and bilingual proofs. Other catalogued questions open an internal record with any verified answer key, scoring notes, topics and optional external sources. Keep IDs stable for students' bookmarks and saved worksheets.

| Exam | Source |
| --- | --- |
| AMC 8, AMC 10, AMC 12 and AIME | [LIVE by Po-Shen Loh](https://live.poshenloh.com/past-contests), which publishes the questions with MAA permission |
| USAMO and USAJMO | [MAA competition names](https://maa.org/maa-invitational-competitions/) and per-paper sources in the catalogue |
| Euclid | [Waterloo CEMC](https://cemc.uwaterloo.ca/resources/past-contests) |
| BMO | [British Mathematical Olympiad archive](https://bmos.ukmt.org.uk/home/bmo.shtml) |
| IMO | [International Mathematical Olympiad](https://www.imo-official.org/problems/) |
| NZMO | [New Zealand Mathematical Olympiad Committee](https://www.mathsolympiad.org.nz/resources/) · [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| ESAT practice | [Pearson VUE](https://www.pearsonvue.com/us/en/uatuk.html) |
| TARA | [UAT-UK preparation materials](https://esat-tmua.ac.uk/tara-preparation-materials/) and [Pearson VUE](https://www.pearsonvue.com/us/en/uatuk.html). The TARA practice page identifies the official samples, guide examples, related BMAT/TSA papers and original questions. |
| STEP | [Cambridge STEP Support Programme](https://step.maths.org/questions) and [OCR](https://www.ocr.org.uk/students/step-mathematics/preparing-for-step/) |
| TMUA | [UAT-UK historical preparation papers](https://esat-tmua.ac.uk/tmua-preparation-materials/) |

Bilingual concept labels are in `src/data/*-concepts.json`. Maintain the original practice questions in `src/data/problems.json` and the original question translations and topic mapping in `src/lib/catalog.js`. Original worksheet text uses English with printable ASCII mathematical notation.

### Updating a full-text paper

Edit the question records in `src/data/editions/<paper-id>.json` and the matching catalogue entry in `src/data/past-*.json`. For a question containing a diagram, place the image under `public/inline-figures/` and give its entry in the edition a same-site URL and English alt text. Use the same stable figure ID for the filename stem and the question's reference.

Run `npm ci` and `npx playwright install chromium` once on an authoring machine. From the repository root, regenerate the affected edition with the exact paper title from its catalogue entry. For example:

```sh
node scripts/typeset-questions.mjs --questions src/data/editions/nzmo2-2025.json \
  --title "2025 NZMO Round 2" --figures public/inline-figures --output public/inline-pdf
npm run build
```

To use an existing Chromium executable, add `--chromium /path/to/chromium`. Commit the edited source, any diagrams, the generated question PDFs and the edition's `.build.json` manifest together. The build checks their digests so the printable worksheet matches the reader. If the typesetting script changes, regenerate every full-text edition.

For a paper with in-site worked solutions, edit its matching file in `src/data/answers/`. It stores the answer, worked methods, topic labels and adaptation credits. Run `node scripts/typeset-solutions.mjs --edition nzmo2-2025` (optionally with `--chromium`) to regenerate its English solution downloads. Include the corresponding PDFs and manifest under `public/solution-pdf/`. The build checks that the solution sheets match the current question and solution text.

### On-site answers and worked commentaries

The verified answer key for each objective paper lives in `src/data/answer-keys.json`. Entries use the catalogue paper ID and printed question number. Keep AIME entries as strings to preserve leading zeroes. Source URLs and scoring notes stay with the key.

A worked commentary in `src/data/commentary/<paper-id>.json` includes an independently written question outline in each language, an answer, and one or more bilingual methods with topic labels. It has a static, localised reader under `/questions/<question-id>/`. Building the site typesets each outline and its solution for worksheet downloads. A generic question record requests only its own paper from `/question-data/`.

### Published question collections

`/coverage.json` counts each historical question once from its actual text, solution and language availability. The same figures appear in “Coverage by exam” on the archive page. Use the existing question ID for any added outline.

The site distributes Waterloo-owned Euclid materials under CC BY-NC 4.0 for free, noncommercial use. Individual question and solution extracts retain attribution, original source and licence. The verified source files and crop coordinates are in `src/data/euclid-published.json`. STEP solutions by Keith McNulty are distributed under CC0. The English and Chinese books, revision and precise question ranges are in `src/data/step-published-solutions.json`. The CC0 dedication covers McNulty’s contribution. Cambridge’s exam text is separate. Independently authored STEP question briefs, final results and method topics can be paired with those worked solutions in `src/data/step-outlines/<paper-id>.json`.

For local builds install Poppler (`pdftocairo`), curl and Chromium. The build verifies the locally cached source books or downloads their pinned versions and creates printable question extracts.

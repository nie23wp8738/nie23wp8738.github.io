# DR.WANG Mathematics

A bilingual mathematics question bank at <https://nie23wp8738.github.io/>. The default interface is English. Chinese pages live under `/zh/`; both languages share the same worksheet selections.

- `/past-papers/` — find an exam paper by year and browse its individual questions.
- `/esat/` — open official specimen and practice tests by module, or find separately labelled ENGAA and NSAA precursor papers.
- `/topics/` — find questions across papers by subject area and specific concept.
- `/problems/` — select and reorder questions and download a worksheet or solution/reference PDF.
- `/about/` — education and teaching experience.

## Development

Use Node.js 24. Run `npm ci` and `npm run dev` for development or `npm run build` to generate `dist/`. Pushes to the main branch are built and published by the GitHub Pages workflow.

## Question sources

Historical records in `src/data/past-*.json` store the paper, year, source URL and question links and topics. Original statements stay at the linked source. Worksheets include clickable source references for past questions and full text for original practice. Within each file, keep existing paper IDs and question numbers stable because students can bookmark them or save them to worksheets.

| Exam | Source |
| --- | --- |
| AMC 8, AMC 10, AMC 12 and AIME | [LIVE by Po-Shen Loh](https://live.poshenloh.com/past-contests), which publishes the questions with MAA permission |
| USAMO and USAJMO | [MAA competition names](https://maa.org/maa-invitational-competitions/) and per-paper sources in the catalogue |
| Euclid | [Waterloo CEMC](https://cemc.uwaterloo.ca/resources/past-contests) |
| BMO | [British Mathematical Olympiad archive](https://bmos.ukmt.org.uk/home/bmo.shtml) |
| IMO | [International Mathematical Olympiad](https://www.imo-official.org/problems/) |
| ESAT practice | [Pearson VUE](https://www.pearsonvue.com/us/en/uatuk.html) |
| STEP | [Cambridge STEP Support Programme](https://step.maths.org/questions) and [OCR](https://www.ocr.org.uk/students/step-mathematics/preparing-for-step/) |
| TMUA | [UAT-UK historical preparation papers](https://esat-tmua.ac.uk/tmua-preparation-materials/) |

Bilingual concept labels are in `src/data/*-concepts.json`. Maintain the original practice questions in `src/data/problems.json` and the original question translations and topic mapping in `src/lib/catalog.js`. Original worksheet text uses English with printable ASCII mathematical notation.

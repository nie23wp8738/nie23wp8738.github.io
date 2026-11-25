"""Rebuild AMC and AIME question references from the public LIVE by Po-Shen Loh archive.

Indexes edition names, individual source links, and the publisher's concept tags.
No question text, solutions, diagrams, hints, or answer keys are copied.
Requires Python 3 and lxml. Run from any directory.
"""
import argparse
import json
import re
import time
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.parse import urljoin
from urllib.request import Request, urlopen

from lxml import html

BASE = "https://live.poshenloh.com"
OUTPUT = Path(__file__).resolve().parents[1] / "src/data/past-amc.json"
SOURCE = "LIVE by Po-Shen Loh"
CONTEST_NAMES = {"amc10": "AMC 10", "aime": "AIME", "amc8": "AMC 8", "amc12": "AMC 12"}
FAMILIES = {
    "arithmetic": "arithmetic", "algebra": "algebra", "number theory": "number-theory",
    "geometry": "geometry", "combinatorics": "counting", "logic": "logic",
    "problem-solving techniques": "problem-solving", "probability and statistics": "probability",
}
STATISTICS = {"mean", "median (data)", "mode", "range", "weighted mean", "harmonic mean", "data and graph interpretation"}


def get_page(path):
    for attempt in range(3):
        try:
            req = Request(urljoin(BASE, path), headers={"User-Agent": "DrWangMathArchive/1.0 (educational link index)"})
            with urlopen(req, timeout=45) as result:
                return html.fromstring(result.read().decode("utf-8"))
        except (ConnectionError, TimeoutError, OSError):
            if attempt == 2:
                raise
            time.sleep(2 ** attempt)


def props(doc):
    return json.loads(doc.get_element_by_id("__NEXT_DATA__").text)["props"]["pageProps"]


def concept_families():
    doc = get_page("/zh/past-contests/concepts")
    groups = props(doc)["groups"]
    definitions = {c["slug"]: (c["name"], "statistics" if c["name"] in STATISTICS else FAMILIES[g["subject"]])
                   for g in groups for c in g["concepts"]}
    translations = {}
    for a in doc.xpath('//a[starts-with(@href, "/zh/past-contests/concepts/")]'):
        slug = a.get("href").rsplit("/", 1)[-1]
        if slug in definitions:
            label = "".join(a.xpath('.//text()[not(ancestor::style)]')).strip()
            chinese = re.sub(r"\d+$", "", label).strip()
            if chinese:
                translations[definitions[slug][0]] = chinese
    return definitions, translations


def editions(contest):
    doc = get_page("/past-contests/" + contest)
    anchors = {a.get("href"): a.text_content().strip() for a in doc.xpath("//a[@href]")}
    for path, label in anchors.items():
        if not re.fullmatch(r"/past-contests/" + contest + r"/\d{4}[A-Za-z]*", path):
            continue
        if path + "/solutions" not in anchors:
            # The index also advertises a future, unreleased edition.
            continue
        assert label.endswith(" Problems")
        yield contest, path, label.removesuffix(" Problems"), path + "/solutions"


def read_paper(entry, concept_map):
    contest, path, label, solutions = entry
    doc = get_page(path)
    p = props(doc)
    edition = path.rsplit("/", 1)[-1]
    assert p["contest"] == contest and str(p["year"]) == edition and not p["pending"], path
    anchors = {a.get("href") for a in doc.xpath("//a[@href]")}
    questions = []
    blocks = doc.xpath('//div[contains(@class, "examQuestionContainer")]')
    for block in blocks:
        number = int(block.findtext("p").strip().strip("."))
        qpath = path + "/problem/" + str(number)
        assert qpath in anchors, qpath
        item = {"n": number, "url": urljoin(BASE, qpath)}
        slugs = list(dict.fromkeys(a.get("href").rsplit("/", 1)[-1] for a in
                                  block.xpath('.//a[starts-with(@href, "/past-contests/concepts/")]')))
        assert all(slug in concept_map for slug in slugs), (qpath, slugs)
        tags = [concept_map[slug][0] for slug in slugs]
        categories = [concept_map[slug][1] for slug in slugs]
        if categories:
            # Pick the most frequently tagged content area. On ties preserve source order.
            content = [c for c in categories if c != "problem-solving"] or categories
            item["topic"] = Counter(content).most_common(1)[0][0]
        if tags:
            secondary = [c for c in categories if c != item["topic"]]
            item["tags"] = list(dict.fromkeys(tags + secondary))
        questions.append(item)
    questions.sort(key=lambda q: q["n"])
    year = int(edition[:4])
    if contest == "amc12" and year < 2000:
        expected = len(p["baseQuestions"])
        assert expected in {30, 35, 40, 50}, path
        label = (f"{year} MAA Mathematical Contest (AMC 12 series)" if year < 1959
                 else f"{year} AHSME (AMC 12 series)")
    else:
        expected = 15 if contest == "aime" else 25
        if contest == "amc8" and year < 1999:
            label = f"{year} AJHSME (AMC 8 series)"
    assert [q["n"] for q in questions] == list(range(1, expected + 1)), path
    return {"id": contest + "-" + edition.lower(), "exam": CONTEST_NAMES[contest],
            "year": int(edition[:4]), "label": label, "source": SOURCE, "url": urljoin(BASE, path),
            "solutionsUrl": urljoin(BASE, solutions), "questions": questions}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("contests", nargs="*", metavar="CONTEST", help="Refresh selected series: " + ", ".join(CONTEST_NAMES))
    args = parser.parse_args()
    requested = args.contests or list(CONTEST_NAMES)
    if set(requested) - CONTEST_NAMES.keys():
        parser.error("Unsupported series")
    topics, translations = concept_families()
    entries = []
    for contest in requested:
        series = list(editions(contest))
        if not series:
            raise ValueError(f"No released editions found for {contest}; check the source before updating.")
        entries.extend(series)
    with ThreadPoolExecutor(max_workers=7) as pool:
        papers = list(pool.map(lambda e: read_paper(e, topics), entries))
    assert len({p["id"] for p in papers}) == len(papers)
    # AMC 10/AIME share the original stable file. The two larger historical series have
    # separate files so an individual refresh does not rewrite unrelated catalogues.
    groups = ((OUTPUT, {"AMC 10", "AIME"}),
              (OUTPUT.with_name("past-amc8.json"), {"AMC 8"}),
              (OUTPUT.with_name("past-amc12.json"), {"AMC 12"}))
    refreshed = {CONTEST_NAMES[c] for c in requested}
    fine_tags = set()
    for target, exams in groups:
        current = json.loads(target.read_text(encoding="utf-8")) if target.exists() else []
        if refreshed & exams:
            current = [paper for paper in current if paper["exam"] not in refreshed]
            current.extend(paper for paper in papers if paper["exam"] in exams)
            encoded = json.dumps(current, ensure_ascii=False, separators=(",", ":"))
            target.write_text(encoded + "\n", encoding="utf-8")
        fine_tags.update(tag for paper in current for question in paper["questions"]
                         for tag in question.get("tags", []) if tag in translations)
    translated = {tag: translations[tag] for tag in sorted(fine_tags)}
    OUTPUT.with_name("amc-concepts.json").write_text(
        json.dumps(translated, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f'Indexed {len(papers)} papers and {sum(len(p["questions"]) for p in papers)} problem references.')


if __name__ == "__main__":
    main()

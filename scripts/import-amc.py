"""Rebuild AMC 10/AIME question references from the public LIVE by Po-Shen Loh archive.

Indexes edition names, individual source links, and the publisher's concept tags.
No question text, solutions, diagrams, hints, or answer keys are copied.
Requires Python 3 and lxml. Run from any directory.
"""
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
        assert label.endswith(" Problems") and path + "/solutions" in anchors
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
    expected = 25 if contest == "amc10" else 15
    assert [q["n"] for q in questions] == list(range(1, expected + 1)), path
    return {"id": contest + "-" + edition.lower(), "exam": "AMC 10" if contest == "amc10" else "AIME",
            "year": int(edition[:4]), "label": label, "source": SOURCE, "url": urljoin(BASE, path),
            "solutionsUrl": urljoin(BASE, solutions), "questions": questions}


def main():
    topics, translations = concept_families()
    entries = [entry for contest in ("amc10", "aime") for entry in editions(contest)]
    with ThreadPoolExecutor(max_workers=7) as pool:
        papers = list(pool.map(lambda e: read_paper(e, topics), entries))
    assert len({p["id"] for p in papers}) == len(papers)
    translated = {tag: translations[tag] for tag in sorted({tag for paper in papers for q in paper["questions"]
                                                         for tag in q.get("tags", []) if tag in translations})}
    OUTPUT.with_name("amc-concepts.json").write_text(json.dumps(translated, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    output = json.dumps(papers, ensure_ascii=False, separators=(",", ":"))
    OUTPUT.write_text(output + "\n", encoding="utf-8")
    print(f'Indexed {len(papers)} papers and {sum(len(p["questions"]) for p in papers)} problem references.')


if __name__ == "__main__":
    main()

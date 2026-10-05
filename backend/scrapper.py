from playwright.sync_api import sync_playwright
from bs4 import BeautifulSoup
import math
import re


PORTAL_URL = "https://jssateb.azurewebsites.net/RApps/Home/login.aspx?E=1"


class LoginError(Exception):
    pass


def parse_period(td):
    marker = td.find("div", style=re.compile(r"cursor\s*:\s*pointer"))
    if marker is None:
        return None
    rows = marker.find_all("div", class_="row")
    if len(rows) < 4:  # need course(0), faculty(1), type(3); status may not exist yet
        return None

    b = rows[0].find("b")
    if b is None:
        return None
    course = "".join(str(c) for c in b.contents if getattr(c, "name", None) != "sup")

    def text(i):
        return rows[i].get_text(strip=True)

    return {
        "course": course,
        "faculty": text(1),
        "type": text(3),
        "status": text(5) if len(rows) > 5 else "",
    }


def build_table(table):
    headers = [th.get_text(strip=True) for th in table.find("thead").find_all("th")[1:]]
    days = []

    for tr in table.find("tbody").find_all("tr"):
        day_cell = tr.find("td", class_="bg-primary")
        if day_cell is None:
            continue

        # 1. day label → name + date  (its own text-parsing job)
        day_text = day_cell.get_text(strip=True)  # "Monday21-09-26"
        day = "".join(filter(str.isalpha, day_text))  # "Monday"
        date = day_text[len(day) :].strip()  # "21-09-26"

        # 2. the 8 period cells → parse_period each
        periods = [parse_period(td) for td in tr.find_all("td", recursive=False)[1:]]

        days.append({"day": day, "date": date, "periods": periods})
    return {"headers": headers, "days": days}


def scrapper(usn: str, password: str):
    with sync_playwright() as pw:
        browser = pw.chromium.launch()

        try:
            page = browser.new_page()
            page.goto(PORTAL_URL, wait_until="domcontentloaded", timeout=8000)
            page.wait_for_selector("#optLoginAsStudent", timeout=15000)
            page.check("#optLoginAsStudent")
            page.fill("#txtUserID", usn, timeout=5000)
            page.fill("#txtPassword", password, timeout=5000)
            # NOTE: the page now has TWO elements with id="myBtn" — the first one
            # belongs to the hidden PIN form (#Form_LWP). Target the visible
            # password form's button, which calls submitForm_CG().
            page.click("#Form_LWPass #myBtn")
            # Login settles in one of two ways: the validation modal gets an
            # error message (bad credentials), or the home page loads (success).
            # Poll for either instead of guessing with a fixed sleep(3).
            try:
                page.wait_for_function(
                    """() => {
                        const m = document.querySelector('#MyModelValidation_Msg');
                        if (m && m.innerText.trim()) return true;
                        return [...document.querySelectorAll('.card')].some(
                            (c) => c.textContent.includes('Student Attendance')
                        );
                    }""",
                    timeout=15000,
                )
            except Exception:
                pass  # navigation destroyed the context or it timed out —
                # the checks below decide what actually happened

            # Check for login error (instant check, no timeout needed)
            # Old portal: #divModelValidation_alertmsg — new portal shows failures
            # in a validation modal whose body starts out empty.
            error_box = page.query_selector("#MyModelValidation_Msg")
            if error_box:
                msg = error_box.inner_text().strip().lower()
                if "incorrect user id" in msg or "password" in msg or "invalid" in msg:
                    raise LoginError("Invalid credentials")

            page.wait_for_selector("text=Student Attendance", timeout=15000)
            page.click("text=Student Attendance")

            try:
                page.wait_for_selector("table.table", timeout=15000)
            except Exception:
                return {
                    "status": "portal down",
                    "error": "Table time out",
                }

            soup = BeautifulSoup(page.content(), "lxml")
            table = soup.find("table", {"class": "table"})
            if table is None:
                return {"status": "portal down", "error": "No table found"}

            timetable = build_table(table)

            # Derive the absent list from the timetable we just parsed
            # (one parser, one source of truth)
            absent_periods = [
                {
                    "day": day["day"],
                    "date": day["date"],
                    "course": p["course"],
                    "attendance": "Absent",
                }
                for day in timetable["days"]
                for p in day["periods"]
                if p and "absent" in p["status"].lower()
            ]

            page.get_by_role("button", name="Summary").click()
            # Wait for real data, not just the table shell: the Summary view
            # loads via AJAX, so <table> can exist before its rows land.
            page.wait_for_selector("table.fancyTable tbody tr td", timeout=15000)

            soup = BeautifulSoup(page.content(), "lxml")

            # Extract branch and semester from dropdown
            branch = None
            semester = None
            select = soup.find("select", id="cboStudentSessionDetail")
            if select:
                selected = select.find("option", selected=True)
                if selected:
                    details_text = selected.get_text()
                    semester_match = re.search(r"Semester\s+(\d+)", details_text)
                    semester = int(semester_match.group(1)) if semester_match else None
                    branch_match = re.search(r"\[([A-Z]+)-\d+\]", details_text)
                    branch = branch_match.group(1) if branch_match else None

            attendance_table = soup.find("table", class_="fancyTable")
            summary = []

            if attendance_table:
                tbody = attendance_table.find("tbody")
                rows = tbody.find_all("tr") if tbody else []

                for row in rows:
                    cols = [col.text.strip() for col in row.find_all("td")]
                    if len(cols) < 10:
                        continue
                    summary.append(
                        {
                            "no": cols[1],
                            "code": cols[2],
                            "name": cols[3],
                            "classes": cols[7],
                            "present": cols[8],
                            "percentage": cols[9],
                        }
                    )

            total_classes = sum(int(x["classes"]) for x in summary)
            total_present = sum(int(x["present"]) for x in summary)
            total_avg = (
                round((total_present / total_classes) * 100, 2) if total_classes else 0
            )

            if total_avg >= 85:
                can_miss85 = math.floor((total_present - 0.85 * total_classes) / 0.85)
                need_to_attend85 = 0
            else:
                need_to_attend85 = math.ceil(
                    ((0.85 * total_classes) - total_present) / 0.15
                )
                can_miss85 = 0

            if total_avg >= 75:
                can_miss75 = math.floor((total_present - 0.75 * total_classes) / 0.75)
                need_to_attend75 = 0
            else:
                need_to_attend75 = math.ceil(
                    ((0.75 * total_classes) - total_present) / 0.25
                )
                can_miss75 = 0

        finally:
            browser.close()
    return {
        "status": "success",
        "summary": summary,
        "absent_periods": absent_periods,
        "timetable": timetable,
        "total_avg": total_avg,
        "can_miss85": can_miss85,
        "can_miss75": can_miss75,
        "need_to_attend85": need_to_attend85,
        "need_to_attend75": need_to_attend75,
        "branch": branch,
        "sem": semester,
    }


if __name__ == "__main__":
    soup = BeautifulSoup(open("sample.html").read(), "lxml")
    tt = build_table(
        BeautifulSoup(open("sample.html").read(), "lxml").find(
            "table", {"class": "table"}
        )
    )
    for i, p in enumerate(tt["days"][0]["periods"]):
        print(i, tt["headers"][i], "->", p)
    assert len(tt["headers"]) == 8
    assert len(tt["days"]) == 6
    assert all(len(d["periods"]) == 8 for d in tt["days"])
    assert tt["days"][0]["day"] == "Monday" and tt["days"][0]["date"] == "21-09-26"
    assert tt["days"][0]["periods"][0]["course"] == "BCS502"
    assert tt["days"][0]["periods"][0]["status"] == "Absent"
    assert tt["days"][0]["periods"][4] is None  # B1 lunch break — always empty
    print("ok", tt["headers"])

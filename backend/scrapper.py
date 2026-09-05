from playwright.sync_api import sync_playwright
from bs4 import BeautifulSoup
import math, time
from datetime import datetime, timezone
import re


PORTAL_URL = "https://jssateb.azurewebsites.net/Apps/Login.aspx"


class LoginError(Exception):
    pass


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
            try:
                with page.expect_navigation(wait_until="networkidle", timeout=15000):
                    page.click("#myBtn")
            except TimeoutError:
                return {"status": "portal down", "error": "Login page time out"}

            try:
                error_box = page.query_selector("#divModelValidation_alertmsg")
                if error_box:
                    msg = error_box.inner_text().strip().lower()
                    if "incorrect user id" in msg or "password" in msg:
                        raise LoginError("Invalid credentials")
            except TimeoutError:
                pass  # login worked

            page.click("text=Student Attendance")

            try:
                page.wait_for_selector("table.table", timeout=15000)
            except TimeoutError:
                return {
                    "status": "portal down",
                    "error": "Table time out",
                }

            soup = BeautifulSoup(page.content(), "lxml")
            table = soup.find("table", {"class": "table"})

            absent_periods = []

            if table:
                table_rows = table.find_all("tr")[1:]
                for row in table_rows:
                    day_cell = row.find("td", class_="bg-primary")
                    if not day_cell:
                        continue

                    day_text = day_cell.get_text(strip=True)
                    day_name = "".join(filter(str.isalpha, day_text))
                    day_date = day_text[len(day_name) :].strip()

                    for cell in row.find_all("td")[1:]:
                        for period_info in cell.find_all(
                            "div", style="cursor:pointer;", recursive=False
                        ):
                            info_divs = period_info.find_all("div", class_="row")

                            if len(info_divs) < 6:
                                continue

                            info_list = [div.get_text(strip=True) for div in info_divs]
                            if any("absent" in x.lower() for x in info_list):
                                absent_periods.append(
                                    {
                                        "day": day_name,
                                        "date": day_date,
                                        "course": info_list[0]
                                        if info_list
                                        else "Unknown",
                                        "attendance": "Absent",
                                    }
                                )

            with page.expect_navigation(wait_until="networkidle", timeout=15000):
                page.get_by_role("button", name="Summary").click()

            page.wait_for_selector("table.fancyTable", timeout=15000)
            time.sleep(1)

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

            page.screenshot(path="debug.png")

        finally:
            browser.close()
    return {
        "status": "success",
        "summary": summary,
        "absent_periods": absent_periods,
        "total_avg": total_avg,
        "can_miss85": can_miss85,
        "can_miss75": can_miss75,
        "need_to_attend85": need_to_attend85,
        "need_to_attend75": need_to_attend75,
        "branch": branch,
        "sem": semester,
        "last_updated": datetime.now(timezone.utc).isoformat(),
    }


if __name__ == "__main__":
    pass

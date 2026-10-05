"""Attendance scraper: logs into the JSSATEB portal and returns structured data.

The portal is ordinary ASP.NET WebForms — every step ends in a plain
`form.submit()` or a plain URL fetch — so this module replays those requests
with `httpx` instead of driving a browser. A scrape costs ~9 MB and ~1s.

The four requests:

  1. GET  /RApps/Home/login.aspx?E=1
        -> __VIEWSTATE, txtHPUBRSI (RSA public key), txtHLoginKey
  2. GET  /RApps/Home/HSData.aspx?FORM=LOGIN&FORWHAT=CHECKCOLLEGE&...
        -> "SUCCESS<cKey>" | "FAILED<message>" | "SHOWC<college list>"
        This is the AJAX pre-check submitForm_CG() fires when #divCKey is
        present-but-hidden (it is). USN goes plaintext, password RSA'd.
  3. POST /RApps/Home/login.aspx?E=1
        -> the real login; txtUserID is RSA'd and txtHCKey carries the cKey
           from step 2 (submitForm_CG:119 + submitForm:210/238)
  4. GET  /apps/TimeTable/StudentAttendance.aspx?WAT=1033   (the timetable)
        POST /apps/TimeTable/StudentAttendanceSummary.aspx  (the summary)

Note on the path in step 4: the home page cards call
`TakeAction_Menu('../../apps/...')` from /RApps/Home/Home.aspx, and the browser
resolves that TWO levels up — to the site ROOT, i.e. /apps/..., not
/RApps/apps/...  Asking for the latter returns GenericErrorPage.aspx.

`scrapper()` returns the exact dict shape the API has always returned, so the
routes and the DB write path are unchanged.
"""

import base64
import math
import re
from pathlib import Path

import httpx
from bs4 import BeautifulSoup
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import padding

PORTAL_URL = "https://jssateb.azurewebsites.net/RApps/Home/login.aspx?E=1"
BASE = "https://jssateb.azurewebsites.net"
_HSDATA_URL = f"{BASE}/RApps/Home/HSData.aspx"
_ATTENDANCE_URL = f"{BASE}/apps/TimeTable/StudentAttendance.aspx?WAT=1033"
_SUMMARY_URL = f"{BASE}/apps/TimeTable/StudentAttendanceSummary.aspx"

# A believable desktop UA — the portal is indifferent, but a python-requests
# signature is the kind of thing a WAF notices.
_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    )
}
_TIMEOUT = 20.0
_STUDENT_LOGIN_AS = "3"  # value of the #optLoginAsStudent radio


class LoginError(Exception):
    pass


class PortalError(Exception):
    """The portal answered, but not in a way we understand."""


# ---------------------------------------------------------------------------
# Parsing — shared by every caller, independent of how the HTML arrived
# ---------------------------------------------------------------------------


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


def derive_absent_periods(timetable):
    """Derive the absent list from a timetable we just parsed.

    (one parser, one source of truth)
    """
    return [
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


def parse_summary(soup):
    """Pull (summary rows, branch, semester) out of the AttendanceSummary page."""
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
    return summary, branch, semester


def compute_metrics(summary):
    """Totals + the 75%/85% can-miss / need-to-attend arithmetic."""
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

    return {
        "total_avg": total_avg,
        "can_miss85": can_miss85,
        "can_miss75": can_miss75,
        "need_to_attend85": need_to_attend85,
        "need_to_attend75": need_to_attend75,
    }


# ---------------------------------------------------------------------------
# HTTP plumbing
# ---------------------------------------------------------------------------


def _rsa(text: str, pem: str) -> str:
    """JSEncrypt-compatible RSA: PKCS#1 v1.5, base64 output.

    Matches encrypt_RSI() in login.html, which calls JSEncrypt.encrypt().
    """
    key = serialization.load_pem_public_key(pem.encode())
    return base64.b64encode(key.encrypt(text.encode(), padding.PKCS1v15())).decode()


def _form_fields(soup: BeautifulSoup) -> dict:
    """Every named, non-radio input on the page, values as rendered."""
    fields = {}
    for tag in soup.find_all("input"):
        name = tag.get("name")
        if name and tag.get("type") != "radio":  # radios submit only the checked one
            fields[name] = tag.get("value") or ""
    return fields


def _validate(soup: BeautifulSoup) -> str:
    """The portal's validation-modal text, or "" if it has none."""
    box = soup.find(id="MyModelValidation_Msg")
    return box.get_text(strip=True) if box else ""


def scrapper(usn: str, password: str):
    """Fetch attendance from the portal. Returns the API's attendance dict.

    Raises LoginError for bad credentials (routes turn that into 401).
    Transport failures and unrecognised portal replies come back as
    {"status": "portal down", ...} (routes turn that into 502).
    """
    try:
        with httpx.Client(
            follow_redirects=True, timeout=_TIMEOUT, headers=_HEADERS
        ) as client:
            return _scrape(client, usn, password)
    except httpx.HTTPError as exc:
        # Transport-level failure (DNS, timeout, connection reset).
        return {"status": "portal down", "error": type(exc).__name__}
    except PortalError as exc:
        return {"status": "portal down", "error": str(exc)}


def _scrape(client: httpx.Client, usn: str, password: str) -> dict:
    # ---- 1. fetch the login form ---------------------------------------
    page = client.get(PORTAL_URL)
    page.raise_for_status()
    soup = BeautifulSoup(page.text, "lxml")

    pubkey = soup.find(id="txtHPUBRSI")
    login_key = soup.find(id="txtHLoginKey")
    if pubkey is None or login_key is None:
        raise PortalError("login form changed: no txtHPUBRSI/txtHLoginKey")
    pem = pubkey["value"]

    # ---- 2. the CHECKCOLLEGE pre-check (submitForm_CG) ------------------
    # Note USERID is plaintext here: submitForm_CG reads #txtUserID at line 108,
    # BEFORE submitForm() RSA-encrypts it at line 210.
    check = client.get(
        _HSDATA_URL,
        params={
            "FORM": "LOGIN",
            "FORWHAT": "CHECKCOLLEGE",
            "USERID": usn,
            "PWD": _rsa(password, pem),
            "LKEY": login_key["value"],
            "PWD2": _rsa(password, pem),
            "LOGINAS": _STUDENT_LOGIN_AS,
        },
        headers={"Referer": PORTAL_URL},
    )
    check.raise_for_status()
    answer = check.text
    if answer.startswith("FAILED"):
        # e.g. "FAILEDIncorrect User ID / Password."
        detail = answer[len("FAILED"):].strip() or "Login failed"
        if "password" in detail.lower() or "user id" in detail.lower():
            raise LoginError(detail)
        raise PortalError(detail)
    if answer.startswith("SHOWC"):
        # Portal wants a college picked first — a flow this client doesn't model.
        raise PortalError("portal requested college selection (SHOWC)")
    if not answer.startswith("SUCCESS"):
        raise PortalError(f"unexpected pre-check reply: {answer[:60]!r}")
    ckey = answer[len("SUCCESS"):]

    # ---- 3. the real login POST (submitForm) ----------------------------
    fields = _form_fields(soup)
    fields.update(
        {
            "txtUserID": _rsa(usn, pem),  # submitForm():210
            "txtPassword": _rsa(password, pem),  # already set by submitForm_CG:119
            "optLoginAs": _STUDENT_LOGIN_AS,
            "txtHCKey": ckey,  # replaced by the SUCCESS payload
            "txtHMode": "",
            "txtHMode1": "aa",  # submitForm():238
            "txtHAction": "LO",  # submitForm():208
        }
    )
    home = client.post(PORTAL_URL, data=fields, headers={"Referer": PORTAL_URL})
    home.raise_for_status()
    home_soup = BeautifulSoup(home.text, "lxml")

    if "Student Attendance" not in home.text:
        msg = _validate(home_soup)
        if msg:
            low = msg.lower()
            if "incorrect" in low or "password" in low or "invalid" in low:
                raise LoginError("Invalid credentials")
        raise PortalError(f"login did not reach the home page: {msg!r}")

    # ---- 4a. the timetable ----------------------------------------------
    attendance = client.get(
        _ATTENDANCE_URL, headers={"Referer": f"{BASE}/RApps/Home/Home.aspx"}
    )
    attendance.raise_for_status()
    attendance_soup = BeautifulSoup(attendance.text, "lxml")

    table = attendance_soup.find("table", {"class": "table"})
    if table is None:
        return {"status": "portal down", "error": "No table found"}

    timetable = build_table(table)
    absent_periods = derive_absent_periods(timetable)

    # ---- 4b. the summary -------------------------------------------------
    # The Summary button does postwith(...StudentAttendanceSummary.aspx,
    # {ENTRYFOR: <id>}) — an opaque token embedded in the button's onclick.
    match = None
    for btn in attendance_soup.find_all("button", onclick=True):
        match = re.search(r"ShowForm_AttendanceSummary\('([^']+)'", btn["onclick"])
        if match:
            break
    if match is None:
        match = re.search(r"ShowForm_AttendanceSummary\('([^']+)'", attendance.text)
    if match is None:
        return {"status": "portal down", "error": "Summary button not found"}
    entryfor = match.group(1)

    summary_page = client.post(
        _SUMMARY_URL, data={"ENTRYFOR": entryfor}, headers={"Referer": _ATTENDANCE_URL}
    )
    summary_page.raise_for_status()
    summary, branch, semester = parse_summary(
        BeautifulSoup(summary_page.text, "lxml")
    )

    if not summary:
        return {"status": "portal down", "error": "Empty summary"}

    return {
        "status": "success",
        "summary": summary,
        "absent_periods": absent_periods,
        "timetable": timetable,
        **compute_metrics(summary),
        "branch": branch,
        "sem": semester,
    }


# ---------------------------------------------------------------------------
# CLI: self-test against the saved sample, or a live scrape
# ---------------------------------------------------------------------------


def selftest() -> None:
    """Parse the saved sample.html and assert the known-good shape."""
    sample = Path(__file__).with_name("sample.html")
    soup = BeautifulSoup(sample.read_text(), "lxml")
    tt = build_table(soup.find("table", {"class": "table"}))
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


if __name__ == "__main__":
    import json
    import os
    import sys
    import time

    if "--selftest" in sys.argv:
        selftest()
        sys.exit(0)

    # creds come from argv, then the environment — never hard-coded
    arg_usn = sys.argv[1] if len(sys.argv) > 1 else os.environ.get("PORTAL_USN")
    arg_pw = sys.argv[2] if len(sys.argv) > 2 else os.environ.get("PORTAL_PASSWORD")
    if not (arg_usn and arg_pw):
        sys.exit("usage: python portal_client.py <usn> <password>   (or --selftest)")

    started = time.perf_counter()
    data = scrapper(arg_usn, arg_pw)
    elapsed = time.perf_counter() - started

    if data.get("status") != "success":
        print(f"[{elapsed:.2f}s] FAILED: {json.dumps(data, indent=2)}")
        sys.exit(1)

    print(f"[{elapsed:.2f}s] ok  branch={data['branch']} sem={data['sem']} "
          f"avg={data['total_avg']}%  days={len(data['timetable']['days'])} "
          f"absent={len(data['absent_periods'])} subjects={len(data['summary'])}")
    print(f"  can_miss85={data['can_miss85']} need85={data['need_to_attend85']} "
          f"can_miss75={data['can_miss75']} need75={data['need_to_attend75']}")

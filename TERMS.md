# Terms & Conditions — Attendance Tracker

**Last updated:** September 2026

## 1. Service Description

This is a student-built tool that fetches your attendance data from the JSSATEB student portal and displays it in a simplified format. It is not affiliated with, endorsed by, or representing JSS Academy of Technical Education in any official capacity.

## 2. Credentials & Security

- Your college portal password is sent to the backend for login and attendance refreshes. The backend uses it to authenticate with the portal without saving it to a database or file.
- The app keeps the password only in page memory, not browser storage. Reloading, closing the tab, or logging out clears it. After reloading, refreshing attendance requires another login.
- I do not have access to any other college systems, emails, or internal services.

## 3. Data Collected

- I store only: your USN, alias, attendance summary (subjects, classes, percentages), branch, semester, and leaderboard preference.
- No personal information beyond what the college portal itself displays is collected or retained.

## 4. Open Source & Transparency

- This project is fully open-sourced. The entire codebase — backend, scraper logic, database models, and frontend — is publicly available on GitHub.
- The application is deployed directly from the public repository. Any changes to the code are immediately visible and auditable.
- [View Source Code](https://github.com/sr1k7nth/AttendanceTracker-jssateb)

## 5. Rate Limiting

- Each user is limited to **4 data refreshes per day** to minimize unnecessary load on the college portal.
- Data is cached for **2 hours** between refreshes to further reduce scraping frequency.

## 6. No Guarantee of Accuracy

- Data is scraped from the college portal in real time. Display errors, missing subjects, or delayed updates may occur.
- This tool is for **informational purposes only**. Always verify attendance numbers on the official college portal for any academic decisions.

## 7. Account & Data Removal

- Contact me via the [feedback form](https://forms.gle/RW7jREYrceoacjxY9) to request complete deletion of your stored data at any time.

## 8. Not a Substitute for Official Records

- This tool does not modify, interfere with, or interact with any college academic records, internal databases, or administrative systems.
- Attendance data shown here is read-only and has no effect on official records.

## 9. No Misuse

- This tool must not be used to automate bulk scraping, distribute data to third parties, or circumvent any college systems.
- Detailed attendance records are accessible only to their owner. Opting into the leaderboard shares your alias, attendance percentage, branch, rank, and last update time with other opted-in users in your semester.

## 10. Changes to Terms

- I reserve the right to update these terms. Continued use after changes constitutes acceptance.

## 11. Contact & Feedback

- Bugs, concerns, or feature requests: [Feedback Form](https://forms.gle/RW7jREYrceoacjxY9)
- For data removal requests, mention "data deletion" in the feedback form.

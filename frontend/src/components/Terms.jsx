export default function Terms({ onBack }) {
  return (
    <div className="terms-page">
      <h2>Terms & Conditions</h2>

      <div className="terms-content">
        <h3>1. Service Description</h3>
        <p>
          This is a student-built tool that fetches your attendance data from the JSSATEB student
          portal and displays it in a simplified format. It is not affiliated with, endorsed by, or
          representing JSS Academy of Technical Education in any official capacity.
        </p>

        <h3>2. Credentials & Security</h3>
        <ul>
          <li>Your college portal password is used <strong>once</strong> per session to authenticate
            with the portal and is <strong>never stored</strong> on any server or database.</li>
          <li>The password exists only in your browser's session memory and is discarded immediately
            when you close the tab or log out.</li>
          <li>I do not have access to any other college systems, emails, or internal services.</li>
        </ul>

        <h3>3. Data Collected</h3>
        <ul>
          <li>I store only: your USN, attendance summary (subjects, classes, percentages), branch,
            semester, and leaderboard preference.</li>
          <li>No personal information beyond what the college portal itself displays is collected
            or retained.</li>
        </ul>

        <h3>4. Open Source & Transparency</h3>
        <ul>
          <li>This project is fully open-sourced. The entire codebase — backend, scraper logic,
            database models, and frontend — is publicly available on GitHub.</li>
          <li>The application is deployed directly from the public repository. Any changes to the
            code are immediately visible and auditable.</li>
          <li>
            <a href="https://github.com/sr1k7nth/AttendanceTracker-jssateb" target="_blank" rel="noopener noreferrer">
              View Source Code
            </a>
          </li>
        </ul>

        <h3>5. Rate Limiting</h3>
        <ul>
          <li>Each user is limited to <strong>4 data refreshes per day</strong> to minimize unnecessary
            load on the college portal.</li>
          <li>Data is cached for <strong>2 hours</strong> between refreshes to further reduce scraping
            frequency.</li>
        </ul>

        <h3>6. No Guarantee of Accuracy</h3>
        <ul>
          <li>Data is scraped from the college portal in real time. Display errors, missing subjects,
            or delayed updates may occur.</li>
          <li>This tool is for <strong>informational purposes only</strong>. Always verify attendance
            numbers on the official college portal for any academic decisions.</li>
        </ul>

        <h3>7. Account & Data Removal</h3>
        <ul>
          <li>Contact me via the feedback form to request complete deletion of your stored data
            at any time.</li>
        </ul>

        <h3>8. Not a Substitute for Official Records</h3>
        <ul>
          <li>This tool does not modify, interfere with, or interact with any college academic records,
            internal databases, or administrative systems.</li>
          <li>Attendance data shown here is read-only and has no effect on official records.</li>
        </ul>

        <h3>9. No Misuse</h3>
        <ul>
          <li>This tool must not be used to automate bulk scraping, distribute data to third parties,
            or circumvent any college systems.</li>
          <li>Each user accesses only their own attendance data.</li>
        </ul>

        <h3>10. Changes to Terms</h3>
        <ul>
          <li>I reserve the right to update these terms. Continued use after changes constitutes
            acceptance.</li>
        </ul>

        <h3>11. Contact & Feedback</h3>
        <ul>
          <li>
            Bugs, concerns, or feature requests:{' '}
            <a href="https://forms.gle/RW7jREYrceoacjxY9" target="_blank" rel="noopener noreferrer">
              Feedback Form
            </a>
          </li>
          <li>For data removal requests, mention "data deletion" in the feedback form.</li>
        </ul>
      </div>

      <button className="faq-back" onClick={onBack}>
        Back
      </button>
    </div>
  );
}

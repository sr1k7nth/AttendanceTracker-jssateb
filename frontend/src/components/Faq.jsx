const faqItems = [
  {
    q: 'Why does login take a moment?',
    a: 'The server replays the college portal’s own login and attendance requests over HTTP — no browser involved — and parses the result. That usually takes a second or two; when the portal itself is slow, so are we.',
  },
  {
    q: 'Is my password stored?',
    a: 'No. It is sent once when you log in and never saved — not in browser storage, a database, or a file. Because nothing is kept, getting updated attendance means logging in again.',
  },
  {
    q: 'What is Summary?',
    a: 'Shows your overall attendance percentage, how many classes you can still miss (to stay above 85% and 75%), subject-wise breakdown, and a list of your absent periods.',
  },
  {
    q: 'What does Update do?',
    a: 'Logs you in again so the portal can be re-scraped. Your password is never stored, so this is the only way to fetch newly marked attendance.',
  },
  {
    q: 'What is the Leaderboard?',
    a: 'A ranking of students (from the same semester) who opted in. Sorted by attendance percentage. You can filter by your branch or see all branches.',
  },
  {
    q: 'What does Logout do?',
    a: 'Clears your session and all stored data from the browser. You will need to log in again.',
  },
];

export default function Faq() {
  return (
    <div className="faq-page">
      <h2>Frequently Asked Questions</h2>
      {faqItems.map((item) => (
        <details key={item.q} className="faq-item">
          <summary>{item.q}</summary>
          <p>{item.a}</p>
        </details>
      ))}
    </div>
  );
}

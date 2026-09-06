const faqItems = [
  {
    q: 'Why is login slow?',
    a: 'It launches a headless browser that logs into the college portal, navigates to your attendance page, and scrapes the data. This takes 15-25 seconds because the portal itself is slow.',
  },
  {
    q: 'Is my password stored?',
    a: 'No. Your credentials are used once to scrape the portal and then discarded immediately. They are never saved in any database or file.',
  },
  {
    q: 'What is Summary?',
    a: 'Shows your overall attendance percentage, how many classes you can still miss (to stay above 85% and 75%), subject-wise breakdown, and a list of your absent periods.',
  },
  {
    q: 'What is Refresh?',
    a: 'Re-scrapes the college portal with your credentials to get the latest attendance data. Useful after new attendance has been marked.',
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

export default function Faq({ onBack }) {
  return (
    <div className="faq-page">
      <h2>Frequently Asked Questions</h2>
      {faqItems.map((item) => (
        <details key={item.q} className="faq-item">
          <summary>{item.q}</summary>
          <p>{item.a}</p>
        </details>
      ))}
      <button className="faq-back" onClick={onBack}>
        ← Back
      </button>
    </div>
  );
}

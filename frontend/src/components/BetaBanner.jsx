const FEEDBACK_URL = 'https://forms.gle/RW7jREYrceoacjxY9';

export default function BetaBanner() {
  return (
    <div className="beta-banner">
      <span className="beta-badge">BETA</span>
      <span className="beta-text">
        This app is in beta. Found a bug or have a feature request?{' '}
        <a href={FEEDBACK_URL} target="_blank" rel="noopener noreferrer">
          Share feedback
        </a>
      </span>
    </div>
  );
}

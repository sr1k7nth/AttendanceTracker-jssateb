export default function Landing({ onLogin }) {
  return (
    <div className="landing">
      <p className="login-tagline">
        Stressed about attendance?
        <br />
        Welcome to <span className="brand-accent">JATracker</span>.
      </p>
      <button className="btn btn-primary landing-login" onClick={onLogin}>
        Login
      </button>
    </div>
  );
}

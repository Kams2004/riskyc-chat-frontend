import { useNavigate } from 'react-router-dom';

/** Placeholder content — the integration point mobile links out to; real legal copy is a content question, not an engineering one. */
export function TermsPage() {
  const navigate = useNavigate();
  return (
    <div className="legal-page">
      <button className="back-link" onClick={() => navigate(-1)}>
        ← Back
      </button>
      <h1>Terms of Service</h1>
      <p>
        These terms govern your use of RiskyC Chat. By creating an account, you agree to use the service responsibly and in
        accordance with applicable law.
      </p>
      <p>This page is a placeholder — replace this content with RiskyC Chat's actual terms of service.</p>
    </div>
  );
}

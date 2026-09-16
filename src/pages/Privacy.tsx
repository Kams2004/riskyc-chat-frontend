import { useNavigate } from 'react-router-dom';

/** Placeholder content — the integration point mobile links out to; real legal copy is a content question, not an engineering one. */
export function PrivacyPage() {
  const navigate = useNavigate();
  return (
    <div className="legal-page">
      <button className="back-link" onClick={() => navigate(-1)}>
        ← Back
      </button>
      <h1>Privacy Policy</h1>
      <p>
        RiskyC Chat collects only what's needed to provide the service: your phone number or email, your messages, and basic
        profile information you choose to share.
      </p>
      <p>This page is a placeholder — replace this content with RiskyC Chat's actual privacy policy.</p>
    </div>
  );
}

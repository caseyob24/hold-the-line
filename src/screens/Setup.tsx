export default function Setup() {
  return (
    <div className="app">
      <div className="screen no-tabs">
        <div className="head">
          <span className="lbl brass">Deployment check</span>
          <h1 className="title">Almost ready</h1>
        </div>
        <p className="muted">
          The app is deployed but not connected to its database yet. Add these environment variables in Netlify
          (Site configuration → Environment variables), then redeploy:
        </p>
        <div className="card mono small stack">
          <span>VITE_SUPABASE_URL</span>
          <span>VITE_SUPABASE_ANON_KEY</span>
          <span>VITE_VAPID_PUBLIC_KEY</span>
        </div>
        <p className="muted small">The README in the repo walks through every step, including Outlook and push notifications.</p>
      </div>
    </div>
  );
}

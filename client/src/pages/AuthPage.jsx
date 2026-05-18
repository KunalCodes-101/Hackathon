import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BriefcaseBusiness, Loader2, LogIn, Rocket } from 'lucide-react';
import Chrome from '../components/Chrome.jsx';
import { Card } from '../components/ui.jsx';
import { useAuth } from '../auth.jsx';

export default function AuthPage({ mode = 'signin' }) {
  const isSignup = mode === 'signup';
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'founder', region: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();

  async function submit(event) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = isSignup ? await signUp(form) : await signIn(form);
      navigate(user.role === 'job-seeker' ? '/jobs' : '/');
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Chrome>
      <section className="mx-auto grid min-h-[calc(100vh-6rem)] max-w-5xl items-center px-5 py-10">
        <Card className="grid overflow-hidden lg:grid-cols-[1fr_420px]">
          <div className="bg-raised p-6 md:p-8">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-teal">FounderOS account</p>
            <h1 className="mt-4 text-3xl font-semibold leading-tight text-white md:text-4xl">
              {isSignup ? 'Create your workspace.' : 'Welcome back.'}
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-muted">
              Founders can approve startup reports and publish generated roles. Job seekers choose a region and apply to openings created by approved startups.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <AuthRole icon={Rocket} title="Founder" body="Generate reports, approve startups, and open hiring roles." />
              <AuthRole icon={BriefcaseBusiness} title="Job seeker" body="See jobs in your selected area and apply from one place." />
            </div>
          </div>

          <form onSubmit={submit} className="p-5 md:p-6">
            <h2 className="text-xl font-semibold text-white">{isSignup ? 'Sign up' : 'Sign in'}</h2>
            {isSignup && (
              <input
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder="Full name"
                className="input-surface mt-5 h-14 w-full rounded-xl border border-line px-4 text-base outline-none focus:border-teal"
                required
              />
            )}
            <input
              type="email"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              placeholder="Email"
              className="input-surface mt-3 h-14 w-full rounded-xl border border-line px-4 text-base outline-none focus:border-teal"
              required
            />
            <input
              type="password"
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              placeholder="Password"
              className="input-surface mt-3 h-14 w-full rounded-xl border border-line px-4 text-base outline-none focus:border-teal"
              required
            />
            {isSignup && (
              <>
                <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl border border-line bg-raised p-1">
                  {['founder', 'job-seeker'].map((role) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => setForm({ ...form, role })}
                      className={`rounded-lg px-3 py-3 text-sm font-semibold capitalize transition ${form.role === role ? 'bg-panel text-white' : 'text-muted hover:text-white'}`}
                    >
                      {role.replace('-', ' ')}
                    </button>
                  ))}
                </div>
                <input
                  value={form.region}
                  onChange={(event) => setForm({ ...form, region: event.target.value })}
                  placeholder={form.role === 'job-seeker' ? 'Job area / region' : 'Startup region'}
                  className="input-surface mt-3 h-14 w-full rounded-xl border border-line px-4 text-base outline-none focus:border-teal"
                  required={form.role === 'job-seeker'}
                />
              </>
            )}
            {error && <p className="mt-3 rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-red-100">{error}</p>}
            <button className="mt-5 inline-flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-teal px-5 text-base font-semibold text-white">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
              {isSignup ? 'Create account' : 'Sign in'}
            </button>
            <p className="mt-4 text-center text-sm text-muted">
              {isSignup ? 'Already have an account?' : 'New to FounderOS?'}{' '}
              <Link className="font-semibold text-teal hover:text-white" to={isSignup ? '/signin' : '/signup'}>
                {isSignup ? 'Sign in' : 'Sign up'}
              </Link>
            </p>
          </form>
        </Card>
      </section>
    </Chrome>
  );
}

function AuthRole({ icon: Icon, title, body }) {
  return (
    <div className="rounded-lg border border-line bg-panel p-4">
      <Icon className="h-5 w-5 text-teal" />
      <h3 className="mt-3 font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-muted">{body}</p>
    </div>
  );
}

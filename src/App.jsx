import { useState, useEffect } from 'react';
import LandingPage from './components/LandingPage';
import MatrixChat from './components/MatrixChat';
import FAQ from './components/FAQ';
import { MessageSquare, HelpCircle, Home } from 'lucide-react';
import logo from './assets/output-onlinepngtools.png';

const SESSION_KEY = 'mchs_session';

function Navigation({ currentView, setCurrentView, session, onLogout }) {
  return (
    <nav style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-base)' }}
         className="px-6 h-12 flex items-center justify-between">
      <button onClick={() => setCurrentView('home')} className="flex items-center gap-2.5 shrink-0">
        <img src={logo} alt="MCHS Robotics" className="h-7 w-7 object-contain"
             style={{ filter: 'brightness(0) invert(1)' }} />
        <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>MCHS Robotics</span>
        <span className="text-xs px-1.5 py-0.5 rounded"
              style={{ background: 'var(--bg-overlay)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
          5728
        </span>
      </button>

      <div className="flex items-center gap-1">
        {[
          { view: 'home', icon: Home,          label: 'Home'  },
          { view: 'chat', icon: MessageSquare, label: 'Chat'  },
          { view: 'faq',  icon: HelpCircle,    label: 'FAQ'   },
        ].map(({ view, icon: Icon, label }) => {
          const active = currentView === view;
          return (
            <button key={view} onClick={() => setCurrentView(view)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs transition-colors duration-150"
              style={{
                color:      active ? 'var(--text-primary)' : 'var(--text-muted)',
                background: active ? 'var(--bg-overlay)'   : 'transparent',
                border:     active ? '1px solid var(--border)' : '1px solid transparent',
              }}>
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          );
        })}

        {/* User pill */}
        {session && (
          <div className="flex items-center gap-1.5 ml-2 pl-2"
               style={{ borderLeft: '1px solid var(--border)' }}>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {session.userId.replace(/@/, '').replace(/:.*$/, '')}
            </span>
            {session.verified && (
              <span className="text-xs px-1.5 py-0.5 rounded"
                    style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.2)' }}>
                ✓
              </span>
            )}
            <button onClick={onLogout}
              className="text-xs px-2 py-1 rounded transition-colors ml-1"
              style={{ color: 'var(--text-subtle)', border: '1px solid var(--border)' }}
              onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-subtle)'; e.currentTarget.style.borderColor = 'var(--border)'; }}>
              Sign out
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}

export default function App() {
  const [currentView, setCurrentView] = useState('chat');
  const [session, setSession]         = useState(null); // { userId, accessToken, deviceId, verified }

  // Restore session from localStorage on load
  useEffect(() => {
    try {
      const saved = localStorage.getItem(SESSION_KEY);
      if (saved) setSession(JSON.parse(saved));
    } catch { /* ignore */ }
  }, []);

  const handleVerified = (sessionData) => {
    setSession(sessionData);
    localStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
    setCurrentView('chat');
  };

  const handleLogout = () => {
    setSession(null);
    localStorage.removeItem(SESSION_KEY);
    setCurrentView('home');
  };

  // Not logged in — show landing
  if (!session) {
    return <LandingPage onVerified={handleVerified} />;
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-base)' }}>
      <Navigation
        currentView={currentView}
        setCurrentView={setCurrentView}
        session={session}
        onLogout={handleLogout}
      />
      {currentView === 'chat' && <MatrixChat session={session} />}
      {currentView === 'faq'  && <FAQ />}
      {currentView === 'home' && <MatrixChat session={session} />}
    </div>
  );
}

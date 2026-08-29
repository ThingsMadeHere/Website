import { useState } from 'react';
import LandingPage from './components/LandingPage';
import MatrixChat from './components/MatrixChat';
import FAQ from './components/FAQ';
import { MessageSquare, HelpCircle, Home } from 'lucide-react';

function App() {
  const [currentView, setCurrentView] = useState('chat'); // landing, chat, faq
  const [isVerified, setIsVerified] = useState(true);

  const handleVerified = () => {
    setIsVerified(true);
    setCurrentView('chat');
  };

  const handleLogout = () => {
    setIsVerified(false);
    setCurrentView('landing');
  };

  const Navigation = () => (
    <nav className="bg-slate-800 border-b border-slate-700 px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-6">
        <button
          onClick={() => setCurrentView('landing')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
            currentView === 'landing'
              ? 'bg-frc-blue text-white'
              : 'text-slate-400 hover:text-white hover:bg-slate-700'
          }`}
        >
          <Home className="w-5 h-5" />
          <span>Home</span>
        </button>
        {isVerified && (
          <button
            onClick={() => setCurrentView('chat')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              currentView === 'chat'
                ? 'bg-frc-blue text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-700'
            }`}
          >
            <MessageSquare className="w-5 h-5" />
            <span>Chat</span>
          </button>
        )}
        <button
          onClick={() => setCurrentView('faq')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
            currentView === 'faq'
              ? 'bg-frc-blue text-white'
              : 'text-slate-400 hover:text-white hover:bg-slate-700'
          }`}
        >
          <HelpCircle className="w-5 h-5" />
          <span>FAQ</span>
        </button>
      </div>
      <div className="text-slate-400 text-sm">
        MCHS Robotics
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen">
      {currentView === 'landing' && !isVerified && (
        <LandingPage onVerified={handleVerified} />
      )}
      {(currentView === 'chat' || isVerified) && (
        <>
          <Navigation />
          {currentView === 'chat' && <MatrixChat onLogout={handleLogout} />}
        </>
      )}
      {currentView === 'faq' && (
        <>
          <Navigation />
          <FAQ />
        </>
      )}
    </div>
  );
}

export default App;

import { useState } from 'react';
import { ChevronDown, ChevronUp, HelpCircle, Mail, MessageCircle } from 'lucide-react';

const faqData = [
  {
    question: 'What is FRC?',
    answer: 'FRC (FIRST Robotics Competition) is an international high school robotics competition. Each year, teams of students, mentors, and coaches build and program industrial-size robots to play a difficult field game against like-minded competitors. It\'s as close to real-world engineering as a student can get.'
  },
  {
    question: 'Who can join MCHS Robotics?',
    answer: 'Any student at MCHS can join our robotics team! We welcome students with all skill levels and interests. Whether you\'re interested in programming, mechanical design, electrical work, marketing, or just want to learn, there\'s a place for you on our team.'
  },
  {
    question: 'When and where does the team meet?',
    answer: 'We meet regularly in the school\'s robotics shop. During build season (January-February), we meet more frequently, including some weekends. Check our Matrix chat or contact a team lead for the current schedule.'
  },
  {
    question: 'What skills will I learn?',
    answer: 'Team members learn valuable skills including CAD design, programming (Java/C++/Python), electrical wiring, mechanical fabrication, project management, teamwork, and communication. These skills are valuable for college and future careers in STEM fields.'
  },
  {
    question: 'Does it cost anything to join?',
    answer: 'There are no dues to join the team. However, we do fundraising throughout the year to cover competition fees, parts, and travel expenses. We encourage all team members to participate in fundraising activities.'
  },
  {
    question: 'What is the time commitment?',
    answer: 'During the off-season, we typically meet 2-3 times per week. During build season (6 weeks starting in early January), the commitment increases significantly as we work to complete our robot for competition. We understand that students have other commitments and work to accommodate schedules.'
  },
  {
    question: 'Do I need prior experience?',
    answer: 'No prior experience is required! We teach new members everything they need to know. Our veteran members and mentors are always willing to help beginners learn. The most important things are enthusiasm and willingness to learn.'
  },
  {
    question: 'What competitions do you participate in?',
    answer: 'We participate in the FRC season, which includes regional competitions and potentially the World Championship if we qualify. We also sometimes participate in off-season events to give new members experience and test our robot.'
  },
  {
    question: 'How can parents get involved?',
    answer: 'Parents can help by volunteering at competitions, assisting with fundraising, providing mentorship in their areas of expertise, or simply supporting team members. We appreciate all parental support!'
  },
  {
    question: 'What is the Matrix chat?',
    answer: 'Matrix is an open network for secure, decentralized communication. Our team uses Matrix for real-time coordination, announcements, and discussions. It\'s optimized for team communication and keeps everyone connected.'
  }
];

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState(null);

  const toggleFAQ = (index) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 py-12 px-4 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-20 right-20 w-72 h-72 bg-frc-blue/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 left-20 w-96 h-96 bg-frc-yellow/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      {/* Grid pattern overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:50px_50px]" />

      <div className="max-w-4xl mx-auto relative z-10">
        <div className="text-center mb-12">
          <div className="w-20 h-20 bg-gradient-to-br from-frc-yellow to-yellow-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-yellow-500/30">
            <HelpCircle className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-5xl font-bold text-white mb-4">
            <span className="bg-gradient-to-r from-blue-400 via-white to-blue-400 bg-clip-text text-transparent">
              Frequently Asked Questions
            </span>
          </h1>
          <p className="text-xl text-blue-200">Everything you need to know about MCHS Robotics</p>
        </div>

        <div className="space-y-4">
          {faqData.map((faq, index) => (
            <div
              key={index}
              className={`bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 overflow-hidden transition-all duration-300 ${
                openIndex === index ? 'shadow-2xl shadow-blue-500/20' : 'hover:shadow-xl hover:shadow-blue-500/10'
              }`}
            >
              <button
                onClick={() => toggleFAQ(index)}
                className="w-full px-6 py-5 flex items-center justify-between text-left hover:bg-white/5 transition-colors"
              >
                <span className="text-white font-semibold pr-4 text-lg">{faq.question}</span>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                  openIndex === index 
                    ? 'bg-frc-yellow rotate-180' 
                    : 'bg-slate-700/50 hover:bg-slate-700'
                }`}>
                  {openIndex === index ? (
                    <ChevronUp className="w-5 h-5 text-white" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-white" />
                  )}
                </div>
              </button>
              {openIndex === index && (
                <div className="px-6 pb-5 pt-2">
                  <div className="h-px bg-gradient-to-r from-transparent via-white/20 to-transparent mb-4" />
                  <p className="text-blue-200 leading-relaxed">{faq.answer}</p>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <p className="text-blue-300 mb-6 text-lg">Still have questions?</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button className="flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-frc-blue to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all font-medium shadow-lg shadow-blue-500/30">
              <Mail className="w-5 h-5" />
              Contact Us
            </button>
            <button className="flex items-center justify-center gap-2 px-8 py-4 bg-slate-800/80 backdrop-blur text-white rounded-xl hover:bg-slate-700/80 transition-all font-medium border border-slate-700/50">
              <MessageCircle className="w-5 h-5 text-frc-yellow" />
              Join Matrix Chat
            </button>
          </div>
        </div>

        <div className="mt-12 text-center">
          <div className="h-px bg-gradient-to-r from-transparent via-white/20 to-transparent mb-6" />
          <p className="text-blue-400/60 text-sm">© 2026 MCHS Robotics - FRC Team</p>
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, MessageSquare, Users, Settings, LogOut, Bot } from 'lucide-react';
import * as sdk from 'matrix-js-sdk';
import { ClientEvent, RoomEvent } from 'matrix-js-sdk';
import { matrixConfig } from '../config/matrix';

export default function MatrixChat({ onLogout }) {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [onlineCount, setOnlineCount] = useState(0);
  const [matrixClient, setMatrixClient] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const initMatrix = async () => {
      try {
        const client = sdk.createClient({
          baseUrl: matrixConfig.homeserverUrl,
          accessToken: matrixConfig.accessToken,
          userId: matrixConfig.userId,
        });

        setMatrixClient(client);

        client.on(ClientEvent.Sync, (state, prevState, res) => {
          console.log('Sync state:', state);
          if (state === 'PREPARED') {
            setIsConnected(true);
            loadRoomMessages(client);
          }
        });

        client.on(RoomEvent.Timeline, (event, room, toStartOfTimeline) => {
          if (toStartOfTimeline) return;
          if (event.getType() !== 'm.room.message') return;

          const content = event.getContent();
          const sender = event.getSender();
          const timestamp = event.getTs();
          
          const newMessage = {
            id: event.getId(),
            user: sender.replace(/@.*:/, '').replace(':', ''),
            text: content.body,
            time: new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isOwn: sender === matrixConfig.userId,
          };

          setMessages(prev => [...prev, newMessage]);
        });

        await client.startClient({ initialSyncLimit: 20 });
      } catch (error) {
        console.error('Matrix initialization error:', error);
        setIsConnected(false);
      }
    };

    initMatrix();

    return () => {
      if (matrixClient) {
        matrixClient.stopClient();
      }
    };
  }, []);

  const loadRoomMessages = useCallback((client) => {
    try {
      const room = client.getRoom(matrixConfig.roomId);
      if (!room) {
        console.log('Room not found:', matrixConfig.roomId);
        return;
      }

      const timeline = room.timeline;
      const messages = timeline.map((event) => {
        const content = event.getContent();
        const sender = event.getSender();
        const timestamp = event.getTs();
        
        return {
          id: event.getId(),
          user: sender.replace(/@.*:/, '').replace(':', ''),
          text: content.body,
          time: new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isOwn: sender === matrixConfig.userId,
        };
      });

      setMessages(messages);
      
      // Update online count
      const members = room.getJoinedMembers();
      setOnlineCount(members.length);
    } catch (error) {
      console.error('Error loading room messages:', error);
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSendMessage = useCallback(async (e) => {
    e.preventDefault();
    if (inputMessage.trim() && matrixClient) {
      try {
        const content = {
          body: inputMessage,
          msgtype: 'm.text',
        };

        await matrixClient.sendEvent(
          matrixConfig.roomId,
          'm.room.message',
          content
        );

        setInputMessage('');
      } catch (error) {
        console.error('Error sending message:', error);
      }
    }
  }, [inputMessage, matrixClient]);

  const handleInputChange = (e) => {
    setInputMessage(e.target.value);
    setIsTyping(e.target.value.length > 0);
  };

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      {/* Header */}
      <div className="bg-slate-800/80 backdrop-blur-xl border-b border-slate-700/50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-frc-blue to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">MCHS Robotics Chat</h1>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                {isConnected ? 'Connected to Matrix' : 'Disconnected'}
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-700/50 rounded-lg">
            <Users className="w-4 h-4 text-frc-yellow" />
            <span className="text-sm text-slate-300">{onlineCount} online</span>
          </div>
          <button className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition-all">
            <Settings className="w-5 h-5" />
          </button>
          <button
            onClick={onLogout}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-frc-red to-red-600 text-white rounded-xl hover:from-red-600 hover:to-red-700 transition-all text-sm font-medium shadow-lg shadow-red-500/30"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800/50 backdrop-blur rounded-full text-sm text-slate-400">
            <Bot className="w-4 h-4 text-frc-blue" />
            <span>Matrix Chat • End-to-end encrypted</span>
          </div>
        </div>

        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.isOwn ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`flex gap-3 max-w-md lg:max-w-lg xl:max-w-xl ${message.isOwn ? 'flex-row-reverse' : ''}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                message.isOwn 
                  ? 'bg-gradient-to-br from-frc-blue to-blue-600' 
                  : 'bg-gradient-to-br from-frc-yellow to-yellow-600'
              } shadow-lg`}>
                <span className="text-white text-xs font-bold">
                  {message.isOwn ? 'Y' : message.user.charAt(0)}
                </span>
              </div>
              <div
                className={`${
                  message.isOwn
                    ? 'bg-gradient-to-br from-frc-blue to-blue-600 text-white'
                    : 'bg-slate-800/80 backdrop-blur text-slate-200 border border-slate-700/50'
                } rounded-2xl px-4 py-3 shadow-lg`}
              >
                {!message.isOwn && (
                  <p className="text-xs font-semibold text-frc-yellow mb-1">{message.user}</p>
                )}
                <p className="text-sm leading-relaxed">{message.text}</p>
                <p className={`text-xs mt-1 ${message.isOwn ? 'text-blue-200' : 'text-slate-500'}`}>
                  {message.time}
                </p>
              </div>
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex justify-start">
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-frc-yellow to-yellow-600 flex items-center justify-center flex-shrink-0 shadow-lg">
                <span className="text-white text-xs font-bold">T</span>
              </div>
              <div className="bg-slate-800/80 backdrop-blur rounded-2xl px-4 py-3 border border-slate-700/50">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                  <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                </div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="bg-slate-800/80 backdrop-blur-xl border-t border-slate-700/50 p-4">
        <form onSubmit={handleSendMessage} className="flex gap-3 max-w-4xl mx-auto">
          <input
            ref={inputRef}
            type="text"
            value={inputMessage}
            onChange={handleInputChange}
            placeholder="Type a message..."
            className="flex-1 bg-slate-700/50 backdrop-blur text-white placeholder-slate-400 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-frc-blue/50 border border-slate-600/50 transition-all"
          />
          <button
            type="submit"
            disabled={!inputMessage.trim()}
            className="px-6 py-3 bg-gradient-to-r from-frc-blue to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 disabled:from-slate-600 disabled:to-slate-600 disabled:cursor-not-allowed transition-all flex items-center gap-2 font-medium shadow-lg shadow-blue-500/30"
          >
            <Send className="w-4 h-4" />
            Send
          </button>
        </form>
      </div>
    </div>
  );
}

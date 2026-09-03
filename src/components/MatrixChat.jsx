import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Users, Hash } from 'lucide-react';
import * as sdk from 'matrix-js-sdk';
import { ClientEvent, RoomEvent } from 'matrix-js-sdk';
import { matrixConfig } from '../config/matrix';

const HOMESERVER_URL = window.location.origin + '/api/matrix';

export default function MatrixChat({ session }) {
  const [messages, setMessages]         = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isConnected, setIsConnected]   = useState(false);
  const [onlineCount, setOnlineCount]   = useState(0);
  const [verifiedMap, setVerifiedMap]   = useState({}); // userId → boolean
  const [joiningRoom, setJoiningRoom]   = useState(false);
  const [canSendMessage, setCanSendMessage] = useState(false);
  const [sendAttempts, setSendAttempts]   = useState(0);
  const [joinInProgress, setJoinInProgress] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef       = useRef(null);
  const clientRef      = useRef(null);
  const joinedRoomRef  = useRef(false);

  // Fetch verified status for all users
  useEffect(() => {
    fetch('/api/users/verified')
      .then(r => r.json())
      .then(setVerifiedMap)
      .catch(() => {});
  }, []);

  const loadRoomMessages = useCallback((client) => {
    try {
      const room = client.getRoom(matrixConfig.roomId);
      if (!room) return;

      const loaded = room.timeline
        .filter(e => e.getType() === 'm.room.message' && e.getContent()?.body)
        .map(e => msgFromEvent(e, session.userId));

      setMessages(loaded);
      setOnlineCount(room.getJoinedMembers().length);
    } catch (err) {
      console.error('Error loading messages:', err);
    }
  }, [session.userId]);

  useEffect(() => {
    const init = async () => {
      try {
        const client = sdk.createClient({
          baseUrl:     HOMESERVER_URL,
          accessToken: session.accessToken,
          userId:      session.userId,
          timelineSupport: true,
        });
        clientRef.current = client;
        client.setAccessToken(session.accessToken);
        
        client.on(ClientEvent.Sync, (state) => {
          console.log('Matrix sync state:', state);
          
          if (state === 'PREPARED') {
            setIsConnected(true);
            
            // Check if we have the room and user's membership
            const room = client.getRoom(matrixConfig.roomId);
            if (room) {
              const member = room.getMember(session.userId);
              console.log('Room membership status:', member ? member.membership : 'no member state');
              
              // Check if we can send messages (user must be in the room with join membership)
              const userInRoom = member?.membership === 'join';
              setCanSendMessage(userInRoom);
              
              if (userInRoom) {
                loadRoomMessages(client);
              }
              // If user's membership is not 'join', we need to join
              else if (!joinInProgress) {
                console.log('User not in room (membership:', member?.membership || 'no member object' + '), attempting to join...');
                setJoiningRoom(true);
                setJoinInProgress(true);
                client.joinRoom(matrixConfig.roomId).then(async (room) => {
                  console.log('Successfully joined room:', matrixConfig.roomId);
                  await new Promise(resolve => setTimeout(resolve, 1000));
                  setJoiningRoom(false);
                  setJoinInProgress(false);
                  const checkRoom = client.getRoom(matrixConfig.roomId);
                  const checkMember = checkRoom?.getMember(session.userId);
                  if (checkMember?.membership === 'join') {
                    setCanSendMessage(true);
                    loadRoomMessages(client);
                  } else {
                    console.error('Join confirmed but membership is still:', checkMember?.membership);
                    setCanSendMessage(false);
                  }
                }).catch(err => {
                  console.error('Failed to join room:', err);
                  setJoiningRoom(false);
                  setJoinInProgress(false);
                  setCanSendMessage(false);
                });
              }
            } else {
              // Room not in timeline - try to join with direct fetch
              console.log('Room not in timeline, attempting to join...');
              setJoiningRoom(true);
              setJoinInProgress(true);
              
              const joinWithDirectFetch = () => {
                const url = `${client.baseUrl}/_matrix/client/v3/join/${encodeURIComponent(matrixConfig.roomId)}`;
                return fetch(url, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.accessToken}`,
                  },
                  body: JSON.stringify({}),
                }).then(async (response) => {
                  if (!response.ok) {
                    const data = await response.text();
                    throw new Error(`Join failed with status ${response.status}: ${data}`);
                  }
                  return response.json();
                });
              };
              
              joinWithDirectFetch().then(async (data) => {
                console.log('Successfully joined room:', matrixConfig.roomId);
                await new Promise(resolve => setTimeout(resolve, 1000));
                setJoiningRoom(false);
                setJoinInProgress(false);
                const checkRoom = client.getRoom(matrixConfig.roomId);
                const checkMember = checkRoom?.getMember(session.userId);
                if (checkMember?.membership === 'join') {
                  setCanSendMessage(true);
                  loadRoomMessages(client);
                } else {
                  console.error('Join confirmed but membership is still:', checkMember?.membership);
                  setCanSendMessage(false);
                }
              }).catch(err => {
                console.error('Failed to join room:', err);
                setJoiningRoom(false);
                setJoinInProgress(false);
                setCanSendMessage(false);
              });
            }
          }
        });
        
        client.on(ClientEvent.SyncError, (err) => {
          console.error('Matrix sync error:', err);
        });

        client.on(RoomEvent.Timeline, (event, _room, toStartOfTimeline) => {
          if (toStartOfTimeline) return;
          if (event.getType() !== 'm.room.message') return;
          if (!event.getContent()?.body) return;

          setMessages(prev => {
            if (prev.some(m => m.id === event.getId())) return prev;
            return [...prev, msgFromEvent(event, session.userId)];
          });
        });

        await client.startClient({ initialSyncLimit: 100 });
        console.log('Matrix client started');
      } catch (err) {
        console.error('Matrix init error:', err);
        setIsConnected(false);
      }
    };

    init();
    return () => { 
      clientRef.current?.stopClient();
      // Reset join state on unmount so next session can try again
      joinedRoomRef.current = false;
    };
  }, [session, loadRoomMessages]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleSend = useCallback(async (e) => {
    e.preventDefault();
    if (!inputMessage.trim() || !clientRef.current) return;
    
    const room = clientRef.current.getRoom(matrixConfig.roomId);
    if (!room) {
      console.error('Cannot send message: room not found');
      if (sendAttempts < 3) {
        setSendAttempts(prev => prev + 1);
        setTimeout(() => {
          setSendAttempts(0);
          e.target.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
        }, 1000);
      }
      return;
    }
    
    const member = room.getMember(session.userId);
    if (!member || member.membership !== 'join') {
      setJoiningRoom(true);
      setSendAttempts(0);
      try {
        await clientRef.current.joinRoom(matrixConfig.roomId);
        await new Promise(resolve => setTimeout(resolve, 1500));
        const checkRoom = clientRef.current.getRoom(matrixConfig.roomId);
        const checkMember = checkRoom?.getMember(session.userId);
        if (checkMember?.membership === 'join') {
          setJoiningRoom(false);
          const result = await clientRef.current.sendEvent(matrixConfig.roomId, 'm.room.message', {
            body: inputMessage, msgtype: 'm.text',
          });
          console.log('Message sent successfully, event ID:', result);
          setInputMessage('');
          setSendAttempts(0);
        } else {
          setJoiningRoom(false);
        }
        return;
      } catch (joinErr) {
        console.error('Failed to join room:', joinErr);
        setJoiningRoom(false);
        return;
      }
    }
    
    try {
      const result = await clientRef.current.sendEvent(matrixConfig.roomId, 'm.room.message', {
        body: inputMessage, msgtype: 'm.text',
      });
      console.log('Message sent successfully, event ID:', result);
      setInputMessage('');
      setSendAttempts(0);
    } catch (err) {
      console.error('Send error:', err.message);
      setSendAttempts(0);
    }
  }, [inputMessage, session.userId, sendAttempts]);

  const avatarColor = (name) => {
    const colors = ['#0066B3', '#6366f1', '#8b5cf6', '#0891b2', '#059669', '#d97706'];
    let h = 0;
    for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
    return colors[Math.abs(h) % colors.length];
  };

  const displayName = (userId) => userId.replace(/:.*$/, '').replace('@', '');

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 48px)', background: 'var(--bg-base)' }}>

      {/* Channel header */}
      <div className="px-5 h-11 flex items-center justify-between shrink-0"
           style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2">
          <Hash className="w-3.5 h-3.5" style={{ color: 'var(--text-subtle)' }} />
          <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>mchs-robotics</span>
          <span className="text-xs px-1.5 py-0.5 rounded" style={{
            background: isConnected ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
            color:      isConnected ? '#22c55e'              : '#ef4444',
            border:     `1px solid ${isConnected ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
          }}>
            {isConnected ? 'live' : 'offline'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Users className="w-3.5 h-3.5" style={{ color: 'var(--text-subtle)' }} />
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{onlineCount}</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-0.5">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm" style={{ color: 'var(--text-subtle)' }}>
              {isConnected ? 'No messages yet.' : 'Connecting to Matrix…'}
            </p>
          </div>
        )}

        {messages.map((msg, i) => {
          const prev    = messages[i - 1];
          const grouped = prev?.fullUserId === msg.fullUserId;
          const isOwn   = msg.fullUserId === session.userId;
          const verified = verifiedMap[msg.fullUserId];

          return (
            <div key={msg.id} className={`flex gap-3 ${grouped ? 'mt-0.5' : 'mt-4'}`}>
              {/* Avatar */}
              <div className="w-7 h-7 shrink-0 mt-0.5">
                {!grouped && (
                  <div className="w-7 h-7 rounded-md flex items-center justify-center text-xs font-semibold text-white select-none"
                       style={{ background: avatarColor(msg.user) }}>
                    {msg.user.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                {!grouped && (
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-sm font-medium"
                          style={{ color: isOwn ? 'var(--accent)' : 'var(--text-primary)' }}>
                      {msg.user}
                    </span>
                    {verified && (
                      <span className="text-xs px-1 py-0.5 rounded"
                            style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e',
                                     border: '1px solid rgba(34,197,94,0.2)', lineHeight: 1 }}>
                        ✓
                      </span>
                    )}
                    <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>{msg.time}</span>
                  </div>
                )}
                <p className="text-sm leading-relaxed break-words"
                   style={{ color: 'var(--text-muted)' }}>
                  {msg.text}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-5 py-3 shrink-0" style={{ borderTop: '1px solid var(--border)' }}>
        <form onSubmit={handleSend} className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={inputMessage}
            onChange={e => setInputMessage(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(e); } }}
            placeholder="Message #mchs-robotics"
            className="flex-1 rounded-lg px-4 py-2.5 text-sm outline-none transition-colors"
            style={{
              background: 'var(--bg-elevated)',
              border:     '1px solid var(--border)',
              color:      'var(--text-primary)',
            }}
            onFocus={e => e.target.style.borderColor = 'var(--border-light)'}
            onBlur={e  => e.target.style.borderColor = 'var(--border)'}
          />
          <button type="submit" disabled={!inputMessage.trim() || joiningRoom || !canSendMessage}
            className="px-4 py-2.5 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-all duration-150"
            style={{
              background: inputMessage.trim() && !joiningRoom && canSendMessage ? 'var(--accent)' : 'var(--bg-overlay)',
              color:      inputMessage.trim() && !joiningRoom && canSendMessage ? '#fff'          : 'var(--text-subtle)',
              cursor:     inputMessage.trim() && !joiningRoom && canSendMessage ? 'pointer'       : 'not-allowed',
            }}>
            <Send className="w-3.5 h-3.5" />
            {joiningRoom ? 'Joining...' : canSendMessage ? 'Send' : 'Joining room...'}
          </button>
        </form>
        <p className="mt-1.5 text-xs" style={{ color: 'var(--text-subtle)' }}>
          Signed in as <span style={{ color: 'var(--text-muted)' }}>
            {displayName(session.userId)}
          </span>
          {session.verified && (
            <span className="ml-1" style={{ color: '#22c55e' }}>✓ verified</span>
          )}
          {' · '}
          <span style={{ color: 'var(--text-subtle)' }}>matrix.mchsrobotics.dev</span>
        </p>
      </div>
    </div>
  );
}

function msgFromEvent(event, selfUserId) {
  const sender = event.getSender();
  return {
    id:         event.getId(),
    fullUserId: sender,
    user:       sender.replace(/:.*$/, '').replace('@', ''),
    text:       event.getContent().body,
    time:       new Date(event.getTs()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    isOwn:      sender === selfUserId,
  };
}

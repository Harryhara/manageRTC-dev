import React, { useEffect, useState, useRef } from "react";
import Scrollbars from "react-custom-scrollbars-2";
import { Link, useLocation } from "react-router-dom";
import { all_routes } from "../router/all_routes";
import ImageWithBasePath from "../../core/common/imageWithBasePath";
import "react-modal-video/scss/modal-video.scss";
import CollapseHeader from "../../core/common/collapse-header/collapse-header";
import { useSocket } from "../../SocketContext";
import { useAuth, useUser } from "@clerk/clerk-react";
import { Socket } from "socket.io-client";

interface User {
  userId: string;
  name: string;
  avatar?: string;
  role: string;
  email?: string;
  isOnline: boolean;
  lastSeen: Date;
}

interface Employee {
  _id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  avatarUrl: string;
  contact?: {
    email: string;
    phone: string;
  };
  account?: {
    userName: string;
    userId?: string;
  };
  role: string;
  status: "Active" | "Inactive";
}

interface Message {
  _id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  content: string;
  type: 'text' | 'file' | 'image';
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  isEdited: boolean;
  isDeleted: boolean;
  readBy: Array<{ userId: string; readAt: Date }>;
  createdAt: Date;
}

interface Conversation {
  _id: string;
  participants: User[];
  lastMessage?: {
    content: string;
    senderId: string;
    senderName: string;
    timestamp: Date;
    type: string;
  };
  isGroup: boolean;
  groupName?: string;
  groupDescription?: string;
  groupAvatar?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const FunctionalChat = () => {
  const useBodyClass = (className: string) => {
    const location = useLocation();

    useEffect(() => {
      if (location.pathname === "/application/chat") {
        document.body.classList.add(className);
      } else {
        document.body.classList.remove(className);
      }
      return () => {
        document.body.classList.remove(className);
      };
    }, [location.pathname, className]);
  };
  useBodyClass("app-chat");

  const routes = all_routes;
  const socket = useSocket() as Socket | null;
  const { user: clerkUser } = useUser();
  
  // State management
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [companyUsers, setCompanyUsers] = useState<User[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<{ conversations: Conversation[]; messages: any[] }>({ conversations: [], messages: [] });
  const [messageInput, setMessageInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [showUsersList, setShowUsersList] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Record<string, boolean>>({});
  const [typingByConversation, setTypingByConversation] = useState<Record<string, boolean>>({});
  const [unreadByConversation, setUnreadByConversation] = useState<Record<string, number>>({});
  const [activeEmojiPicker, setActiveEmojiPicker] = useState<string | null>(null);
  const [showFooterEmoji, setShowFooterEmoji] = useState(false);
  const [showChatSearch, setShowChatSearch] = useState(false);
  const [chatSearchTerm, setChatSearchTerm] = useState("");
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Emoji picker functions
  const toggleEmojiPicker = (pickerId: string) => {
    setActiveEmojiPicker(activeEmojiPicker === pickerId ? null : pickerId);
  };

  const isEmojiPickerActive = (pickerId: string) => {
    return activeEmojiPicker === pickerId;
  };

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Scroll to highlighted message
  useEffect(() => {
    if (highlightedMessageId && messages.length > 0) {
      // Wait for DOM to update
      setTimeout(() => {
        const messageElement = document.getElementById(`message-${highlightedMessageId}`);
        if (messageElement) {
          messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          
          // Remove highlight after 3 seconds
          setTimeout(() => {
            setHighlightedMessageId(null);
          }, 3000);
        }
      }, 100);
    }
  }, [highlightedMessageId, messages]);

  // Socket event handlers
  useEffect(() => {
    if (!socket) return;

    // Listen for conversations list
    socket.on('conversations_list', (data: { conversations: Conversation[]; hasMore: boolean }) => {
      setConversations(data.conversations);
    });

    // Listen for messages list
    socket.on('messages_list', (data: { conversationId: string; messages: Message[]; hasMore: boolean }) => {
      if (data.conversationId === currentConversation?._id) {
        setMessages(data.messages);
      }
    });

    socket.on('new_message', (data: { conversationId: string; message: Message }) => {
      if (data.conversationId === currentConversation?._id) {
        setMessages(prev => [...prev, data.message]);
      }
      
      // Update conversations list with new message
      setConversations(prev => prev.map(conv => 
        conv._id === data.conversationId 
          ? { ...conv, lastMessage: { 
              content: data.message.content, 
              senderId: data.message.senderId, 
              senderName: data.message.senderName, 
              timestamp: data.message.createdAt, 
              type: data.message.type 
            }, updatedAt: new Date() }
          : conv
      ));

      // Increment unread count for non-active conversations
      if (data.conversationId !== currentConversation?._id && data.message.senderId !== clerkUser?.id) {
        setUnreadByConversation(prev => ({
          ...prev,
          [data.conversationId]: (prev[data.conversationId] || 0) + 1,
        }));
      }
    });

    // Listen for user status changes
    socket.on('user_status_changed', (data: { userId: string; isOnline: boolean }) => {
      setOnlineUsers(prev => {
        const newSet = new Set(prev);
        if (data.isOnline) {
          newSet.add(data.userId);
        } else {
          newSet.delete(data.userId);
        }
        return newSet;
      });
    });

    // Listen for unread count
    socket.on('unread_count', (data: { count: number }) => {
      setUnreadCount(data.count);
    });

    // Listen for company users list
    socket.on('company_users_list', (data: { users: User[]; hasMore: boolean }) => {
      setCompanyUsers(data.users);
    });

    // Listen for employees list
    socket.on('hrm/employees/get-employee-stats-response', (response: any) => {
      console.log('Employees response:', response);
      if (response.done && Array.isArray(response.data.employees)) {
        const activeEmployees = response.data.employees.filter((emp: Employee) => emp.status === 'Active');
        console.log('Active employees loaded:', activeEmployees.length);
        setEmployees(activeEmployees);
      }
    });

    // Listen for conversation started
    socket.on('conversation_started', (data: { conversation: Conversation }) => {
      console.log('Conversation started:', data);
      setConversations(prev => {
        const exists = prev.find(conv => conv._id === data.conversation._id);
        if (exists) {
          console.log('Conversation already exists in list');
          return prev;
        }
        console.log('Adding new conversation to list');
        return [data.conversation, ...prev];
      });
      setCurrentConversation(data.conversation);
      setMessages([]);
      setShowUsersList(false);
      
      // Join the conversation and load messages
      if (socket && data.conversation._id) {
        console.log('Joining conversation and loading messages');
        socket.emit('join_conversation', { conversationId: data.conversation._id });
        socket.emit('get_messages', { conversationId: data.conversation._id, limit: 50, skip: 0 });
      }
    });

    // Listen for search results
    socket.on('search_results', (data: { conversations: Conversation[]; messages: any[] }) => {
      setIsSearching(true);
      
      // Extract unique conversations from messages if they include conversation data
      const messageConversations: Conversation[] = [];
      if (data.messages) {
        const conversationMap = new Map<string, Conversation>();
        
        data.messages.forEach((msg: any) => {
          if (msg.conversation && !conversationMap.has(msg.conversation._id)) {
            conversationMap.set(msg.conversation._id, msg.conversation);
          }
        });
        
        // Convert Map values to array
        conversationMap.forEach((conv) => {
          messageConversations.push(conv);
        });
      }
      
      // Merge all conversations (from direct matches and from messages)
      const allConversations = [...(data.conversations || [])];
      messageConversations.forEach(conv => {
        if (!allConversations.find(c => c._id === conv._id)) {
          allConversations.push(conv);
        }
      });
      
      setConversations(allConversations);
      setSearchResults(data);
    });

    // Listen for single conversation fetch
    socket.on('conversation_data', (data: { conversation: Conversation }) => {
      setConversations(prev => {
        const exists = prev.find(c => c._id === data.conversation._id);
        if (exists) return prev;
        return [data.conversation, ...prev];
      });
      // Pass the highlightedMessageId if it exists
      handleConversationSelect(data.conversation, highlightedMessageId || undefined);
    });

    socket.on('user_typing', (data: { conversationId: string; userId: string }) => {
      setTypingByConversation(prev => ({ ...prev, [data.conversationId]: true }));
      if (data.conversationId === currentConversation?._id) {
        setTypingUsers((prev) => ({ ...prev, [data.userId]: true }));
      }
    });

    socket.on('user_stopped_typing', (data: { conversationId: string; userId: string }) => {
      setTypingByConversation(prev => {
        const next = { ...prev };
        delete next[data.conversationId];
        return next;
      });
      if (data.conversationId === currentConversation?._id) {
        setTypingUsers((prev) => {
          const copy = { ...prev };
          delete copy[data.userId];
          return copy;
        });
      }
    });

    socket.on('error', (error: { message: string }) => {
      console.warn('Chat warning:', error.message);
    });

    return () => {
      socket.off('conversations_list');
      socket.off('messages_list');
      socket.off('new_message');
      socket.off('user_status_changed');
      socket.off('unread_count');
      socket.off('company_users_list');
      socket.off('conversation_started');
      socket.off('search_results');
      socket.off('conversation_data');
      socket.off('user_typing');
      socket.off('user_stopped_typing');
      socket.off('hrm/employees/get-employee-stats-response');
      socket.off('error');
    };
  }, [socket, currentConversation, clerkUser]);

  // Load initial data
  useEffect(() => {
    if (socket && clerkUser) {
      socket.emit('get_conversations', { limit: 50, skip: 0 });
      socket.emit('get_unread_count');
      socket.emit('get_company_users', { limit: 50, skip: 0 });
      socket.emit('hrm/employees/get-employee-stats');
      socket.emit('update_online_status', { isOnline: true });

      const handleUnload = () => {
        try {
          socket.emit('update_online_status', { isOnline: false });
        } catch (e) {}
      };
      window.addEventListener('beforeunload', handleUnload);
      return () => window.removeEventListener('beforeunload', handleUnload);
    }
  }, [socket, clerkUser]);

  // Restore last opened conversation
  useEffect(() => {
    const lastId = localStorage.getItem('lastConversationId');
    if (!lastId || currentConversation) return;
    const found = conversations.find(c => c._id === lastId);
    if (found) handleConversationSelect(found);
  }, [conversations]);

  // Debounced search effect
  useEffect(() => {
    // Clear any existing timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // If search term is empty, reset search
    if (!searchTerm.trim()) {
      setIsSearching(false);
      return;
    }

    // Set new timeout for search
    searchTimeoutRef.current = setTimeout(() => {
      if (socket && searchTerm.trim()) {
        setIsSearching(true);
        socket.emit('search_chats', { searchTerm: searchTerm.trim(), limit: 20 });
      }
    }, 500); // 500ms debounce

    // Cleanup timeout on unmount or when searchTerm changes
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchTerm, socket]);

  // Convert Employee to User format
  const employeeToUser = (employee: Employee): User => {
    console.log('Converting employee to user:', employee);
    // Try to use account.userId if available, otherwise use _id
    const userId = employee.account?.userId || employee._id;
    console.log('Using userId:', userId);
    return {
      userId: userId,
      name: `${employee.firstName} ${employee.lastName}`.trim(),
      avatar: employee.avatarUrl,
      role: employee.role,
      email: employee.contact?.email,
      isOnline: onlineUsers.has(userId),
      lastSeen: new Date(),
    };
  };

  // Handle conversation selection
  const handleConversationSelect = (conversation: Conversation, messageId?: string) => {
    setCurrentConversation(conversation);
    setMessages([]);
    
    // If messageId provided, set it for highlighting
    if (messageId) {
      setHighlightedMessageId(messageId);
    } else {
      setHighlightedMessageId(null);
    }
    
    if (socket) {
      socket.emit('join_conversation', { conversationId: conversation._id });
      socket.emit('get_messages', { conversationId: conversation._id, limit: 50, skip: 0 });
      socket.emit('mark_messages_read', { conversationId: conversation._id });
    }

    setUnreadByConversation(prev => ({ ...prev, [conversation._id]: 0 }));
    localStorage.setItem('lastConversationId', conversation._id);
  };

  // Handle starting new conversation
  const handleStartConversation = (targetUser: User) => {
    console.log('Starting conversation with:', targetUser);
    if (!socket) {
      console.error('Socket not available');
      return;
    }
    
    // Check if conversation already exists with this user
    const existingConversation = conversations.find(conv => 
      !conv.isGroup && conv.participants.some(p => p.userId === targetUser.userId)
    );
    
    console.log('Existing conversation:', existingConversation);
    
    if (existingConversation) {
      // Open existing conversation
      console.log('Opening existing conversation');
      handleConversationSelect(existingConversation);
      setShowUsersList(false);
    } else {
      // Create new conversation
      console.log('Creating new conversation with userId:', targetUser.userId);
      socket.emit('start_conversation', { targetUserId: targetUser.userId });
    }
  };

  // Handle sending message
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim() || !currentConversation || !socket) return;

    socket.emit('send_message', {
      conversationId: currentConversation._id,
      content: messageInput.trim(),
      type: 'text'
    });

    setMessageInput("");
  };

  // Emit typing events
  useEffect(() => {
    if (!socket || !currentConversation) return;
    const conversationId = currentConversation._id;
    if (!messageInput) {
      socket.emit('stop_typing', { conversationId });
      return;
    }
    const t = setTimeout(() => {
      socket.emit('typing', { conversationId });
    }, 150);
    return () => clearTimeout(t);
  }, [messageInput, socket, currentConversation]);

  // Handle file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentConversation || !socket) return;

    socket.emit('send_message', {
      conversationId: currentConversation._id,
      content: `📎 ${file.name}`,
      type: 'file',
      fileData: {
        name: file.name,
        size: file.size,
        type: file.type
      }
    });
  };

  // Get other participant in conversation
  const getOtherParticipant = (conversation: Conversation) => {
    if (!clerkUser) return null;
    return conversation.participants.find(p => p.userId !== clerkUser.id);
  };

  // Format time
  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Format date
  const formatDate = (date: Date) => {
    const now = new Date();
    const messageDate = new Date(date);
    const diffTime = now.getTime() - messageDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return messageDate.toLocaleDateString([], { weekday: 'long' });
    return messageDate.toLocaleDateString();
  };

  // Filter messages based on search
  const filteredMessages = chatSearchTerm.trim()
    ? messages.filter(m => m.content.toLowerCase().includes(chatSearchTerm.toLowerCase()))
    : messages;

  return (
    <>
      {/* Page Wrapper */}
      <div className="page-wrapper">
        <div className="content">
          {/* Breadcrumb */}
          <div className="d-md-flex d-block align-items-center justify-content-between page-breadcrumb mb-3">
            <div className="my-auto mb-2">
              <h2 className="mb-1">Chat</h2>
              <nav>
                <ol className="breadcrumb mb-0">
                  <li className="breadcrumb-item">
                    <Link to={routes.adminDashboard}>
                      <i className="ti ti-smart-home" />
                    </Link>
                  </li>
                  <li className="breadcrumb-item">Application</li>
                  <li className="breadcrumb-item active" aria-current="page">
                    Chat
                  </li>
                </ol>
              </nav>
            </div>
            <div className="head-icons">
              <CollapseHeader />
            </div>
          </div>
          <div className="chat-wrapper">
            {/* Chats sidebar */}
            <div className="sidebar-group" style={{ width: '400px', minWidth: '400px', maxWidth: '400px' }}>
              <div id="chats" className="sidebar-content active slimscroll">
                <Scrollbars>
                  <div className="chat-search-header">
                    {/* Chat Search */}
                    <div className="search-wrap">
                      <form onSubmit={(e) => e.preventDefault()}>
                        <div className="d-flex align-items-center gap-2 w-100">
                          <div className="input-group flex-grow-1">
                            <input
                              type="text"
                              className="form-control"
                              placeholder="Search For Contacts or Messages"
                              value={searchTerm}
                              onChange={(e) => {
                                const v = e.target.value;
                                setSearchTerm(v);
                                if (!v.trim()) {
                                  setIsSearching(false);
                                  socket?.emit('get_conversations', { limit: 50, skip: 0 });
                                }
                              }}
                            />
                            <span className="input-group-text">
                              <i className="ti ti-search" />
                            </span>
                          </div>
                          <div className="d-flex align-items-center gap-2">
                            {unreadCount > 0 && (
                              <span className="badge bg-danger">{unreadCount}</span>
                            )}
                            <button 
                              type="button"
                              className="btn btn-sm btn-primary"
                              onClick={() => {
                                console.log('Toggle users list. Employees count:', employees.length);
                                setShowUsersList(!showUsersList);
                              }}
                              title="Start new conversation"
                            >
                              <i className="ti ti-plus" />
                            </button>
                          </div>
                        </div>
                      </form>
                    </div>
                    {/* /Chat Search */}
                  </div>
                  <div className="sidebar-body chat-body" id="chatsidebar">
                    {/* Show users list or conversations */}
                    {showUsersList ? (
                      <div>
                        <div className="d-flex justify-content-between align-items-center mb-3">
                          <h5 className="chat-title">All Employees</h5>
                          <button 
                            className="btn btn-sm btn-outline-secondary"
                            onClick={() => setShowUsersList(false)}
                          >
                            <i className="ti ti-arrow-left" />
                          </button>
                        </div>
                        <div className="chat-users-wrap">
                          {employees.length > 0 ? (
                            employees.map((employee) => {
                              const user = employeeToUser(employee);
                              return (
                                <div key={employee._id} className="chat-list">
                                  <Link to="#" className="chat-user-list" onClick={(e) => {
                                    e.preventDefault();
                                    handleStartConversation(user);
                                    setShowUsersList(false);
                                  }}>
                                    <div className={`avatar avatar-lg ${user.isOnline ? 'online' : 'offline'} me-2`}>
                                      <ImageWithBasePath
                                        src={user.avatar || "assets/img/profiles/avatar-02.jpg"}
                                        className="rounded-circle"
                                        alt="image"
                                      />
                                    </div>
                                    <div className="chat-user-info">
                                      <div className="chat-user-msg">
                                        <h6>{user.name}</h6>
                                        <p className="text-muted text-capitalize" style={{ fontSize: '12px' }}>
                                          {employee.role} • {employee.employeeId}
                                        </p>
                                      </div>
                                      <div className="chat-user-time">
                                        <span className={`time ${user.isOnline ? 'text-success' : 'text-muted'}`}>
                                          {user.isOnline ? 'Online' : 'Offline'}
                                        </span>
                                      </div>
                                    </div>
                                  </Link>
                                </div>
                              );
                            })
                          ) : (
                            <div className="text-center py-4">
                              <p className="text-muted">No employees found</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="d-flex justify-content-between align-items-center mb-3">
                          <h5 className="chat-title">{isSearching ? 'Search Results' : 'All Chats'}</h5>
                        </div>
                        <div className="chat-users-wrap">
                          {/* Show message search results if available */}
                          {isSearching && searchResults.messages && searchResults.messages.length > 0 && (
                            <div className="mb-3">
                              <h6 className="text-muted mb-2 px-2" style={{ fontSize: '12px' }}>
                                <i className="ti ti-message-circle me-1" />
                                MESSAGES ({searchResults.messages.length})
                              </h6>
                              {searchResults.messages.map((msg: any) => {
                                // Try to find conversation in current list or use embedded conversation data
                                let conversation = conversations.find(c => c._id === msg.conversationId);
                                if (!conversation && msg.conversation) {
                                  conversation = msg.conversation;
                                }
                                
                                const otherParticipant = conversation ? getOtherParticipant(conversation) : null;
                                
                                // Fallback display info from various possible sources
                                const displayName = otherParticipant?.name || msg.conversationName || msg.otherParticipant?.name || 'Unknown';
                                const displayAvatar = otherParticipant?.avatar || msg.conversationAvatar || msg.otherParticipant?.avatar || "assets/img/profiles/avatar-02.jpg";
                                
                                return (
                                  <div key={msg._id} className="chat-list">
                                    <Link to="#" className="chat-user-list d-flex align-items-start" onClick={(e) => {
                                      e.preventDefault();
                                      if (conversation) {
                                        handleConversationSelect(conversation, msg._id);
                                      } else if (socket && msg.conversationId) {
                                        // Store message ID for highlighting after conversation loads
                                        setHighlightedMessageId(msg._id);
                                        // Load the conversation if not in current list
                                        socket.emit('get_conversation_by_id', { conversationId: msg.conversationId });
                                      }
                                    }}>
                                      <div className="avatar avatar-md me-2 flex-shrink-0">
                                        <ImageWithBasePath
                                          src={displayAvatar}
                                          className="rounded-circle"
                                          alt="image"
                                        />
                                      </div>
                                      <div className="flex-fill" style={{ minWidth: 0 }}>
                                        <h6 className="mb-1" style={{ fontSize: '14px' }}>
                                          {displayName}
                                        </h6>
                                        <p className="mb-0 text-truncate" style={{ fontSize: '12px' }}>
                                          <i className="ti ti-search me-1" />
                                          {msg.content}
                                        </p>
                                        <small className="text-muted" style={{ fontSize: '11px' }}>
                                          {formatTime(msg.createdAt)}
                                        </small>
                                      </div>
                                    </Link>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* Show conversation results */}
                          {isSearching && conversations.length > 0 && searchResults.messages && searchResults.messages.length > 0 && (
                            <h6 className="text-muted mb-2 px-2" style={{ fontSize: '12px' }}>
                              <i className="ti ti-user me-1" />
                              CONTACTS ({conversations.length})
                            </h6>
                          )}

                          {conversations.map((conversation) => {
                            const otherParticipant = getOtherParticipant(conversation);
                            const isOnline = otherParticipant ? onlineUsers.has(otherParticipant.userId) : false;
                            const isTyping = typingByConversation[conversation._id];
                            
                            return (
                              <div key={conversation._id} className="chat-list">
                                <Link to="#" className="chat-user-list d-flex align-items-start" onClick={(e) => {
                                  e.preventDefault();
                                  handleConversationSelect(conversation);
                                }}>
                                  <div className={`avatar avatar-lg ${isOnline ? 'online' : 'offline'} me-2 flex-shrink-0`}>
                                    <ImageWithBasePath
                                      src={otherParticipant?.avatar || "assets/img/profiles/avatar-02.jpg"}
                                      className="rounded-circle"
                                      alt="image"
                                    />
                                  </div>
                                  <div className="d-flex flex-fill justify-content-between align-items-start" style={{ gap: '10px', minWidth: 0 }}>
                                    <div className="flex-fill" style={{ minWidth: 0 }}>
                                      <h6 className="mb-1">{otherParticipant?.name || conversation.groupName || 'Unknown'}</h6>
                                      {isTyping ? (
                                        <p className="mb-0" style={{ fontSize: '13px' }}>
                                          <span className="animate-typing">
                                            is typing
                                            <span className="dot" />
                                            <span className="dot" />
                                            <span className="dot" />
                                          </span>
                                        </p>
                                      ) : (
                                        <p className={`mb-0 text-truncate ${conversation.lastMessage ? '' : 'text-muted'}`} style={{ fontSize: '13px' }}>
                                          {conversation.lastMessage?.type === 'file' && <i className="ti ti-file me-1" />}
                                          {conversation.lastMessage?.content || 'No messages yet'}
                                        </p>
                                      )}
                                    </div>
                                    <div className="d-flex flex-column align-items-end flex-shrink-0" style={{ gap: '4px' }}>
                                      <span className="text-muted" style={{ fontSize: '11px', whiteSpace: 'nowrap' }}>
                                        {conversation.lastMessage 
                                          ? formatTime(conversation.lastMessage.timestamp)
                                          : formatTime(conversation.createdAt)
                                        }
                                      </span>
                                      {unreadByConversation[conversation._id] > 0 && (
                                        <span className="count-message fs-12 fw-semibold">
                                          {unreadByConversation[conversation._id]}
                                        </span>
                                      )}
                                      <Link 
                                        to="#" 
                                        data-bs-toggle="dropdown" 
                                        className="text-muted text-decoration-none d-inline-block" 
                                        style={{ fontSize: '16px', padding: '2px 4px' }}
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <i className="ti ti-dots-vertical" />
                                      </Link>
                                      <ul className="dropdown-menu dropdown-menu-end p-3">
                                        <li>
                                          <Link className="dropdown-item" to="#">
                                            <i className="ti ti-box-align-right me-2" />
                                            Archive Chat
                                          </Link>
                                        </li>
                                        <li>
                                          <Link className="dropdown-item" to="#">
                                            <i className="ti ti-heart me-2" />
                                            Mark as Favourite
                                          </Link>
                                        </li>
                                        <li>
                                          <Link className="dropdown-item" to="#">
                                            <i className="ti ti-check me-2" />
                                            Mark as Unread
                                          </Link>
                                        </li>
                                        <li>
                                          <Link className="dropdown-item" to="#">
                                            <i className="ti ti-pinned me-2" />
                                            Pin Chats
                                          </Link>
                                        </li>
                                        <li>
                                          <Link className="dropdown-item" to="#" onClick={(e) => {
                                            e.preventDefault();
                                            if (!socket) return;
                                            socket.emit('delete_conversation', { conversationId: conversation._id });
                                            if (currentConversation?._id === conversation._id) {
                                              setCurrentConversation(null);
                                            }
                                          }}>
                                            <i className="ti ti-trash me-2" />
                                            Delete
                                          </Link>
                                        </li>
                                      </ul>
                                    </div>
                                  </div>
                                </Link>
                              </div>
                            );
                          })}
                          
                          {conversations.length === 0 && (
                            <div className="text-center py-4">
                              <p className="text-muted">No conversations yet</p>
                              <small className="text-muted">Click the + button to start a conversation</small>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </Scrollbars>
              </div>
            </div>
            {/* / Chats sidebar */}
            {/* Chat */}
            <div className="chat chat-messages show flex-grow-1" id="middle" style={{ minWidth: 0 }}>
              {currentConversation ? (
                <div>
                  <div className="chat-header">
                    <div className="user-details">
                      <div className="d-xl-none">
                        <Link className="text-muted chat-close me-2" to="#">
                          <i className="fas fa-arrow-left" />
                        </Link>
                      </div>
                      <div className={`avatar avatar-lg ${onlineUsers.has(getOtherParticipant(currentConversation)?.userId || '') ? 'online' : 'offline'} flex-shrink-0`}>
                        <ImageWithBasePath
                          src={getOtherParticipant(currentConversation)?.avatar || "assets/img/profiles/avatar-02.jpg"}
                          className="rounded-circle"
                          alt="image"
                        />
                      </div>
                      <div className="ms-2 overflow-hidden">
                        <h6>{getOtherParticipant(currentConversation)?.name || currentConversation.groupName || 'Unknown'}</h6>
                        <span className="last-seen">
                          {Object.keys(typingUsers).length > 0 
                            ? 'Typing...' 
                            : (onlineUsers.has(getOtherParticipant(currentConversation)?.userId || '') ? 'Online' : 'Offline')
                          }
                        </span>
                      </div>
                    </div>
                    <div className="chat-options">
                      <ul>
                        <li>
                          <Link
                            to="#"
                            className="btn chat-search-btn"
                            data-bs-toggle="tooltip"
                            data-bs-placement="bottom"
                            title="Search"
                            onClick={(e) => {
                              e.preventDefault();
                              setShowChatSearch(!showChatSearch);
                              if (showChatSearch) {
                                setChatSearchTerm("");
                              }
                            }}
                          >
                            <i className="ti ti-search" />
                          </Link>
                        </li>
                        <li>
                          <Link className="btn no-bg" to="#" data-bs-toggle="dropdown">
                            <i className="ti ti-dots-vertical" />
                          </Link>
                          <ul className="dropdown-menu dropdown-menu-end p-3">
                            <li>
                              <Link to="#" className="dropdown-item" onClick={(e) => {
                                e.preventDefault();
                                if (!socket || !currentConversation) return;
                                const current = (window as any).CHAT_MUTED?.[currentConversation._id] || false;
                                (window as any).CHAT_MUTED = { ...(window as any).CHAT_MUTED, [currentConversation._id]: !current };
                                socket.emit('mute_conversation', { conversationId: currentConversation._id, muted: !current });
                              }}>
                                <i className="ti ti-volume-off me-2" />
                                Mute Notification
                              </Link>
                            </li>
                            <li>
                              <Link to="#" className="dropdown-item" onClick={(e) => {
                                e.preventDefault();
                                if (!socket || !currentConversation) return;
                                const current = (window as any).CHAT_DISAPPEAR?.[currentConversation._id] || false;
                                (window as any).CHAT_DISAPPEAR = { ...(window as any).CHAT_DISAPPEAR, [currentConversation._id]: !current };
                                socket.emit('disappearing_toggle', { conversationId: currentConversation._id, enabled: !current });
                              }}>
                                <i className="ti ti-clock-hour-4 me-2" />
                                Disappearing Message
                              </Link>
                            </li>
                            <li>
                              <Link to="#" className="dropdown-item" onClick={(e) => {
                                e.preventDefault();
                                if (!socket || !currentConversation) return;
                                socket.emit('clear_conversation', { conversationId: currentConversation._id });
                                setMessages([]);
                              }}>
                                <i className="ti ti-clear-all me-2" />
                                Clear Message
                              </Link>
                            </li>
                            <li>
                              <Link to="#" className="dropdown-item" onClick={(e) => {
                                e.preventDefault();
                                if (!socket || !currentConversation) return;
                                socket.emit('delete_conversation', { conversationId: currentConversation._id });
                                setCurrentConversation(null);
                              }}>
                                <i className="ti ti-trash me-2" />
                                Delete Chat
                              </Link>
                            </li>
                            <li>
                              <Link to="#" className="dropdown-item" onClick={(e) => {
                                e.preventDefault();
                                if (!socket || !currentConversation) return;
                                const current = (window as any).CHAT_BLOCKED?.[currentConversation._id] || false;
                                (window as any).CHAT_BLOCKED = { ...(window as any).CHAT_BLOCKED, [currentConversation._id]: !current };
                                socket.emit('block_user', { conversationId: currentConversation._id, blocked: !current });
                              }}>
                                <i className="ti ti-ban me-2" />
                                Block
                              </Link>
                            </li>
                          </ul>
                        </li>
                      </ul>
                    </div>
                    {/* Chat Search */}
                    <div className={`chat-search search-wrap contact-search ${showChatSearch ? 'show' : ''}`}>
                      <form onSubmit={(e) => e.preventDefault()}>
                        <div className="input-group">
                          <input
                            type="text"
                            className="form-control"
                            placeholder="Search in messages"
                            value={chatSearchTerm}
                            onChange={(e) => setChatSearchTerm(e.target.value)}
                          />
                          <span className="input-group-text">
                            <i className="ti ti-search" />
                          </span>
                        </div>
                      </form>
                    </div>
                    {/* /Chat Search */}
                  </div>

                  <div className="chat-body chat-page-group slimscroll">
                    <Scrollbars>
                      <div className="messages">
                        {filteredMessages.map((message) => {
                          const isOwnMessage = message.senderId === clerkUser?.id;
                          const isRead = message.readBy.some(read => read.userId !== message.senderId);
                          const isHighlighted = highlightedMessageId === message._id;

                          return (
                            <div 
                              key={message._id} 
                              id={`message-${message._id}`}
                              className={`chats ${isOwnMessage ? 'chats-right' : ''} ${isHighlighted ? 'message-highlighted' : ''}`}
                              style={isHighlighted ? { 
                                backgroundColor: '#fff3cd', 
                                padding: '10px', 
                                borderRadius: '8px',
                                transition: 'background-color 0.3s ease'
                              } : {}}
                            >
                              {!isOwnMessage && (
                                <div className="chat-avatar">
                                  <ImageWithBasePath
                                    src={message.senderAvatar || getOtherParticipant(currentConversation)?.avatar || "assets/img/profiles/avatar-29.jpg"}
                                    className="rounded-circle"
                                    alt="image"
                                  />
                                </div>
                              )}
                              <div className="chat-content">
                                <div className="chat-info">
                                  {!isOwnMessage && (
                                    <>
                                      <div className="message-content">
                                        {message.type === 'file' ? (
                                          <>
                                            <i className="ti ti-file me-2" />
                                            {message.content}
                                          </>
                                        ) : (
                                          message.content
                                        )}
                                        <div className="emoj-group">
                                          <ul>
                                            <li className="emoj-action">
                                              <Link to="#" onClick={() => toggleEmojiPicker(`msg-${message._id}`)}>
                                                <i className="ti ti-mood-smile" />
                                              </Link>
                                              <div className="emoj-group-list" style={{ display: isEmojiPickerActive(`msg-${message._id}`) ? "block" : "none" }}>
                                                <ul>
                                                  <li><Link to="#"><ImageWithBasePath src="assets/img/icons/emonji-02.svg" alt="Icon" /></Link></li>
                                                  <li><Link to="#"><ImageWithBasePath src="assets/img/icons/emonji-05.svg" alt="Icon" /></Link></li>
                                                  <li><Link to="#"><ImageWithBasePath src="assets/img/icons/emonji-06.svg" alt="Icon" /></Link></li>
                                                  <li><Link to="#"><ImageWithBasePath src="assets/img/icons/emonji-07.svg" alt="Icon" /></Link></li>
                                                  <li><Link to="#"><ImageWithBasePath src="assets/img/icons/emonji-08.svg" alt="Icon" /></Link></li>
                                                  <li><Link to="#"><ImageWithBasePath src="assets/img/icons/emonji-03.svg" alt="Icon" /></Link></li>
                                                  <li><Link to="#"><ImageWithBasePath src="assets/img/icons/emonji-10.svg" alt="Icon" /></Link></li>
                                                  <li><Link to="#"><ImageWithBasePath src="assets/img/icons/emonji-09.svg" alt="Icon" /></Link></li>
                                                  <li className="add-emoj"><Link to="#"><i className="ti ti-plus" /></Link></li>
                                                </ul>
                                              </div>
                                            </li>
                                            <li><Link to="#"><i className="ti ti-arrow-forward-up" /></Link></li>
                                          </ul>
                                        </div>
                                      </div>
                                      <div className="chat-actions">
                                        <Link to="#" data-bs-toggle="dropdown">
                                          <i className="ti ti-dots-vertical" />
                                        </Link>
                                        <ul className="dropdown-menu dropdown-menu-end p-3">
                                          <li><Link className="dropdown-item" to="#"><i className="ti ti-corner-up-left me-2" />Reply</Link></li>
                                          <li><Link className="dropdown-item" to="#"><i className="ti ti-share me-2" />Forward</Link></li>
                                          <li><Link className="dropdown-item" to="#"><i className="ti ti-copy me-2" />Copy</Link></li>
                                          <li><Link className="dropdown-item" to="#"><i className="ti ti-heart me-2" />Mark as Favourite</Link></li>
                                          <li><Link className="dropdown-item" to="#"><i className="ti ti-trash me-2" />Delete</Link></li>
                                        </ul>
                                      </div>
                                    </>
                                  )}
                                  {isOwnMessage && (
                                    <>
                                      <div className="chat-actions">
                                        <Link to="#" data-bs-toggle="dropdown">
                                          <i className="ti ti-dots-vertical" />
                                        </Link>
                                        <ul className="dropdown-menu dropdown-menu-end p-3">
                                          <li><Link className="dropdown-item" to="#"><i className="ti ti-corner-up-left me-2" />Reply</Link></li>
                                          <li><Link className="dropdown-item" to="#"><i className="ti ti-share me-2" />Forward</Link></li>
                                          <li><Link className="dropdown-item" to="#"><i className="ti ti-copy me-2" />Copy</Link></li>
                                          <li><Link className="dropdown-item" to="#"><i className="ti ti-heart me-2" />Mark as Favourite</Link></li>
                                          <li><Link className="dropdown-item" to="#"><i className="ti ti-trash me-2" />Delete</Link></li>
                                        </ul>
                                      </div>
                                      <div className="message-content">
                                        {message.type === 'file' ? (
                                          <>
                                            <i className="ti ti-file me-2" />
                                            {message.content}
                                          </>
                                        ) : (
                                          message.content
                                        )}
                                        <div className="emoj-group">
                                          <ul>
                                            <li className="emoj-action">
                                              <Link to="#" onClick={() => toggleEmojiPicker(`msg-${message._id}`)}>
                                                <i className="ti ti-mood-smile" />
                                              </Link>
                                              <div className="emoj-group-list" style={{ display: isEmojiPickerActive(`msg-${message._id}`) ? "block" : "none" }}>
                                                <ul>
                                                  <li><Link to="#"><ImageWithBasePath src="assets/img/icons/emonji-02.svg" alt="Icon" /></Link></li>
                                                  <li><Link to="#"><ImageWithBasePath src="assets/img/icons/emonji-05.svg" alt="Icon" /></Link></li>
                                                  <li><Link to="#"><ImageWithBasePath src="assets/img/icons/emonji-06.svg" alt="Icon" /></Link></li>
                                                  <li><Link to="#"><ImageWithBasePath src="assets/img/icons/emonji-07.svg" alt="Icon" /></Link></li>
                                                  <li><Link to="#"><ImageWithBasePath src="assets/img/icons/emonji-08.svg" alt="Icon" /></Link></li>
                                                  <li><Link to="#"><ImageWithBasePath src="assets/img/icons/emonji-03.svg" alt="Icon" /></Link></li>
                                                  <li><Link to="#"><ImageWithBasePath src="assets/img/icons/emonji-10.svg" alt="Icon" /></Link></li>
                                                  <li><Link to="#"><ImageWithBasePath src="assets/img/icons/emonji-09.svg" alt="Icon" /></Link></li>
                                                  <li className="add-emoj"><Link to="#"><i className="ti ti-plus" /></Link></li>
                                                </ul>
                                              </div>
                                            </li>
                                            <li><Link to="#"><i className="ti ti-arrow-forward-up" /></Link></li>
                                          </ul>
                                        </div>
                                      </div>
                                    </>
                                  )}
                                </div>
                                <div className={`chat-profile-name ${isOwnMessage ? 'text-end' : ''}`}>
                                  <h6>
                                    {isOwnMessage ? 'You' : message.senderName}
                                    <i className="ti ti-circle-filled fs-7 mx-2" />
                                    <span className="chat-time">{formatTime(message.createdAt)}</span>
                                    {isOwnMessage && (
                                      <span className="msg-read success ms-2">
                                        <i className={`ti ${isRead ? 'ti-checks' : 'ti-check'}`} />
                                      </span>
                                    )}
                                  </h6>
                                </div>
                              </div>
                              {isOwnMessage && (
                                <div className="chat-avatar">
                                  <ImageWithBasePath
                                    src={clerkUser?.imageUrl || "assets/img/profiles/avatar-14.jpg"}
                                    className="rounded-circle dreams_chat"
                                    alt="image"
                                  />
                                </div>
                              )}
                            </div>
                          );
                        })}
                        {chatSearchTerm.trim() && filteredMessages.length === 0 && (
                          <div className="text-center py-4">
                            <p className="text-muted">No messages found matching "{chatSearchTerm}"</p>
                          </div>
                        )}
                        <div ref={messagesEndRef} />
                      </div>
                    </Scrollbars>
                  </div>

                  <div className="chat-footer">
                    <form className="footer-form" onSubmit={handleSendMessage}>
                      <div className="chat-footer-wrap" style={{ gap: '8px' }}>
                        <div className="form-item">
                          <Link to="#" className="action-circle">
                            <i className="ti ti-microphone" />
                          </Link>
                        </div>
                        <div className="form-wrap">
                          <input
                            type="text"
                            className="form-control"
                            placeholder="Type Your Message"
                            value={messageInput}
                            onChange={(e) => setMessageInput(e.target.value)}
                          />
                        </div>
                        <div className="form-item emoj-action-foot">
                          <Link to="#"
                            className="action-circle"
                            onClick={() => setShowFooterEmoji(!showFooterEmoji)}
                          >
                            <i className="ti ti-mood-smile" />
                          </Link>
                          <div className="emoj-group-list-foot down-emoji-circle" style={{ display: showFooterEmoji ? "block" : "none" }}>
                            <ul>
                              <li><Link to="#" onClick={() => { setMessageInput(prev => prev + '😊'); setShowFooterEmoji(false); }}><ImageWithBasePath src="assets/img/icons/emonji-02.svg" alt="Icon" /></Link></li>
                              <li><Link to="#" onClick={() => { setMessageInput(prev => prev + '❤️'); setShowFooterEmoji(false); }}><ImageWithBasePath src="assets/img/icons/emonji-05.svg" alt="Icon" /></Link></li>
                              <li><Link to="#" onClick={() => { setMessageInput(prev => prev + '👍'); setShowFooterEmoji(false); }}><ImageWithBasePath src="assets/img/icons/emonji-06.svg" alt="Icon" /></Link></li>
                              <li><Link to="#" onClick={() => { setMessageInput(prev => prev + '😂'); setShowFooterEmoji(false); }}><ImageWithBasePath src="assets/img/icons/emonji-07.svg" alt="Icon" /></Link></li>
                              <li><Link to="#" onClick={() => { setMessageInput(prev => prev + '🔥'); setShowFooterEmoji(false); }}><ImageWithBasePath src="assets/img/icons/emonji-08.svg" alt="Icon" /></Link></li>
                              <li className="add-emoj"><Link to="#"><i className="ti ti-plus" /></Link></li>
                            </ul>
                          </div>
                        </div>
                        <div className="form-item position-relative d-flex align-items-center justify-content-center">
                          <Link
                            to="#"
                            className="action-circle file-action position-absolute"
                            onClick={() => fileInputRef.current?.click()}
                          >
                            <i className="ti ti-folder" />
                          </Link>
                          <input
                            type="file"
                            ref={fileInputRef}
                            className="open-file position-relative"
                            name="files"
                            id="files"
                            onChange={handleFileUpload}
                            style={{ display: 'none' }}
                          />
                        </div>
                        <div className="form-item">
                          <Link to="#" data-bs-toggle="dropdown">
                            <i className="ti ti-dots-vertical" />
                          </Link>
                          <div className="dropdown-menu dropdown-menu-end p-3">
                            <Link to="#" className="dropdown-item"><i className="ti ti-camera-selfie me-2" />Camera</Link>
                            <Link to="#" className="dropdown-item"><i className="ti ti-photo-up me-2" />Gallery</Link>
                            <Link to="#" className="dropdown-item"><i className="ti ti-music me-2" />Audio</Link>
                            <Link to="#" className="dropdown-item"><i className="ti ti-map-pin-share me-2" />Location</Link>
                            <Link to="#" className="dropdown-item"><i className="ti ti-user-check me-2" />Contact</Link>
                          </div>
                        </div>
                        <div className="form-btn">
                          <button className="btn btn-primary" type="submit">
                            <i className="ti ti-send" />
                          </button>
                        </div>
                      </div>
                    </form>
                  </div>
                </div>
              ) : (
                <div className="chat-body chat-page-group">
                  <div className="messages text-center d-flex align-items-center justify-content-center" style={{ minHeight: '400px' }}>
                    <div>
                      <div className="avatar avatar-xl mx-auto mb-3">
                        <ImageWithBasePath
                          src="assets/img/profiles/avatar-02.jpg"
                          className="rounded-circle"
                          alt="image"
                        />
                      </div>
                      <h4>Welcome to Chat</h4>
                      <p className="text-muted">Select a conversation to start chatting or click the + button to start a new conversation</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
            {/* /Chat */}
          </div>
        </div>
      </div>
      {/* /Page Wrapper */}
    </>
  );
};

export default FunctionalChat;
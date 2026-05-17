import { useCallback, useState } from 'react';
import ChatService from '../services/chatService.js';

/**
 * Manage chat threads, contacts, messages, and request state around the chat service layer.
 */
const useChat = () => {
  const [threads, setThreads] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [messages, setMessages] = useState([]);
  const [isLoadingThreads, setIsLoadingThreads] = useState(false);
  const [isLoadingContacts, setIsLoadingContacts] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Load the conversation thread list for the current user.
   */
  const loadThreads = useCallback(async () => {
    setIsLoadingThreads(true);
    setError(null);

    try {
      const nextThreads = await ChatService.getThreads();
      setThreads(nextThreads);
      return nextThreads;
    } catch (loadError) {
      setError(loadError?.message || 'Gagal memuat daftar percakapan.');
      throw loadError;
    } finally {
      setIsLoadingThreads(false);
    }
  }, []);

  /**
   * Load all reachable chat contacts for the current user.
   */
  const loadContacts = useCallback(async (search = '') => {
    setIsLoadingContacts(true);
    setError(null);

    try {
      const nextContacts = await ChatService.getContacts(search);
      setContacts(nextContacts);
      return nextContacts;
    } catch (loadError) {
      setError(loadError?.message || 'Gagal memuat daftar kontak.');
      throw loadError;
    } finally {
      setIsLoadingContacts(false);
    }
  }, []);

  /**
   * Load the full message history with one selected counterpart.
   */
  const loadConversation = useCallback(async (userId) => {
    setIsLoadingMessages(true);
    setError(null);

    try {
      const nextMessages = await ChatService.getConversation(userId);
      setMessages(nextMessages);
      return nextMessages;
    } catch (loadError) {
      setError(loadError?.message || 'Gagal memuat percakapan.');
      throw loadError;
    } finally {
      setIsLoadingMessages(false);
    }
  }, []);

  /**
   * Send one chat message and optimistically append the returned payload to local state.
   */
  const sendMessage = useCallback(async (payload) => {
    setIsSendingMessage(true);
    setError(null);

    try {
      const sentMessage = await ChatService.sendMessage(payload);
      setMessages((currentMessages) => [...currentMessages, sentMessage]);
      return sentMessage;
    } catch (sendError) {
      setError(sendError?.message || 'Gagal mengirim pesan.');
      throw sendError;
    } finally {
      setIsSendingMessage(false);
    }
  }, []);

  return {
    threads,
    contacts,
    messages,
    isLoadingThreads,
    isLoadingContacts,
    isLoadingMessages,
    isSendingMessage,
    error,
    loadThreads,
    loadContacts,
    loadConversation,
    sendMessage,
  };
};

export default useChat;

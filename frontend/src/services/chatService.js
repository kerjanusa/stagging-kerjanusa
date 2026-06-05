import apiClient from '../utils/apiClient.js';
import { shouldUseMockData } from '../utils/mockMode.js';

const MOCK_CHAT_STORAGE_KEY = 'mock_chat_messages';
const MOCK_USERS_STORAGE_KEY = 'mock_auth_users';
const MOCK_APPLICATIONS_STORAGE_KEY = 'mock_job_applications';
const MOCK_JOBS_STORAGE_KEY = 'mock_jobs';

/**
 * Read and parse JSON from local storage while returning a safe fallback on failure.
 */
const readStoredJson = (storageKey, fallbackValue) => {
  try {
    const rawValue = localStorage.getItem(storageKey);
    return rawValue ? JSON.parse(rawValue) : fallbackValue;
  } catch {
    return fallbackValue;
  }
};

/**
 * Load the current authenticated user from browser storage for mock chat flows.
 */
const getCurrentUser = () => {
  try {
    return JSON.parse(localStorage.getItem('user') || 'null');
  } catch {
    return null;
  }
};

/**
 * Load mock users available to the demo chat layer.
 */
const getMockUsers = () => readStoredJson(MOCK_USERS_STORAGE_KEY, []);
/**
 * Load mock applications used to validate candidate-recruiter chat access.
 */
const getMockApplications = () => readStoredJson(MOCK_APPLICATIONS_STORAGE_KEY, []);
/**
 * Load mock jobs used to resolve chat job context and recruiter ownership.
 */
const getMockJobs = () => readStoredJson(MOCK_JOBS_STORAGE_KEY, []);

/**
 * Load demo chat messages or seed a small starter conversation set.
 */
const getMockMessages = () => {
  const storedMessages = readStoredJson(MOCK_CHAT_STORAGE_KEY, null);

  if (Array.isArray(storedMessages)) {
    return storedMessages;
  }

  const seedMessages = [
    {
      id: 1,
      sender_id: 3,
      recipient_id: 1,
      body: 'Silakan pastikan profil company dan lowongan aktif Anda sudah lengkap.',
      job_id: null,
      read_at: null,
      created_at: new Date(Date.now() - 86400000).toISOString(),
    },
    {
      id: 2,
      sender_id: 1,
      recipient_id: 2,
      body: 'Kami tertarik dengan profil Anda. Mohon cek jadwal screening di dashboard.',
      job_id: 8,
      read_at: null,
      created_at: new Date(Date.now() - 3600000).toISOString(),
    },
  ];

  localStorage.setItem(MOCK_CHAT_STORAGE_KEY, JSON.stringify(seedMessages));
  return seedMessages;
};

/**
 * Persist the full mock chat history to browser storage.
 */
const saveMockMessages = (messages) => {
  localStorage.setItem(MOCK_CHAT_STORAGE_KEY, JSON.stringify(messages));
};

/**
 * Reduce a user record to the public shape needed by chat payloads.
 */
const presentUser = (user) => {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    name: user.name,
    role: user.role,
    email: user.email,
    company_name: user.company_name,
  };
};

const getCandidateFacingContactSearchLabel = (contact) => {
  if (!contact) {
    return '';
  }

  if (contact.role === 'superadmin') {
    return String(contact.company_name || 'KerjaNusa').trim();
  }

  if (contact.role === 'recruiter') {
    return String(contact.company_name || 'Perusahaan Recruiter').trim();
  }

  return String(contact.company_name || contact.name || '').trim();
};

/**
 * Decide whether two demo users are allowed to communicate in chat.
 */
const canCommunicateMock = (currentUser, counterpart) => {
  if (!currentUser || !counterpart || Number(currentUser.id) === Number(counterpart.id)) {
    return false;
  }

  if (currentUser.role === 'superadmin' || counterpart.role === 'superadmin') {
    return true;
  }

  const applications = getMockApplications();
  const jobs = getMockJobs();

  if (currentUser.role === 'recruiter' && counterpart.role === 'candidate') {
    const recruiterJobIds = jobs
      .filter((job) => Number(job.recruiter_id) === Number(currentUser.id))
      .map((job) => Number(job.id));

    return applications.some(
      (application) =>
        Number(application.candidate_id) === Number(counterpart.id) &&
        recruiterJobIds.includes(Number(application.job_id))
    );
  }

  if (currentUser.role === 'candidate' && counterpart.role === 'recruiter') {
    return applications.some((application) => {
      if (Number(application.candidate_id) !== Number(currentUser.id)) {
        return false;
      }

      const relatedJob = jobs.find((job) => Number(job.id) === Number(application.job_id));
      return Number(relatedJob?.recruiter_id) === Number(counterpart.id);
    });
  }

  return false;
};

/**
 * Convert a raw mock message into the API-style payload consumed by the chat UI.
 */
const presentMessage = (message, currentUser) => {
  const users = getMockUsers();
  const jobs = getMockJobs();
  const sender = users.find((user) => Number(user.id) === Number(message.sender_id));
  const recipient = users.find((user) => Number(user.id) === Number(message.recipient_id));
  const job = jobs.find((item) => Number(item.id) === Number(message.job_id));

  return {
    id: message.id,
    body: message.body,
    created_at: message.created_at,
    read_at: message.read_at,
    is_mine: Number(message.sender_id) === Number(currentUser?.id),
    sender: presentUser(sender),
    recipient: presentUser(recipient),
    job: job
      ? {
          id: job.id,
          title: job.title,
        }
      : null,
  };
};

class ChatService {
  /**
   * Return grouped conversation threads for the current user.
   */
  static async getThreads() {
    if (shouldUseMockData) {
      const currentUser = getCurrentUser();
      const users = getMockUsers();
      const messages = getMockMessages()
        .filter(
          (message) =>
            Number(message.sender_id) === Number(currentUser?.id) ||
            Number(message.recipient_id) === Number(currentUser?.id)
        )
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      const threadMap = new Map();

      messages.forEach((message) => {
        const counterpartId =
          Number(message.sender_id) === Number(currentUser?.id)
            ? Number(message.recipient_id)
            : Number(message.sender_id);

        if (threadMap.has(counterpartId)) {
          return;
        }

        const counterpart = users.find((user) => Number(user.id) === counterpartId);
        const unreadCount = messages.filter(
          (item) =>
            Number(item.sender_id) === counterpartId &&
            Number(item.recipient_id) === Number(currentUser?.id) &&
            !item.read_at
        ).length;

        threadMap.set(counterpartId, {
          contact: presentUser(counterpart),
          last_message: message.body,
          updated_at: message.created_at,
          unread_count: unreadCount,
          message_count: messages.filter(
            (item) =>
              Number(item.sender_id) === counterpartId ||
              Number(item.recipient_id) === counterpartId
          ).length,
        });
      });

      return Array.from(threadMap.values());
    }

    try {
      const response = await apiClient.get('/chat/threads');
      return response.data.data || [];
    } catch (error) {
      throw error.response?.data || error.message;
    }
  }

  /**
   * Return all messageable contacts, optionally filtered by a search term.
   */
  static async getContacts(search = '') {
    if (shouldUseMockData) {
      const currentUser = getCurrentUser();
      const normalizedSearch = search.trim().toLowerCase();
      const contacts = getMockUsers()
        .filter((user) => user.account_status !== 'suspended')
        .filter((user) => canCommunicateMock(currentUser, user))
        .filter((user) => {
          if (!normalizedSearch) {
            return true;
          }

          const haystack =
            currentUser?.role === 'candidate'
              ? getCandidateFacingContactSearchLabel(user).toLowerCase()
              : [user.name, user.company_name, user.email].filter(Boolean).join(' ').toLowerCase();

          return haystack.includes(normalizedSearch);
        })
        .map(presentUser);

      return contacts;
    }

    try {
      const params = search.trim() ? `?search=${encodeURIComponent(search.trim())}` : '';
      const response = await apiClient.get(`/chat/contacts${params}`);
      return response.data.data || [];
    } catch (error) {
      throw error.response?.data || error.message;
    }
  }

  /**
   * Return the conversation history with one counterpart and mark inbound messages as read.
   */
  static async getConversation(userId) {
    if (shouldUseMockData) {
      const currentUser = getCurrentUser();
      const nextMessages = getMockMessages().map((message) =>
        Number(message.sender_id) === Number(userId) &&
        Number(message.recipient_id) === Number(currentUser?.id)
          ? { ...message, read_at: message.read_at || new Date().toISOString() }
          : message
      );

      saveMockMessages(nextMessages);

      return nextMessages
        .filter(
          (message) =>
            (Number(message.sender_id) === Number(currentUser?.id) &&
              Number(message.recipient_id) === Number(userId)) ||
            (Number(message.sender_id) === Number(userId) &&
              Number(message.recipient_id) === Number(currentUser?.id))
        )
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        .map((message) => presentMessage(message, currentUser));
    }

    try {
      const response = await apiClient.get(`/chat/conversations/${userId}`);
      return response.data.data || [];
    } catch (error) {
      throw error.response?.data || error.message;
    }
  }

  /**
   * Send one outbound message using either mock storage or the live chat endpoint.
   */
  static async sendMessage(payload) {
    if (shouldUseMockData) {
      const currentUser = getCurrentUser();
      const counterpart = getMockUsers().find(
        (user) => Number(user.id) === Number(payload.recipient_id)
      );

      if (!canCommunicateMock(currentUser, counterpart)) {
        throw { message: 'Kontak ini belum bisa dihubungi dari akun Anda.' };
      }

      const messages = getMockMessages();
      const nextMessage = {
        id: messages.reduce((largestId, message) => Math.max(largestId, message.id), 0) + 1,
        sender_id: Number(currentUser?.id),
        recipient_id: Number(payload.recipient_id),
        body: payload.body,
        job_id: payload.job_id ? Number(payload.job_id) : null,
        read_at: null,
        created_at: new Date().toISOString(),
      };

      saveMockMessages([...messages, nextMessage]);
      return presentMessage(nextMessage, currentUser);
    }

    try {
      const response = await apiClient.post('/chat/messages', payload);
      return response.data.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  }
}

export default ChatService;

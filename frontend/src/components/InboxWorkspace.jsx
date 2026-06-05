import { useEffect, useRef } from 'react';
import '../styles/workspace.css';
import '../styles/collaboration.css';

/**
 * Memformat timestamp pesan menjadi label waktu singkat yang nyaman dibaca di inbox.
 */
const formatMessageTime = (value) => {
  if (!value) {
    return '-';
  }

  try {
    return new Date(value).toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '-';
  }
};

/**
 * Menormalkan string label supaya tampilan thread dan kontak tidak membawa spasi berlebih.
 */
const normalizeLabelText = (value) => String(value || '').trim();

/**
 * Mengambil bagian depan email sebagai fallback label kontak.
 */
const getEmailAlias = (value) => {
  const normalizedEmail = normalizeLabelText(value);

  if (!normalizedEmail.includes('@')) {
    return normalizedEmail;
  }

  return normalizedEmail.split('@')[0];
};

/**
 * Menentukan nama utama yang ditampilkan untuk thread atau kontak berdasarkan role yang aktif.
 */
const resolveContactLabel = (contact, companyFirstContacts = false) => {
  if (!contact) {
    return 'Kontak';
  }

  const normalizedName = normalizeLabelText(contact.name);
  const normalizedCompany = normalizeLabelText(contact.company_name);
  const normalizedEmailAlias = getEmailAlias(contact.email);

  if (companyFirstContacts) {
    if (contact.role === 'superadmin') {
      return normalizedCompany || 'KerjaNusa';
    }

    if (contact.role === 'recruiter') {
      return normalizedCompany || 'Perusahaan Recruiter';
    }

    return normalizedCompany || normalizedName || `Kontak #${contact.id || '-'}`;
  }

  if (contact.role === 'recruiter') {
    return (
      normalizedCompany ||
      normalizedName ||
      normalizedEmailAlias ||
      `Recruiter #${contact.id || '-'}`
    );
  }

  if (contact.role === 'superadmin') {
    return 'Superadmin KerjaNusa';
  }

  return normalizedName || normalizedCompany || normalizedEmailAlias || `Pelamar #${contact.id || '-'}`;
};

/**
 * Menentukan teks pendamping kontak seperti email atau label akun cadangan.
 */
const resolveContactSecondaryText = (contact, companyFirstContacts = false) => {
  if (!contact) {
    return 'Kontak belum tersedia.';
  }

  const normalizedEmail = normalizeLabelText(contact.email);
  const normalizedName = normalizeLabelText(contact.name);
  const normalizedCompany = normalizeLabelText(contact.company_name);

  if (companyFirstContacts) {
    if (contact.role === 'superadmin') {
      return 'Layanan platform KerjaNusa';
    }

    if (contact.role === 'recruiter') {
      return normalizedCompany
        ? 'Perusahaan recruiter'
        : 'Profil perusahaan recruiter belum dilengkapi';
    }

    return normalizedCompany || 'Kontak perusahaan';
  }

  if (normalizedEmail) {
    return normalizedEmail;
  }

  if (contact.role === 'recruiter') {
    return normalizedName || `Akun recruiter #${contact.id || '-'}`;
  }

  if (contact.role === 'superadmin') {
    return 'Akun superadmin';
  }

  return normalizedCompany || `Akun pelamar #${contact.id || '-'}`;
};

/**
 * Menyediakan layout inbox generik untuk thread, daftar kontak, dan panel percakapan.
 */
const InboxWorkspace = ({
  title,
  description,
  threads,
  contacts,
  selectedContact,
  selectedContactId,
  messages,
  draftMessage,
  onDraftMessageChange,
  contactSearchQuery,
  onContactSearchQueryChange,
  onSelectContact,
  onSendMessage,
  isLoadingThreads,
  isLoadingContacts,
  isLoadingMessages,
  isSendingMessage,
  compactLayout = false,
  companyFirstContacts = false,
  emptyMessage = 'Pilih percakapan untuk mulai berdiskusi.',
}) => {
  const messageListRef = useRef(null);
  const hasSelectedConversation = Boolean(selectedContactId);
  const normalizedSearchQuery = normalizeLabelText(contactSearchQuery);
  const showContactSuggestions = normalizedSearchQuery.length > 0 && !isLoadingContacts;
  const contactSuggestions = showContactSuggestions ? contacts.slice(0, 5) : [];

  useEffect(() => {
    if (!selectedContactId || !messageListRef.current) {
      return;
    }

    const nextFrame = window.requestAnimationFrame(() => {
      messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
    });

    return () => window.cancelAnimationFrame(nextFrame);
  }, [messages, selectedContactId]);

  /**
   * Mengirim draft pesan aktif dari form chat ketika penerima sudah dipilih.
   */
  const handleSubmit = (event) => {
    event.preventDefault();

    if (!selectedContactId || !draftMessage.trim()) {
      return;
    }

    onSendMessage?.();
  };

  /**
   * Membuka percakapan dari hasil pencarian dan opsional membersihkan query agar dropdown menutup.
   */
  const handleSelectContact = (contact, clearSearch = false) => {
    onSelectContact?.(contact);

    if (clearSearch) {
      onContactSearchQueryChange?.('');
    }
  };

  return (
    <section
      className={`workspace-section-stack${
        compactLayout ? ' collaboration-workspace-app' : ''
      }`}
    >
      {!compactLayout && (
        <article className="workspace-panel" data-reveal>
          <div className="workspace-panel-heading">
            <div>
              <span className="workspace-section-label">Komunikasi</span>
              <h2>{title}</h2>
            </div>
            <p>{description}</p>
          </div>
        </article>
      )}

      <div className={`collaboration-grid${compactLayout ? ' is-app-layout' : ''}`}>
        <article className="workspace-panel collaboration-sidebar" data-reveal data-reveal-delay="50ms">
          <div className="collaboration-sidebar-block">
            <div className="collaboration-sidebar-header">
              <strong>Thread Terbaru</strong>
              <span>{threads.length}</span>
            </div>
            {isLoadingThreads ? (
              <p className="workspace-muted-text">Memuat percakapan...</p>
            ) : threads.length === 0 ? (
              <p className="workspace-muted-text">Belum ada percakapan aktif.</p>
            ) : (
              <div className="collaboration-thread-list">
                {threads.map((thread) => (
                  <button
                    key={`thread-${thread.contact?.id}`}
                    type="button"
                    className={`collaboration-thread-card${
                      Number(selectedContactId) === Number(thread.contact?.id) ? ' is-active' : ''
                    }`}
                    onClick={() => handleSelectContact(thread.contact)}
                  >
                    <div className="collaboration-thread-card-top">
                      <strong className="collaboration-card-title">
                        {resolveContactLabel(thread.contact, companyFirstContacts)}
                      </strong>
                      <span className="collaboration-card-timestamp">
                        {formatMessageTime(thread.updated_at)}
                      </span>
                    </div>
                    <p className="collaboration-card-preview">
                      {normalizeLabelText(thread.last_message) || 'Belum ada ringkasan pesan.'}
                    </p>
                    <small className="collaboration-card-caption">
                      {thread.unread_count > 0
                        ? `${thread.unread_count} pesan belum dibaca`
                        : 'Sudah terbaca'}
                    </small>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="collaboration-sidebar-block">
            <div className="collaboration-sidebar-header">
              <strong>Kontak yang Bisa Dihubungi</strong>
              <span>{contacts.length}</span>
            </div>
            <input
              type="search"
              name="contact-search"
              className="collaboration-search"
              placeholder={
                companyFirstContacts
                  ? 'Cari nama perusahaan atau KerjaNusa...'
                  : 'Cari recruiter, perusahaan, atau superadmin...'
              }
              value={contactSearchQuery}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck="false"
              onChange={(event) => onContactSearchQueryChange?.(event.target.value)}
            />

            {showContactSuggestions && (
              <div className="collaboration-search-suggestions" role="listbox">
                {contactSuggestions.length === 0 ? (
                  <p className="collaboration-search-empty">
                    {companyFirstContacts
                      ? 'Tidak ada perusahaan yang cocok.'
                      : 'Tidak ada kontak yang cocok.'}
                  </p>
                ) : (
                  contactSuggestions.map((contact) => (
                    <button
                      key={`contact-suggestion-${contact.id}`}
                      type="button"
                      className="collaboration-search-suggestion"
                      onClick={() => handleSelectContact(contact, true)}
                    >
                      <strong>{resolveContactLabel(contact, companyFirstContacts)}</strong>
                      <span>{resolveContactSecondaryText(contact, companyFirstContacts)}</span>
                    </button>
                  ))
                )}
              </div>
            )}

            {isLoadingContacts ? (
              <p className="workspace-muted-text">Memuat kontak...</p>
            ) : contacts.length === 0 ? (
              <p className="workspace-muted-text">Belum ada kontak yang tersedia.</p>
            ) : (
              <div className="collaboration-contact-list">
                {contacts.map((contact) => (
                  <button
                    key={`contact-${contact.id}`}
                    type="button"
                    className={`collaboration-contact-chip${
                      compactLayout ? ' is-label-only' : ''
                    }${
                      Number(selectedContactId) === Number(contact.id) ? ' is-active' : ''
                    }`}
                    onClick={() => handleSelectContact(contact)}
                    title={resolveContactLabel(contact, companyFirstContacts)}
                  >
                    {compactLayout ? (
                      <strong className="collaboration-contact-label">
                        {resolveContactLabel(contact, companyFirstContacts)}
                      </strong>
                    ) : (
                      <>
                        <strong className="collaboration-card-title">
                          {resolveContactLabel(contact, companyFirstContacts)}
                        </strong>
                        <span className="collaboration-card-email">
                          {resolveContactSecondaryText(contact, companyFirstContacts)}
                        </span>
                      </>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </article>

        <article
          className={`workspace-panel collaboration-chat-panel${
            hasSelectedConversation ? ' has-conversation' : ''
          }`}
          data-reveal
          data-reveal-delay="110ms"
        >
          <div className="collaboration-chat-header">
            <div>
              <span className="workspace-section-label">Percakapan</span>
              <h2>{resolveContactLabel(selectedContact, companyFirstContacts)}</h2>
            </div>
            {selectedContact ? (
              <p className="collaboration-chat-contact-meta">
                {resolveContactSecondaryText(selectedContact, companyFirstContacts)}
              </p>
            ) : (
              <p className="collaboration-chat-contact-meta is-placeholder">
                Pilih percakapan untuk mulai menangani pesan masuk.
              </p>
            )}
          </div>

          <div
            className={`collaboration-message-list${
              hasSelectedConversation ? ' has-conversation' : ''
            }`}
            ref={messageListRef}
          >
            {!selectedContactId ? (
              <div className="collaboration-empty-state">
                <p>{emptyMessage}</p>
              </div>
            ) : isLoadingMessages ? (
              <div className="collaboration-empty-state">
                <p>Memuat isi percakapan...</p>
              </div>
            ) : messages.length === 0 ? (
              <div className="collaboration-empty-state">
                <p>Belum ada pesan. Mulai percakapan dari panel bawah.</p>
              </div>
            ) : (
              messages.map((message) => (
                <article
                  key={message.id}
                  className={`collaboration-message-bubble${
                    message.is_mine ? ' is-mine' : ' is-theirs'
                  }`}
                >
                  <div className="collaboration-message-meta">
                    <strong>
                      {message.is_mine
                        ? 'Anda'
                        : resolveContactLabel(message.sender, companyFirstContacts)}
                    </strong>
                    <span>{formatMessageTime(message.created_at)}</span>
                  </div>
                  {message.job?.title && (
                    <small className="collaboration-message-job">{message.job.title}</small>
                  )}
                  <p>{message.body}</p>
                </article>
              ))
            )}
          </div>

          <form className="collaboration-composer" onSubmit={handleSubmit}>
            <textarea
              rows="4"
              placeholder={
                selectedContactId
                  ? 'Tulis pesan ke kontak ini...'
                  : 'Pilih kontak terlebih dahulu sebelum mengirim pesan.'
              }
              value={draftMessage}
              onChange={(event) => onDraftMessageChange?.(event.target.value)}
              disabled={!selectedContactId || isSendingMessage}
            />
            <div className="collaboration-composer-actions">
              <small>
                Chat ini dipakai untuk koordinasi registrasi, screening, dan tindak lanjut hiring.
              </small>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={!selectedContactId || !draftMessage.trim() || isSendingMessage}
              >
                {isSendingMessage ? 'Mengirim...' : 'Kirim Pesan'}
              </button>
            </div>
          </form>
        </article>
      </div>
    </section>
  );
};

export default InboxWorkspace;

import React, { useMemo, useRef, useState } from "react";
import { Virtuoso } from "react-virtuoso";
import {
  Archive,
  AudioLines,
  Check,
  ChevronLeft,
  FileText,
  Image as ImageIcon,
  MessageCircle,
  Paperclip,
  Play,
  Search,
  Upload,
  Video,
  X,
  ZoomIn
} from "lucide-react";
import { buildMediaMap, findMedia, parseWhatsAppText } from "./parser";

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}

function formatTime(message) {
  return message.time?.replace(/:00(?=\s*(?:am|pm)?$)/i, "") || "";
}

function formatDate(message) {
  if (!message.timestamp) return message.date;
  return message.timestamp.toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric"
  });
}

function detectTitle(files, parsed) {
  const txt = files.find(f => f.name.toLowerCase().endsWith(".txt"));
  if (txt) {
    const base = txt.name.replace(/\.[^.]+$/, "").replace(/[_-]?chat$/i, "");
    if (base && base !== "whatsapp") return base.replace(/[_-]+/g, " ");
  }
  return parsed.participants.slice(0, 3).join(", ") || "WhatsApp Chat";
}

function MediaContent({ message, mediaMap, onImage }) {
  const file = findMedia(mediaMap, message.attachmentName);
  const [url, setUrl] = React.useState(null);

  React.useEffect(() => {
    if (!file) {
      setUrl(null);
      return undefined;
    }
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  if (!file) {
    return (
      <div className="media-missing">
        <Paperclip size={16} />
        <span>{message.attachmentName || "Media omitted"}</span>
      </div>
    );
  }

  const type = message.attachmentType;
  if (!url) return <div className="media-loading">Loading media…</div>;

  if (type === "image") {
    return (
      <button className="image-wrap" onClick={() => onImage(url, file.name)}>
        <img src={url} alt={file.name} loading="lazy" />
        <span className="zoom-badge"><ZoomIn size={14} /></span>
      </button>
    );
  }

  if (type === "video") {
    return <video className="chat-video" controls preload="metadata" src={url} />;
  }

  if (type === "audio") {
    return (
      <div className="audio-card">
        <AudioLines size={20} />
        <div className="audio-meta">
          <strong>{file.name}</strong>
          <small>{formatBytes(file.size)}</small>
        </div>
        <audio controls preload="metadata" src={url} />
      </div>
    );
  }

  return (
    <a className="file-card" href={url} download={file.name}>
      <FileText size={22} />
      <span>
        <strong>{file.name}</strong>
        <small>{formatBytes(file.size)}</small>
      </span>
    </a>
  );
}

function MessageBubble({ message, own, mediaMap, onImage }) {
  if (message.isSystem) {
    return <div className="system-message">{message.text}</div>;
  }

  const isMediaOnly = message.attachmentType && (
    !message.text ||
    message.text.trim().toLowerCase() === "<media omitted>" ||
    message.text.toLowerCase().startsWith("<attached:")
  );

  return (
    <div className={`message-row ${own ? "own" : ""}`}>
      <article className={`bubble ${own ? "bubble-own" : "bubble-other"}`}>
        {!own && <div className="author">{message.author || "Unknown"}</div>}
        {message.attachmentType && (
          <MediaContent message={message} mediaMap={mediaMap} onImage={onImage} />
        )}
        {!isMediaOnly && (
          <div className="message-text">{message.text}</div>
        )}
        <div className="message-meta">
          <span>{formatTime(message)}</span>
          {own && <Check size={13} className="checks" />}
        </div>
      </article>
    </div>
  );
}

function DropZone({ onFiles }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  const acceptFiles = (fileList) => {
    const files = Array.from(fileList || []);
    if (files.length) onFiles(files);
  };

  return (
    <main
      className={`drop-zone ${dragging ? "dragging" : ""}`}
      onDragEnter={(e) => { e.preventDefault(); setDragging(true); }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setDragging(false); }}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        acceptFiles(e.dataTransfer.files);
      }}
      onClick={() => inputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".zip,.txt,text/plain,application/zip"
        multiple
        hidden
        onChange={(e) => acceptFiles(e.target.files)}
      />
      <div className="drop-icon"><Upload size={30} /></div>
      <h1>WhatsApp Chat Viewer</h1>
      <p>Drop an exported <b>.zip</b> or <b>.txt</b> chat here</p>
      <span className="drop-hint">ZIP exports can include photos, videos, audio and documents.</span>
      <div className="privacy-pill">Everything is processed locally in your browser</div>
    </main>
  );
}

function ChatHeader({ title, messages, participants, sender, onTogglePov, onClose, onSearch }) {
  const first = messages.find(m => m.author);
  return (
    <header className="chat-header">
      <button className="icon-button mobile-back" onClick={onClose} aria-label="Back">
        <ChevronLeft size={21} />
      </button>
      <div className="avatar"><MessageCircle size={21} /></div>
      <div className="header-info">
        <strong>{title}</strong>
        <span>{messages.length.toLocaleString()} messages</span>
      </div>
      <button
        className="pov-toggle"
        onClick={onTogglePov}
        aria-label="Switch chat point of view"
        title="Switch sender / receiver POV"
      >
        <span className="pov-label">POV</span>
        <span className="pov-name">{sender || participants[0] || "Sender"}</span>
        <span className="pov-switch">↔</span>
      </button>
      <button className="icon-button" onClick={onSearch} aria-label="Search">
        <Search size={19} />
      </button>
      <button className="icon-button" onClick={onClose} aria-label="Close chat">
        <X size={19} />
      </button>
    </header>
  );
}

function App() {
  const [chat, setChat] = useState(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [lightbox, setLightbox] = useState(null);
  const [sender, setSender] = useState(null);

  const loadFiles = async (inputFiles) => {
    setError("");
    try {
      let txtFile = inputFiles.find(f => f.name.toLowerCase().endsWith(".txt"));
      let mediaFiles = inputFiles.filter(f => !f.name.toLowerCase().endsWith(".txt") && !f.name.toLowerCase().endsWith(".zip"));

      const zip = inputFiles.find(f => f.name.toLowerCase().endsWith(".zip"));
      if (zip) {
        // JSZip is used for reliable client-side ZIP support across browsers.
        const { default: JSZip } = await import("jszip");
        const archive = await JSZip.loadAsync(zip);
        for (const entry of Object.values(archive.files)) {
          if (!entry.dir) {
            const blob = await entry.async("blob");
            const file = new File([blob], entry.name.split("/").pop(), { type: blob.type || "" });
            if (file.name.toLowerCase().endsWith(".txt") && !txtFile) txtFile = file;
            else mediaFiles.push(file);
          }
        }
      }

      if (!txtFile) throw new Error("No .txt chat export was found.");
      const raw = await txtFile.text();
      const parsed = parseWhatsAppText(raw);
      if (!parsed.messages.length) {
        throw new Error("The file was read, but no WhatsApp-style messages were detected.");
      }

      setChat({
        ...parsed,
        title: detectTitle([txtFile, ...mediaFiles], parsed),
        mediaMap: buildMediaMap(mediaFiles),
        rawSize: txtFile.size,
        sourceName: txtFile.name
      });
      setSearch("");
      setSender(parsed.participants[0] || null);
    } catch (err) {
      console.error(err);
      setError(err.message || "Could not read this export.");
    }
  };

  const filteredMessages = useMemo(() => {
    if (!chat) return [];
    const query = search.trim().toLowerCase();
    if (!query) return chat.messages;
    return chat.messages.filter(m =>
      [m.author, m.text, m.attachmentName].filter(Boolean).some(v => v.toLowerCase().includes(query))
    );
  }, [chat, search]);

  if (!chat) {
    return (
      <div className="app-shell landing">
        <DropZone onFiles={loadFiles} />
        {error && <div className="error-toast">{error}</div>}
      </div>
    );
  }

  return (
    <div className="app-shell">
      <div className="viewer">
        <ChatHeader
          title={chat.title}
          messages={chat.messages}
          participants={chat.participants}
          sender={sender}
          onTogglePov={() => {
            if (chat.participants.length > 1) {
              setSender(current => {
                const index = chat.participants.indexOf(current);
                return chat.participants[(index + 1) % chat.participants.length];
              });
            }
          }}
          onClose={() => setChat(null)}
          onSearch={() => document.querySelector(".search-input")?.focus()}
        />
        <div className="toolbar">
          <div className="search-box">
            <Search size={16} />
            <input
              className="search-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search messages…"
            />
            {search && <button onClick={() => setSearch("")}><X size={15} /></button>}
          </div>
          <span className="result-count">
            {search ? `${filteredMessages.length.toLocaleString()} matches` : `${formatBytes(chat.rawSize)} text`}
          </span>
        </div>

        <div className="chat-canvas">
          <div className="chat-pattern" />
          <Virtuoso
            className="message-list"
            data={filteredMessages}
            initialTopMostItemIndex={Math.max(0, filteredMessages.length - 1)}
            followOutput="auto"
            itemContent={(_, message) => {
              const previous = filteredMessages[_ - 1];
              const showDate = !previous || formatDate(previous) !== formatDate(message);
              const own = message.author === sender;
              return (
                <React.Fragment key={message.id}>
                  {showDate && <div className="date-divider"><span>{formatDate(message)}</span></div>}
                  <MessageBubble
                    message={message}
                    own={own}
                    mediaMap={chat.mediaMap}
                    onImage={(url, name) => setLightbox({ url, name })}
                  />
                </React.Fragment>
              );
            }}
          />
        </div>

        <footer className="status-bar">
          <span><Archive size={14} /> {chat.sourceName}</span>
          <span>{chat.participants.length} participant{chat.participants.length === 1 ? "" : "s"}</span>
        </footer>
      </div>

      {lightbox && (
        <div className="lightbox" onClick={() => setLightbox(null)}>
          <button className="lightbox-close" onClick={() => setLightbox(null)}><X /></button>
          <img src={lightbox.url} alt={lightbox.name} onClick={e => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}

export default App;
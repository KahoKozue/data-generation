import React, { useState } from 'react';

interface RenderedViewProps {
  data: any;
}

const ChatList: React.FC<{ messages: any[] }> = ({ messages }) => {
  if (!messages || messages.length === 0) {
    return <div className="empty-state">此視圖無資料</div>;
  }
  return (
    <>
      {messages.map((msg, idx) => {
        const senderName = msg.from?.user?.displayName || "Unknown User";
        const content = msg.body?.content || "";
        const time = msg.createdDateTime ? new Date(msg.createdDateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "";

        return (
          <div key={idx} className="message-item">
            <div className="avatar">{senderName.charAt(0)}</div>
            <div className="message-content">
              <div className="message-header">
                <span className="sender-name">{senderName}</span>
                <span className="timestamp">{time}</span>
              </div>
              <div className="message-body" dangerouslySetInnerHTML={{ __html: content }} />
            </div>
          </div>
        );
      })}
    </>
  );
};

export const RenderedView: React.FC<RenderedViewProps> = ({ data }) => {
  const [viewMode, setViewMode] = useState<'malicious' | 'benign'>('malicious');

  if (!data) {
    return <div className="empty-state">沒有產生完的對話</div>;
  }

  // Detect Data Structure
  const isPaired = !Array.isArray(data) && data.malicious && data.benign;

  // Normalize to list to render
  let messagesToRender: any[] = [];
  if (isPaired) {
    messagesToRender = viewMode === 'malicious' ? data.malicious : data.benign;
  } else if (Array.isArray(data)) {
    messagesToRender = data;
  } else {
    // Single object output or unknown structure
    return <div className="empty-state">無法解析的資料結構</div>;
  }

  return (
    <div className="teams-container">
      {isPaired && (
        <div className="view-toggle">
          <button
            className={`toggle-btn ${viewMode === 'malicious' ? 'active' : ''}`}
            onClick={() => setViewMode('malicious')}
          >
            惡意意圖 (Malicious)
          </button>
          <button
            className={`toggle-btn ${viewMode === 'benign' ? 'active' : ''}`}
            onClick={() => setViewMode('benign')}
          >
            良性意圖 (Benign)
          </button>
        </div>
      )}

      <ChatList messages={messagesToRender} />

      <style>{`
        .teams-container {
          padding: 0;
          background: #1f1f1f;
          height: 100%;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .empty-state {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
          color: var(--text-secondary);
        }
        .view-toggle {
            display: flex;
            gap: 10px;
            margin: 12px 12px 8px 12px;
            background: rgba(255,255,255,0.05);
            padding: 6px;
            border-radius: 6px;
        }
        .toggle-btn {
            flex: 1;
            background: transparent;
            border: none;
            color: var(--text-secondary);
            padding: 8px;
            cursor: pointer;
            border-radius: 4px;
            font-size: 13px;
        }
        .toggle-btn.active {
            background: var(--accent-color);
            color: white;
        }
        .message-item {
          display: flex;
          gap: 10px;
          padding: 10px 12px;
        }
        .avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: #5b5fc7;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          font-weight: 600;
          flex-shrink: 0;
        }
        .message-content {
          display: flex;
          flex-direction: column;
          gap: 2px;
          max-width: 80%;
        }
        .message-header {
          display: flex;
          align-items: baseline;
          gap: 8px;
        }
        .sender-name {
          font-weight: 600;
          color: #e1e1e1;
          font-size: 13px;
        }
        .timestamp {
          font-size: 11px;
          color: #888;
        }
        .message-body {
          color: #d1d1d1;
          font-size: 14px;
          line-height: 1.4;
        }
        .message-body p {
          margin: 0;
        }
      `}</style>
    </div>
  );
};

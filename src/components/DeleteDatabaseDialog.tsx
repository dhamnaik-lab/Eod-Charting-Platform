import { useState } from 'react';
import { getDesktopApi } from '@/platform';
import { useChartStore } from '@/store/chartStore';

interface DeleteDatabaseDialogProps {
  onClose: () => void;
}

export function DeleteDatabaseDialog({ onClose }: DeleteDatabaseDialogProps) {
  const snapshot = useChartStore((state) => state.snapshot);
  const closeDatabase = useChartStore((state) => state.closeDatabase);
  const api = getDesktopApi();
  const [selectedDatabases, setSelectedDatabases] = useState<Set<string>>(new Set());
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const knownDatabases = snapshot?.knownDatabases ?? [];

  const toggleDatabase = (path: string) => {
    setSelectedDatabases((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const handleDelete = async () => {
    if (!api || selectedDatabases.size === 0) return;
    if (confirmText !== 'DELETE') return;

    setIsDeleting(true);
    try {
      for (const dbPath of selectedDatabases) {
        await api.deleteDatabase(dbPath);
        if (snapshot?.activeDatabasePath === dbPath) {
          closeDatabase();
        }
      }
      onClose();
    } catch (error) {
      console.error('Failed to delete databases:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div style={overlayStyle}>
      <div style={windowStyle}>
        <div style={headerStyle}>
          <h2 style={titleStyle}>Delete Databases</h2>
          <button style={closeButtonStyle} onClick={onClose}>×</button>
        </div>

        <div style={contentStyle}>
          <p style={warningStyle}>
            ⚠️ This action cannot be undone. All selected databases and their data will be permanently deleted.
          </p>

          <div style={listStyle}>
            {knownDatabases.length === 0 ? (
              <div style={emptyStyle}>No databases found.</div>
            ) : (
              knownDatabases.map((db) => (
                <label key={db.path} style={itemStyle}>
                  <input
                    type="checkbox"
                    checked={selectedDatabases.has(db.path)}
                    onChange={() => toggleDatabase(db.path)}
                    style={checkboxStyle}
                  />
                  <div style={itemContentStyle}>
                    <div style={itemNameStyle}>{db.label}</div>
                    <div style={itemPathStyle}>{db.path}</div>
                  </div>
                </label>
              ))
            )}
          </div>

          {selectedDatabases.size > 0 && (
            <div style={confirmSectionStyle}>
              <p style={confirmLabelStyle}>
                Type <strong>DELETE</strong> to confirm deletion of {selectedDatabases.size} database(s):
              </p>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="Type DELETE"
                style={confirmInputStyle}
                disabled={isDeleting}
              />
            </div>
          )}
        </div>

        <div style={footerStyle}>
          <button
            style={cancelButtonStyle}
            onClick={onClose}
            disabled={isDeleting}
          >
            Cancel
          </button>
          <button
            style={{
              ...deleteButtonStyle,
              opacity: selectedDatabases.size === 0 || confirmText !== 'DELETE' || isDeleting ? 0.5 : 1,
              cursor: selectedDatabases.size === 0 || confirmText !== 'DELETE' || isDeleting ? 'not-allowed' : 'pointer',
            }}
            onClick={handleDelete}
            disabled={selectedDatabases.size === 0 || confirmText !== 'DELETE' || isDeleting}
          >
            {isDeleting ? 'Deleting...' : `Delete ${selectedDatabases.size} Database(s)`}
          </button>
        </div>
      </div>
    </div>
  );
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'var(--overlay-bg)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
};

const windowStyle: React.CSSProperties = {
  width: 500,
  maxHeight: '80vh',
  backgroundColor: 'var(--bg2)',
  borderRadius: 8,
  border: '1px solid var(--border)',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  boxShadow: 'var(--shadow-lg)',
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '12px 16px',
  borderBottom: '1px solid var(--border)',
  backgroundColor: 'var(--bg3)',
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 16,
  fontWeight: 600,
  color: 'var(--text)',
};

const closeButtonStyle: React.CSSProperties = {
  width: 28,
  height: 28,
  border: 'none',
  borderRadius: 4,
  backgroundColor: 'transparent',
  color: 'var(--text-dim)',
  fontSize: 20,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const contentStyle: React.CSSProperties = {
  flex: 1,
  padding: 16,
  overflow: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
};

const warningStyle: React.CSSProperties = {
  margin: 0,
  padding: '10px 12px',
  backgroundColor: 'var(--control-bg)',
  border: '1px solid var(--red)',
  borderRadius: 4,
  color: 'var(--red)',
  fontSize: 13,
  lineHeight: 1.5,
};

const listStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  maxHeight: 250,
  overflow: 'auto',
};

const emptyStyle: React.CSSProperties = {
  padding: 20,
  textAlign: 'center',
  color: 'var(--text-dim)',
  fontSize: 13,
};

const itemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 12,
  padding: '10px 12px',
  backgroundColor: 'var(--control-bg)',
  borderRadius: 4,
  border: '1px solid var(--border)',
  cursor: 'pointer',
};

const checkboxStyle: React.CSSProperties = {
  width: 18,
  height: 18,
  marginTop: 2,
  cursor: 'pointer',
};

const itemContentStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  flex: 1,
  minWidth: 0,
};

const itemNameStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 500,
  color: 'var(--text)',
};

const itemPathStyle: React.CSSProperties = {
  fontSize: 11,
  color: 'var(--text-dim)',
  wordBreak: 'break-all',
};

const confirmSectionStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
};

const confirmLabelStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 13,
  color: 'var(--text)',
};

const confirmInputStyle: React.CSSProperties = {
  height: 36,
  padding: '0 12px',
  border: '1px solid var(--border2)',
  borderRadius: 4,
  backgroundColor: 'var(--control-bg)',
  color: 'var(--text)',
  fontSize: 14,
};

const footerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 8,
  padding: '12px 16px',
  borderTop: '1px solid var(--border)',
  backgroundColor: 'var(--bg3)',
};

const cancelButtonStyle: React.CSSProperties = {
  height: 36,
  padding: '0 16px',
  border: '1px solid var(--border2)',
  borderRadius: 4,
  backgroundColor: 'transparent',
  color: 'var(--text)',
  fontSize: 13,
  cursor: 'pointer',
};

const deleteButtonStyle: React.CSSProperties = {
  height: 36,
  padding: '0 16px',
  border: '1px solid var(--red)',
  borderRadius: 4,
  backgroundColor: 'var(--red)',
  color: 'var(--text)',
  fontSize: 13,
  fontWeight: 500,
  cursor: 'pointer',
};

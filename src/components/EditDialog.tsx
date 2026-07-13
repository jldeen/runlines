import { useEffect, useState } from 'react';
import type { Beat, BeatEdit } from '../types';
import { Dialog } from './Dialog';

interface EditDialogProps {
  open: boolean;
  beat: Beat; // effective (already-edited) beat
  beatIndex: number;
  edited: boolean;
  onClose: () => void;
  onSave: (edit: BeatEdit | null) => void;
}

export function EditDialog({ open, beat, beatIndex, edited, onClose, onSave }: EditDialogProps) {
  const [narrative, setNarrative] = useState(beat.narrative);
  const [cue, setCue] = useState(beat.cue);

  // Sync fields whenever the dialog opens on a (possibly different) beat.
  useEffect(() => {
    if (open) {
      setNarrative(beat.narrative);
      setCue(beat.cue);
    }
  }, [open, beat.narrative, beat.cue]);

  const save = () => {
    onSave({ narrative, cue });
    onClose();
  };
  const revert = () => {
    onSave(null);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} labelledBy="editTitle">
      <h2 id="editTitle">Edit beat {beatIndex + 1}</h2>
      <p className="sub">
        Tweak the line or cue without a round-trip to GitHub. Overrides are saved on this device.
      </p>

      <div className="field">
        <label htmlFor="editLine">Line</label>
        <textarea
          id="editLine"
          rows={5}
          value={narrative}
          onChange={(e) => setNarrative(e.target.value)}
        />
      </div>

      <div className="field" style={{ marginTop: 12 }}>
        <label htmlFor="editCue">Stage cue</label>
        <textarea id="editCue" rows={2} value={cue} onChange={(e) => setCue(e.target.value)} />
      </div>

      <div className="row2" style={{ marginTop: 16 }}>
        <button type="button" className="btn" onClick={save}>
          Save edit
        </button>
        <button type="button" className="btn secondary" onClick={onClose}>
          Cancel
        </button>
      </div>
      {edited && (
        <div className="row2" style={{ marginTop: 10 }}>
          <button type="button" className="btn secondary" onClick={revert}>
            ↺ Revert to original
          </button>
        </div>
      )}
    </Dialog>
  );
}
